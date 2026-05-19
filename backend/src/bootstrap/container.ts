/**
 * container.ts — Composição de dependências com tsyringe.
 *
 * Usa as annotations do tsyringe (@injectable, @inject) nas classes concretas,
 * permitindo que o container resolva a maioria das dependências automaticamente
 * via `useClass`. Apenas casos especiais precisam de `useFactory` ou `useValue`:
 *
 *   useClass   → classes com @injectable e @inject nos construtores (maioria)
 *   useValue   → singletons externos já instanciados (DataSource, Queue, Redis)
 *   useFactory → lógica de construção que não cabe em um construtor simples
 *                (ex: VCSAdapterResolver que resolve o provedor em runtime)
 *
 * Tokens disponíveis para injeção em testes (definidos em tokens.ts):
 *   TOKENS.TaskRepository, TOKENS.SettingsRepository, TOKENS.TaskQueue,
 *   TOKENS.Memory, TOKENS.Context, TOKENS.LLM, TOKENS.VCSAdapter,
 *   TOKENS.ProjectManagerRegistry, TOKENS.AgentHarness, TOKENS.TaskOrchestrator
 *
 * Ordem de registro:
 *   1. Valores externos (DataSource, Queue, Redis)
 *   2. Infraestrutura (repositórios, fila, memória, LLM, VCS)
 *   3. Orquestração (ContextEngine, AgentHarness, TaskOrchestrator)
 *   4. Project Manager (Registry, JiraService, JiraAdapter)
 */

import 'reflect-metadata';
import { container as tsContainer, instanceCachingFactory } from 'tsyringe';
import IORedis from 'ioredis';
import { Queue } from 'bullmq';
import { AppDataSource } from '../config/database';

// Infraestrutura
import { TypeOrmTaskRepository } from '../infrastructure/persistence/TypeOrmTaskRepository';
import { TypeOrmSettingsRepository } from '../infrastructure/persistence/TypeOrmSettingsRepository';
import { CompositeMemoryAdapter } from '../infrastructure/memory/CompositeMemoryAdapter';
import { DockerContainerRuntime } from '../infrastructure/containers/DockerContainerRuntime';
import { LangChainLLMAdapter } from '../infrastructure/llm/LangChainLLMAdapter';
import { BullMqTaskQueue } from '../infrastructure/queue/BullMqTaskQueue';
import { vcsRegistry } from '../infrastructure/vcs/VCSAdapterRegistry';
import { ProjectManagerRegistry } from '../infrastructure/project-manager/ProjectManagerRegistry';
import { JiraService } from '../infrastructure/project-manager/jira/JiraService';
import { JiraAdapter } from '../infrastructure/project-manager/jira/JiraAdapter';
import { AzureDevOpsService } from '../infrastructure/project-manager/azure-devops/AzureDevOpsService';
import { AzureDevOpsAdapter } from '../infrastructure/project-manager/azure-devops/AzureDevOpsAdapter';

// Orquestração
import { ContextEngine } from '../orchestration/ContextEngine';
import { AgentHarness } from '../orchestration/AgentHarness';
import { TaskOrchestrator } from '../orchestration/TaskOrchestrator';

// Tipos
import { IVCSAdapter } from '../domain/project/ports/IVCSAdapter';
import { logger } from '../config/logger';
import { TOKENS } from './tokens';

export { TOKENS };

const log = logger.child({ module: 'container' });

// ─── 1. Valores externos (singletons já instanciados) ─────────────────────────

/**
 * Conexão Redis única — compartilhada entre Queue e Worker.
 * Exportada para que o TaskWorker use a mesma instância.
 */
export const redisConnection = new IORedis(
  process.env.REDIS_URL ?? 'redis://localhost:6379',
  { maxRetriesPerRequest: null },
);

/**
 * Queue BullMQ — instância única.
 * Exportada para que o TaskWorker use a mesma instância.
 */
