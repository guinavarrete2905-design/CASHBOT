-- Testes das ações em massa (delete_transactions_batch e update_transactions_batch).
-- Rodam dentro de uma transação e terminam em ROLLBACK: nada fica gravado.
-- Resultado esperado: o erro proposital "OK: todos os testes de ações em massa passaram".

begin;

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-4000-a100-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ba-a@cashbot.test', '{"full_name":"Ana"}', now(), now()),
  ('00000000-0000-4000-a100-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ba-b@cashbot.test', '{"full_name":"Bruno"}', now(), now()),
  ('00000000-0000-4000-a100-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ba-c@cashbot.test', '{"full_name":"Carla"}', now(), now());

set local role authenticated;

-- ===== ANA (proprietária) =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a100-00000000000a","role":"authenticated"}', true);
do $$
declare
  v_space uuid;
  v_itau uuid;
  v_cash uuid;
  v_card uuid;
  v_food uuid;
  v_salary uuid;
begin
  v_space := public.create_space('Casa', 'couple');
  perform set_config('test.space', v_space::text, true);
  perform public.add_space_member(v_space, 'ba-b@cashbot.test', 'member');
  insert into public.accounts (space_id, name, type) values (v_space, 'Itaú', 'checking') returning id into v_itau;
  insert into public.accounts (space_id, name, type) values (v_space, 'Carteira', 'wallet') returning id into v_cash;
  insert into public.accounts (space_id, name, type, credit_limit, closing_day, due_day) values (v_space, 'Nubank', 'credit_card', 5000, 3, 10) returning id into v_card;
  select id into v_food from public.categories where space_id = v_space and name = 'Alimentação';
  select id into v_salary from public.categories where space_id = v_space and name = 'Salário';
  perform set_config('test.itau', v_itau::text, true);
  perform set_config('test.cash', v_cash::text, true);
  perform set_config('test.card', v_card::text, true);
  perform set_config('test.food', v_food::text, true);

  insert into public.transactions (space_id, kind, description, amount, occurred_on, account_id, status) values
    (v_space, 'expense', 'A1', 10, '2026-10-01', v_itau, 'pending'),
    (v_space, 'expense', 'A2', 20, '2026-10-02', v_itau, 'pending'),
    (v_space, 'income', 'A3', 30, '2026-10-03', v_itau, 'paid');
  insert into public.transactions (space_id, kind, description, amount, occurred_on, account_id, transfer_account_id) values
    (v_space, 'transfer', 'T1', 40, '2026-10-04', v_itau, v_cash);
end $$;

-- ===== BRUNO (membro) =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a100-00000000000b","role":"authenticated"}', true);
do $$
declare v_space uuid := current_setting('test.space')::uuid; v_ids uuid[]; v int; v_own uuid;
begin
  insert into public.transactions (space_id, kind, description, amount, occurred_on) values (v_space, 'expense', 'B1', 5, '2026-10-05') returning id into v_own;

  -- Membro não exclui o que outra pessoa lançou: tudo ou nada.
  select array_agg(id) into v_ids from public.transactions where space_id = v_space;
  begin
    perform public.delete_transactions_batch(v_space, v_ids);
    raise exception 'FALHA: membro excluiu movimentações de outra pessoa';
  exception when insufficient_privilege then null;
  end;
  select count(*) into v from public.transactions where space_id = v_space;
  if v <> 5 then raise exception 'FALHA: exclusão parcial (% restantes)', v; end if;

  -- Mas pode excluir as próprias.
  v := public.delete_transactions_batch(v_space, array[v_own]);
  if v <> 1 then raise exception 'FALHA: membro deveria excluir a própria'; end if;

  -- Membro pode alterar categoria (mesma regra do formulário).
  select array_agg(id) into v_ids from public.transactions where space_id = v_space and description in ('A1', 'A2');
  v := public.update_transactions_batch(v_space, v_ids, false, null, true, current_setting('test.food')::uuid);
  if v <> 2 then raise exception 'FALHA: deveria alterar 2 categorias'; end if;
  select count(*) into v from public.transactions where space_id = v_space and category_id = current_setting('test.food')::uuid;
  if v <> 2 then raise exception 'FALHA: categorias não foram alteradas'; end if;
end $$;

-- ===== ANA: regras das alterações =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a100-00000000000a","role":"authenticated"}', true);
do $$
declare v_space uuid := current_setting('test.space')::uuid; v_ids uuid[]; v int;
begin
  -- Categoria de despesa numa seleção com receita: nada muda.
  select array_agg(id) into v_ids from public.transactions where space_id = v_space and description in ('A1', 'A3');
  begin
    perform public.update_transactions_batch(v_space, v_ids, false, null, true, current_setting('test.food')::uuid);
    raise exception 'FALHA: aceitou categoria de despesa em receita';
  exception when check_violation then null;
  end;
  select count(*) into v from public.transactions where space_id = v_space and description = 'A3' and category_id is not null;
  if v <> 0 then raise exception 'FALHA: alteração parcial de categoria'; end if;

  -- Transferência na seleção impede alterar categoria.
  select array_agg(id) into v_ids from public.transactions where space_id = v_space and description in ('A1', 'T1');
  begin
    perform public.update_transactions_batch(v_space, v_ids, false, null, true, null);
    raise exception 'FALHA: aceitou categoria em transferência';
  exception when check_violation then null;
  end;

  -- Origem igual ao destino da transferência é recusada.
  begin
    perform public.update_transactions_batch(v_space, v_ids, true, current_setting('test.cash')::uuid, false, null);
    raise exception 'FALHA: aceitou origem igual ao destino';
  exception when check_violation then null;
  end;

  -- Mover para o cartão: despesas ficam pagas (situação da fatura).
  select array_agg(id) into v_ids from public.transactions where space_id = v_space and description in ('A1', 'A2');
  v := public.update_transactions_batch(v_space, v_ids, true, current_setting('test.card')::uuid, false, null);
  if v <> 2 then raise exception 'FALHA: deveria mover 2 para o cartão'; end if;
  select count(*) into v from public.transactions where space_id = v_space and account_id = current_setting('test.card')::uuid and status = 'paid';
  if v <> 2 then raise exception 'FALHA: no cartão a situação deveria ser paga'; end if;

  -- Id inexistente na seleção: nada muda.
  begin
    perform public.update_transactions_batch(v_space, v_ids || gen_random_uuid(), true, current_setting('test.itau')::uuid, false, null);
    raise exception 'FALHA: aceitou seleção com id inexistente';
  exception when insufficient_privilege then null;
  end;
  select count(*) into v from public.transactions where space_id = v_space and account_id = current_setting('test.card')::uuid;
  if v <> 2 then raise exception 'FALHA: alteração parcial com id inexistente'; end if;

  -- Proprietária exclui tudo.
  select array_agg(id) into v_ids from public.transactions where space_id = v_space;
  v := public.delete_transactions_batch(v_space, v_ids);
  if v <> 4 then raise exception 'FALHA: proprietária deveria excluir 4, excluiu %', v; end if;
end $$;

-- ===== CARLA (de fora) =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-a100-00000000000c","role":"authenticated"}', true);
do $$
begin
  begin
    perform public.delete_transactions_batch(current_setting('test.space')::uuid, array[gen_random_uuid()]);
    raise exception 'FALHA: Carla usou a função no espaço do casal';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
set local role anon;
do $$
begin
  begin
    perform public.delete_transactions_batch(gen_random_uuid(), array[gen_random_uuid()]);
    raise exception 'FALHA: anônimo executou a função';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

do $$ begin raise exception 'OK: todos os testes de ações em massa passaram'; end $$;

rollback;
