-- CashBot v2 — planejamento: orçamento mensal por categoria e metas.
-- Somente cria objetos novos.

------------------------------------------------------------------------------
-- Orçamentos: um limite mensal por categoria de despesa (vale para todos os meses).
------------------------------------------------------------------------------
create table public.budgets (
  id           uuid primary key default gen_random_uuid(),
  space_id     uuid not null references public.spaces (id) on delete cascade,
  category_id  uuid not null references public.categories (id) on delete cascade,
  amount       numeric(14, 2) not null check (amount > 0 and amount < 1000000000000),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (space_id, category_id)
);

create index budgets_category_idx on public.budgets (category_id);

create trigger budgets_updated_at before update on public.budgets
  for each row execute function public.set_updated_at();

-- A categoria precisa ser de despesa e do mesmo espaço.
create or replace function public.budgets_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_space uuid;
  v_kind text;
begin
  if tg_op = 'UPDATE' and new.space_id <> old.space_id then
    raise exception 'Um orçamento não pode mudar de espaço.' using errcode = '42501';
  end if;
  select c.space_id, c.kind into v_space, v_kind from public.categories c where c.id = new.category_id;
  if v_space is distinct from new.space_id then
    raise exception 'A categoria escolhida não pertence a este espaço.' using errcode = '23514';
  end if;
  if v_kind is distinct from 'expense' then
    raise exception 'O orçamento é definido só para categorias de despesa.' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger budgets_guard before insert or update on public.budgets
  for each row execute function public.budgets_guard();

alter table public.budgets enable row level security;

create policy budgets_select on public.budgets for select to authenticated
  using (public.is_space_member(space_id));
create policy budgets_insert on public.budgets for insert to authenticated
  with check (public.is_space_member(space_id));
create policy budgets_update on public.budgets for update to authenticated
  using (public.is_space_member(space_id)) with check (public.is_space_member(space_id));
create policy budgets_delete on public.budgets for delete to authenticated
  using (public.is_space_member(space_id));

revoke all on public.budgets from anon;

------------------------------------------------------------------------------
-- Metas: valor a juntar, quanto já foi guardado e prazo opcional.
------------------------------------------------------------------------------
create table public.goals (
  id             uuid primary key default gen_random_uuid(),
  space_id       uuid not null references public.spaces (id) on delete cascade,
  name           text not null check (char_length(btrim(name)) between 1 and 80),
  target_amount  numeric(14, 2) not null check (target_amount > 0 and target_amount < 1000000000000),
  saved_amount   numeric(14, 2) not null default 0 check (saved_amount >= 0 and saved_amount < 1000000000000),
  target_date    date,
  archived       boolean not null default false,
  created_by     uuid references auth.users (id) on delete set null default auth.uid(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index goals_space_idx on public.goals (space_id);

create trigger goals_updated_at before update on public.goals
  for each row execute function public.set_updated_at();

create or replace function public.goals_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.space_id <> old.space_id then
      raise exception 'Uma meta não pode mudar de espaço.' using errcode = '42501';
    end if;
    new.created_by := old.created_by;
  else
    new.created_by := coalesce(auth.uid(), new.created_by);
  end if;
  return new;
end;
$$;
create trigger goals_guard before insert or update on public.goals
  for each row execute function public.goals_guard();

alter table public.goals enable row level security;

create policy goals_select on public.goals for select to authenticated
  using (public.is_space_member(space_id));
create policy goals_insert on public.goals for insert to authenticated
  with check (public.is_space_member(space_id));
create policy goals_update on public.goals for update to authenticated
  using (public.is_space_member(space_id)) with check (public.is_space_member(space_id));
-- Excluir: quem criou, ou proprietário/administrador.
create policy goals_delete on public.goals for delete to authenticated
  using (
    public.is_space_member(space_id)
    and (created_by = (select auth.uid()) or public.space_role(space_id) in ('owner', 'admin'))
  );

revoke all on public.goals from anon;