export const rawTaskQueue = new Queue('agent-tasks', { connection: redisConnection });

// Registra os valores externos como tokens para injeção
tsContainer.register(TOKENS.DataSource, { useValue: AppDataSource });
tsContainer.register(TOKENS.TaskQueue_Raw, { useValue: rawTaskQueue });

// ─── 2. Infraestrutura — useClass (resolvido automaticamente via @inject) ─────

tsContainer.register(TOKENS.TaskRepository, { useClass: TypeOrmTaskRepository });
tsContainer.register(TOKENS.SettingsRepository, { useClass: TypeOrmSettingsRepository });
tsContainer.register(TOKENS.TaskQueue, { useClass: BullMqTaskQueue });
tsContainer.register(TOKENS.Memory, { useClass: CompositeMemoryAdapter });
tsContainer.register(TOKENS.ContainerRuntime, { useClass: DockerContainerRuntime });
tsContainer.register(TOKENS.LLM, { useClass: LangChainLLMAdapter });

// ─── 3. VCS Adapter Resolver — useFactory (lógica de runtime) ────────────────
//
// O VCSAdapterResolver não é uma classe simples: ele precisa resolver o provedor
// correto em runtime baseado na URL do repositório. Não cabe em um construtor
// com @inject — por isso usa useFactory com instanceCachingFactory.

tsContainer.register(TOKENS.VCSAdapter, {
  useFactory: instanceCachingFactory((): IVCSAdapter => {
    const settingsRepo = tsContainer.resolve<TypeOrmSettingsRepository>(TOKENS.SettingsRepository);

    const resolveAdapter = async (repoUrl: string) => {
      const token = (await settingsRepo.findOne('git_pat')) ?? '';
      return vcsRegistry.getForUrl(repoUrl, token);
    };

    return {
      providerType: 'resolver',
      async getRepositoryMetadata(repoUrl) { return (await resolveAdapter(repoUrl)).getRepositoryMetadata(repoUrl); },
      async listFiles(repoUrl, path, ref) { return (await resolveAdapter(repoUrl)).listFiles(repoUrl, path, ref); },
      async getFileContent(repoUrl, filePath, ref) { return (await resolveAdapter(repoUrl)).getFileContent(repoUrl, filePath, ref); },
      async getMultipleFiles(repoUrl, paths, ref) { return (await resolveAdapter(repoUrl)).getMultipleFiles(repoUrl, paths, ref); },
      async createBranch(repoUrl, branchName, fromRef) { return (await resolveAdapter(repoUrl)).createBranch(repoUrl, branchName, fromRef); },
      async branchExists(repoUrl, branchName) { return (await resolveAdapter(repoUrl)).branchExists(repoUrl, branchName); },
      async commitFiles(repoUrl, branch, files, message) { return (await resolveAdapter(repoUrl)).commitFiles(repoUrl, branch, files, message); },
      async openPullRequest(repoUrl, title, body, headBranch, baseBranch) { return (await resolveAdapter(repoUrl)).openPullRequest(repoUrl, title, body, headBranch, baseBranch); },
      async validateAccess(repoUrl) { return (await resolveAdapter(repoUrl)).validateAccess(repoUrl); },
    };
  }),
});

// ─── 4. Orquestração — useClass ───────────────────────────────────────────────

tsContainer.register(TOKENS.ProjectManagerRegistry, { useClass: ProjectManagerRegistry });
tsContainer.register(TOKENS.Context, { useClass: ContextEngine });
tsContainer.register(TOKENS.AgentHarness, { useClass: AgentHarness });

// ─── 5. TaskOrchestrator — useFactory ────────────────────────────────────────
//
// TaskOrchestrator recebe OrchestratorDependencies (objeto com 6 campos),
// não dependências individuais. A factory monta esse objeto explicitamente.

