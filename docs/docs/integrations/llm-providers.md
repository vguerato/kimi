---
id: llm-providers
title: Provedores LLM
sidebar_label: Provedores LLM
---

# Provedores LLM

O sistema detecta automaticamente o provedor ativo pelas variáveis de ambiente. Configure pelo menos um.

## Prioridade de Detecção

```
OpenAI → Anthropic → Azure OpenAI → Gemini → Ollama
```

Para forçar um provedor específico:
```env
LLM_PROVIDER=gemini
```

---

## OpenAI

```env
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o   # opcional, padrão: gpt-4o
```

Obtém a lista de modelos disponíveis via API. Suporta `gpt-4o`, `gpt-4o-mini`, etc.

**Obter chave:** https://platform.openai.com/api-keys

---

## Anthropic

```env
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-opus-4-5   # opcional
```

**Modelos disponíveis:** `claude-opus-4-5`, `claude-sonnet-4-5`, `claude-haiku-3-5`

**Obter chave:** https://console.anthropic.com/settings/keys

---

## Google Gemini

```env
GEMINI_API_KEY=AIza...
GEMINI_MODEL=gemini-2.5-flash   # opcional
```

Sincroniza automaticamente com `GOOGLE_API_KEY` (alias do LangChain).

**Modelos disponíveis:** `gemini-2.5-pro`, `gemini-2.5-flash`, `gemini-2.0-flash`, `gemini-1.5-pro`, `gemini-1.5-flash`

**Obter chave:** https://aistudio.google.com/app/apikey

---

## Azure OpenAI

```env
AZURE_OPENAI_API_KEY=...
AZURE_OPENAI_INSTANCE_NAME=minha-instancia
AZURE_OPENAI_DEPLOYMENT_NAME=meu-deployment
AZURE_OPENAI_API_VERSION=2024-02-01
AZURE_OPENAI_MODEL=gpt-4o
```

**Obter:** https://portal.azure.com → Azure OpenAI

---

## Ollama (local)

```env
OLLAMA_BASE_URL=http://host.docker.internal:11434
OLLAMA_MODEL=llama3.2
```

Busca a lista de modelos instalados via `GET /api/tags`.

**Instalar Ollama:** https://ollama.com

```bash
# Instalar um modelo
ollama pull llama3.2
ollama pull codellama
```

:::tip Docker
Dentro do Docker, use `host.docker.internal` para acessar o Ollama rodando no host.
:::

---

## Seleção Automática de Modelo

O `AgentHarness` usa o modelo mais rápido disponível para analisar a tarefa e escolher o modelo ideal:

```
Tarefa simples (CRUD, boilerplate)  →  modelo rápido (flash, mini, haiku)
Tarefa complexa (arquitetura, refatoração)  →  modelo capaz (pro, opus, gpt-4o)
```

O modelo selecionado é registrado na tarefa e adicionado como tag/label no issue.

---

## Retry Automático

Em caso de rate limit (HTTP 429), o sistema aplica backoff exponencial:

- Tenta extrair o delay do header `RetryInfo` da API
- Fallback: `10s × tentativa` (máx. 60s)
- Máximo de 5 tentativas por chamada
