/**
 * router.ts — Composição das rotas da API.
 *
 * Responsabilidade única: mapear verbos HTTP + paths para métodos de controller.
 * Sem lógica de negócio — apenas wiring.
 *
 * Organização das rotas:
 *   /settings                              — Configurações da aplicação
 *   /repos/status                          — Status de indexação (compatibilidade frontend)
 *   /projects                              — Projetos e indexação de contexto
 *   /project-manager/providers             — Lista provedores disponíveis
 *   /project-manager/config                — Config do PM ativo
 *   /project-manager/mapping               — Mapeamento do PM ativo
 *   /project-manager/webhook               — Webhook agnóstico (provedor ativo)
 *   /project-manager/:provider/webhook     — Webhook por provedor específico
 *   /project-manager/:provider/config      — Config por provedor específico
 *   /project-manager/:provider/mapping     — Mapeamento por provedor específico
 *   /project-manager/:provider/setup-webhook — Registra webhook no provedor
 *   /tasks                                 — Gerenciamento de tarefas
 *   /ngrok-url                             — URL pública do Ngrok
 */

import { Router } from 'express';
import { asyncHandler } from './middleware/asyncHandler';

// Controllers
import { SettingsController } from './controllers/SettingsController';
import { TasksController } from './controllers/TasksController';
import { ProjectsController } from './controllers/ProjectsController';
import { ProjectManagerController } from './controllers/ProjectManagerController';
import { NgrokController } from './controllers/NgrokController';

// Use Cases
import { GetSettingsUseCase } from '../application/settings/GetSettingsUseCase';
import { SaveSettingsUseCase } from '../application/settings/SaveSettingsUseCase';
import { ListTasksUseCase } from '../application/tasks/ListTasksUseCase';
import { DeleteTaskUseCase } from '../application/tasks/DeleteTaskUseCase';
import { RetryTaskUseCase } from '../application/tasks/RetryTaskUseCase';
import { StreamTaskLogsUseCase } from '../application/tasks/StreamTaskLogsUseCase';
import { ListProjectsUseCase } from '../application/projects/ListProjectsUseCase';
import { GetRepoStatusUseCase } from '../application/projects/GetRepoStatusUseCase';
import { IndexProjectUseCase } from '../application/projects/IndexProjectUseCase';
import { GetProjectContextUseCase } from '../application/projects/GetProjectContextUseCase';
import { ClearProjectMemoryUseCase } from '../application/projects/ClearProjectMemoryUseCase';
import { ListGitRepositoriesUseCase } from '../application/projects/ListGitRepositoriesUseCase';
import { ValidateGitConnectionUseCase } from '../application/projects/ValidateGitConnectionUseCase';
import { GetProvidersUseCase } from '../application/project-manager/GetProvidersUseCase';
import { GetPMConfigUseCase } from '../application/project-manager/GetPMConfigUseCase';
import { GetMappingUseCase } from '../application/project-manager/GetMappingUseCase';
import { SaveMappingUseCase } from '../application/project-manager/SaveMappingUseCase';
import { ProcessWebhookUseCase } from '../application/project-manager/ProcessWebhookUseCase';
import { SetupWebhookUseCase } from '../application/project-manager/SetupWebhookUseCase';

// Infraestrutura
import { container } from '../bootstrap/container';
import { logEmitter } from '../infrastructure/logging/LogEmitter';

// ─── Instanciação dos use cases ───────────────────────────────────────────────

const getSettingsUC = new GetSettingsUseCase(container.settingsRepo);
const saveSettingsUC = new SaveSettingsUseCase(container.settingsRepo, container.projectManagerRegistry);

const listTasksUC = new ListTasksUseCase(container.taskRepo);
const deleteTaskUC = new DeleteTaskUseCase(container.taskRepo, container.taskQueuePort);
const retryTaskUC = new RetryTaskUseCase(container.taskRepo, container.taskQueuePort);
const streamLogsUC = new StreamTaskLogsUseCase(container.taskRepo, logEmitter);

const listProjectsUC = new ListProjectsUseCase(container.settingsRepo, container.memoryAdapter);
const getRepoStatusUC = new GetRepoStatusUseCase(container.settingsRepo, container.memoryAdapter);
const indexProjectUC = new IndexProjectUseCase(container.settingsRepo, container.contextEngine);
const getContextUC = new GetProjectContextUseCase(container.memoryAdapter);
const clearMemoryUC = new ClearProjectMemoryUseCase(container.memoryAdapter);
const listGitReposUC = new ListGitRepositoriesUseCase(container.settingsRepo, container.memoryAdapter);
const validateGitUC = new ValidateGitConnectionUseCase(container.settingsRepo);

