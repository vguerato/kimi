---
id: components
title: Componentes
sidebar_label: Componentes
---

# Componentes

## TaskOrchestrator

**`src/orchestration/TaskOrchestrator.ts`**

Orquestrador central de execução de tarefas. Recebe `OrchestratorDependencies` via construtor (objeto com `taskRepo`, `settingsRepo`, `memory`, `context`, `harness`, `getProjectManagerAdapter`).

**Responsabilidades:**
1. Atualiza status da tarefa para `processando`
2. Carrega configurações (PAT, mapeamento de repositórios)
3. Verifica/indexa contexto do projeto via `ContextEngine`
4. Seleciona o modelo LLM via `AgentHarness.selectModel()`
5. Cria branch no VCS se não existir
6. Clona o repositório em `/tmp/shift-tasks/{taskId}` (temporário)
7. Executa o agente via `AgentHarness.execute()` com tools dinâmicas
8. Commita arquivos modificados via VCS API
9. Armazena contexto de execução na memória
10. Envia feedback ao project manager (comentário + transição de status)
11. Limpa o diretório temporário

**Tools disponíveis para o agente:**

| Tool | Descrição |
|---|---|
| `execute_terminal_command` | Executa bash no diretório do repositório (timeout: 60s) |
| `write_file` | Escreve arquivo com proteção contra path traversal |
| `read_file_from_vcs` | Lê arquivo via API VCS sem precisar do clone |

---

## AgentHarness

**`src/orchestration/AgentHarness.ts`**

Camada de governança para execução de agentes. Implementa a metodologia **Agent Harness** com SDD (Spec-Driven Development).

**Fases:**
- **Pre-flight** — carrega contexto do projeto, seleciona modelo
- **Execution** — loop agentic (máx. 25 iterações, máx. 200k tokens)
- **Post-flight** — registra métricas

**Seleção de modelo:** usa o modelo mais rápido disponível para analisar a complexidade da tarefa e escolher o modelo ideal.

---

## ContextEngine

**`src/orchestration/ContextEngine.ts`**

Motor de indexação inteligente de projetos. **Não usa buscas hard-coded** — o LLM identifica quais arquivos são relevantes.

**Fluxo de indexação:**
1. Lista arquivos do repositório via VCS API (2 níveis de profundidade)
2. Envia lista ao LLM: "Quais arquivos contêm specs, diretrizes, configurações?"
3. Busca conteúdo dos arquivos identificados (máx. 20 arquivos, 8k chars cada)
4. LLM sintetiza `ProjectContextMemory` estruturado
5. Persiste na memória para uso futuro

**Re-indexação:** disparada na primeira interação, quando o contexto está stale, ou via `POST /api/projects/:prefix/index`.

---

## CompositeMemoryAdapter

**`src/infrastructure/memory/CompositeMemoryAdapter.ts`**

Orquestra duas camadas de memória com estratégia **dual-write** — toda memória é escrita em ambas as camadas disponíveis.

### EpisodicMemory (Mem0)

- Armazena execuções passadas como texto para busca semântica
- Backend: Mem0 Cloud (`MEM0_API_KEY`) ou Mem0 OSS (`MEM0_BASE_URL`)
- Fallback silencioso se não configurado

### ProceduralMemory (JSON local)

- Fonte de verdade para objetos estruturados (`ProjectContextMemory`)
- Fallback quando Mem0 não está disponível
- Persiste em `/app/data/memory.json`
- Circular buffer: máx. 50 execuções por repositório

**Estratégia de leitura:**
- Busca semântica → Mem0 primeiro, fallback para ProceduralMemory
- Contexto de projeto → sempre ProceduralMemory (objetos tipados)

---

## LangChainLLMAdapter

**`src/infrastructure/llm/LangChainLLMAdapter.ts`**

Implementa `ILLMPort` usando o padrão Registry. Detecta automaticamente o provedor ativo pelas variáveis de ambiente.

**Provedores (ordem de prioridade):**

