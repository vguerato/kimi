# Kiro AI - Jira Task Delegator 🤖

Plataforma full-stack inteligente que automatiza o desenvolvimento de tarefas do Jira delegando-as para um Agente de Inteligência Artificial alimentado por **qualquer LLM** (Gemini, OpenAI, Anthropic, Ollama, Azure OpenAI).

O sistema intercepta transições de status no Jira via Webhooks, automatiza o sincronismo de branches do Github localmente, **descobre e incorpora specs, rules e skills do repositório** antes de escrever o código, e finaliza fazendo commits padronizados e movendo a tarefa para code-review.

## 🛠️ Arquitetura e Stack
- **Backend:** Node.js, Express, TypeScript, LangChain (Core)
- **Frontend:** React (Vite), Tailwind CSS v4, HeroUI v3
- **Fila e Processamento:** Redis + BullMQ
- **Banco de Dados:** SQLite (persistido em disco local via volume)
- **Memória de Agente:** Mem0 (cloud ou self-hosted) com fallback local em JSON
- **Infraestrutura:** Docker Compose, Nginx (Proxy Reverso)

---

## 🧠 Spec-Driven Development (SDD) — Agnostic

Antes de executar qualquer tarefa, o agente **descobre automaticamente** as diretivas de desenvolvimento do repositório alvo:

| Ferramenta | Arquivos/Diretórios Suportados |
|---|---|
| **Kiro** | `.kiro/specs/**`, `.kiro/steering/**`, `.kiro/skills/**` |
| **Cursor** | `.cursorrules`, `.cursor/rules/**` |
| **Claude** | `CLAUDE.md`, `.claude/commands/**` |
| **GitHub Copilot** | `.github/copilot-instructions.md` |
| **Windsurf** | `.windsurfrules` |
| **Aider** | `CONVENTIONS.md`, `CONTRIBUTING.md`, `.aider.conf.yml` |
| **OpenSpec** | `.openspec/**` |
| **Genérico** | `AGENTS.md`, `docs/specs/**`, `docs/rules/**`, `docs/skills/**` |

O agente filtra as diretivas relevantes para a tarefa atual e as injeta no system prompt antes de iniciar o desenvolvimento.

---

## 🔌 Providers de LLM Suportados

O sistema detecta automaticamente qual provider usar com base nas variáveis de ambiente presentes. Prioridade: `OPENAI > ANTHROPIC > OLLAMA > AZURE_OPENAI > GEMINI`.

| Provider | Variável de Ambiente | Modelo Padrão |
|---|---|---|
| Google Gemini | `GEMINI_API_KEY` | `gemini-2.0-flash` |
| OpenAI | `OPENAI_API_KEY` | `gpt-4o` |
| Anthropic | `ANTHROPIC_API_KEY` | `claude-3-5-sonnet-20241022` |
| Ollama (local) | `OLLAMA_BASE_URL` | `llama3.2` |
| Azure OpenAI | `AZURE_OPENAI_API_KEY` | configurável |

---

## 🚀 Como Executar Localmente

### 1. Requisitos
- **Docker** e **Docker Compose** instalados.
- Chave de API de pelo menos **um** provider de LLM.
- Um **Personal Access Token (PAT)** do Github (Classic) com permissões em `repo`.
- Um **API Token** do Jira (Atlassian).

### 2. Configurando o Ambiente
Crie um arquivo `.env` na pasta `backend/` (ou edite o existente):
```env
# ── LLM Provider (configure pelo menos um) ──────────────────────────────────
GEMINI_API_KEY=AIzaSy...
# GEMINI_MODEL=gemini-2.0-flash

# OPENAI_API_KEY=sk-...
# OPENAI_MODEL=gpt-4o

# ANTHROPIC_API_KEY=sk-ant-...
# ANTHROPIC_MODEL=claude-3-5-sonnet-20241022

# OLLAMA_BASE_URL=http://host.docker.internal:11434
# OLLAMA_MODEL=llama3.2

# ── Memória de Agente (Mem0) ─────────────────────────────────────────────────
# Obtenha em: https://app.mem0.ai → API Keys
# Deixe em branco para usar fallback local (JSON)
MEM0_API_KEY=

# Para Mem0 self-hosted:
# MEM0_BASE_URL=http://mem0-server:8000

# ── Ngrok (opcional) ─────────────────────────────────────────────────────────
NGROK_AUTHTOKEN=seu_ngrok_authtoken_aqui
```

### 3. Iniciando os Contêineres
```bash
docker compose up -d --build
```

---

## 🖥️ Acessando o Dashboard

👉 **http://localhost:5173**

---

## 🔗 Configuração do Webhook no Jira

1. Exponha a porta do Backend/Nginx:
```bash
ngrok http 5173
```
2. No Jira, vá em **Configurações → Sistema → Webhooks → Criar Webhook**.
3. Configure:
   - **URL:** `https://abcd-123.ngrok-free.app/api/jira/webhook`
   - **Eventos:** `Issue → Transition`

---

## 🧠 Como o Agente Funciona (Workflows)

1. **Gatilho:** Você move a tarefa mãe no Jira para "Em Desenvolvimento".
2. **Webhook:** O Jira envia um JSON para `/api/jira/webhook`.
3. **Descoberta:** O sistema extrai o prefixo `[repo]` da tarefa e busca as subtarefas.
4. **Fila:** As subtarefas entram na fila do BullMQ (Redis).
5. **Git Sync:** O Worker clona/sincroniza o repositório e cria a branch `feature/<taskId>-<slug>`.
6. **SDD Discovery:** O agente escaneia o repositório por specs, rules e skills (agnóstico a qualquer ferramenta).
7. **Memória:** O agente recupera contexto de tarefas anteriores no mesmo repositório via Mem0.
8. **Desenvolvimento:** A IA implementa a tarefa seguindo as diretivas SDD descobertas.
9. **Commit & Push:** Commit automatizado com `feat: <ID> - <Description>`.
10. **Feedback no Jira:** Subtarefa movida para "Em Análise" com link do commit.

---

## 🛠️ Manutenção

```bash
# Ver logs do agente em tempo real
docker compose logs -f backend

# Reiniciar serviços
docker compose restart
```
