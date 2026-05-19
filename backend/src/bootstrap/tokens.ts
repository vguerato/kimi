/**
 * tokens.ts — Tokens de injeção de dependência para tsyringe.
 *
 * Por que Symbol.for() em vez de string?
 *   Strings são globais e podem colidir se dois módulos registrarem o mesmo
 *   token acidentalmente. `Symbol.for('X')` é único por nome no registry global
 *   — sem colisões entre módulos, sem bugs silenciosos de DI.
 *
 * Por que um arquivo separado?
 *   Os tokens são importados tanto pelo container (para registrar) quanto
 *   pelas classes (para @inject). Centralizar evita dependências circulares.
 *
 * Uso:
 *   // Registrar (container.ts)
 *   tsContainer.register(TOKENS.TaskRepository, { useClass: TypeOrmTaskRepository });
 *
 *   // Injetar via decorator
 *   constructor(@inject(TOKENS.TaskRepository) private repo: ITaskRepository) {}
 *
 *   // Resolver manualmente (testes ou bootstrap)
 *   const repo = tsContainer.resolve<ITaskRepository>(TOKENS.TaskRepository);
 */

export const TOKENS = {
    // Repositórios
    TaskRepository: Symbol.for('ITaskRepository'),
    SettingsRepository: Symbol.for('ISettingsRepository'),

    // Fila
    TaskQueue: Symbol.for('ITaskQueue'),

    // Memória e contexto
    Memory: Symbol.for('IMemoryPort'),
    Context: Symbol.for('IContextPort'),

    // LLM e VCS
    LLM: Symbol.for('ILLMPort'),
    VCSAdapter: Symbol.for('IVCSAdapter'),

    // Infraestrutura
    ContainerRuntime: Symbol.for('IContainerRuntime'),
    DataSource: Symbol.for('DataSource'),
    TaskQueue_Raw: Symbol.for('Queue<agent-tasks>'),
    LLMProviderRegistry: Symbol.for('LLMProviderRegistry'),

    // Orquestração
    ProjectManagerRegistry: Symbol.for('ProjectManagerRegistry'),
    AgentHarness: Symbol.for('AgentHarness'),
    TaskOrchestrator: Symbol.for('TaskOrchestrator'),

    // Project Manager
    JiraService: Symbol.for('JiraService'),
    JiraAdapter: Symbol.for('JiraAdapter'),
    AzureDevOpsService: Symbol.for('AzureDevOpsService'),
    AzureDevOpsAdapter: Symbol.for('AzureDevOpsAdapter'),
} as const;

/** Tipo utilitário para os valores dos tokens. */
export type TokenKey = keyof typeof TOKENS;
