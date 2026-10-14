-- Testes de autorização (RLS) das movimentações.
-- Rodam dentro de uma transação e terminam em ROLLBACK: nada fica gravado.
-- Resultado esperado: o erro proposital "OK: todos os testes de movimentações passaram".
-- Qualquer falha aparece como "FALHA: <descrição>".

begin;

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-4000-b000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tx-a@cashbot.test', '{"full_name":"Ana"}', now(), now()),
  ('00000000-0000-4000-b000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tx-b@cashbot.test', '{"full_name":"Bruno"}', now(), now()),
  ('00000000-0000-4000-b000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tx-c@cashbot.test', '{"full_name":"Carla"}', now(), now());

select set_config('test.a_personal', (select id::text from public.spaces where owner_id = '00000000-0000-4000-b000-00000000000a' and type = 'personal'), true),
       set_config('test.c_personal', (select id::text from public.spaces where owner_id = '00000000-0000-4000-b000-00000000000c' and type = 'personal'), true);

-- ===== ANA =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-b000-00000000000a","role":"authenticated"}', true);

do $$
declare v int; v_couple uuid; v_cat_exp uuid; v_cat_inc uuid; v_cat_c uuid; v_tx uuid;
begin
  v_couple := public.create_space('Casa', 'couple');
  perform set_config('test.couple', v_couple::text, true);
  perform public.add_space_member(v_couple, 'tx-b@cashbot.test', 'member');

  select id into v_cat_exp from public.categories where space_id = v_couple and kind = 'expense' limit 1;
  select id into v_cat_inc from public.categories where space_id = v_couple and kind = 'income' limit 1;
  perform set_config('test.cat_exp', v_cat_exp::text, true);

  -- Lança no próprio espaço; o autor é sempre quem lançou.
  insert into public.transactions (space_id, kind, description, amount, occurred_on, category_id, created_by)
  values (v_couple, 'expense', 'Mercado', 250.40, current_date, v_cat_exp, '00000000-0000-4000-b000-00000000000c')
  returning id into v_tx;
  perform set_config('test.tx_ana', v_tx::text, true);
  select count(*) into v from public.transactions where id = v_tx and created_by = '00000000-0000-4000-b000-00000000000a';
  if v <> 1 then raise exception 'FALHA: autor da movimentação não foi forçado para quem lançou'; end if;

  -- Categoria precisa ser do mesmo tipo.
  begin
    insert into public.transactions (space_id, kind, description, amount, occurred_on, category_id)
    values (v_couple, 'expense', 'Errada', 10, current_date, v_cat_inc);
    raise exception 'FALHA: aceitou categoria de receita numa despesa';
  exception when check_violation then null;
  end;

  -- Valor precisa ser positivo.
  begin
    insert into public.transactions (space_id, kind, description, amount, occurred_on)
    values (v_couple, 'expense', 'Negativa', -5, current_date);
    raise exception 'FALHA: aceitou valor negativo';
  exception when check_violation then null;
  end;

  -- Não lança em espaço alheio.
  begin
    insert into public.transactions (space_id, kind, description, amount, occurred_on)
    values (current_setting('test.c_personal')::uuid, 'expense', 'Invasão', 1, current_date);
    raise exception 'FALHA: lançou em espaço alheio';
  exception when insufficient_privilege then null;
  end;

  -- Não usa categoria de outro espaço.
  select id into v_cat_c from public.categories where space_id = current_setting('test.a_personal')::uuid and kind = 'expense' limit 1;
  begin
    insert into public.transactions (space_id, kind, description, amount, occurred_on, category_id)
    values (v_couple, 'expense', 'Categoria de outro espaço', 1, current_date, v_cat_c);
    raise exception 'FALHA: aceitou categoria de outro espaço';
  exception when check_violation then null;
  end;
end $$;

-- ===== BRUNO (membro) =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-b000-00000000000b","role":"authenticated"}', true);
do $$
declare v int; v_tx uuid;
begin
  select count(*) into v from public.transactions where space_id = current_setting('test.couple')::uuid;
  if v <> 1 then raise exception 'FALHA: membro deveria ver 1 movimentação do espaço, vê %', v; end if;

  insert into public.transactions (space_id, kind, description, amount, occurred_on)
  values (current_setting('test.couple')::uuid, 'income', 'Salário', 5000, current_date)
  returning id into v_tx;

  -- Membro edita, mas não move para outro espaço.
  update public.transactions set amount = 260 where id = current_setting('test.tx_ana')::uuid;
  get diagnostics v = row_count;
  if v <> 1 then raise exception 'FALHA: membro não conseguiu editar movimentação do espaço'; end if;
  begin
    update public.transactions set space_id = current_setting('test.a_personal')::uuid where id = v_tx;
    raise exception 'FALHA: movimentação mudou de espaço';
  exception when insufficient_privilege then null;
  end;

  -- Membro exclui só o que ele lançou.
  delete from public.transactions where id = current_setting('test.tx_ana')::uuid;
  get diagnostics v = row_count;
  if v <> 0 then raise exception 'FALHA: membro excluiu movimentação de outra pessoa'; end if;
  delete from public.transactions where id = v_tx;
  get diagnostics v = row_count;
  if v <> 1 then raise exception 'FALHA: membro não conseguiu excluir a própria movimentação'; end if;
end $$;

-- ===== CARLA (fora do espaço) =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-b000-00000000000c","role":"authenticated"}', true);
do $$
declare v int;
begin
  select count(*) into v from public.transactions where space_id = current_setting('test.couple')::uuid;
  if v <> 0 then raise exception 'FALHA: pessoa de fora vê movimentações do espaço'; end if;
  update public.transactions set amount = 1 where space_id = current_setting('test.couple')::uuid;
  get diagnostics v = row_count;
  if v <> 0 then raise exception 'FALHA: pessoa de fora editou movimentações'; end if;
end $$;

-- ===== ANA (proprietária) exclui qualquer movimentação; excluir categoria mantém a movimentação =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-b000-00000000000a","role":"authenticated"}', true);
do $$
declare v int;
begin
  delete from public.categories where id = current_setting('test.cat_exp')::uuid;
  select count(*) into v from public.transactions where id = current_setting('test.tx_ana')::uuid and category_id is null;
  if v <> 1 then raise exception 'FALHA: excluir categoria deveria apenas desvincular a movimentação'; end if;
  delete from public.transactions where id = current_setting('test.tx_ana')::uuid;
  get diagnostics v = row_count;
  if v <> 1 then raise exception 'FALHA: proprietária não conseguiu excluir movimentação'; end if;
end $$;

reset role;
set local role anon;
do $$
begin
  begin
    perform 1 from public.transactions;
    raise exception 'FALHA: anon consultou movimentações';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

do $$ begin raise exception 'OK: todos os testes de movimentações passaram'; end $$;

rollback;
