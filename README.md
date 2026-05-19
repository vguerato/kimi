# Shift — Task Delegator

Sistema de automação de tarefas de desenvolvimento orientado por agentes de IA. Recebe tarefas de gerenciadores de projetos (Jira, Azure DevOps), executa-as autonomamente usando LLMs, e commita o resultado diretamente no repositório via API VCS.

## Início Rápido

```bash
# 1. Configurar
cp backend/.env.example backend/.env
# Edite backend/.env e adicione pelo menos uma chave de LLM

# 2. Subir
docker compose up -d

# 3. Acessar
# Dashboard:      http://localhost:5173
# API:            http://localhost:3001
# Documentação:   http://localhost:3002
```

## Serviços

| Serviço | Porta | Descrição |
|---|---|---|
| Frontend | `5173` | Dashboard React |
| Backend API | `3001` | API REST + Worker BullMQ |
| Docs (Docusaurus) | `3002` | Documentação |
| Redis | `6379` | Fila de tarefas |
| Weaviate | `8080` | Memória semântica vetorial |

## Documentação

A documentação completa está em http://localhost:3002 (Docusaurus).

Os arquivos fonte estão em `docs/docs/`:

| Seção | Arquivos |
|---|---|
| Guias | `guides/getting-started.md`, `guides/task-flow.md` |
| Arquitetura | `architecture/overview.md`, `architecture/components.md` |
| Integrações | `integrations/jira.md`, `integrations/azure-devops.md`, `integrations/llm-providers.md`, `integrations/vcs.md` |
| Referência | `reference/api.md`, `reference/configuration.md` |

## Provedores Suportados

| Categoria | Provedores |
|---|---|
| **LLM** | OpenAI, Anthropic, Google Gemini, Azure OpenAI, Ollama |
| **Project Manager** | Jira, Azure DevOps Boards |
| **VCS** | GitHub, Azure DevOps Repos |

## Licença

Veja [LICENSE.MD](LICENSE.MD).
