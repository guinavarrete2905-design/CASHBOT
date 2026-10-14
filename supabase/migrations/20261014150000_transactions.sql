-- CashBot v2 — movimentações (receitas e despesas) por espaço.
-- Somente cria objetos novos; não altera tabelas existentes.

create table public.transactions (
  id            uuid primary key default gen_random_uuid(),
  space_id      uuid not null references public.spaces (id) on delete cascade,
  kind          text not null check (kind in ('income', 'expense')),
  description   text not null check (char_length(btrim(description)) between 1 and 140),
  amount        numeric(14, 2) not null check (amount > 0 and amount < 1000000000000),
  occurred_on   date not null,
  category_id   uuid references public.categories (id) on delete set null,
  status        text not null default 'paid' check (status in ('paid', 'pending')),
  notes         text check (notes is null or char_length(notes) <= 500),
  -- Identificador de origem (importações): evita duplicar a mesma linha importada duas vezes.
  external_ref  text check (external_ref is null or char_length(external_ref) <= 200),
  created_by    uuid references auth.users (id) on delete set null default auth.uid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Consulta principal: movimentações de um espaço num período, mais recentes primeiro.
create index transactions_space_date_idx on public.transactions (space_id, occurred_on desc, created_at desc);
-- Apoia o "on delete set null" das categorias.
create index transactions_category_idx on public.transactions (category_id) where category_id is not null;
create unique index transactions_external_ref_unique on public.transactions (space_id, external_ref)
  where external_ref is not null;

create trigger transactions_updated_at before update on public.transactions
  for each row execute function public.set_updated_at();

-- Categoria precisa ser do mesmo espaço e do mesmo tipo (receita/despesa).
-- Autor e espaço não mudam depois de criados.
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
  return new;
end;
$$;
create trigger transactions_guard before insert or update on public.transactions
  for each row execute function public.transactions_guard();

alter table public.transactions enable row level security;

-- Todos os participantes do espaço veem, lançam e editam.
create policy transactions_select on public.transactions for select to authenticated
  using (public.is_space_member(space_id));
create policy transactions_insert on public.transactions for insert to authenticated
  with check (public.is_space_member(space_id));
create policy transactions_update on public.transactions for update to authenticated
  using (public.is_space_member(space_id)) with check (public.is_space_member(space_id));
-- Excluir: quem lançou, ou proprietário/administrador do espaço.
create policy transactions_delete on public.transactions for delete to authenticated
  using (
    public.is_space_member(space_id)
    and (created_by = (select auth.uid()) or public.space_role(space_id) in ('owner', 'admin'))
  );

revoke all on public.transactions from anon;
