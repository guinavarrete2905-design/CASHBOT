-- Testes de autorização (RLS) dos espaços financeiros.
-- Rodam dentro de uma transação e terminam em ROLLBACK: nada fica gravado no banco.
-- Como rodar: cole no SQL Editor do Supabase (ou `psql "$DATABASE_URL" -f supabase/tests/rls_spaces.sql`).
-- Resultado: se qualquer regra falhar, a execução para com "FALHA: <descrição>".
-- Se tudo passar, termina com o erro proposital "OK: todos os testes de RLS passaram"
-- (o erro garante o rollback e deixa o resultado visível em qualquer cliente).

begin;

-- Usuários de teste (o gatilho on_auth_user_created_v2 cria perfil, espaço pessoal e preferências).
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-4000-a000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-a@cashbot.test', '{"full_name":"Ana Teste"}', now(), now()),
  ('00000000-0000-4000-a000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-b@cashbot.test', '{"full_name":"Bruno Teste"}', now(), now()),
  ('00000000-0000-4000-a000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rls-c@cashbot.test', '{"full_name":"Carla Teste"}', now(), now());

-- 1. Cadastro cria a estrutura inicial.
do $$
declare v int;
begin
  select count(*) into v from public.profiles where id::text like '00000000-0000-4000-a000-00000000000%';
  if v <> 3 then raise exception 'FALHA: cadastro deveria criar 3 perfis, criou %', v; end if;
  select count(*) into v from public.spaces where type = 'personal' and owner_id::text like '00000000-0000-4000-a000-00000000000%';
  if v <> 3 then raise exception 'FALHA: cadastro deveria criar 3 espaços pessoais, criou %', v; end if;
  select count(*) into v from public.space_members m join public.spaces s on s.id = m.space_id
    where s.owner_id = '00000000-0000-4000-a000-00000000000a' and m.role = 'owner';
  if v <> 1 then raise exception 'FALHA: dono deveria ser membro owner do espaço pessoal'; end if;
  select count(*) into v from public.user_preferences
    where user_id = '00000000-0000-4000-a000-00000000000a' and default_space_id is not null;
  if v <> 1 then raise exception 'FALHA: preferências com espaço padrão não criadas'; end if;
  select count(*) into v from public.categories c join public.spaces s on s.id = c.space_id
    where s.owner_id = '00000000-0000-4000-a000-00000000000a';
  if v <> 12 then raise exception 'FALHA: espaço pessoal deveria ter 12 categorias iniciais, tem %', v; end if;
end $$;

select set_config('test.a_personal', (select id::text from public.spaces where owner_id = '00000000-0000-4000-a000-00000000000a' and type = 'personal'), true),
       set_config('test.b_personal', (select id::text from public.spaces where owner_id = '00000000-0000-4000-a000-00000000000b' and type = 'personal'), true),
       set_config('test.c_personal', (select id::text from public.spaces where owner_id = '00000000-0000-4000-a000-00000000000c' and type = 'personal'), true);

-- 2. Visitante anônimo não acessa nada.
set local role anon;
do $$
begin
  begin
    perform 1 from public.spaces;
    raise exception 'FALHA: anon conseguiu consultar spaces';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

-- ===== Como ANA =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-00000000000a","role":"authenticated"}', true);

