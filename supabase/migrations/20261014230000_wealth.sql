-- CashBot v2 — patrimônio: bens e investimentos, dívidas e financiamentos, histórico mensal.
-- Somente cria objetos novos.

------------------------------------------------------------------------------
-- Bens e investimentos
------------------------------------------------------------------------------
create table public.assets (
  id          uuid primary key default gen_random_uuid(),
  space_id    uuid not null references public.spaces (id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 80),
  type        text not null check (type in ('investment', 'property', 'vehicle', 'other')),
  value       numeric(14, 2) not null check (value >= 0 and value < 1000000000000),
  notes       text check (notes is null or char_length(notes) <= 500),
  archived    boolean not null default false,
  created_by  uuid references auth.users (id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index assets_space_idx on public.assets (space_id);

------------------------------------------------------------------------------
-- Dívidas e financiamentos (saldo devedor atual)
------------------------------------------------------------------------------
create table public.liabilities (
  id               uuid primary key default gen_random_uuid(),
  space_id         uuid not null references public.spaces (id) on delete cascade,
  name             text not null check (char_length(btrim(name)) between 1 and 80),
  type             text not null check (type in ('financing', 'loan', 'other')),
  balance          numeric(14, 2) not null check (balance >= 0 and balance < 1000000000000),
  monthly_payment  numeric(14, 2) check (monthly_payment is null or (monthly_payment > 0 and monthly_payment < 1000000000000)),
  notes            text check (notes is null or char_length(notes) <= 500),
  archived         boolean not null default false,
  created_by       uuid references auth.users (id) on delete set null default auth.uid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index liabilities_space_idx on public.liabilities (space_id);

create trigger assets_updated_at before update on public.assets
  for each row execute function public.set_updated_at();
create trigger liabilities_updated_at before update on public.liabilities
  for each row execute function public.set_updated_at();

-- Espaço e autor não mudam depois de criados.
create or replace function public.space_item_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.space_id <> old.space_id then
      raise exception 'Este item não pode mudar de espaço.' using errcode = '42501';
    end if;
    new.created_by := old.created_by;
  else
    new.created_by := coalesce(auth.uid(), new.created_by);
  end if;
  return new;
end;
$$;
create trigger assets_guard before insert or update on public.assets
  for each row execute function public.space_item_guard();
create trigger liabilities_guard before insert or update on public.liabilities
  for each row execute function public.space_item_guard();

alter table public.assets enable row level security;
alter table public.liabilities enable row level security;

create policy assets_select on public.assets for select to authenticated
  using (public.is_space_member(space_id));
create policy assets_insert on public.assets for insert to authenticated
  with check (public.is_space_member(space_id));
create policy assets_update on public.assets for update to authenticated
  using (public.is_space_member(space_id)) with check (public.is_space_member(space_id));
create policy assets_delete on public.assets for delete to authenticated
  using (
    public.is_space_member(space_id)
    and (created_by = (select auth.uid()) or public.space_role(space_id) in ('owner', 'admin'))
  );

create policy liabilities_select on public.liabilities for select to authenticated
  using (public.is_space_member(space_id));
create policy liabilities_insert on public.liabilities for insert to authenticated
  with check (public.is_space_member(space_id));
create policy liabilities_update on public.liabilities for update to authenticated
  using (public.is_space_member(space_id)) with check (public.is_space_member(space_id));
create policy liabilities_delete on public.liabilities for delete to authenticated
  using (
    public.is_space_member(space_id)
    and (created_by = (select auth.uid()) or public.space_role(space_id) in ('owner', 'admin'))
  );

revoke all on public.assets, public.liabilities from anon;

------------------------------------------------------------------------------
-- Histórico mensal do patrimônio (uma linha por espaço e mês; a do mês atual é atualizada).
------------------------------------------------------------------------------
create table public.net_worth_snapshots (
  space_id     uuid not null references public.spaces (id) on delete cascade,
  month        date not null check (extract(day from month) = 1),
  accounts     numeric(14, 2) not null,
  assets       numeric(14, 2) not null,
  liabilities  numeric(14, 2) not null,
  net_worth    numeric(14, 2) not null,
  updated_at   timestamptz not null default now(),
  primary key (space_id, month)
);

alter table public.net_worth_snapshots enable row level security;

-- Leitura para membros; gravação só pela função abaixo (que calcula os valores no banco).
create policy net_worth_snapshots_select on public.net_worth_snapshots for select to authenticated
  using (public.is_space_member(space_id));

revoke all on public.net_worth_snapshots from anon;

-- Calcula o patrimônio atual do espaço e grava/atualiza a linha do mês corrente.
-- Contas: saldo das contas não arquivadas (cartões entram como dívida, pelo valor em aberto).
create or replace function public.record_net_worth_snapshot(p_space_id uuid)
returns public.net_worth_snapshots
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_accounts numeric(14, 2);
  v_card_debt numeric(14, 2);
  v_assets numeric(14, 2);
  v_liabilities numeric(14, 2);
  v_row public.net_worth_snapshots;
begin
  if not public.is_space_member(p_space_id) then
    raise exception 'Você não participa deste espaço.' using errcode = '42501';
  end if;

  select
    coalesce(sum(b.balance) filter (where a.type <> 'credit_card'), 0),
    coalesce(sum(greatest(-b.balance, 0)) filter (where a.type = 'credit_card'), 0)
  into v_accounts, v_card_debt
  from public.accounts a
  join public.account_balances b on b.account_id = a.id
  where a.space_id = p_space_id and not a.archived;

  select coalesce(sum(value), 0) into v_assets
  from public.assets where space_id = p_space_id and not archived;

  select coalesce(sum(balance), 0) + v_card_debt into v_liabilities
  from public.liabilities where space_id = p_space_id and not archived;

  insert into public.net_worth_snapshots (space_id, month, accounts, assets, liabilities, net_worth, updated_at)
  values (
    p_space_id,
    date_trunc('month', (now() at time zone 'America/Sao_Paulo'))::date,
    v_accounts, v_assets, v_liabilities,
    v_accounts + v_assets - v_liabilities,
    now()
  )
  on conflict (space_id, month) do update set
    accounts = excluded.accounts,
    assets = excluded.assets,
    liabilities = excluded.liabilities,
    net_worth = excluded.net_worth,
    updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

revoke execute on function public.record_net_worth_snapshot(uuid) from public, anon;
grant execute on function public.record_net_worth_snapshot(uuid) to authenticated;