tsContainer.register(TOKENS.TaskOrchestrator, {
  useFactory: instanceCachingFactory(() => new TaskOrchestrator({
    taskRepo: tsContainer.resolve(TOKENS.TaskRepository),
    settingsRepo: tsContainer.resolve(TOKENS.SettingsRepository),
    memory: tsContainer.resolve(TOKENS.Memory),
    context: tsContainer.resolve(TOKENS.Context),
    harness: tsContainer.resolve(TOKENS.AgentHarness),
    getProjectManagerAdapter: async () => {
      const registry = tsContainer.resolve<ProjectManagerRegistry>(TOKENS.ProjectManagerRegistry);
      const settingsRepo = tsContainer.resolve<TypeOrmSettingsRepository>(TOKENS.SettingsRepository);
      const type = (await settingsRepo.findOne('project_manager')) ?? 'jira';
      const adapter = registry.adapters.get(type);
      if (!adapter) {
        log.warn({ type }, 'Adapter não encontrado — usando Jira');
        const jira = registry.adapters.get('jira');
        if (!jira) throw new Error('Nenhum adapter de project manager registrado');
        return jira;
      }
      return adapter;
    },
  })),
});

// ─── 6. Project Manager — useClass ───────────────────────────────────────────

tsContainer.register(TOKENS.JiraService, { useClass: JiraService });
tsContainer.register(TOKENS.JiraAdapter, { useClass: JiraAdapter });
tsContainer.register(TOKENS.AzureDevOpsService, { useClass: AzureDevOpsService });
tsContainer.register(TOKENS.AzureDevOpsAdapter, { useClass: AzureDevOpsAdapter });

// ─── Inicialização assíncrona ─────────────────────────────────────────────────

async function initProjectManagerAdapters(): Promise<void> {
  const registry = tsContainer.resolve<ProjectManagerRegistry>(TOKENS.ProjectManagerRegistry);
  const jiraAdapter = tsContainer.resolve<JiraAdapter>(TOKENS.JiraAdapter);
  const azureAdapter = tsContainer.resolve<AzureDevOpsAdapter>(TOKENS.AzureDevOpsAdapter);

  registry.register('jira', jiraAdapter);
  registry.register('azure-devops', azureAdapter);
  log.info('Adapters de project manager registrados (jira, azure-devops)');
}

export async function initializeContainer(): Promise<void> {
  log.info('Inicializando container de dependências...');

  const memory = tsContainer.resolve<CompositeMemoryAdapter>(TOKENS.Memory);
  await memory.initialize();

  await initProjectManagerAdapters();

  log.info('Container de dependências inicializado');
}

// ─── Atalhos de acesso (compatibilidade com código existente) ─────────────────

export const taskRepo = tsContainer.resolve<TypeOrmTaskRepository>(TOKENS.TaskRepository);
export const settingsRepo = tsContainer.resolve<TypeOrmSettingsRepository>(TOKENS.SettingsRepository);
export const taskQueuePort = tsContainer.resolve<BullMqTaskQueue>(TOKENS.TaskQueue);
export const memoryAdapter = tsContainer.resolve<CompositeMemoryAdapter>(TOKENS.Memory);
export const containerRuntime = tsContainer.resolve<DockerContainerRuntime>(TOKENS.ContainerRuntime);
export const contextEngine = tsContainer.resolve<ContextEngine>(TOKENS.Context);
export const agentHarness = tsContainer.resolve<AgentHarness>(TOKENS.AgentHarness);
export const taskOrchestrator = tsContainer.resolve<TaskOrchestrator>(TOKENS.TaskOrchestrator);
export const projectManagerRegistry = tsContainer.resolve<ProjectManagerRegistry>(TOKENS.ProjectManagerRegistry);

export const container = {
  taskRepo,
  settingsRepo,
  taskQueuePort,
  memoryAdapter,
  containerRuntime,
  contextEngine,
  agentHarness,
  taskOrchestrator,
  projectManagerRegistry,
};