do $$
declare v int; v_id uuid;
begin
  -- 3. Isolamento: Ana só vê o próprio espaço.
  select count(*) into v from public.spaces;
  if v <> 1 then raise exception 'FALHA: Ana deveria ver 1 espaço, vê %', v; end if;
  select count(*) into v from public.categories where space_id = current_setting('test.b_personal')::uuid;
  if v <> 0 then raise exception 'FALHA: Ana vê categorias do espaço de Bruno'; end if;
  select count(*) into v from public.profiles where id = '00000000-0000-4000-a000-00000000000b';
  if v <> 0 then raise exception 'FALHA: Ana vê perfil de quem não divide espaço com ela'; end if;

  -- 4. Não grava no espaço alheio.
  begin
    insert into public.categories (space_id, name, kind) values (current_setting('test.b_personal')::uuid, 'Invasão', 'expense');
    raise exception 'FALHA: Ana criou categoria no espaço de Bruno';
  exception when insufficient_privilege then null;
  end;
  update public.spaces set name = 'Hackeado' where id = current_setting('test.b_personal')::uuid;
  get diagnostics v = row_count;
  if v <> 0 then raise exception 'FALHA: Ana renomeou o espaço de Bruno'; end if;

  -- 5. Inserção direta em spaces é bloqueada (só via create_space).
  begin
    insert into public.spaces (name, type, owner_id) values ('Direto', 'family', '00000000-0000-4000-a000-00000000000a');
    raise exception 'FALHA: insert direto em spaces foi permitido';
  exception when insufficient_privilege then null;
  end;

  -- 6. Espaço pessoal não aceita membros e não pode ser excluído.
  begin
    perform public.add_space_member(current_setting('test.a_personal')::uuid, 'rls-b@cashbot.test', 'member');
    raise exception 'FALHA: espaço pessoal aceitou membro';
  exception when insufficient_privilege then null;
  end;
  delete from public.spaces where id = current_setting('test.a_personal')::uuid;
  get diagnostics v = row_count;
  if v <> 0 then raise exception 'FALHA: Ana excluiu o próprio espaço pessoal'; end if;

  -- 7. Preferência não pode apontar para espaço alheio.
  begin
    update public.user_preferences set default_space_id = current_setting('test.c_personal')::uuid
      where user_id = '00000000-0000-4000-a000-00000000000a';
    raise exception 'FALHA: preferência aceitou espaço alheio';
  exception when insufficient_privilege then null;
  end;

  -- 8. Ana cria espaço de casal e adiciona Bruno como membro.
  begin
    perform public.create_space('Pessoal 2', 'personal');
    raise exception 'FALHA: create_space aceitou tipo pessoal';
  exception when invalid_parameter_value then null;
  end;
  v_id := public.create_space('Casa', 'couple');
  perform set_config('test.couple', v_id::text, true);
  if public.space_role(v_id) <> 'owner' then raise exception 'FALHA: criadora não é owner do espaço'; end if;
  select count(*) into v from public.categories where space_id = v_id;
  if v <> 12 then raise exception 'FALHA: espaço novo deveria ter 12 categorias, tem %', v; end if;
  perform public.add_space_member(v_id, 'RLS-B@cashbot.test', 'member');
  begin
    perform public.add_space_member(v_id, 'nao-existe@cashbot.test', 'member');
    raise exception 'FALHA: add_space_member aceitou e-mail inexistente';
  exception when no_data_found then null;
  end;
  select count(*) into v from public.profiles where id = '00000000-0000-4000-a000-00000000000b';
  if v <> 1 then raise exception 'FALHA: Ana não vê o perfil de Bruno após dividir espaço'; end if;
end $$;

-- ===== Como BRUNO (membro) =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-00000000000b","role":"authenticated"}', true);
do $$
declare v int;
begin
  select count(*) into v from public.spaces;
  if v <> 2 then raise exception 'FALHA: Bruno deveria ver 2 espaços (pessoal + casal), vê %', v; end if;
  select count(*) into v from public.spaces where id = current_setting('test.a_personal')::uuid;
  if v <> 0 then raise exception 'FALHA: Bruno vê o espaço pessoal de Ana'; end if;

  -- Membro lê e cria categorias, mas não exclui.
  select count(*) into v from public.categories where space_id = current_setting('test.couple')::uuid;
  if v <> 12 then raise exception 'FALHA: membro deveria ler as categorias do espaço'; end if;
  insert into public.categories (space_id, name, kind) values (current_setting('test.couple')::uuid, 'Pets', 'expense');
  delete from public.categories where space_id = current_setting('test.couple')::uuid;
  get diagnostics v = row_count;
  if v <> 0 then raise exception 'FALHA: membro excluiu categorias'; end if;

  -- Membro não administra o espaço.
  update public.spaces set name = 'Renomeado' where id = current_setting('test.couple')::uuid;
  get diagnostics v = row_count;
  if v <> 0 then raise exception 'FALHA: membro renomeou o espaço'; end if;
  begin
    perform public.add_space_member(current_setting('test.couple')::uuid, 'rls-c@cashbot.test', 'member');
    raise exception 'FALHA: membro adicionou outra pessoa';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.update_space_member_role(current_setting('test.couple')::uuid, '00000000-0000-4000-a000-00000000000b', 'admin');
    raise exception 'FALHA: membro se promoveu a administrador';
  exception when insufficient_privilege then null;
  end;
  update public.space_members set role = 'owner' where user_id = '00000000-0000-4000-a000-00000000000b';
  get diagnostics v = row_count;
  if v <> 0 then raise exception 'FALHA: update direto em space_members foi permitido'; end if;
  delete from public.space_members where space_id = current_setting('test.couple')::uuid and role = 'owner';
  get diagnostics v = row_count;
  if v <> 0 then raise exception 'FALHA: membro removeu a proprietária'; end if;
