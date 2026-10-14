# CashBot

Plataforma web de gestão financeira pessoal e familiar. Começa como ferramenta de uso próprio, com arquitetura preparada para vários usuários, espaços compartilhados e futura comercialização.

Esta é a **v2**, refeita do zero na branch `v2`. A versão anterior (HTML/JS puro) foi preservada em [`legacy/`](legacy/) e continua publicada a partir do `main` até a troca ser aprovada.

## Estado atual (etapa 1 — fundação)

Implementado:

- **Autenticação real (Supabase Auth):** cadastro com e-mail e senha, confirmação por e-mail, login, logout, recuperação e redefinição de senha, sessão persistente, rotas protegidas, mensagens de erro em português e estados de carregamento.
- **Espaços financeiros:** todo usuário ganha um espaço **Pessoal** no cadastro. É possível criar espaços **Casal** e **Família**, alternar entre eles (a escolha é salva e vale em todos os dispositivos), renomear, excluir (só o proprietário), adicionar pessoas pelo e-mail, trocar papéis e sair do espaço.
- **Papéis:** proprietário, administrador e membro, com as regras aplicadas no banco (RLS + funções) e espelhadas na interface.
- **Categorias por espaço:** 12 categorias iniciais criadas automaticamente; criar, renomear, arquivar/reativar e excluir.
- **Configurações:** perfil (nome, troca de senha), aparência (automático/claro/escuro, salvo na conta), espaços, categorias e moeda principal.
- **Interface:** menu lateral no desktop, barra inferior + "Mais" no celular, dashboard com estados vazios (sem valores fictícios) e orientações de primeiros passos. As áreas Movimentações, Contas e cartões, Planejamento, Patrimônio e Relatórios mostram o que está por vir, sem botões que não funcionam.

Ainda **não** implementado (próximas etapas): movimentações, contas, cartões, parcelamentos, recorrências, orçamentos, metas, calendário, projeções, investimentos, patrimônio, dívidas, relatórios, Open Finance e cobrança.

## Tecnologias

React 18 + TypeScript · Vite · Tailwind CSS · componentes no padrão shadcn/ui (Radix) · React Router · TanStack Query · Lucide Icons · Supabase (Postgres, Auth, RLS) · Vitest + Testing Library · Vercel.

## Estrutura de pastas

```
├── legacy/                     # site antigo, preservado sem alterações
├── public/                     # arquivos estáticos (favicon)
├── src/
│   ├── components/
│   │   ├── ui/                 # componentes base (button, input, dialog, ...)
│   │   ├── layout/             # AppShell, navegação, seletor de espaço, logo
│   │   ├── ConfirmDialog.tsx   # confirmação de ações destrutivas
│   │   └── feedback.tsx        # carregamento, vazio, erro
│   ├── features/               # acesso a dados por domínio (TanStack Query)
│   │   ├── categories/ preferences/ profile/ spaces/
│   ├── lib/                    # supabase, tipos do banco, permissões, erros, utils
│   ├── providers/              # Auth, Theme, Space (espaço ativo)
│   ├── routes/
│   │   ├── auth/               # entrar, cadastro, recuperar e redefinir senha
│   │   ├── app/                # dashboard, áreas futuras, configurações
│   │   └── guards.tsx          # rotas protegidas / só para visitantes
│   └── test/setup.ts
├── supabase/
│   ├── migrations/             # migrações versionadas do banco
│   └── tests/rls_spaces.sql    # testes de autorização (RLS)
├── vercel.json                 # build, SPA e cabeçalhos de segurança
└── .env.example
```

## Configuração do ambiente

Requisitos: Node.js 20 ou mais recente.

```bash
npm install
cp .env.example .env.local   # preencha os valores
npm run dev                  # http://localhost:5173
```

### Variáveis necessárias

| Variável | Onde encontrar |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase → Project Settings → API Keys → chave **publishable** (ou a anon legada) |

