# Kiro AI - Jira Task Delegator 🤖

Plataforma full-stack inteligente que automatiza o desenvolvimento de tarefas do Jira delegando-as para um Agente de Inteligência Artificial (Kiro) alimentado pelo Google Gemini 1.5 Pro.

O sistema intercepta transições de status no Jira via Webhooks, automatiza o sincronismo de branches do Github localmente, escreve o código com base na descrição da subtarefa e finaliza fazendo commits padronizados e movendo a tarefa para code-review.

## 🛠️ Arquitetura e Stack
- **Backend:** Node.js, Express, TypeScript, LangChain (Core/Google GenAI)
- **Frontend:** React (Vite), Tailwind CSS v4, HeroUI v3
- **Fila e Processamento:** Redis + BullMQ
- **Banco de Dados:** SQLite (persistido em disco local via volume)
- **Infraestrutura:** Docker Compose, Nginx (Proxy Reverso)

---

## 🚀 Como Executar Localmente

### 1. Requisitos
- **Docker** e **Docker Compose** instalados.
- Uma chave de API do [Google AI Studio (Gemini)](https://aistudio.google.com/app/apikey).
- Um **Personal Access Token (PAT)** do Github (Classic) com permissões em `repo`.
- Um **API Token** do Jira (Atlassian) [Gerar Token Aqui](https://id.atlassian.com/manage-profile/security/api-tokens).

### 2. Configurando o Ambiente
Crie um arquivo `.env` na raiz do projeto (mesmo nível do `docker-compose.yml`):
```env
# Sua chave secreta do Gemini
GEMINI_API_KEY=AIzaSySuaChaveSecreta...

# (Opcional) Modelo Gemini a usar. Padrão: gemini-2.0-flash
# Outros: gemini-2.0-flash-lite, gemini-2.5-pro-preview-05-06
GEMINI_MODEL=gemini-2.0-flash

# (Opcional) Token do Ngrok para expor automaticamente o webhook via túnel HTTPS
# Obtenha em: https://dashboard.ngrok.com/get-started/your-authtoken
NGROK_AUTHTOKEN=seu_ngrok_authtoken_aqui
```

### 3. Iniciando os Contêineres
Na raiz do projeto, suba a infraestrutura:
```bash
docker compose up -d --build
```
> Isso irá baixar e construir o Node, Nginx e Redis, compilar o Frontend e rodar os Workers do Backend em segundo plano.

---

## 🖥️ Acessando o Dashboard

Acesse a interface administrativa (Frontend) no seu navegador:
👉 **http://localhost:5173**

### Configurações Iniciais no Dashboard
No painel **"Settings"**, preencha **obrigatoriamente** todos os campos para que o agente tenha autorização para atuar:
- **Repo Directory:** O caminho base onde os repositórios serão salvos.
- **Git PAT:** O Personal Access Token do Github para acessar repositórios privados e fazer commits.
- **Jira URL:** A URL da sua empresa no Jira (Ex: `https://sua-empresa.atlassian.net`).
- **Jira Email:** O e-mail da sua conta Atlassian.
- **Jira API Token:** O token gerado no painel da Atlassian.

Clique em **Save Settings**. (Os dados ficam criptografados/salvos no volume local do SQLite).

---

## 🔗 Configuração do Webhook no Jira

Para que o Jira avise seu sistema local que uma nova tarefa precisa ser feita, você precisará expor a sua porta local para a internet (usando ferramentas como o Ngrok, Cloudflare Tunnels, etc).

1. Exponha a porta do Backend/Nginx:
```bash
ngrok http 5173
```
*(Anote a URL HTTPS gerada, ex: `https://abcd-123.ngrok-free.app`)*

2. No Jira, vá em **Configurações (Engrenagem) -> Sistema -> Webhooks** (ou pesquise por "Webhooks").
3. Clique em **Criar Webhook**.
4. Configure os dados:
   - **Nome:** `Kiro AI Delegator`
   - **URL:** `https://abcd-123.ngrok-free.app/api/webhook` *(substitua pela sua URL do ngrok/tunnel)*
   - **Eventos:** Em "Issue", marque apenas **`Transition`** (ou `Updated`).
   - **Filtro JQL (Opcional):** Você pode restringir para disparar apenas no seu projeto: `project = "MEUPROJETO" AND issuetype = "Sub-task"`.

---

## 🧠 Como o Agente Funciona (Workflows)

1. **Gatilho:** Você move a tarefa mãe no Jira para "Em Desenvolvimento".
2. **Webhook:** O Jira envia um JSON via Webhook para a rota `/api/webhook` do sistema.
3. **Descoberta:** O sistema extrai o prefixo do nome da tarefa (ex: `[balance] Criar botão X`) para deduzir qual é o repositório (`balance`) e busca todas as subtarefas dessa issue usando a API do Jira.
4. **Fila:** As subtarefas identificadas entram na fila do BullMQ (Redis).
5. **Git Sync:** O Worker inicia o `GitService`, que clona ou faz o `fetch/pull` do repositório mapeado, criando automaticamente a branch local `feature/<taskId>-<slug>`.
6. **Desenvolvimento (Kiro AI):** A IA lê a descrição da tarefa. Equipada com ferramentas bash (`execute_terminal_command`) e manipulação de arquivos (`write_file`), navega pela arquitetura, busca arquivos necessários, codifica a funcionalidade e realiza testes estáticos locais.
7. **Commit & Deploy:** Ao finalizar as mudanças, a IA faz os commits automatizados padronizados (ex: `feat: <ID> - <Description>`).
8. **Feedback no Jira:** A subtarefa é movida automaticamente para o status **"Em Espera"**. Quando todas as subtarefas ativas são finalizadas, a tarefa mãe vai para **"Code Review"**.

---

## 🛠️ Manutenção

- **Ver Logs da IA:**
  ```bash
  docker compose logs -f backend
  ```
  *(O Kiro exibe exatamente quais comandos ele está rodando no terminal pelo log e o raciocínio em tempo real).*

- **Reiniciar os serviços:**
  ```bash
  docker compose restart
  ```
