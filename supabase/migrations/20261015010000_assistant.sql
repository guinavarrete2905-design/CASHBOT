-- CashBot v2 — Assistente Financeiro (sem IA generativa).
-- Cria o histórico de conversas e funções de consulta agregada.
-- As funções são SECURITY INVOKER: rodam com as permissões de quem chama, então o RLS continua valendo.
-- Somente cria objetos novos.

------------------------------------------------------------------------------
-- Histórico de conversas (por usuário e espaço)
------------------------------------------------------------------------------
create table public.assistant_messages (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  space_id    uuid not null references public.spaces (id) on delete cascade,
  role        text not null check (role in ('user', 'assistant')),
  content     text not null check (char_length(content) between 1 and 4000),
  created_at  timestamptz not null default now()
);

-- Consulta principal: últimas mensagens de um usuário num espaço.
create index assistant_messages_user_space_idx on public.assistant_messages (user_id, space_id, created_at desc);

-- O autor é sempre quem está logado (não dá para gravar em nome de outra pessoa).
create or replace function public.assistant_messages_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.user_id := coalesce(auth.uid(), new.user_id);
  return new;
end;
$$;
create trigger assistant_messages_guard before insert on public.assistant_messages
  for each row execute function public.assistant_messages_guard();

alter table public.assistant_messages enable row level security;

create policy assistant_messages_select on public.assistant_messages for select to authenticated
  using (user_id = (select auth.uid()) and public.is_space_member(space_id));
create policy assistant_messages_insert on public.assistant_messages for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_space_member(space_id));
create policy assistant_messages_delete on public.assistant_messages for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.assistant_messages from anon;

------------------------------------------------------------------------------
-- Consultas agregadas (transferências não contam como receita nem despesa)
------------------------------------------------------------------------------

-- Totais de um período, opcionalmente de uma conta ou categoria.
create or replace function public.assistant_period_summary(
  p_space_id uuid,
  p_from date,
  p_to date,
  p_account_id uuid default null,
  p_category_id uuid default null
)
returns table (
  income numeric,
  expense numeric,
  pending_income numeric,
  pending_expense numeric,
  income_count bigint,
  expense_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    coalesce(sum(t.amount) filter (where t.kind = 'income'), 0),
    coalesce(sum(t.amount) filter (where t.kind = 'expense'), 0),
    coalesce(sum(t.amount) filter (where t.kind = 'income' and t.status = 'pending'), 0),
    coalesce(sum(t.amount) filter (where t.kind = 'expense' and t.status = 'pending'), 0),
    count(*) filter (where t.kind = 'income'),
    count(*) filter (where t.kind = 'expense')
  from public.transactions t
  where t.space_id = p_space_id
    and t.occurred_on between p_from and p_to
    and (p_account_id is null or t.account_id = p_account_id)
    and (p_category_id is null or t.category_id = p_category_id);
$$;

-- Despesas por categoria no período, da maior para a menor.
create or replace function public.assistant_expenses_by_category(p_space_id uuid, p_from date, p_to date)
returns table (category_id uuid, category_name text, total numeric, tx_count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select t.category_id, c.name, sum(t.amount), count(*)
  from public.transactions t
  left join public.categories c on c.id = t.category_id
  where t.space_id = p_space_id
    and t.kind = 'expense'
    and t.occurred_on between p_from and p_to
  group by t.category_id, c.name
  order by 3 desc;
$$;

-- Maiores despesas do período (no máximo 50).
create or replace function public.assistant_top_expenses(
  p_space_id uuid,
  p_from date,
  p_to date,
  p_limit integer default 5,
  p_category_id uuid default null
)
returns table (
  id uuid,
  description text,
  amount numeric,
  occurred_on date,
  status text,
  category_name text,
  account_name text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select t.id, t.description, t.amount, t.occurred_on, t.status, c.name, a.name
  from public.transactions t
  left join public.categories c on c.id = t.category_id
  left join public.accounts a on a.id = t.account_id
  where t.space_id = p_space_id
    and t.kind = 'expense'
    and t.occurred_on between p_from and p_to
    and (p_category_id is null or t.category_id = p_category_id)
  order by t.amount desc, t.occurred_on desc
  limit least(greatest(coalesce(p_limit, 5), 1), 50);
$$;

-- Receitas e despesas por mês no período.
create or replace function public.assistant_monthly_totals(p_space_id uuid, p_from date, p_to date)
returns table (month date, income numeric, expense numeric)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    date_trunc('month', t.occurred_on)::date,
    coalesce(sum(t.amount) filter (where t.kind = 'income'), 0),
    coalesce(sum(t.amount) filter (where t.kind = 'expense'), 0)
  from public.transactions t
  where t.space_id = p_space_id
    and t.occurred_on between p_from and p_to
  group by 1
  order by 1;
$$;

revoke execute on function
  public.assistant_period_summary(uuid, date, date, uuid, uuid),
  public.assistant_expenses_by_category(uuid, date, date),
  public.assistant_top_expenses(uuid, date, date, integer, uuid),
  public.assistant_monthly_totals(uuid, date, date)
  from public, anon;
grant execute on function
  public.assistant_period_summary(uuid, date, date, uuid, uuid),
  public.assistant_expenses_by_category(uuid, date, date),
  public.assistant_top_expenses(uuid, date, date, integer, uuid),
  public.assistant_monthly_totals(uuid, date, date)
  to authenticated;
