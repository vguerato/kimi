# 🏛️ Especificação Arquitetural Frontend - SaaS Corporativo

Este documento define a arquitetura, estrutura de pastas e boas práticas para o desenvolvimento do ecossistema frontend da aplicação. O objetivo principal é garantir **manutenibilidade**, **isolamento de domínios** e **escala** para múltiplos desenvolvedores.

---

## 🚀 1. Stack Tecnológica Core

* **Framework:** Next.js (App Router)
* **Linguagem:** TypeScript (Strict Mode)
* **Gerenciamento de Estado Server/Cache:** TanStack Query (React Query)
* **Gerenciamento de Estado Client/UI:** Zustand
* **Formulários e Validação:** React Hook Form + Zod
* **Estilização e Componentes:** Tailwind CSS + Shadcn/ui (Radix UI)

---

## 📂 2. Estrutura de Pastas

O projeto adota uma abordagem **Feature-Based (Baseada em Funcionalidades)** combinada com camadas globais agnósticas.

```text
src/
├── app/                  # Provedores globais, middlewares e roteamento (Next.js)
├── assets/               # Mídias estáticas globais (imagens, fontes, ícones)
├── components/           # UI Kit global e agnóstico de negócio (Design System)
├── config/               # Variáveis de ambiente, constantes e configurações de runtime
├── features/             # Módulos isolados por domínio de negócio (SaaS Core)
│   ├── [nome-da-feature]/
│   │   ├── api/          # Queries, mutations e transformadores de dados do backend
│   │   ├── components/   # Componentes visuais exclusivos desta funcionalidade
│   │   ├── hooks/        # Estado local e regras de negócio complexas da funcionalidade
│   │   ├── types/        # Tipos e interfaces TypeScript restritos ao domínio
│   │   └── index.ts      # API Pública da feature (Barrel File)
├── hooks/                # Custom hooks de utilidade global (ex: useAuth, useTheme)
├── lib/                  # Inicialização e encapsulamento de SDKs externos (ex: axios, supabase)
├── stores/               # Estados globais de UI que cortam múltiplos domínios
└── utils/                # Funções utilitárias puras (ex: formatadores, validadores)
```

---

## 🔒 3. Regras de Acoplamento e Importação

Para evitar código espaguete e garantir que funcionalidades possam ser refatoradas ou removidas sem quebrar o sistema, aplicamos três regras estritas:

### 3.1. A Barreira do `index.ts` (API Pública)
Cada pasta dentro de `src/features/[nome-da-feature]` deve possuir um arquivo `index.ts`. Este arquivo dita o que o resto do software pode enxergar.
* **Regra:** Pastas de fora da feature **nunca** podem importar arquivos internos diretamente.
* **Incorreto ❌:** `import { UserCard } from '@/features/users/components/UserCard'`
* **Correto    ✅:** `import { UserCard } from '@/features/users'` (onde o `index.ts` exporta o componente).

### 3.2. Proibido Importações Cruzadas Diretas
Uma funcionalidade nunca deve depender de arquivos internos de outra funcionalidade.
* **Cenário:** Se a `Feature A` precisa de um componente visual desenvolvido dentro da `Feature B`:
  1. Avalie se o componente é genérico.
  2. Se sim, mova-o para a pasta global `src/components/`.
  3. Se não, a `Feature B` deve exportá-lo explicitamente em seu `index.ts` para que a `Feature A` o consuma via API pública.

### 3.3. Promoção de Escopo
O código deve começar o mais local possível. Mova para o escopo global apenas quando estritamente necessário.
* Comece criando o componente/hook dentro da pasta da própria feature.
* Se duas ou mais features independentes precisarem do mesmo recurso, promova-o para as pastas globais (`src/components`, `src/hooks`, etc.).

---

## 🛠️ 4. Fluxo de Dados e Camada de API (Anticorruption Layer)

Não expor contratos puros do backend diretamente para os componentes de UI. Toda requisição deve passar pelo encapsulamento do TanStack Query dentro da pasta `api/` de cada funcionalidade.

1. **Definição de Tipos:** Crie os tipos de resposta da API em `features/[feature]/types/`.
2. **Transformação de Dados (Mappers):** Se o backend retornar formatos inadequados para a UI (ex: `is_active_user: 1`), use funções adaptadoras antes de retornar o dado na Query.
3. **Encapsulamento em Hooks:** Sempre encapsule a chamada do TanStack Query em um hook customizado.

```typescript
// Exemplo: features/billing/api/useGetInvoices.ts
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import { Invoice } from '../types';

const getInvoices = async (): Promise<Invoice[]> => {
  const { data } = await api.get('/invoices');
  return data.map((item: any) => ({
    id: item.uuid,
    amount: item.total_cents / 100, // Adaptação de centavos para decimal
    dueDate: new Date(item.due_at),
  }));
};

export const useGetInvoices = () => {
  return useQuery({
    queryKey: ['invoices'],
    queryFn: getInvoices,
  });
};
```

---

## 🎨 5. Boas Práticas de Codificação

* **Regra dos Três (Componentes Enxutos):** Se um arquivo de componente passar de 150 linhas ou possuir mais de 3 estados locais, divida-o em subcomponentes menores ou extraia a lógica para um Custom Hook local.
* **Clean Code:** Prefira código autoexplicativo a comentários excessivos. Use nomes de variáveis descritivos (`isBillingLoading` em vez de `loading`).
* **Zustand com Moderação:** Não utilize estado global para fluxos de formulários ou dados de API. O Zustand deve gerenciar apenas estados voláteis da interface do usuário (ex: abrir barra lateral, guardar preferência de tema).