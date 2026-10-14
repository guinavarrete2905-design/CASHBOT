# CashBot

Plataforma web de gestão financeira pessoal e familiar. Começa como ferramenta de uso próprio, com arquitetura preparada para vários usuários, espaços compartilhados e futura comercialização.

Esta é a **v2**, refeita do zero na branch `v2`. A versão anterior (HTML/JS puro) foi preservada em [`legacy/`](legacy/) e continua publicada a partir do `main` até a troca ser aprovada.

## Estado atual (etapa 7 — patrimônio)

Implementado:

- **Autenticação real (Supabase Auth):** cadastro com e-mail e senha, confirmação por e-mail, login, logout, recuperação e redefinição de senha, sessão persistente, rotas protegidas, mensagens de erro em português e estados de carregamento.
- **Espaços financeiros:** todo usuário ganha um espaço **Pessoal** no cadastro. É possível criar espaços **Casal** e **Família**, alternar entre eles (a escolha é salva e vale em todos os dispositivos), renomear, excluir (só o proprietário), adicionar pessoas pelo e-mail, trocar papéis e sair do espaço.
- **Papéis:** proprietário, administrador e membro, com as regras aplicadas no banco (RLS + funções) e espelhadas na interface.
- **Categorias por espaço:** 12 categorias iniciais criadas automaticamente; criar, renomear, arquivar/reativar e excluir.
- **Configurações:** perfil (nome, troca de senha), aparência (automático/claro/escuro, salvo na conta), espaços, categorias e moeda principal.
- **Movimentações:** receitas e despesas por espaço, com valor, descrição, data, categoria, situação (paga/a pagar, recebida/a receber) e observações. Lista por mês agrupada por dia, navegação entre meses, filtros por tipo, categoria e busca, edição e exclusão com confirmação, atalho "Salvar e lançar outra" e botão flutuante no celular.
- **Contas e cartões:** conta corrente, poupança, dinheiro, investimento e cartão de crédito. Cada conta tem saldo inicial e saldo atualizado a cada lançamento pago. Cartões têm limite, dia de fechamento e de vencimento, valor em aberto, fatura atual e última fatura fechada, e botão "Pagar fatura" (gera uma transferência da conta para o cartão). Contas podem ser arquivadas; só podem ser excluídas se não tiverem movimentações.
- **Parcelas e recorrências:** ao lançar, escolha "Parcelado" (informa o total e o número de parcelas; os centavos são distribuídos sem perda) ou "Todo mês" (repete o mesmo valor por N meses). As ocorrências futuras ficam pendentes; no cartão, cada parcela entra na fatura do seu mês. Na edição e na exclusão, escolha "Só esta", "Esta e as próximas" ou "Todas". As listas mostram a posição (ex.: 3/10).
- **Planejamento:** orçamento mensal por categoria de despesa (limite que vale todos os meses), com barra de uso, aviso a partir de 80% e quando passa do limite, e lista de gastos em categorias sem limite. Metas com valor, quanto já foi guardado, prazo opcional e quanto guardar por mês. Próximos vencimentos (atrasados e próximos 60 dias). O Início mostra o resumo do orçamento.
- **Relatórios:** período de 3, 6 ou 12 meses ou o ano atual, considerando tudo ou só o que já foi pago/recebido. Totais (receitas, despesas, resultado e quanto sobrou da renda), gastos por categoria com participação, receitas x despesas por mês e comparativo de despesas por categoria com o mês anterior. Exportação em CSV no padrão do Excel em português (";" e vírgula decimal).
- **Patrimônio:** bens e investimentos (imóvel, veículo, aplicação, outros) com valor atual; dívidas e financiamentos com saldo devedor e parcela; patrimônio líquido = contas + bens − dívidas − cartões. O histórico mensal é gravado pelo banco (função `record_net_worth_snapshot`) ao abrir a página e a cada alteração, e vira o gráfico de evolução.
- **Transferências** entre contas (não contam como receita nem despesa), lançamentos ligados a uma conta ou cartão e filtro por conta na lista de movimentações.
- **Dashboard com dados reais:** receitas, despesas e resultado do mês (com o que ainda está pendente), movimentações recentes, lista de contas a pagar e a receber (destacando as atrasadas) e gráfico de receitas x despesas dos últimos 6 meses.
- **Interface:** menu lateral no desktop, barra inferior + "Mais" no celular. Todas as áreas do menu estão implementadas.

Ainda **não** implementado (próximas etapas): contas e saldos, cartões e faturas, transferências, parcelamentos, recorrências, orçamentos, metas, projeções, investimentos, patrimônio, dívidas, relatórios, importação de extratos, Open Finance e cobrança. Os lançamentos do CashBot antigo **não** foram importados (decisão de começar do zero).

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

Migrações, em ordem:

