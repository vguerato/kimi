---
id: getting-started
title: Início Rápido
sidebar_label: Início Rápido
---

# Início Rápido

## Pré-requisitos

- Docker e Docker Compose
- Node.js 20+ (apenas para desenvolvimento local sem Docker)
- Pelo menos uma chave de API de LLM (OpenAI, Anthropic, Gemini ou Ollama local)

## 1. Clonar e configurar

```bash
git clone <repo-url>
cd shift

cp backend/.env.example backend/.env
```

## 2. Configurar o provedor LLM

Edite `backend/.env` e defina pelo menos um provedor:

```env
# Escolha um (ou mais):
GEMINI_API_KEY=sua-chave-aqui
# OPENAI_API_KEY=sua-chave-aqui
# ANTHROPIC_API_KEY=sua-chave-aqui
```

## 3. Subir os serviços

```bash
docker compose up -d
```

Aguarde todos os serviços iniciarem (~30 segundos) e acesse:

| URL | Serviço |
|---|---|
| http://localhost:5173 | Dashboard |
| http://localhost:3001/health | Backend API |
| http://localhost:3002 | Esta documentação |

## 4. Configurar via Dashboard

Acesse http://localhost:5173 → **Configurações**:

### Aba Git

Configure as credenciais de acesso ao repositório:

- **GitHub Username** — nome de usuário para commits do agente (ex: `shift-agent`)
- **Git PAT** — Personal Access Token com escopo `repo`
- **Mapeamento de Repositórios** — conecta prefixos de issues a URLs de repositórios:

```
payments → https://github.com/org/payments-service.git
auth     → https://github.com/org/auth-service.git
```

### Aba Integração

Selecione o gerenciador de projetos: **Jira** ou **Azure DevOps**.

### Aba Jira / Azure DevOps

Preencha as credenciais do provedor selecionado. Veja os guias específicos:
- [Configurar Jira](../integrations/jira)
- [Configurar Azure DevOps](../integrations/azure-devops)

## 5. Configurar Webhook (desenvolvimento)

Para receber eventos do Jira/Azure DevOps localmente, use o Ngrok:

```env
# backend/.env
NGROK_AUTHTOKEN=seu-token-ngrok
```

Reinicie o backend. A URL pública aparece em **Settings → Jira → Webhook**.

## Desenvolvimento local (sem Docker)

```bash
# Sobe apenas Redis e Weaviate
docker compose up -d redis weaviate

# Backend
cd backend
npm install
npm run dev

# Frontend (outro terminal)
cd frontend
npm install
npm run dev

# Docs (outro terminal)
cd docs
npm install
npm start
```

## Verificar saúde

```bash
curl http://localhost:3001/health
# {"status":"ok","timestamp":"...","version":"2.0.0"}
```
