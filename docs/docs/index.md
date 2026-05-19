---
id: index
title: Kiro AI
slug: /
---

# Kiro AI — Task Delegator

Sistema de automação de tarefas de desenvolvimento orientado por agentes de IA. Recebe tarefas de gerenciadores de projetos (Jira, Azure DevOps), executa-as autonomamente usando LLMs, e commita o resultado diretamente no repositório via API VCS — sem clonar código localmente.

## Serviços

| Serviço | Porta | Descrição |
|---|---|---|
| Frontend | `5173` | Dashboard React |
| Backend API | `3001` | API REST + Worker BullMQ |
| Docs (Docusaurus) | `3002` | Esta documentação |
| Redis | `6379` | Fila de tarefas |
| Weaviate | `8080` | Memória semântica vetorial |

## Provedores Suportados

| Categoria | Provedores |
|---|---|
| **LLM** | OpenAI, Anthropic, Google Gemini, Azure OpenAI, Ollama |
| **Project Manager** | Jira, Azure DevOps Boards |
| **VCS** | GitHub, Azure DevOps Repos |

## Navegação Rápida

- **[Início Rápido](./guides/getting-started)** — como rodar o projeto em minutos
- **[Fluxo de uma Tarefa](./guides/task-flow)** — ciclo de vida completo de uma tarefa
- **[Arquitetura](./architecture/overview)** — camadas, princípios e decisões de design
- **[Componentes](./architecture/components)** — descrição detalhada de cada módulo
- **[Integrações](./integrations/jira)** — como configurar Jira, Azure DevOps, LLMs e VCS
- **[API REST](./reference/api)** — referência completa de todos os endpoints
- **[Configuração](./reference/configuration)** — variáveis de ambiente e settings
