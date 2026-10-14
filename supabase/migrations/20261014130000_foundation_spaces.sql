-- CashBot v2 — fundação: perfis, espaços financeiros, membros, preferências e categorias.
-- Não altera nem remove as tabelas do CashBot antigo (lancamentos, saldos, categorias, pessoas, ...).
-- Única mudança em objeto existente: o gatilho antigo `on_auth_user_created` (que inseria em `pessoas`
-- com cpf/telefone vazios e UNIQUE, falhando a partir do 2º cadastro) é substituído pelo novo gatilho.
-- A função antiga `public.handle_new_user` é mantida, sem uso.

------------------------------------------------------------------------------
-- Utilitário: updated_at
------------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

------------------------------------------------------------------------------
-- Tabelas
------------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null default '' check (char_length(full_name) <= 120),
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.spaces (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(btrim(name)) between 1 and 80),
  type        text not null check (type in ('personal', 'couple', 'family')),
  owner_id    uuid not null references auth.users (id) on delete cascade,
  settings    jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
-- Cada usuário tem exatamente um espaço pessoal.
create unique index spaces_one_personal_per_owner on public.spaces (owner_id) where type = 'personal';

create table public.space_members (
  space_id    uuid not null references public.spaces (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  role        text not null check (role in ('owner', 'admin', 'member')),
  created_at  timestamptz not null default now(),
  primary key (space_id, user_id)
);
-- Consulta principal: "em quais espaços este usuário está?" (usada em todas as políticas).
create index space_members_user_id_idx on public.space_members (user_id);
-- Um único proprietário por espaço.
create unique index space_members_one_owner on public.space_members (space_id) where role = 'owner';

create table public.user_preferences (
  user_id           uuid primary key references auth.users (id) on delete cascade,
  theme             text not null default 'system' check (theme in ('system', 'light', 'dark')),
  currency          text not null default 'BRL' check (currency ~ '^[A-Z]{3}$'),
  locale            text not null default 'pt-BR' check (char_length(locale) between 2 and 10),
  default_space_id  uuid references public.spaces (id) on delete set null,
  updated_at        timestamptz not null default now()
);

create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  space_id    uuid not null references public.spaces (id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 60),
  kind        text not null check (kind in ('income', 'expense')),
  color       text check (color is null or color ~ '^#[0-9a-fA-F]{6}$'),
  archived    boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
-- Evita duplicadas no mesmo espaço e serve a listagem por espaço (coluna inicial).
create unique index categories_unique_name on public.categories (space_id, kind, lower(btrim(name)));

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger spaces_updated_at before update on public.spaces
  for each row execute function public.set_updated_at();
create trigger user_preferences_updated_at before update on public.user_preferences
  for each row execute function public.set_updated_at();
create trigger categories_updated_at before update on public.categories
  for each row execute function public.set_updated_at();

------------------------------------------------------------------------------
-- Funções auxiliares de autorização (SECURITY DEFINER evita recursão de RLS)
------------------------------------------------------------------------------
create or replace function public.space_role(p_space_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select m.role from public.space_members m
  where m.space_id = p_space_id and m.user_id = auth.uid();
$$;

create or replace function public.is_space_member(p_space_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.space_members m
    where m.space_id = p_space_id and m.user_id = auth.uid()
  );
$$;

create or replace function public.shares_space_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.space_members a
    join public.space_members b on b.space_id = a.space_id
    where a.user_id = auth.uid() and b.user_id = p_user_id
  );
$$;

------------------------------------------------------------------------------
-- Regras de integridade dos espaços
------------------------------------------------------------------------------
-- Dono e tipo não mudam depois de criados.
create or replace function public.spaces_guard_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.owner_id <> old.owner_id then
    raise exception 'O proprietário do espaço não pode ser alterado.' using errcode = '42501';
  end if;
  if new.type <> old.type then
    raise exception 'O tipo do espaço não pode ser alterado.' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger spaces_guard_immutable before update on public.spaces
  for each row execute function public.spaces_guard_immutable();

-- Ao criar um espaço: o dono vira membro "owner" e o espaço recebe categorias iniciais.
create or replace function public.spaces_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.space_members (space_id, user_id, role)
  values (new.id, new.owner_id, 'owner');

  insert into public.categories (space_id, name, kind) values
    (new.id, 'Alimentação', 'expense'),
    (new.id, 'Moradia', 'expense'),
    (new.id, 'Transporte', 'expense'),
    (new.id, 'Saúde', 'expense'),
    (new.id, 'Educação', 'expense'),
    (new.id, 'Lazer', 'expense'),
    (new.id, 'Compras', 'expense'),
    (new.id, 'Contas e serviços', 'expense'),
    (new.id, 'Outras despesas', 'expense'),
    (new.id, 'Salário', 'income'),
    (new.id, 'Rendimentos', 'income'),
    (new.id, 'Outras receitas', 'income');
  return new;
end;
$$;
create trigger spaces_after_insert after insert on public.spaces
  for each row execute function public.spaces_after_insert();

-- Membros só entram em espaços de casal/família.
create or replace function public.space_members_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type text;
  v_owner uuid;
begin
  select type, owner_id into v_type, v_owner from public.spaces where id = new.space_id;
  if v_type = 'personal' and new.user_id <> v_owner then
    raise exception 'O espaço pessoal não aceita outros membros.' using errcode = '42501';
  end if;
  if new.role = 'owner' and new.user_id <> v_owner then
    raise exception 'Somente o proprietário do espaço pode ter o papel de proprietário.' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger space_members_guard before insert or update on public.space_members
  for each row execute function public.space_members_guard();

------------------------------------------------------------------------------
-- Cadastro de novo usuário: perfil + espaço pessoal + preferências
------------------------------------------------------------------------------
create or replace function public.handle_new_user_v2()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_space_id uuid;
begin
  insert into public.profiles (id, full_name)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120))
  on conflict (id) do nothing;

  insert into public.spaces (name, type, owner_id)
  values ('Pessoal', 'personal', new.id)
  on conflict do nothing
  returning id into v_space_id;

  insert into public.user_preferences (user_id, default_space_id)
  values (new.id, v_space_id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created_v2
  after insert on auth.users
  for each row execute function public.handle_new_user_v2();

------------------------------------------------------------------------------
-- RPCs de membros (validam papel do chamador)
------------------------------------------------------------------------------
create or replace function public.add_space_member(p_space_id uuid, p_email text, p_role text default 'member')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_role text := public.space_role(p_space_id);
  v_user_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Sessão expirada. Entre novamente.' using errcode = '42501';
  end if;
  if v_caller_role is null or v_caller_role not in ('owner', 'admin') then
    raise exception 'Você não tem permissão para adicionar membros a este espaço.' using errcode = '42501';
  end if;
  if p_role not in ('admin', 'member') then
    raise exception 'Papel inválido.' using errcode = '22023';
  end if;
  if p_role = 'admin' and v_caller_role <> 'owner' then
    raise exception 'Somente o proprietário pode adicionar administradores.' using errcode = '42501';
  end if;

  select u.id into v_user_id from auth.users u where lower(u.email) = lower(btrim(p_email));
  if v_user_id is null then
    raise exception 'Nenhuma conta do CashBot usa esse e-mail. Peça para a pessoa se cadastrar primeiro.' using errcode = 'P0002';
  end if;

  insert into public.space_members (space_id, user_id, role)
  values (p_space_id, v_user_id, p_role)
  on conflict (space_id, user_id) do nothing;
  if not found then
    raise exception 'Essa pessoa já participa do espaço.' using errcode = '23505';
  end if;
end;
$$;

-- Criação de espaço compartilhado (o dono é sempre quem chama).
create or replace function public.create_space(p_name text, p_type text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Sessão expirada. Entre novamente.' using errcode = '42501';
  end if;
  if p_type not in ('couple', 'family') then
    raise exception 'Escolha o tipo Casal ou Família.' using errcode = '22023';
  end if;
  insert into public.spaces (name, type, owner_id)
  values (btrim(p_name), p_type, auth.uid())
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.update_space_member_role(p_space_id uuid, p_user_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.space_role(p_space_id) is distinct from 'owner' then
    raise exception 'Somente o proprietário pode alterar papéis.' using errcode = '42501';
  end if;
  if p_role not in ('admin', 'member') then
    raise exception 'Papel inválido.' using errcode = '22023';
  end if;
  update public.space_members set role = p_role
  where space_id = p_space_id and user_id = p_user_id and role <> 'owner';
  if not found then
    raise exception 'Membro não encontrado.' using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function public.space_role(uuid), public.is_space_member(uuid), public.shares_space_with(uuid),
  public.add_space_member(uuid, text, text), public.update_space_member_role(uuid, uuid, text),
  public.create_space(text, text)
  from public, anon;
grant execute on function public.space_role(uuid), public.is_space_member(uuid), public.shares_space_with(uuid),
  public.add_space_member(uuid, text, text), public.update_space_member_role(uuid, uuid, text),
  public.create_space(text, text)
  to authenticated;
revoke execute on function public.handle_new_user_v2(), public.spaces_after_insert(), public.space_members_guard()
  from public, anon, authenticated;

------------------------------------------------------------------------------
-- Row Level Security
------------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.spaces enable row level security;
alter table public.space_members enable row level security;
alter table public.user_preferences enable row level security;
alter table public.categories enable row level security;

-- profiles: vê o próprio e o de quem divide algum espaço; edita só o próprio.
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.shares_space_with(id));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- spaces
create policy spaces_select on public.spaces for select to authenticated
  using (public.is_space_member(id));
-- Inserção somente via public.create_space (sem política de insert direto).
create policy spaces_update on public.spaces for update to authenticated
  using (public.space_role(id) in ('owner', 'admin'))
  with check (public.space_role(id) in ('owner', 'admin'));
create policy spaces_delete on public.spaces for delete to authenticated
  using (owner_id = (select auth.uid()) and type <> 'personal');

-- space_members: inserção e troca de papel só via RPC; saída/remoção via delete.
create policy space_members_select on public.space_members for select to authenticated
  using (public.is_space_member(space_id));
create policy space_members_delete on public.space_members for delete to authenticated
  using (
    role <> 'owner'
    and (
      user_id = (select auth.uid())
      or public.space_role(space_id) = 'owner'
      or (public.space_role(space_id) = 'admin' and role = 'member')
    )
  );

-- user_preferences: só o próprio usuário; espaço padrão precisa ser um espaço do qual participa.
create policy user_preferences_select on public.user_preferences for select to authenticated
  using (user_id = (select auth.uid()));
create policy user_preferences_insert on public.user_preferences for insert to authenticated
  with check (user_id = (select auth.uid())
    and (default_space_id is null or public.is_space_member(default_space_id)));
create policy user_preferences_update on public.user_preferences for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid())
    and (default_space_id is null or public.is_space_member(default_space_id)));

