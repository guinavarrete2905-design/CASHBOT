-- CashBot v2 — contas, cartões de crédito e transferências.
-- Altera somente a tabela transactions (criada na v2): adiciona conta, conta de destino e o tipo "transfer".

------------------------------------------------------------------------------
-- Contas e cartões
------------------------------------------------------------------------------
create table public.accounts (
  id               uuid primary key default gen_random_uuid(),
  space_id         uuid not null references public.spaces (id) on delete cascade,
  name             text not null check (char_length(btrim(name)) between 1 and 60),
  type             text not null check (type in ('checking', 'savings', 'wallet', 'investment', 'credit_card')),
  -- Contas: saldo no dia em que começou a usar o CashBot (pode ser negativo).
  initial_balance  numeric(14, 2) not null default 0 check (abs(initial_balance) < 1000000000000),
  -- Cartões: limite e dias de fechamento/vencimento da fatura.
  credit_limit     numeric(14, 2) check (credit_limit is null or (credit_limit >= 0 and credit_limit < 1000000000000)),
  closing_day      smallint check (closing_day between 1 and 31),
  due_day          smallint check (due_day between 1 and 31),
  archived         boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint accounts_card_fields check (
    -- Cartão: saldo inicial só pode ser zero ou negativo (valor já em aberto ao começar).
    (type = 'credit_card' and closing_day is not null and due_day is not null and initial_balance <= 0)
    or (type <> 'credit_card' and closing_day is null and due_day is null and credit_limit is null)
  )
);

create unique index accounts_unique_name on public.accounts (space_id, lower(btrim(name)));

create trigger accounts_updated_at before update on public.accounts
  for each row execute function public.set_updated_at();

-- Uma conta não muda de espaço nem vira/deixa de ser cartão.
create or replace function public.accounts_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.space_id <> old.space_id then
    raise exception 'Uma conta não pode mudar de espaço.' using errcode = '42501';
  end if;
  if (new.type = 'credit_card') <> (old.type = 'credit_card') then
    raise exception 'Não é possível transformar uma conta em cartão (ou o contrário). Crie uma nova.' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger accounts_guard before update on public.accounts
  for each row execute function public.accounts_guard();

alter table public.accounts enable row level security;

create policy accounts_select on public.accounts for select to authenticated
  using (public.is_space_member(space_id));
create policy accounts_insert on public.accounts for insert to authenticated
  with check (public.space_role(space_id) in ('owner', 'admin'));
create policy accounts_update on public.accounts for update to authenticated
  using (public.space_role(space_id) in ('owner', 'admin'))
  with check (public.space_role(space_id) in ('owner', 'admin'));
create policy accounts_delete on public.accounts for delete to authenticated
  using (public.space_role(space_id) in ('owner', 'admin'));

revoke all on public.accounts from anon;

------------------------------------------------------------------------------
-- Movimentações: conta, transferência
------------------------------------------------------------------------------
alter table public.transactions
  add column account_id uuid references public.accounts (id) on delete restrict,
  add column transfer_account_id uuid references public.accounts (id) on delete restrict;

alter table public.transactions drop constraint transactions_kind_check;
alter table public.transactions add constraint transactions_kind_check
  check (kind in ('income', 'expense', 'transfer'));
alter table public.transactions add constraint transactions_transfer_shape check (
  (kind = 'transfer' and account_id is not null and transfer_account_id is not null
     and account_id <> transfer_account_id and category_id is null)
  or (kind <> 'transfer' and transfer_account_id is null)
);

create index transactions_account_idx on public.transactions (account_id, occurred_on) where account_id is not null;
create index transactions_transfer_account_idx on public.transactions (transfer_account_id, occurred_on)
  where transfer_account_id is not null;

-- Regras de integridade: categoria e contas do mesmo espaço; categoria do mesmo tipo.
create or replace function public.transactions_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_space uuid;
  v_kind text;
begin
  if tg_op = 'UPDATE' then
    if new.space_id <> old.space_id then
      raise exception 'Uma movimentação não pode mudar de espaço.' using errcode = '42501';
    end if;
    new.created_by := old.created_by;
  else
    new.created_by := coalesce(auth.uid(), new.created_by);
  end if;

  if new.category_id is not null then
    select c.space_id, c.kind into v_space, v_kind from public.categories c where c.id = new.category_id;
    if v_space is distinct from new.space_id then
      raise exception 'A categoria escolhida não pertence a este espaço.' using errcode = '23514';
    end if;
    if v_kind is distinct from new.kind then
      raise exception 'A categoria escolhida não combina com o tipo da movimentação.' using errcode = '23514';
    end if;
  end if;

  if new.account_id is not null then
    select a.space_id into v_space from public.accounts a where a.id = new.account_id;
    if v_space is distinct from new.space_id then
      raise exception 'A conta escolhida não pertence a este espaço.' using errcode = '23514';
    end if;
  end if;

  if new.transfer_account_id is not null then
    select a.space_id into v_space from public.accounts a where a.id = new.transfer_account_id;
    if v_space is distinct from new.space_id then
      raise exception 'A conta de destino não pertence a este espaço.' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

------------------------------------------------------------------------------
-- Saldo de cada conta (somente o que já foi pago/recebido).
-- Em cartões, o saldo é negativo: é o valor em aberto.
-- security_invoker: a visão respeita o RLS de quem consulta.
------------------------------------------------------------------------------
create view public.account_balances
with (security_invoker = true)
as
select
  a.id as account_id,
  a.space_id,
  a.initial_balance + coalesce(sum(
    case
      when t.account_id = a.id and t.kind = 'income' then t.amount
      when t.account_id = a.id and t.kind in ('expense', 'transfer') then -t.amount
      when t.transfer_account_id = a.id then t.amount
      else 0
    end
  ) filter (where t.status = 'paid'), 0)::numeric(14, 2) as balance
from public.accounts a
left join public.transactions t
  on t.space_id = a.space_id
 and (t.account_id = a.id or t.transfer_account_id = a.id)
group by a.id, a.space_id, a.initial_balance;

revoke all on public.account_balances from anon;
grant select on public.account_balances to authenticated;
