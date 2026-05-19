---
id: configuration
title: Configuração
sidebar_label: Configuração
---

# Configuração

## Variáveis de Ambiente

Arquivo: `backend/.env` (copie de `backend/.env.example`)

### Servidor

| Variável | Padrão | Descrição |
|---|---|---|
| `PORT` | `3001` | Porta do servidor HTTP |
| `NODE_ENV` | `development` | Ambiente (`development` \| `production`) |
| `LOG_LEVEL` | `info` | Nível de log (`trace` \| `debug` \| `info` \| `warn` \| `error` \| `fatal`) |

### Redis

| Variável | Padrão | Descrição |
|---|---|---|
| `REDIS_URL` | `redis://localhost:6379` | URL de conexão com o Redis |

### Worker

| Variável | Padrão | Descrição |
|---|---|---|
| `WORKER_CONCURRENCY` | `3` | Tarefas processadas em paralelo |

### LLM

| Variável | Padrão | Descrição |
|---|---|---|
| `LLM_PROVIDER` | auto | Força um provedor (`openai` \| `anthropic` \| `gemini` \| `azure-openai` \| `ollama`) |
| `OPENAI_API_KEY` | — | Chave OpenAI |
| `OPENAI_MODEL` | `gpt-4o` | Modelo OpenAI |
| `ANTHROPIC_API_KEY` | — | Chave Anthropic |
| `ANTHROPIC_MODEL` | `claude-opus-4-5` | Modelo Anthropic |
| `GEMINI_API_KEY` | — | Chave Gemini |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Modelo Gemini |
| `AZURE_OPENAI_API_KEY` | — | Chave Azure OpenAI |
| `AZURE_OPENAI_INSTANCE_NAME` | — | Nome da instância Azure |
| `AZURE_OPENAI_DEPLOYMENT_NAME` | — | Nome do deployment |
| `AZURE_OPENAI_API_VERSION` | `2024-02-01` | Versão da API |
| `AZURE_OPENAI_MODEL` | `gpt-4o` | Modelo Azure |
| `OLLAMA_BASE_URL` | — | URL do servidor Ollama |
| `OLLAMA_MODEL` | `llama3.2` | Modelo Ollama |

### Memória

| Variável | Padrão | Descrição |
|---|---|---|
| `MEM0_API_KEY` | — | Chave Mem0 Cloud |
| `MEM0_BASE_URL` | — | URL Mem0 OSS self-hosted |

### Infraestrutura

| Variável | Padrão | Descrição |
|---|---|---|
| `DOCKER_HOST` | `/var/run/docker.sock` | Socket do Docker daemon |
| `NGROK_AUTHTOKEN` | — | Token de autenticação Ngrok |

---

## Settings do Dashboard

Configurações armazenadas no banco SQLite (tabela `settings`). Acessíveis via `GET/POST /api/settings`.

### Git / VCS

| Chave | Descrição |
|---|---|
| `git_pat` | Personal Access Token do GitHub/Azure DevOps |
| `github_username` | Nome de usuário para commits do agente (ex: `kiro-agent`) |
| `repo_mappings` | JSON: `{ "prefix": "https://github.com/org/repo.git" }` |

### Project Manager

| Chave | Descrição |
|---|---|
| `project_manager` | Provedor ativo: `jira` \| `azure-devops` |

### Jira

| Chave | Descrição |
|---|---|
| `jira_url` | URL base do Jira (ex: `https://empresa.atlassian.net`) |
| `jira_email` | Email de autenticação |
| `jira_token` | API Token do Jira |
| `jira_mapping` | JSON com o mapeamento de status/tipos |
| `jira_webhook_secret` | Secret HMAC para validação de webhooks (opcional) |

### Azure DevOps

| Chave | Descrição |
|---|---|
| `azure_devops_org` | Nome da organização (ex: `mycompany`) |
| `azure_devops_project` | Nome ou ID do projeto (ex: `MyProject`) |
| `azure_devops_token` | Personal Access Token |
| `azure_devops_mapping` | JSON com o mapeamento de status/tipos |

---

## Mapeamento de Repositórios

Conecta prefixos de issues a URLs de repositórios:

```json
{
  "payments": "https://github.com/org/payments-service.git",
  "auth": "https://github.com/org/auth-service.git",
  "infra": "https://dev.azure.com/org/project/_git/infra"
}
```

O prefixo deve aparecer entre colchetes no título do issue:
```
[payments] Adicionar endpoint de reembolso
```

---

## Mapeamento de Status/Tipos

Controla quais mudanças de status disparam o agente e quais tipos de issue são delegáveis.

```json
{
  "triggerStatuses": ["Em Análise", "Active", "In Progress"],
  "skipStatuses": ["Done", "Closed", "Cancelled"],
  "delegatableTypes": ["Task", "Sub-task", "Bug"],
  "parentTypes": ["Story", "Epic", "Feature"],
  "savedAt": "2024-01-01T00:00:00.000Z"
}
```

| Campo | Descrição |
|---|---|
| `triggerStatuses` | Quando um issue muda para um destes status, o agente é acionado |
| `skipStatuses` | Issues nestes status são ignorados mesmo que sejam do tipo delegável |
| `delegatableTypes` | Tipos de issue que o agente pode executar |
| `parentTypes` | Tipos tratados como containers (não executados diretamente) |