Use somente a chave pública. A `service_role` **nunca** vai para o frontend. Sem as variáveis, o app mostra uma tela explicando a configuração pendente em vez de quebrar.

Na Vercel, cadastre as mesmas duas variáveis em Project Settings → Environment Variables (Preview e Production).

### Supabase Auth

Em Authentication → URL Configuration, inclua em **Redirect URLs** os endereços onde o app roda, por exemplo:

- `http://localhost:5173/**`
- `https://<seu-domínio>.vercel.app/**`

Sem isso, os links de confirmação de cadastro e de recuperação de senha não voltam para o app.

## Banco de dados

Migração: [`supabase/migrations/20261014130000_foundation_spaces.sql`](supabase/migrations/20261014130000_foundation_spaces.sql). Ela **não altera nem remove** as tabelas do CashBot antigo (`lancamentos`, `saldos`, `categorias`, `pessoas`, ...). A única mudança em objeto existente é a troca do gatilho de cadastro (`on_auth_user_created` → `on_auth_user_created_v2`).

| Tabela | Conteúdo |
| --- | --- |
| `profiles` | nome e avatar do usuário (1:1 com `auth.users`) |
| `spaces` | espaços financeiros: nome, tipo (`personal`, `couple`, `family`), proprietário, configurações |
| `space_members` | quem participa de cada espaço e com qual papel (`owner`, `admin`, `member`) |
| `user_preferences` | tema, moeda, idioma e espaço em uso |
| `categories` | categorias de receita e despesa de cada espaço |

Funções: `create_space`, `add_space_member`, `update_space_member_role` (validam o papel de quem chama) e `is_space_member`, `space_role`, `shares_space_with` (usadas pelas políticas, `SECURITY DEFINER` para evitar recursão).

### Regras de acesso (RLS)

- Visitantes anônimos não acessam nenhuma tabela.
- Cada pessoa só vê espaços, membros e categorias dos espaços dos quais participa.
- Perfis: cada um vê o próprio e o de quem divide algum espaço; edita só o próprio.
- Espaço pessoal: criado no cadastro, não aceita membros e não pode ser excluído.
- Criação de espaço só por `create_space` (o dono é sempre quem chama).
- Renomear: proprietário ou administrador. Excluir: só proprietário. Dono e tipo não mudam.
- Adicionar pessoas: proprietário (como membro ou administrador) ou administrador (só como membro). Trocar papéis: só proprietário. O proprietário não pode ser removido.
- Categorias: membros leem, criam e editam; proprietário e administrador excluem.
- Preferências: só o próprio usuário, e o espaço em uso precisa ser um espaço do qual ele participa.

### Aplicar a migração

No SQL Editor do Supabase, cole e execute o arquivo da migração. Com a CLI: `supabase db push` (projeto vinculado com `supabase link`).

## Testes

```bash
npm run typecheck   # verificação de tipos
npm run lint        # ESLint
npm test            # Vitest: regras de permissão, mensagens de erro e proteção de rotas
npm run build       # build de produção
```

Testes de autorização no banco: execute [`supabase/tests/rls_spaces.sql`](supabase/tests/rls_spaces.sql) no SQL Editor. Ele cria usuários de teste dentro de uma transação, verifica cerca de 40 regras e termina com o erro proposital `OK: todos os testes de RLS passaram`, que garante o rollback (nada fica gravado). Qualquer falha aparece como `FALHA: <descrição>`.

## Próximas etapas

1. Módulo de movimentações (receitas, despesas, transferências) ligado a categorias e espaços.
2. Contas bancárias e cartões de crédito, com faturas.
3. Parcelamentos e recorrências.
4. Orçamentos, metas e calendário de vencimentos.
5. Patrimônio, investimentos e dívidas.
6. Relatórios.
7. Migrar os lançamentos do CashBot antigo para o novo modelo e, depois, remover as tabelas antigas.
