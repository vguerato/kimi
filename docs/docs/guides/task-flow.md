---
id: task-flow
title: Fluxo de uma Tarefa
sidebar_label: Fluxo de uma Tarefa
---

# Fluxo de uma Tarefa

Ciclo de vida completo de uma tarefa, desde o evento no gerenciador de projetos até o commit no repositório.

## Diagrama

```
Jira / Azure DevOps
    │  issue atualizado
    ▼
POST /api/project-manager/{provider}/webhook
    │  valida assinatura HMAC (se configurado)
    │  verifica se status é trigger
    │  verifica se tipo é delegável
    ▼
IProjectManagerAdapter.processWebhook()
    │  cria TaskAggregate  →  status: "em fila"
    │  persiste no banco
    ▼
BullMQ Queue "agent-tasks"
    │
    ▼
TaskWorker
    │
    ▼
TaskOrchestrator.processTask()
    │
    ├─ 1. status → "processando"
    │
    ├─ 2. ContextEngine.isStale()?
    │      └─ sim → indexProject() em background
    │
    ├─ 3. AgentHarness.selectModel()
    │      └─ LLM analisa complexidade → escolhe modelo
    │
    ├─ 4. IVCSAdapter.branchExists()?
    │      └─ não → createBranch()
    │
    ├─ 5. git clone → /tmp/shift-tasks/{taskId}
    │
    ├─ 6. AgentHarness.execute()
    │      ├─ pre-flight: carrega contexto do projeto
    │      ├─ loop agentic (máx. 25 iterações):
    │      │    LLM → tool calls → resultados → LLM → ...
    │      │    tools: execute_terminal_command
    │      │           write_file
    │      │           read_file_from_vcs
    │      └─ post-flight: registra métricas
    │
    ├─ 7. IVCSAdapter.commitFiles()
    │      └─ commit atômico via API (sem git local)
    │
    ├─ 8. status → "em espera"
    │
    ├─ 9. IMemoryPort.storeExecutionContext()
    │
    ├─ 10. IProjectManagerAdapter.addComment()
    │       └─ "✅ Implementação concluída. Commit: {url}"
    │
    ├─ 11. IProjectManagerAdapter.updateTaskStatus()
    │       └─ move issue para "Em Análise"
    │
    └─ 12. rm -rf /tmp/shift-tasks/{taskId}
```

## Status da Tarefa

| Status | Descrição |
|---|---|
| `em fila` | Criada, aguardando worker |
| `processando` | Worker executando |
| `em espera` | Concluída, aguardando revisão humana |
| `error` | Falhou — pode ser reprocessada via retry |

## Indexação de Contexto

Antes de executar, o sistema verifica se o contexto do projeto está na memória.

**Primeira execução** — o `ContextEngine` indexa automaticamente:
1. Lista arquivos do repositório via VCS API
2. LLM identifica arquivos relevantes (specs, configs, docs)
3. Busca conteúdo dos arquivos (máx. 20 arquivos, 8k chars cada)
4. LLM sintetiza `ProjectContextMemory` com linguagem, framework, comandos, convenções
5. Persiste na memória

**Execuções seguintes** — contexto carregado da memória sem nova indexação.

**Re-indexação manual:** `POST /api/projects/{prefix}/index`

## Seleção de Modelo

O `AgentHarness` usa o modelo mais rápido para analisar a tarefa e escolher o modelo ideal:

- **Tarefas simples** (CRUD, boilerplate, pequenas correções) → modelos rápidos (flash, mini, haiku)
- **Tarefas complexas** (arquitetura, algoritmos, refatoração profunda) → modelos capazes (pro, opus, gpt-4o)

## Loop Agentic

O agente opera em um loop ReAct (Reasoning + Acting):

```
1. LLM recebe: system prompt (contexto do projeto) + human message (tarefa)
2. LLM responde com tool calls ou texto final
3. Se tool calls:
   a. Executa cada tool
   b. Adiciona resultados ao histórico
   c. Volta ao passo 2
4. Se texto final (sem tool calls): tarefa concluída
```

**Guardrails:**
- Máximo de **25 iterações**
- Máximo de **200.000 tokens** por execução
- Proteção contra path traversal no `write_file`
- Validação de nome de branch antes de usar em shell

## Commit Atômico

O commit é feito via API VCS, garantindo atomicidade:

**GitHub (Git Data API):**
1. Cria blobs para cada arquivo modificado
2. Cria uma tree com todos os blobs
3. Cria um commit apontando para a tree
4. Atualiza a ref da branch

**Fallback:** se a API falhar, tenta commit via git local no diretório temporário.

## Tratamento de Falhas

Se qualquer etapa falhar:
1. Status → `error`
2. Logs de erro persistidos no banco
3. Contexto de falha armazenado na memória (para aprendizado futuro)
4. Diretório temporário limpo

Reprocessar via `POST /api/tasks/{id}/retry` ou pelo botão no dashboard.

## Logs em Tempo Real

Durante a execução, os logs são transmitidos via SSE:

```
GET /api/tasks/{id}/logs/stream
```

| Nível | Descrição |
|---|---|
| `system` | Eventos do orquestrador (indexação, seleção de modelo) |
| `info` | Respostas do LLM e resultados de tools |
| `tool` | Comandos executados (`$ npm test`, `✏️ write_file → src/...`) |
| `error` | Erros durante a execução |