const getProvidersUC = new GetProvidersUseCase(container.projectManagerRegistry);
const getPMConfigUC = new GetPMConfigUseCase(container.settingsRepo, container.projectManagerRegistry);
const getMappingUC = new GetMappingUseCase(container.settingsRepo, container.projectManagerRegistry);
const saveMappingUC = new SaveMappingUseCase(container.settingsRepo, container.projectManagerRegistry);
const processWebhookUC = new ProcessWebhookUseCase(container.settingsRepo, container.projectManagerRegistry);
const setupWebhookUC = new SetupWebhookUseCase(container.projectManagerRegistry);

// ─── Instanciação dos controllers ────────────────────────────────────────────

const settings = new SettingsController(getSettingsUC, saveSettingsUC);
const tasks = new TasksController(listTasksUC, deleteTaskUC, retryTaskUC, streamLogsUC, logEmitter);
const projects = new ProjectsController(listProjectsUC, getRepoStatusUC, indexProjectUC, getContextUC, clearMemoryUC, listGitReposUC, validateGitUC);
const pm = new ProjectManagerController(getProvidersUC, getPMConfigUC, getMappingUC, saveMappingUC, processWebhookUC, setupWebhookUC);
const ngrok = new NgrokController();

// ─── Montagem das rotas ───────────────────────────────────────────────────────

const router = Router();

// Settings
router.get('/settings', asyncHandler(settings.get.bind(settings)));
router.post('/settings', asyncHandler(settings.save.bind(settings)));

// Repos status (compatibilidade com frontend)
router.get('/repos/status', asyncHandler(projects.repoStatus.bind(projects)));

// Projects
router.get('/projects', asyncHandler(projects.list.bind(projects)));
router.get('/projects/:prefix/index', asyncHandler(projects.index.bind(projects)));
router.post('/projects/:prefix/index', asyncHandler(projects.index.bind(projects)));
router.get('/projects/:prefix/context', asyncHandler(projects.getContext.bind(projects)));
router.delete('/projects/:prefix/memory', asyncHandler(projects.clearMemory.bind(projects)));

// Git repositories (lista repos acessíveis via PAT)
router.get('/git/repositories', asyncHandler(projects.listGitRepositories.bind(projects)));
router.get('/git/validate', asyncHandler(projects.validateGit.bind(projects)));

// ─── Project Manager — rotas agnósticas ──────────────────────────────────────
//
// Todas as operações de PM passam por aqui. O provedor ativo é determinado
// pela configuração `project_manager` nas settings (padrão: 'jira').
//
// Rotas com :provider permitem operar em um provedor específico sem alterar
// a configuração global — útil para multi-tenant ou testes.

// Metadados
router.get('/project-manager/providers', pm.providers.bind(pm));

// Operações no provedor ativo
router.get('/project-manager/config', asyncHandler(pm.config.bind(pm)));
router.get('/project-manager/mapping', asyncHandler(pm.mapping.bind(pm)));
router.post('/project-manager/mapping', asyncHandler(pm.saveMap.bind(pm)));

// Webhook agnóstico (usa o provedor ativo)
router.get('/project-manager/webhook', pm.webhookHealth.bind(pm));
router.post('/project-manager/webhook', asyncHandler(pm.webhook.bind(pm)));

// Operações por provedor específico (:provider = 'jira' | 'azure-devops' | ...)
router.get('/project-manager/:provider/webhook', pm.webhookHealth.bind(pm));
router.post('/project-manager/:provider/webhook', asyncHandler(pm.providerWebhook.bind(pm)));
router.get('/project-manager/:provider/config', asyncHandler(pm.providerConfig.bind(pm)));
router.get('/project-manager/:provider/mapping', asyncHandler(pm.providerMapping.bind(pm)));
router.post('/project-manager/:provider/mapping', asyncHandler(pm.saveProviderMapping.bind(pm)));
router.post('/project-manager/:provider/setup-webhook', asyncHandler(pm.providerSetupWebhook.bind(pm)));

// Tasks
router.get('/tasks', asyncHandler(tasks.list.bind(tasks)));
router.get('/tasks/:id/logs/stream', asyncHandler(tasks.streamTaskLogs.bind(tasks)));
router.delete('/tasks/:id', asyncHandler(tasks.delete.bind(tasks)));
router.post('/tasks/:id/retry', asyncHandler(tasks.retry.bind(tasks)));

// Ngrok
router.get('/ngrok-url', ngrok.getUrl.bind(ngrok));

export default router;
