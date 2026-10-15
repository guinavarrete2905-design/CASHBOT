# CashBot

Plataforma web de gestão financeira pessoal e familiar. Começa como ferramenta de uso próprio, com arquitetura preparada para vários usuários, espaços compartilhados e futura comercialização.

Esta é a **v2**, refeita do zero em React + Supabase e publicada na Vercel a partir do `main`. A versão anterior (HTML/JS puro) foi preservada em [`legacy/`](legacy/) apenas como referência; ela não é mais publicada.

## O que já funciona



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
- **Lançamento em massa:** em Movimentações, botão "Lançamento em massa" abre uma planilha editável (Data, Tipo, Descrição, Valor, Conta, Categoria/destino, Situação, Repetição, Observações). Adicionar 1 ou 10 linhas, duplicar, excluir, repetir data/conta/categoria/situação para baixo, navegação por teclado e colagem direto do Excel/Google Planilhas. Valida cada célula com as mesmas regras do formulário, mostra resumo ao vivo, revisão com alerta de possíveis duplicados e grava tudo de uma vez (tudo ou nada). No celular, cada linha vira um cartão.
- **Assistente Financeiro (sem IA generativa):** chat que consulta os dados reais do espaço atual, registra movimentações com prévia e confirmação e explica conceitos financeiros. Detalhes em [Assistente Financeiro](#assistente-financeiro).

Ainda **não** implementado:

- **Open Finance:** não há conexão automática com bancos; extratos e faturas entram por arquivo (CSV, OFX, XLSX) no Lançamento em massa.
- **Cobrança e planos:** não há assinatura, pagamento nem limites por plano.
- **Histórico de faturas:** o cartão mostra só a fatura atual e a última fechada; "Pagar fatura" gera a transferência, mas a fatura não fica marcada como paga.
- **Convites por e-mail:** só dá para adicionar ao espaço quem já tem conta no CashBot; nenhum e-mail de convite é enviado.
- **Foto de perfil:** o campo existe no banco (`profiles.avatar_url`), mas não há envio de imagem.
- **Importação de PDF e de `.xls` antigo:** só CSV, OFX e XLSX.
- **Outros idiomas:** a interface é só em português (o campo `user_preferences.locale` existe no banco, sem tela).
- **Dados do CashBot antigo:** os lançamentos não foram importados (decisão de começar do zero) e as tabelas antigas continuam no banco, intactas.

## Tecnologias

React 18 + TypeScript · Vite · Tailwind CSS · componentes no padrão shadcn/ui (Radix) · React Router · TanStack Query · Lucide Icons · Supabase (Postgres, Auth, RLS) · Vitest + Testing Library · Vercel.

## Estrutura de pastas

```
├── docs/                       # cobertura do Assistente Financeiro
├── legacy/                     # site antigo (HTML/JS), só como referência
├── public/                     # arquivos estáticos (favicon)
├── scripts/
│   ├── assistant/coverage.ts   # gera docs/assistente-cobertura.md
│   └── node-test/              # roda testes sem React direto no Node
├── src/
│   ├── components/
│   │   ├── ui/                 # componentes base (button, input, dialog, ...)
│   │   ├── layout/             # AppShell, navegação, seletor de espaço, logo
│   │   ├── ConfirmDialog.tsx   # confirmação de ações destrutivas
│   │   └── feedback.tsx        # carregamento, vazio, erro
│   ├── features/               # dados (TanStack Query), regras e diálogos por domínio
│   │   ├── accounts/           # contas, cartões e faturas
│   │   ├── assistant/          # Assistente Financeiro
│   │   ├── planning/           # orçamento e metas
│   │   ├── reports/            # relatórios
│   │   ├── transactions/       # movimentações, parcelas, recorrências
│   │   │   └── bulk/           # lançamento em massa e importação de arquivos
│   │   ├── wealth/             # patrimônio
│   │   └── categories/ preferences/ profile/ spaces/
│   ├── lib/                    # supabase, tipos do banco, dinheiro, datas, permissões, erros
│   ├── providers/              # Auth, Theme, Space (espaço ativo)
│   ├── routes/
│   │   ├── auth/               # entrar, cadastro, recuperar e redefinir senha
│   │   ├── app/                # início, movimentações, contas, planejamento,
│   │   │                       # patrimônio, relatórios, configurações
│   │   ├── ConfigMissingPage.tsx  # aviso quando faltam as variáveis do Supabase
│   │   └── guards.tsx          # rotas protegidas / só para visitantes
│   └── test/setup.ts
├── supabase/
│   ├── migrations/             # migrações versionadas do banco
│   └── tests/                  # testes de autorização (RLS), um por área
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

### Publicação na Vercel

O projeto da Vercel é ligado a este repositório: cada push no `main` publica em produção e cada branch ganha uma prévia. O [`vercel.json`](vercel.json) define o build (`npm run build`, saída em `dist/`), o redirecionamento de todas as rotas para o `index.html` (SPA) e cabeçalhos de segurança.

Cadastre as mesmas duas variáveis em Project Settings → Environment Variables, para Preview e Production. Como o Vite embute as variáveis no build, depois de alterar alguma é preciso publicar de novo.

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
7. [`20261015010000_assistant.sql`](supabase/migrations/20261015010000_assistant.sql) — histórico do Assistente Financeiro e funções de consulta agregada.
8. [`20261015030000_transactions_batch.sql`](supabase/migrations/20261015030000_transactions_batch.sql) — função `create_transactions_batch` do lançamento em massa.

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
| `assistant_messages` | histórico do Assistente Financeiro, por usuário e espaço (só o próprio usuário lê e apaga) |
| `account_balances` (visão) | saldo de cada conta, só com o que já foi pago/recebido; respeita o RLS de quem consulta |

Funções: `create_space`, `add_space_member`, `update_space_member_role` (validam o papel de quem chama) e `is_space_member`, `space_role`, `shares_space_with` (usadas pelas políticas, `SECURITY DEFINER` para evitar recursão). Lançamento em massa: `create_transactions_batch(espaço, lote, linhas)` grava o lote inteiro numa única transação (qualquer erro desfaz tudo), roda com as permissões de quem chama (RLS e o gatilho `transactions_guard` valem) e marca cada linha com `external_ref = lote:<id>:<posição>`, então reenviar o mesmo lote não duplica. Para o assistente: `assistant_period_summary`, `assistant_expenses_by_category`, `assistant_top_expenses` e `assistant_monthly_totals` — consultas agregadas `SECURITY INVOKER` (rodam com as permissões de quem chama, então o RLS vale), só para usuários autenticados.

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
- Histórico do assistente: cada pessoa lê, grava e apaga só as próprias mensagens, e só em espaços dos quais participa. Não há edição.
- Movimentações: todos os participantes do espaço veem, lançam e editam; excluir é permitido a quem lançou e ao proprietário/administrador. A categoria precisa ser do mesmo espaço e do mesmo tipo; uma movimentação não muda de espaço; o autor é sempre quem lançou. Excluir uma categoria deixa as movimentações sem categoria.

### Aplicar as migrações

No SQL Editor do Supabase, cole e execute cada arquivo de migração, na ordem. Com a CLI: `supabase db push` (projeto vinculado com `supabase link`).

## Testes

```bash
npm run typecheck   # verificação de tipos
npm run lint        # ESLint
npm test            # Vitest: permissões, erros, rotas, valores em reais, datas, totais, faturas, parcelas, orçamento, metas, relatórios, patrimônio, lançamento em massa, importação e assistente
npm run build       # build de produção
```

Testes de autorização no banco: execute no SQL Editor cada arquivo de [`supabase/tests/`](supabase/tests/) (`rls_spaces`, `rls_transactions`, `rls_accounts`, `rls_series`, `rls_planning`, `rls_wealth`, `rls_assistant` e `rls_batch`), depois de aplicar as migrações. Eles criam usuários de teste dentro de uma transação, verificam as regras e terminam com um erro proposital começando por `OK:`, que garante o rollback (nada fica gravado). Qualquer falha aparece como `FALHA: <descrição>`.

Sem acesso ao registro do npm, os testes puros (sem React) também rodam direto no Node:

```bash
scripts/node-test/t.sh src/features/assistant/*.test.ts      # ou qualquer arquivo *.test.ts sem React
node --experimental-strip-types --no-warnings --import ./scripts/node-test/register.mjs scripts/assistant/coverage.ts --write
```

## Lançamento em massa

Fica em `src/features/transactions/bulk/`: `model.ts` (interpretação, validação, colagem, duplicados, resumo e geração do lote — sem React, testado em `model.test.ts`), `api.ts` (gravação e consulta de duplicados) e `BulkEntryDialog.tsx` (interface, carregada sob demanda).

Decisões:

- **Mesmas regras do formulário:** `validateTransaction`, situação no cartão (`effectiveStatus`), parcelas e recorrências por `buildSeries` (centavos distribuídos sem perda, futuras pendentes, no cartão todas na fatura), limites de 2–48 parcelas e 2–60 meses, transferência não pode ser parcelada. Contas e categorias arquivadas não são aceitas.
- **Sem adivinhação:** data só DD/MM/AAAA (ou AAAA-MM-DD), nunca troca dia e mês; valor com um separador e três dígitos ("1.234", "1,234") é ambíguo e vira erro; tipo, conta, categoria, situação ou repetição colados sem correspondência ficam marcados na célula.
- **Estados das linhas:** em branco (ignorada), incompleta, com erro, válida. Só dá para revisar com todas as linhas preenchidas válidas.
- **Valores no resumo:** como informados na linha (parcelado = total da compra; todo mês = valor de um mês). Na revisão, os totais somam todas as movimentações que serão criadas, com as parcelas e meses futuros contados à parte.
- **Duplicados:** mesma data + valor + descrição + conta, na planilha ou já gravado. É só um alerta: dá para remover a linha ou salvar assim mesmo.
- **Importar arquivo:** extrato do banco ou fatura do cartão em CSV, OFX ou XLSX (`bulk/import/`). OFX é lido direto; CSV/XLSX têm detecção de cabeçalho, colunas (data, descrição, valor ou crédito/débito, tipo C/D), formato de data e de número, que o usuário confirma ou ajusta. Extrato: negativo = saída; fatura: positivo = compra, negativo = estorno, e "pagamento" vira transferência para o cartão com a origem em aberto. Linhas de saldo/total são ignoradas com o motivo. Categoria sugerida pelas palavras-chave do assistente. Tudo entra na planilha para revisão; o alerta de duplicados acusa o que já foi lançado. O leitor de XLSX é próprio (ZIP + XML com `DecompressionStream`), sem dependências; `.xls` antigo não é suportado.
- **Gravação:** uma chamada a `create_transactions_batch`. Tudo ou nada; o id do lote é mantido enquanto o conteúdo não muda, então tentar de novo depois de uma falha nunca duplica.

## Assistente Financeiro

Assistente conversacional **baseado em regras**: não usa OpenAI, Anthropic, Gemini nem qualquer modelo generativo, não envia mensagens para serviços externos e não tem custo recorrente. Botão "Assistente Financeiro" no menu lateral (desktop) e ícone no topo (celular); painel lateral no computador e tela cheia no celular. O código só é baixado quando o painel é aberto pela primeira vez.

Arquitetura (`src/features/assistant/`):

| Módulo | Arquivo | Papel |
| --- | --- | --- |
| A. Interpretador de intenções | `normalize.ts`, `parse.ts`, `intents.ts` | normaliza o texto (acentos, abreviações, erros de digitação), extrai valores, datas, períodos, parcelas, categorias e contas, e pontua ~50 intenções por regras |
| B. Motor de regras | `engine.ts` | decide a intenção considerando contexto e ambiguidade (pergunta quando há empate) e chama o tratador |
| C. Motor de consultas | `queries.ts` | consultas fixas e autorizadas ao Supabase com a sessão do usuário (RLS sempre vale); nada da mensagem vira SQL |
| D. Motor de cálculos | `calc.ts` + funções já existentes (faturas, orçamento, metas, patrimônio) | variações, participações, juros simples/compostos, Price, planos de economia |
| E. Base de conhecimento | `knowledge/` | 47 artigos em 5 categorias, carregados sob demanda; sem taxas atuais, temas que mudam marcados como "depende de atualização" |
| F. Gerenciador de conversas | `types.ts` (`ConversationContext`) | último período, filtros e resultados ("E em outubro?", "Qual a diferença?"), perguntas em aberto e rascunhos pendentes |
| G. Interface | `AssistantLauncher.tsx`, `AssistantPanel.tsx` | botão discreto, histórico, sugestões, cartões de confirmação, links para as telas |

Lançamentos: o assistente prepara um rascunho (descrição, valor, data, categoria, conta/cartão, espaço, parcelamento) e mostra **CONFIRMAR / EDITAR / CANCELAR**. Nada é salvo sem confirmação. A gravação usa o mesmo serviço e as mesmas validações do formulário (`validateTransaction`), e cada rascunho tem um código único gravado em `external_ref` (`assistente:<id>`): confirmar duas vezes não duplica. EDITAR abre o formulário normal já preenchido. Até 5 itens por mensagem; para mais, o assistente indica o Lançamento em massa em Movimentações.

Cobertura: [`docs/assistente-cobertura.md`](docs/assistente-cobertura.md) (conjunto de 210 perguntas de referência, gerado por `scripts/assistant/coverage.ts`).

Limitações: não acessa taxas e cotações atuais; não dá orientação tributária, jurídica ou recomendação individual de investimento; não altera permissões nem edita/exclui movimentações; frases muito diferentes das previstas podem não ser entendidas (nesse caso ele diz que não entendeu e sugere perguntas). O histórico guarda o texto das mensagens (protegido por RLS e apagável pelo usuário).

## Próximas etapas

1. Histórico de faturas e marcação de fatura paga.
2. Convite por e-mail para quem ainda não tem conta.
3. Open Finance (importação automática de extratos e faturas).
4. Cobrança e planos, para a comercialização.
5. Remover as tabelas do CashBot antigo, quando você decidir.
