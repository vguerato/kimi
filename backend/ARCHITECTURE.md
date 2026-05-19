# Shift Backend v2 — Arquitetura

## Visão Geral

O backend v2 é uma aplicação corporativa de agentes de IA para automação de tarefas de desenvolvimento. Ele recebe tarefas de gerenciadores de projetos (Jira, Azure DevOps), executa-as autonomamente usando LLMs, e commita o resultado diretamente no repositório via API VCS — sem clonar código localmente.

```
┌─────────────────────────────────────────────────────────────────┐
│                        API Gateway (Express)                     │
│         /api/tasks  /api/projects  /api/webhook  /api/settings  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                     Orchestration Layer                          │
│                                                                  │
│   TaskOrchestrator ──────────────── AgentHarness                │
│   (fluxo dinâmico)                  (governança SDD)            │
│         │                                  │                    │
│         └──────────── ContextEngine ───────┘                    │
│                       (indexação LLM)                           │
└──────┬───────────────────────────────────────┬──────────────────┘
       │                                       │
┌──────▼──────────┐                 ┌──────────▼──────────────────┐
│  Code Execution │                 │     Intelligence Layer       │
│                 │                 │                              │
│  VCS API-first  │                 │  LangChainLLMAdapter         │
│  (sem clone)    │                 │  (OpenAI/Anthropic/Gemini)   │
│                 │                 │                              │
│  Docker         │                 │  CompositeMemoryAdapter      │
│  Containers     │                 │  (Mem0 + fallback local)     │
│  (efêmeros)     │                 │                              │
└─────────────────┘                 └─────────────────────────────┘
```

---

## Princípios de Design

### 1. API-First VCS (sem clone local)
Repositórios **nunca são clonados permanentemente**. Todas as operações de leitura e escrita usam a API REST do provedor VCS:
- Leitura de arquivos → `IVCSAdapter.getFileContent()`
- Criação de branches → `IVCSAdapter.createBranch()`
- Commits atômicos → `IVCSAdapter.commitFiles()` (Git Data API)
- Pull Requests → `IVCSAdapter.openPullRequest()`

Para execução de código (testes, builds), containers Docker efêmeros são provisionados sob demanda e destruídos após o uso.

### 2. Sem Fluxos Hard-Coded
O sistema **nunca busca arquivos por padrão fixo**. O LLM decide:
- Quais arquivos contêm specs/diretrizes do projeto
- Qual linguagem/framework/ferramentas o projeto usa
- Qual modelo LLM é mais adequado para a tarefa
- Quais passos executar para completar a tarefa

### 3. Agent Harness (Governança)
Cada execução de agente passa por três fases:
- **Pre-flight**: carrega contexto, seleciona modelo, verifica orçamento
- **Execution**: loop agentic com tools auditadas e guardrails
- **Post-flight**: valida resultado, atualiza memória, registra métricas

### 4. Memória em Camadas
```
L1 — Mem0 (episódica): "O que o agente fez neste projeto antes"
L2 — Fallback local (JSON): quando Mem0 não está disponível
```

---

## Estrutura de Pastas

```
src/
├── domain/                    # Lógica de negócio pura (sem dependências externas)
│   ├── task/                  # Aggregate Task + value objects + ports
│   ├── project/               # Aggregate Project + VCSProvider + ports
│   ├── agent/                 # AgentExecution + ports (LLM, Memory, Context, Container)
│   ├── settings/              # Port ISettingsRepository
│   └── project-manager/       # Port IProjectManagerAdapter + tipos agnósticos
│
├── application/               # Casos de uso (orquestram o domínio)
│
├── infrastructure/            # Implementações concretas dos ports
│   ├── vcs/                   # GitHubAdapter, AzureDevOpsAdapter, VCSAdapterRegistry
│   ├── llm/                   # LangChainLLMAdapter (OpenAI/Anthropic/Gemini/Ollama)
│   ├── memory/                # CompositeMemoryAdapter (Mem0 + fallback local)
│   ├── containers/            # DockerContainerRuntime
│   ├── persistence/           # TypeOrmTaskRepository, TypeOrmSettingsRepository
│   ├── queue/                 # BullMqTaskQueue
│   ├── logging/               # LogEmitter (SSE)
│   └── project-manager/       # ProjectManagerRegistry
│
├── orchestration/             # Motor de orquestração
│   ├── TaskOrchestrator.ts    # Fluxo dinâmico de execução de tarefas
│   ├── AgentHarness.ts        # Governança SDD (pre/exec/post-flight)
│   └── ContextEngine.ts       # Indexação e recuperação de contexto via LLM
│
├── bootstrap/
│   └── container.ts           # Composição de dependências (DI manual)
│
├── workers/
│   └── TaskWorker.ts          # Adaptador BullMQ → TaskOrchestrator
│
├── routes/
│   └── api.ts                 # Rotas REST
│
└── config/
    ├── database.ts            # TypeORM DataSource
    └── logger.ts              # Pino logger
```

---

## Fluxo de uma Tarefa

```
1. Webhook recebido (Jira/Azure DevOps)
        │
        ▼
2. IProjectManagerAdapter.processWebhook()
   → Cria TaskAggregate + enfileira via ITaskQueue
        │
        ▼
3. BullMQ Worker recebe o job
   → Delega ao TaskOrchestrator
        │
        ▼
4. TaskOrchestrator.processTask():
   a. Carrega configurações (ISettingsRepository)
   b. Verifica/indexa contexto do projeto (ContextEngine)
   c. Seleciona modelo (AgentHarness.selectModel)
   d. Cria branch via VCS API (IVCSAdapter)
   e. Clona para /tmp temporário
   f. Executa AgentHarness.execute() com tools
   g. Commita arquivos modificados via VCS API
   h. Atualiza project manager (addComment, updateStatus)
   i. Armazena contexto na memória (IMemoryPort)
        │
        ▼
5. AgentHarness.execute():
   a. Pre-flight: carrega contexto do projeto
   b. Loop agentic: LLM ↔ tools (terminal, write_file, read_vcs)
   c. Post-flight: registra métricas
```

---

## Adicionando um Novo Provedor VCS

1. Implemente `IVCSAdapter` em `infrastructure/vcs/`
2. Registre no `VCSAdapterRegistry`:
   ```typescript
   this.factories.set('gitlab', (token) => new GitLabAdapter(token));
   ```
3. Adicione o tipo em `VCSProvider.ts`

Nenhuma outra mudança necessária.

---

## Adicionando um Novo Provedor LLM

O `LangChainLLMAdapter` detecta provedores por variáveis de ambiente. Para adicionar um novo:

1. Adicione a configuração em `buildProviderConfigs()` no `LangChainLLMAdapter.ts`
2. Defina a variável de ambiente correspondente no `.env`

---

## Adicionando um Novo Gerenciador de Projetos

1. Implemente `IProjectManagerAdapter` em `infrastructure/project-manager/` ou `services/project-manager/`
2. Registre no container:
   ```typescript
   projectManagerRegistry.register('linear', new LinearAdapter(linearService));
   ```
3. Adicione o tipo em `ProjectManagerType`
