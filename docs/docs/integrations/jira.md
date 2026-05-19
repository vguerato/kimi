---
id: jira
title: Jira
sidebar_label: Jira
---

# Integração com Jira

## Configuração

### 1. Selecionar o provedor

Acesse **Settings → Integração** e selecione **Jira**.

### 2. Preencher credenciais

Acesse **Settings → Jira** e preencha:

| Campo | Descrição |
|---|---|
| **Jira URL** | `https://empresa.atlassian.net` |
| **Email** | Seu email de login no Jira |
| **API Token** | Gere em https://id.atlassian.com/manage-profile/security/api-tokens |

Clique em **Salvar Configurações** — o sistema valida as credenciais automaticamente.

### 3. Configurar Webhook

O webhook notifica o Kiro quando um issue muda de status.

**Com Ngrok (desenvolvimento):**
1. Configure `NGROK_AUTHTOKEN` no `backend/.env`
2. Reinicie o backend
3. Acesse **Settings → Jira → Webhook**
4. Clique em **Registrar Webhook Automaticamente**

**Em produção:**
Registre manualmente no Jira com:
- URL: `https://seu-servidor/api/project-manager/jira/webhook`
- Evento: `Issue Updated`

### 4. Configurar Mapeamento

1. Acesse **Settings → Jira → Mapeamento**
2. Clique em **Carregar do Jira** para buscar statuses e tipos disponíveis
3. Configure:
   - **Status Gatilho** — quando um issue muda para este status, o agente é acionado (ex: "Em Análise")
   - **Tipos Delegáveis** — tipos de issue que o agente pode executar (ex: "Sub-task", "Task")

## Convenção de Títulos

O Kiro identifica o repositório pelo prefixo entre colchetes no título do issue:

```
[payments] Adicionar endpoint de reembolso
[auth] Corrigir validação de JWT
[infra] Atualizar versão do Node.js
```

O prefixo deve corresponder a uma chave no mapeamento de repositórios.

## Segurança do Webhook (opcional)

Para validar a autenticidade dos webhooks em produção:

1. Configure um secret ao criar o webhook no Jira
2. Adicione nas settings do banco: `jira_webhook_secret = seu-secret`

O sistema valida a assinatura HMAC-SHA256 automaticamente. Sem secret configurado, aceita todos os webhooks (modo desenvolvimento).

## Payload do Webhook

O Jira envia um payload `jira:issue_updated` com o changelog:

```json
{
  "webhookEvent": "jira:issue_updated",
  "issue": {
    "key": "SCRUM-14",
    "fields": {
      "summary": "[payments] Adicionar endpoint de reembolso",
      "description": { "type": "doc", "content": [...] },
      "status": { "name": "Em Análise" },
      "issuetype": { "name": "Sub-task" },
      "parent": { "key": "SCRUM-13" }
    }
  },
  "changelog": {
    "items": [
      { "field": "status", "toString": "Em Análise" }
    ]
  }
}
```

:::note Formato ADF
A descrição do Jira é retornada no formato **Atlassian Document Format (ADF)** — um objeto JSON complexo. O Kiro converte automaticamente para texto plano antes de enviar ao agente.
:::

## Hierarquia de Issues

O Kiro suporta dois cenários:

**Issue pai com subtasks:**
- O webhook é disparado no issue pai
- O Kiro busca todas as subtasks elegíveis
- Cada subtask elegível é enfileirada como uma tarefa separada

**Subtask disparada diretamente:**
- O webhook é disparado na subtask
- O Kiro busca o issue pai para contexto adicional
- A subtask é enfileirada com o contexto do pai

## Settings do Banco

| Chave | Descrição |
|---|---|
| `jira_url` | URL base do Jira |
| `jira_email` | Email de autenticação |
| `jira_token` | API Token |
| `jira_mapping` | JSON com o mapeamento de status/tipos |
| `jira_webhook_secret` | Secret HMAC (opcional) |
