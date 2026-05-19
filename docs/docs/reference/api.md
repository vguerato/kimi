---
id: api
title: API REST
sidebar_label: API REST
---

# API REST

**Base URL:** `http://localhost:3001`

Todos os endpoints retornam JSON. Erros seguem o formato:
```json
{ "error": "Mensagem descritiva do erro" }
```

## Health

### `GET /health`

Verifica se o servidor está respondendo.

```json
{ "status": "ok", "timestamp": "2024-01-01T00:00:00.000Z", "version": "2.0.0" }
```

---

## Settings

### `GET /api/settings`

Retorna todas as configurações armazenadas.

**Resposta 200:** `Record<string, string>`

### `POST /api/settings`

Salva configurações e valida credenciais do project manager.

**Body:** `Record<string, unknown>`

**Resposta 200:**
```json
{ "success": true, "pmValid": true }
```

`pmValid`: `true` (válido) | `false` (inválido) | `null` (não verificado)

---

## Tasks

### `GET /api/tasks`

Lista todas as tarefas ordenadas por data de atualização.

**Resposta 200:**
```json
[{
  "id": "SCRUM-14",
  "parent_id": "SCRUM-13",
  "title": "Adicionar endpoint de pagamento",
  "description": "...",
  "repository": "payments",
  "branch": "feature/SCRUM-14-adicionar-endpoint-de-pagamento",
  "status": "em fila",
  "model": "gemini-2.5-flash",
  "commit_url": "https://github.com/org/repo/commit/abc123",
  "logs": null,
  "created_at": "2024-01-01T00:00:00.000Z",
  "updated_at": "2024-01-01T00:00:00.000Z"
}]
```

**Status possíveis:** `em fila` | `processando` | `em espera` | `error`

### `GET /api/tasks/:id/logs/stream`

Stream de logs em tempo real via **Server-Sent Events (SSE)**.

```
Content-Type: text/event-stream
```

**Eventos:**
```
data: {"type":"history","entries":[{"ts":"...","level":"info","message":"..."}]}
data: {"type":"log","entry":{"ts":"...","level":"tool","message":"$ npm test"}}
data: {"type":"done","status":"em espera"}
```

**Níveis:** `info` | `tool` | `error` | `system` | `warn`

### `DELETE /api/tasks/:id`

Remove uma tarefa do banco e da fila.

**Resposta 200:** `{ "success": true, "id": "SCRUM-14" }`

### `POST /api/tasks/:id/retry`

Reenfileira uma tarefa para reprocessamento.

**Resposta 200:** `{ "success": true, "id": "SCRUM-14" }`

**Resposta 409** (tarefa ativa): `{ "success": false, "error": "...", "state": "active" }`

---

## Projects

### `GET /api/repos/status`

Status de indexação de cada repositório configurado.

**Resposta 200:**
```json
{ "payments": "ready", "auth": "pending" }
```

`ready` = contexto indexado | `pending` = ainda não indexado

### `GET /api/projects`

Lista projetos com metadados de contexto.

**Resposta 200:**
```json
[{
  "prefix": "payments",
  "url": "https://github.com/org/payments.git",
  "hasContext": true,
  "language": "TypeScript",
  "framework": "NestJS",
  "confidence": 0.92
}]
```

### `POST /api/projects/:prefix/index`

Dispara indexação de contexto em background.

**Resposta 200:** `{ "success": true, "message": "Indexação iniciada." }`

**Resposta 404:** Repositório não encontrado no mapeamento.

### `GET /api/projects/:prefix/context`

Retorna o contexto indexado de um projeto.

**Resposta 200:** `ProjectContextMemory` com `language`, `framework`, `buildCommand`, `testCommand`, `lintCommand`, `conventions`, `specs`, `confidence`.

### `DELETE /api/projects/:prefix/memory`

Limpa toda a memória de um projeto (contexto + histórico de execuções).

**Resposta 200:** `{ "success": true, "message": "Memória limpa." }`

---

## Project Manager

### `GET /api/project-manager/providers`

Lista provedores disponíveis com status de registro.

**Resposta 200:**
```json
[
  { "type": "jira", "label": "Jira (Atlassian)", "registered": true },
  { "type": "azure-devops", "label": "Azure DevOps", "registered": true }
]
```

### `GET /api/project-manager/config`

Busca statuses e tipos de issue do provedor ativo.

**Resposta 200:** `{ statuses: [...], issueTypes: [...] }`

**Resposta 503:** Adapter não registrado.

### `GET /api/project-manager/mapping`

Retorna o mapeamento configurado.

**Resposta 200:** `{ "mapping": { "triggerStatuses": [...], ... } | null }`

### `POST /api/project-manager/mapping`

Salva o mapeamento de status/tipos.

**Body:**
```json
{
  "triggerStatuses": ["Em Análise", "Active"],
  "skipStatuses": ["Done", "Closed"],
  "delegatableTypes": ["Task", "Sub-task"],
  "parentTypes": ["Story", "Epic"]
}
```

**Resposta 200:** `{ "success": true, "mapping": { ... } }`

**Resposta 400:** Campo não é array.

### `GET /api/project-manager/webhook`

Health check do endpoint de webhook.

### `POST /api/project-manager/webhook`

Recebe webhook do provedor ativo.

**Resposta 200:** `{ "received": true }`

**Resposta 401:** Assinatura HMAC inválida.

### `POST /api/project-manager/:provider/webhook`

Recebe webhook de um provedor específico (`jira` ou `azure-devops`).

### `GET /api/project-manager/:provider/config`

Config de um provedor específico.

### `GET /api/project-manager/:provider/mapping`

Mapping de um provedor específico.

### `POST /api/project-manager/:provider/mapping`

Salva mapping de um provedor específico.

### `POST /api/project-manager/:provider/setup-webhook`

Registra webhook no provedor.

**Body (opcional):** `{ "webhookUrl": "https://..." }`

Se `webhookUrl` for omitida, usa a URL do Ngrok automaticamente.

**Resposta 200:** `{ "success": true, "webhookUrl": "...", "id": "..." }`

**Resposta 400:** Ngrok não ativo e URL não fornecida.

---

## Ngrok

### `GET /api/ngrok-url`

Retorna a URL pública atual do tunnel Ngrok.

**Resposta 200:**
```json
{
  "url": "https://abc123.ngrok.io",
  "webhookUrl": "https://abc123.ngrok.io/api/webhook"
}
```

`url` e `webhookUrl` são `null` se o Ngrok não estiver ativo.
