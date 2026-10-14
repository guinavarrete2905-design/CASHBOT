-- Testes de orçamentos e metas.
-- Rodam dentro de uma transação e terminam em ROLLBACK: nada fica gravado.
-- Resultado esperado: o erro proposital "OK: todos os testes de planejamento passaram".

begin;

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-4000-e000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pl-a@cashbot.test', '{"full_name":"Ana"}', now(), now()),
  ('00000000-0000-4000-e000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pl-b@cashbot.test', '{"full_name":"Bruno"}', now(), now()),
  ('00000000-0000-4000-e000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pl-c@cashbot.test', '{"full_name":"Carla"}', now(), now());

set local role authenticated;

-- ===== ANA =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-e000-00000000000a","role":"authenticated"}', true);
do $$
declare v_space uuid; v_exp uuid; v_inc uuid; v_goal uuid;
begin
  v_space := public.create_space('Casa', 'couple');
  perform set_config('test.space', v_space::text, true);
  perform public.add_space_member(v_space, 'pl-b@cashbot.test', 'member');

  select id into v_exp from public.categories where space_id = v_space and kind = 'expense' limit 1;
  select id into v_inc from public.categories where space_id = v_space and kind = 'income' limit 1;

  insert into public.budgets (space_id, category_id, amount) values (v_space, v_exp, 800);

  begin
    insert into public.budgets (space_id, category_id, amount) values (v_space, v_exp, 900);
    raise exception 'FALHA: aceitou dois orçamentos para a mesma categoria';
  exception when unique_violation then null;
  end;
  begin
    insert into public.budgets (space_id, category_id, amount) values (v_space, v_inc, 100);
    raise exception 'FALHA: aceitou orçamento em categoria de receita';
  exception when check_violation then null;
  end;
  begin
    insert into public.budgets (space_id, category_id, amount) values (v_space, v_exp, 0);
    raise exception 'FALHA: aceitou orçamento zerado';
  exception when check_violation or unique_violation then null;
  end;

  insert into public.goals (space_id, name, target_amount, saved_amount, target_date)
  values (v_space, 'Viagem', 6000, 1500, current_date + 180) returning id into v_goal;
  perform set_config('test.goal', v_goal::text, true);

  begin
    insert into public.goals (space_id, name, target_amount, saved_amount) values (v_space, 'Negativa', 100, -1);
    raise exception 'FALHA: aceitou valor guardado negativo';
  exception when check_violation then null;
  end;
end $$;

-- ===== BRUNO (membro) =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-e000-00000000000b","role":"authenticated"}', true);
do $$
declare v int;
begin
  select count(*) into v from public.budgets where space_id = current_setting('test.space')::uuid;
  if v <> 1 then raise exception 'FALHA: membro deveria ver o orçamento do espaço'; end if;
  update public.budgets set amount = 850 where space_id = current_setting('test.space')::uuid;
  get diagnostics v = row_count;
  if v <> 1 then raise exception 'FALHA: membro não conseguiu ajustar o orçamento'; end if;

  update public.goals set saved_amount = 2000 where id = current_setting('test.goal')::uuid;
  get diagnostics v = row_count;
  if v <> 1 then raise exception 'FALHA: membro não conseguiu atualizar a meta'; end if;
  delete from public.goals where id = current_setting('test.goal')::uuid;
  get diagnostics v = row_count;
  if v <> 0 then raise exception 'FALHA: membro excluiu meta criada por outra pessoa'; end if;
end $$;

-- ===== CARLA (fora do espaço) =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-e000-00000000000c","role":"authenticated"}', true);
do $$
declare v int;
begin
  select count(*) into v from public.budgets where space_id = current_setting('test.space')::uuid;
  if v <> 0 then raise exception 'FALHA: pessoa de fora vê orçamentos'; end if;
  select count(*) into v from public.goals where space_id = current_setting('test.space')::uuid;
  if v <> 0 then raise exception 'FALHA: pessoa de fora vê metas'; end if;
  begin
    insert into public.goals (space_id, name, target_amount) values (current_setting('test.space')::uuid, 'Invasão', 10);
    raise exception 'FALHA: pessoa de fora criou meta';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ===== ANA exclui a meta =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-e000-00000000000a","role":"authenticated"}', true);
do $$
declare v int;
begin
  delete from public.goals where id = current_setting('test.goal')::uuid;
  get diagnostics v = row_count;
  if v <> 1 then raise exception 'FALHA: proprietária não conseguiu excluir a meta'; end if;
end $$;

reset role;
set local role anon;
do $$
begin
  begin
    perform 1 from public.budgets;
    raise exception 'FALHA: anon consultou orçamentos';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

do $$ begin raise exception 'OK: todos os testes de planejamento passaram'; end $$;

rollback;