1. [`20261014130000_foundation_spaces.sql`](supabase/migrations/20261014130000_foundation_spaces.sql) — perfis, espaços, membros, preferências, categorias.
2. [`20261014150000_transactions.sql`](supabase/migrations/20261014150000_transactions.sql) — movimentações.
3. [`20261014170000_accounts.sql`](supabase/migrations/20261014170000_accounts.sql) — contas, cartões, transferências e a visão `account_balances`.
4. [`20261014190000_transaction_series.sql`](supabase/migrations/20261014190000_transaction_series.sql) — séries (parcelas e recorrências).
5. [`20261014210000_planning.sql`](supabase/migrations/20261014210000_planning.sql) — orçamentos e metas.
6. [`20261014230000_wealth.sql`](supabase/migrations/20261014230000_wealth.sql) — bens, dívidas e histórico do patrimônio.

A primeira **não altera nem remove** as tabelas do CashBot antigo (`lancamentos`, `saldos`, `categorias`, `pessoas`, ...). A única mudança em objeto existente é a troca do gatilho de cadastro (`on_auth_user_created` → `on_auth_user_created_v2`).

| Tabela | Conteúdo |
| --- | --- |
| `profiles` | nome e avatar do usuário (1:1 com `auth.users`) |
| `spaces` | espaços financeiros: nome, tipo (`personal`, `couple`, `family`), proprietário, configurações |
| `space_members` | quem participa de cada espaço e com qual papel (`owner`, `admin`, `member`) |
| `user_preferences` | tema, moeda, idioma e espaço em uso |
| `categories` | categorias de receita e despesa de cada espaço |
| `transactions` | movimentações: tipo (receita, despesa, transferência), valor (sempre positivo), data, categoria, conta, conta de destino, situação, observações, autor e, quando fizer parte de uma série, `series_id`, tipo da série (parcelado/mensal), posição e total |
| `accounts` | contas e cartões: tipo, saldo inicial, limite, dias de fechamento e vencimento, arquivada |
| `budgets` | limite mensal por categoria de despesa (um por categoria) |
| `goals` | metas: nome, valor, quanto já foi guardado, prazo, autor |
| `assets` | bens e investimentos com valor atual |
| `liabilities` | dívidas e financiamentos: saldo devedor e parcela |
| `net_worth_snapshots` | patrimônio de cada mês por espaço (gravado só pela função `record_net_worth_snapshot`) |
| `account_balances` (visão) | saldo de cada conta, só com o que já foi pago/recebido; respeita o RLS de quem consulta |

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
- Contas: todos os participantes veem e usam nos lançamentos; só proprietário e administrador cadastram, editam, arquivam e excluem. Conta com movimentações não pode ser excluída. Conta não vira cartão (nem o contrário).
- Orçamentos e metas: todos os participantes veem e editam; a categoria do orçamento precisa ser de despesa e do mesmo espaço; meta é excluída por quem criou ou pelo proprietário/administrador.
- Patrimônio: participantes veem e editam bens e dívidas; exclusão por quem cadastrou ou proprietário/administrador. O histórico só é gravado pela função, que confere se quem chama participa do espaço.
- Movimentações: todos os participantes do espaço veem, lançam e editam; excluir é permitido a quem lançou e ao proprietário/administrador. A categoria precisa ser do mesmo espaço e do mesmo tipo; uma movimentação não muda de espaço; o autor é sempre quem lançou. Excluir uma categoria deixa as movimentações sem categoria.

### Aplicar as migrações

No SQL Editor do Supabase, cole e execute cada arquivo de migração, na ordem. Com a CLI: `supabase db push` (projeto vinculado com `supabase link`).

## Testes

```bash
npm run typecheck   # verificação de tipos
npm run lint        # ESLint
npm test            # Vitest: permissões, erros, rotas, valores em reais, datas, totais, faturas, parcelas, orçamento, metas, relatórios e patrimônio
npm run build       # build de produção
```

Testes de autorização no banco: execute no SQL Editor [`supabase/tests/rls_spaces.sql`](supabase/tests/rls_spaces.sql), [`supabase/tests/rls_transactions.sql`](supabase/tests/rls_transactions.sql) e [`supabase/tests/rls_accounts.sql`](supabase/tests/rls_accounts.sql) , [`supabase/tests/rls_series.sql`](supabase/tests/rls_series.sql), [`supabase/tests/rls_planning.sql`](supabase/tests/rls_planning.sql) e [`supabase/tests/rls_wealth.sql`](supabase/tests/rls_wealth.sql). Eles criam usuários de teste dentro de uma transação, verificam as regras e terminam com um erro proposital começando por `OK:`, que garante o rollback (nada fica gravado). Qualquer falha aparece como `FALHA: <descrição>`.

## Próximas etapas

1. Publicar a v2 no endereço oficial (trocar o `main`) e configurar as variáveis de produção na Vercel.
2. Histórico de faturas e marcação de fatura paga.
3. Orçamentos, metas e calendário de vencimentos.
4. Importação de extratos (OFX/CSV), usando `transactions.external_ref` para não duplicar.
5. Patrimônio, investimentos e dívidas.
6. Relatórios.
7. Remover as tabelas do CashBot antigo, quando você decidir.