end $$;

-- ===== Como CARLA (fora do espaço) =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-00000000000c","role":"authenticated"}', true);
do $$
declare v int;
begin
  select count(*) into v from public.spaces where id = current_setting('test.couple')::uuid;
  if v <> 0 then raise exception 'FALHA: Carla vê espaço do qual não participa'; end if;
  select count(*) into v from public.space_members where space_id = current_setting('test.couple')::uuid;
  if v <> 0 then raise exception 'FALHA: Carla vê membros de espaço alheio'; end if;
  select count(*) into v from public.categories where space_id = current_setting('test.couple')::uuid;
  if v <> 0 then raise exception 'FALHA: Carla vê categorias de espaço alheio'; end if;
  select count(*) into v from public.profiles where id <> '00000000-0000-4000-a000-00000000000c';
  if v <> 0 then raise exception 'FALHA: Carla vê perfis de outras pessoas'; end if;
end $$;

-- ===== ANA promove Bruno a administrador =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-00000000000a","role":"authenticated"}', true);
do $$ begin
  perform public.update_space_member_role(current_setting('test.couple')::uuid, '00000000-0000-4000-a000-00000000000b', 'admin');
end $$;

-- ===== BRUNO como administrador =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-00000000000b","role":"authenticated"}', true);
do $$
declare v int;
begin
  update public.spaces set name = 'Casa nova' where id = current_setting('test.couple')::uuid;
  get diagnostics v = row_count;
  if v <> 1 then raise exception 'FALHA: administrador não conseguiu renomear o espaço'; end if;
  begin
    update public.spaces set owner_id = '00000000-0000-4000-a000-00000000000b' where id = current_setting('test.couple')::uuid;
    raise exception 'FALHA: administrador trocou o proprietário';
  exception when insufficient_privilege then null;
  end;
  delete from public.spaces where id = current_setting('test.couple')::uuid;
  get diagnostics v = row_count;
  if v <> 0 then raise exception 'FALHA: administrador excluiu o espaço'; end if;
  begin
    perform public.add_space_member(current_setting('test.couple')::uuid, 'rls-c@cashbot.test', 'admin');
    raise exception 'FALHA: administrador adicionou outro administrador';
  exception when insufficient_privilege then null;
  end;
  perform public.add_space_member(current_setting('test.couple')::uuid, 'rls-c@cashbot.test', 'member');
  -- Administrador remove membro comum.
  delete from public.space_members where space_id = current_setting('test.couple')::uuid and user_id = '00000000-0000-4000-a000-00000000000c';
  get diagnostics v = row_count;
  if v <> 1 then raise exception 'FALHA: administrador não conseguiu remover membro'; end if;
  -- Bruno sai do espaço.
  delete from public.space_members where space_id = current_setting('test.couple')::uuid and user_id = '00000000-0000-4000-a000-00000000000b';
  get diagnostics v = row_count;
  if v <> 1 then raise exception 'FALHA: membro não conseguiu sair do espaço'; end if;
  select count(*) into v from public.spaces where id = current_setting('test.couple')::uuid;
  if v <> 0 then raise exception 'FALHA: ex-membro continua vendo o espaço'; end if;
end $$;

-- ===== ANA exclui o espaço compartilhado =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a000-00000000000a","role":"authenticated"}', true);
do $$
declare v int;
begin
  delete from public.spaces where id = current_setting('test.couple')::uuid;
  get diagnostics v = row_count;
  if v <> 1 then raise exception 'FALHA: proprietária não conseguiu excluir o espaço'; end if;
end $$;

reset role;
do $$ begin raise exception 'OK: todos os testes de RLS passaram'; end $$;

rollback;
