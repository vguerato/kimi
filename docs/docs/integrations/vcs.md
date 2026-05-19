---
id: vcs
title: VCS (Controle de Versão)
sidebar_label: VCS
---

# VCS — Controle de Versão

O Shift opera em modo **API-first** — repositórios nunca são clonados permanentemente. Todas as operações usam a API REST do provedor.

## GitHub

### Configuração

Configure nas settings do banco:

| Chave | Descrição |
|---|---|
| `git_pat` | Personal Access Token com escopo `repo` |
| `github_username` | Nome de usuário para commits (ex: `shift-agent`) |

**Gerar PAT:** https://github.com/settings/tokens → Classic → escopo `repo`

### Detecção automática

URLs contendo `github.com` usam automaticamente o `GitHubAdapter`.

### Commits atômicos

O GitHub usa a **Git Data API** para commits atômicos:

```
1. Cria blobs para cada arquivo modificado
2. Cria uma tree com todos os blobs
3. Cria um commit apontando para a tree
4. Atualiza a ref da branch
```

Isso garante que todos os arquivos são commitados em uma única operação — sem estados intermediários inconsistentes.

---

## Azure DevOps Repos

### Configuração

Usa o mesmo PAT configurado para o Azure DevOps Boards (se usar o mesmo provedor).

| Chave | Descrição |
|---|---|
| `git_pat` | PAT com escopo Code (Read & Write) |
| `github_username` | Nome de usuário para commits |

### Detecção automática

URLs contendo `dev.azure.com` ou `visualstudio.com` usam automaticamente o `AzureDevOpsAdapter` (VCS).

---

## Mapeamento de Repositórios

Configure em **Settings → Git → Mapeamento de Repositórios**:

```json
{
  "payments": "https://github.com/org/payments-service.git",
  "auth": "https://github.com/org/auth-service.git",
  "infra": "https://dev.azure.com/org/project/_git/infra"
}
```

O prefixo (ex: `payments`) deve aparecer entre colchetes no título do issue:
```
[payments] Adicionar endpoint de reembolso
```

---

## Operações Suportadas

| Operação | Método |
|---|---|
| Metadados do repositório | `getRepositoryMetadata()` |
| Listar arquivos | `listFiles()` |
| Ler arquivo | `getFileContent()` |
| Ler múltiplos arquivos | `getMultipleFiles()` |
| Criar branch | `createBranch()` |
| Verificar se branch existe | `branchExists()` |
| Commitar arquivos | `commitFiles()` |
| Abrir Pull Request | `openPullRequest()` |
| Validar acesso | `validateAccess()` |

---

## Execução Local (containers efêmeros)

Para operações que requerem execução de código (testes, builds), o Shift provisiona um container Docker efêmero:

```yaml
# docker-compose.yml — necessário para containers efêmeros
services:
  backend:
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
```

O container é destruído automaticamente após a execução (TTL: 5 minutos).