-- categories: membros leem, criam e editam; proprietário/administrador excluem.
create policy categories_select on public.categories for select to authenticated
  using (public.is_space_member(space_id));
create policy categories_insert on public.categories for insert to authenticated
  with check (public.is_space_member(space_id));
create policy categories_update on public.categories for update to authenticated
  using (public.is_space_member(space_id)) with check (public.is_space_member(space_id));
create policy categories_delete on public.categories for delete to authenticated
  using (public.space_role(space_id) in ('owner', 'admin'));

-- Sem acesso para visitantes anônimos.
revoke all on public.profiles, public.spaces, public.space_members, public.user_preferences, public.categories from anon;

------------------------------------------------------------------------------
-- Usuários já existentes: cria perfil, espaço pessoal e preferências.
------------------------------------------------------------------------------
insert into public.profiles (id, full_name)
select u.id, left(coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'nome', ''), 120)
from auth.users u
on conflict (id) do nothing;

insert into public.spaces (name, type, owner_id)
select 'Pessoal', 'personal', u.id from auth.users u
where not exists (select 1 from public.spaces s where s.owner_id = u.id and s.type = 'personal');

insert into public.user_preferences (user_id, default_space_id)
select u.id, s.id from auth.users u
join public.spaces s on s.owner_id = u.id and s.type = 'personal'
on conflict (user_id) do nothing;
