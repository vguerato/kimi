---
id: azure-devops
title: Azure DevOps
sidebar_label: Azure DevOps
---

# Integração com Azure DevOps Boards

## Configuração

### 1. Selecionar o provedor

Acesse **Settings → Integração** e selecione **Azure DevOps**.

### 2. Gerar um PAT

Acesse `https://dev.azure.com/{org}/_usersSettings/tokens` e crie um token com os escopos:
- **Work Items** — Read & Write
- **Service Hooks** — Read & Write

### 3. Configurar credenciais

Configure as seguintes chaves nas settings do banco (via API ou dashboard):

| Chave | Exemplo | Descrição |
|---|---|---|
| `azure_devops_org` | `mycompany` | Nome da organização |
| `azure_devops_project` | `MyProject` | Nome ou ID do projeto |
| `azure_devops_token` | `...` | Personal Access Token |

### 4. Configurar Service Hook

O Azure DevOps usa **Service Hooks** (não webhooks simples).

**Via API:**
```
POST /api/project-manager/azure-devops/setup-webhook
```

**Manualmente:**
1. Acesse `https://dev.azure.com/{org}/{project}/_settings/serviceHooks`
2. Crie uma nova subscription:
   - Serviço: **Web Hooks**
   - Evento: **Work item updated**
   - URL: `https://seu-servidor/api/project-manager/azure-devops/webhook`

### 5. Configurar Mapeamento

Mesmo processo do Jira. O `fetchConfig()` busca todos os tipos de work item e seus estados do projeto.

**Estados típicos:**

| Processo | Estados |
|---|---|
| Agile | `New`, `Active`, `Resolved`, `Closed` |
| Scrum | `New`, `Approved`, `Committed`, `Done` |
| CMMI | `Proposed`, `Active`, `Resolved`, `Closed` |

## Convenção de Títulos

Mesma do Jira — prefixo entre colchetes no título do work item:

```
[payments] Adicionar endpoint de reembolso
[auth] Corrigir validação de JWT
```

## Tags vs Labels

No Azure DevOps, "labels" são chamadas de **tags** e são separadas por `;`. O método `addLabel()` adiciona a tag sem duplicar as existentes.

Exemplo de tags após execução:
```
model:gemini-2.5-flash; shift-agent
```

## Payload do Webhook

O Azure DevOps envia um payload `workitem.updated`:

```json
{
  "eventType": "workitem.updated",
  "resource": {
    "workItemId": 123,
    "fields": {
      "System.State": {
        "oldValue": "New",
        "newValue": "Active"
      }
    },
    "revision": {
      "id": 123,
      "fields": {
        "System.Title": "[payments] Adicionar endpoint de reembolso",
        "System.WorkItemType": "Task",
        "System.State": "Active",
        "System.Tags": "sprint-5",
        "System.TeamProject": "MyProject"
      },
      "relations": [
        {
          "rel": "System.LinkTypes.Hierarchy-Reverse",
          "url": "https://dev.azure.com/org/project/_apis/wit/workitems/100"
        }
      ]
    }
  }
}
```

## Hierarquia de Work Items

O Shift encontra o work item pai via a relação `System.LinkTypes.Hierarchy-Reverse` nas relações do work item. Se encontrado, busca o pai para contexto adicional.

## Autenticação

O Azure DevOps usa **Basic Auth** com PAT:
```
Authorization: Basic base64(":{PAT}")
```

O username é vazio — apenas o PAT é necessário.

## Settings do Banco

| Chave | Descrição |
|---|---|
| `azure_devops_org` | Nome da organização |
| `azure_devops_project` | Nome ou ID do projeto |
| `azure_devops_token` | Personal Access Token |
| `azure_devops_mapping` | JSON com o mapeamento de status/tipos |
