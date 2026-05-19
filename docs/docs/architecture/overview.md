---
id: overview
title: Visão Geral da Arquitetura
sidebar_label: Visão Geral
---

# Arquitetura

O Shift é construído sobre **Clean Architecture** com **Domain-Driven Design (DDD)**. As dependências sempre apontam para dentro — infraestrutura depende do domínio, nunca o contrário.

## Diagrama de Camadas

```
┌─────────────────────────────────────────────────────────────────┐
│                     API Gateway (Express)                        │
│   /api/settings  /api/tasks  /api/projects  /api/project-manager│
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                   Application Layer (Use Cases)                  │
│  GetSettings  SaveSettings  ListTasks  RetryTask  ProcessWebhook │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                     Orchestration Layer                          │
│         TaskOrchestrator ←→ AgentHarness ←→ ContextEngine       │
└──────┬───────────────────────────────────────┬──────────────────┘
       │                                       │
┌──────▼──────────┐                 ┌──────────▼──────────────────┐
│  Infrastructure │                 │     Infrastructure           │
│                 │                 │                              │
│  VCS API-first  │                 │  LangChainLLMAdapter         │
│  (sem clone)    │                 │  (OpenAI/Anthropic/Gemini)   │
│                 │                 │                              │
│  Docker         │                 │  CompositeMemoryAdapter      │
│  Containers     │                 │  (Mem0 + JSON local)         │
│  (efêmeros)     │                 │                              │
└─────────────────┘                 └─────────────────────────────┘
```

## Camadas

### Domain (`src/domain/`)

Núcleo do sistema. Sem dependências externas — apenas TypeScript puro.

- **Aggregates**: `TaskAggregate`, `ProjectAggregate`, `AgentExecutionAggregate`
- **Value Objects**: `TaskId`, `TaskStatus`, `BranchName`, `VCSProvider`
- **Ports (interfaces)**: `ITaskRepository`, `ISettingsRepository`, `ITaskQueue`, `ILLMPort`, `IMemoryPort`, `IContextPort`, `IVCSAdapter`, `IContainerRuntime`, `IProjectManagerAdapter`

### Application (`src/application/`)

Use cases — orquestram o domínio sem conhecer infraestrutura. Lançam `HttpError` diretamente para erros esperados.

```
application/
├── settings/         GetSettingsUseCase, SaveSettingsUseCase
├── tasks/            ListTasksUseCase, DeleteTaskUseCase, RetryTaskUseCase,
│                     StreamTaskLogsUseCase
├── projects/         ListProjectsUseCase, GetRepoStatusUseCase,
│                     IndexProjectUseCase, GetProjectContextUseCase,
│                     ClearProjectMemoryUseCase
└── project-manager/  GetPMConfigUseCase, GetMappingUseCase,
                      SaveMappingUseCase, ProcessWebhookUseCase,
                      SetupWebhookUseCase, GetProvidersUseCase
```

### Orchestration (`src/orchestration/`)

Motor de execução dos agentes. Coordena LLM, memória, VCS e ferramentas.

- **`TaskOrchestrator`** — fluxo completo de uma tarefa (contexto → modelo → execução → commit → feedback)
- **`AgentHarness`** — governança SDD: pre-flight, loop agentic, post-flight
- **`ContextEngine`** — indexação inteligente de projetos via LLM (sem buscas hard-coded)

### Infrastructure (`src/infrastructure/`)

Implementações concretas dos ports do domínio.

```
infrastructure/
├── persistence/      TypeOrmTaskRepository, TypeOrmSettingsRepository
├── queue/            BullMqTaskQueue, TaskWorker
├── llm/              LangChainLLMAdapter + providers
│                     (OpenAI, Anthropic, Gemini, Ollama, Azure)
├── memory/           CompositeMemoryAdapter
│                     (EpisodicMemory + ProceduralMemory)
├── vcs/              GitHubAdapter, AzureDevOpsAdapter, VCSAdapterRegistry
├── containers/       DockerContainerRuntime
├── project-manager/  JiraService/Adapter, AzureDevOpsService/Adapter
├── logging/          SSELogger
└── tunnel/           NgrokService
```

### API (`src/api/`)

Camada HTTP. Controllers recebem Request, delegam ao use case, serializam Response.

```
api/
├── controllers/   SettingsController, TasksController, ProjectsController,
│                  ProjectManagerController, HealthController, NgrokController
├── dtos/          Contratos de entrada/saída HTTP (snake_case para o frontend)
├── errors/        HttpError, BadRequestError, UnauthorizedError,
│                  NotFoundError, ConflictError, ServiceUnavailableError
├── middleware/    asyncHandler, errorHandler
└── router.ts      Monta todas as rotas
```

## Princípios de Design

### API-First VCS (sem clone local)

Repositórios **nunca são clonados permanentemente**. Todas as operações usam a API REST do provedor VCS:

- Leitura de arquivos → `IVCSAdapter.getFileContent()`
- Criação de branches → `IVCSAdapter.createBranch()`
- Commits atômicos → `IVCSAdapter.commitFiles()` (Git Data API)
- Pull Requests → `IVCSAdapter.openPullRequest()`

Para execução de código (testes, builds), containers Docker efêmeros são provisionados e destruídos após o uso.

### Sem Fluxos Hard-Coded

O LLM decide dinamicamente:
- Quais arquivos contêm specs/diretrizes do projeto
- Qual linguagem/framework/ferramentas o projeto usa
- Qual modelo LLM é mais adequado para a tarefa

### Agent Harness (Governança)

Cada execução passa por três fases:
1. **Pre-flight** — carrega contexto, seleciona modelo, verifica orçamento de tokens
2. **Execution** — loop agentic com tools auditadas e guardrails (MAX_ITERATIONS=25, MAX_TOKENS=200k)
3. **Post-flight** — valida resultado, atualiza memória, registra métricas

### Injeção de Dependência (tsyringe)

Classes concretas usam `@injectable()` e `@inject(TOKEN)`. O container resolve automaticamente via `useClass`. Apenas casos especiais usam `useFactory`.

```typescript
// Tokens são Symbols únicos — sem colisões
TOKENS.TaskRepository = Symbol.for('ITaskRepository')

// Registro
tsContainer.register(TOKENS.TaskRepository, { useClass: TypeOrmTaskRepository });

// Injeção
constructor(@inject(TOKENS.TaskRepository) private repo: ITaskRepository) {}
```

### Tratamento de Erros

Use cases lançam `HttpError` diretamente. O `asyncHandler` captura e o `errorHandler` serializa com o status HTTP correto — sem switch/if nos controllers.

```typescript
// Use case lança
if (!adapter) throw new ServiceUnavailableError('Adapter não registrado.');

// Controller expressa apenas o caminho feliz
const config = await this.getPMConfig.execute();
res.json(config);
```

## Fluxo de Dados

```
Webhook (Jira/Azure DevOps)
    │
    ▼
IProjectManagerAdapter.processWebhook()
    │  cria TaskAggregate + enfileira
    ▼
BullMQ Queue "agent-tasks"
    │
    ▼
TaskWorker (BullMQ Worker)
    │  delega
    ▼
TaskOrchestrator.processTask()
    ├── ContextEngine.indexProject()   (se necessário)
    ├── AgentHarness.selectModel()
    ├── AgentHarness.execute()         (loop agentic)
    │       ├── execute_terminal_command
    │       ├── write_file
    │       └── read_file_from_vcs
    ├── IVCSAdapter.commitFiles()
    ├── IProjectManagerAdapter.addComment()
    └── IMemoryPort.storeExecutionContext()
```