| Provedor | Env var | Modelo padrão |
|---|---|---|
| OpenAI | `OPENAI_API_KEY` | `gpt-4o` |
| Anthropic | `ANTHROPIC_API_KEY` | `claude-opus-4-5` |
| Azure OpenAI | `AZURE_OPENAI_API_KEY` | configurável |
| Gemini | `GEMINI_API_KEY` | `gemini-2.5-flash` |
| Ollama | `OLLAMA_BASE_URL` | `llama3.2` |

Para forçar um provedor: `LLM_PROVIDER=gemini`

**Retry automático:** backoff exponencial em rate limit (429), até 5 tentativas.

---

## VCS Adapters

**`src/infrastructure/vcs/`**

Implementam `IVCSAdapter` — todas as operações via API REST, sem clone local.

### GitHubAdapter

- Autenticação: PAT via header `Authorization: token {PAT}`
- Commits atômicos via Git Data API (blobs → tree → commit → ref)
- Detectado por URLs `github.com`

### AzureDevOpsAdapter (VCS)

- Autenticação: Basic Auth com PAT (`:PAT`)
- Commits via Push API
- Detectado por URLs `dev.azure.com` ou `visualstudio.com`

### VCSAdapterRegistry

Detecta o provedor correto pela URL do repositório. O token é lido das settings em runtime.

---

## Project Manager Adapters

### JiraAdapter + JiraService

**`src/infrastructure/project-manager/jira/`**

**Credenciais nas settings:** `jira_url`, `jira_email`, `jira_token`

**Funcionalidades:**
- Processa webhooks `jira:issue_updated`
- Converte descrições ADF (Atlassian Document Format) para texto plano
- Suporta validação HMAC via `jira_webhook_secret`
- Enfileira subtasks elegíveis baseado no mapping configurado

**Convenção de repositório:** título do issue deve conter `[repo-prefix]`:
```
[payments] Adicionar endpoint de reembolso
```

### AzureDevOpsAdapter + AzureDevOpsService

**`src/infrastructure/project-manager/azure-devops/`**

**Credenciais nas settings:** `azure_devops_org`, `azure_devops_project`, `azure_devops_token`

**Funcionalidades:**
- Processa webhooks `workitem.updated` (Service Hooks)
- Busca work item completo com relações para encontrar o pai
- Tags configuráveis (separadas por `;`)
- Cria Service Hook subscriptions via `/_apis/hooks/subscriptions`

---

## SSELogger

**`src/infrastructure/logging/SSELogger.ts`**

Emissor de logs em tempo real para Server-Sent Events.

- Buffer circular por `taskId` (máx. 500 entradas)
- Emite eventos `log:{taskId}` para clientes SSE conectados
- Limpeza automática após conclusão da tarefa

**Níveis:** `info` | `tool` | `error` | `system` | `warn`

---

## DockerContainerRuntime

**`src/infrastructure/containers/DockerContainerRuntime.ts`**

Provisiona containers efêmeros para execução de código.

**Configuração Docker Compose:**
```yaml
volumes:
  - /var/run/docker.sock:/var/run/docker.sock
```

**Segurança:**
- Containers sem privilégios (`--no-new-privileges`)
- Rede isolada (`NetworkMode: none`)
- TTL automático (padrão: 5 minutos)
- Labels `shift.managed=true` para identificação

---

## NgrokService

**`src/infrastructure/tunnel/NgrokService.ts`**

Gerencia o tunnel Ngrok para exposição local de webhooks.

- Ativado apenas se `NGROK_AUTHTOKEN` estiver definido
- Registra a URL pública em `shared/ngrok-state.ts`
- Expõe `start()` e `stop()` para o bootstrap

---

## Hierarquia de Erros HTTP

**`src/api/errors/HttpError.ts`**

Use cases lançam diretamente — sem Result types, sem switch nos controllers.

| Classe | Status | Quando |
|---|---|---|
| `BadRequestError` | 400 | Entrada inválida do cliente |
| `UnauthorizedError` | 401 | Assinatura HMAC inválida |
| `NotFoundError` | 404 | Recurso não encontrado |
| `ConflictError` | 409 | Estado incompatível com a operação |
| `ServiceUnavailableError` | 503 | Adapter não registrado |

O `errorHandler` global distingue `HttpError` (log `warn`) de erros inesperados (log `error` + 500).
