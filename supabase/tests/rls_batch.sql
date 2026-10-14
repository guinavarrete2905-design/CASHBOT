-- Testes do lançamento em massa (create_transactions_batch).
-- Rodam dentro de uma transação e terminam em ROLLBACK: nada fica gravado.
-- Resultado esperado: o erro proposital "OK: todos os testes de lançamento em massa passaram".

begin;

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-4000-f000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bt-a@cashbot.test', '{"full_name":"Ana"}', now(), now()),
  ('00000000-0000-4000-f000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bt-b@cashbot.test', '{"full_name":"Bruno"}', now(), now()),
  ('00000000-0000-4000-f000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bt-c@cashbot.test', '{"full_name":"Carla"}', now(), now());

set local role authenticated;

-- ===== ANA: cria o espaço do casal, contas e testa lotes =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-f000-00000000000a","role":"authenticated"}', true);
do $$
declare
  v_space uuid;
  v_itau uuid;
  v_cash uuid;
  v_food uuid;
  v_salary uuid;
  v_series uuid := gen_random_uuid();
  v_batch uuid := gen_random_uuid();
  r record;
  v int;
begin
  v_space := public.create_space('Casa', 'couple');
  perform set_config('test.space', v_space::text, true);
  perform public.add_space_member(v_space, 'bt-b@cashbot.test', 'member');
  insert into public.accounts (space_id, name, type, initial_balance) values (v_space, 'Itaú', 'checking', 1000) returning id into v_itau;
  insert into public.accounts (space_id, name, type, initial_balance) values (v_space, 'Carteira', 'wallet', 0) returning id into v_cash;
  perform set_config('test.itau', v_itau::text, true);
  select id into v_food from public.categories where space_id = v_space and name = 'Alimentação';
  select id into v_salary from public.categories where space_id = v_space and name = 'Salário';
  perform set_config('test.food', v_food::text, true);

  -- 1) Lote com receita, despesa, transferência e uma compra em 3 parcelas.
  select * into r from public.create_transactions_batch(v_space, v_batch, jsonb_build_array(
    jsonb_build_object('kind', 'income', 'description', 'Salário', 'amount', 5000, 'occurred_on', '2026-10-05', 'category_id', v_salary, 'account_id', v_itau, 'status', 'paid', 'ref', '1'),
    jsonb_build_object('kind', 'expense', 'description', 'Mercado', 'amount', 250.90, 'occurred_on', '2026-10-06', 'category_id', v_food, 'account_id', v_cash, 'status', 'paid', 'ref', '2'),
    jsonb_build_object('kind', 'transfer', 'description', 'Saque', 'amount', 300, 'occurred_on', '2026-10-07', 'account_id', v_itau, 'transfer_account_id', v_cash, 'status', 'paid', 'ref', '3'),
    jsonb_build_object('kind', 'expense', 'description', 'Geladeira', 'amount', 400, 'occurred_on', '2026-10-10', 'account_id', v_itau, 'status', 'paid', 'series_id', v_series, 'series_kind', 'installment', 'series_index', 1, 'series_total', 3, 'ref', '4:1'),
    jsonb_build_object('kind', 'expense', 'description', 'Geladeira', 'amount', 400, 'occurred_on', '2026-11-10', 'account_id', v_itau, 'status', 'pending', 'series_id', v_series, 'series_kind', 'installment', 'series_index', 2, 'series_total', 3, 'ref', '4:2'),
    jsonb_build_object('kind', 'expense', 'description', 'Geladeira', 'amount', 400, 'occurred_on', '2026-12-10', 'account_id', v_itau, 'status', 'pending', 'series_id', v_series, 'series_kind', 'installment', 'series_index', 3, 'series_total', 3, 'ref', '4:3')
  ));
  if r.inserted <> 6 or r.already_saved then raise exception 'FALHA: o lote deveria gravar 6 movimentações: %', r; end if;

  select count(*) into v from public.transactions where space_id = v_space and series_id = v_series;
  if v <> 3 then raise exception 'FALHA: a série deveria ter 3 parcelas, tem %', v; end if;
  select count(*) into v from public.transactions where space_id = v_space and created_by = '00000000-0000-4000-f000-00000000000a';
  if v <> 6 then raise exception 'FALHA: o autor deveria ser quem lançou'; end if;
  select count(*) into v from public.transactions where space_id = v_space and kind = 'transfer' and category_id is null and transfer_account_id = v_cash;
  if v <> 1 then raise exception 'FALHA: transferência gravada incorretamente'; end if;

  -- 2) Reenvio do mesmo lote não duplica.
  select * into r from public.create_transactions_batch(v_space, v_batch, jsonb_build_array(
    jsonb_build_object('kind', 'expense', 'description', 'Outra coisa', 'amount', 1, 'occurred_on', '2026-10-06', 'ref', '1')
  ));
  if not r.already_saved or r.inserted <> 6 then raise exception 'FALHA: reenvio deveria informar lote já salvo: %', r; end if;
  select count(*) into v from public.transactions where space_id = v_space;
  if v <> 6 then raise exception 'FALHA: reenvio duplicou movimentações (% no espaço)', v; end if;

  -- 3) Uma linha inválida reverte o lote inteiro (categoria de receita numa despesa).
  begin
    perform public.create_transactions_batch(v_space, gen_random_uuid(), jsonb_build_array(
      jsonb_build_object('kind', 'expense', 'description', 'Válida', 'amount', 10, 'occurred_on', '2026-10-08', 'ref', '1'),
      jsonb_build_object('kind', 'expense', 'description', 'Inválida', 'amount', 10, 'occurred_on', '2026-10-08', 'category_id', v_salary, 'ref', '2')
    ));
    raise exception 'FALHA: aceitou categoria incompatível';
  exception when check_violation then null;
  end;
  select count(*) into v from public.transactions where space_id = v_space and description in ('Válida', 'Inválida');
  if v <> 0 then raise exception 'FALHA: gravação parcial — % linhas ficaram', v; end if;

  -- 4) Valor zero (regra da tabela) também reverte tudo.
  begin
    perform public.create_transactions_batch(v_space, gen_random_uuid(), jsonb_build_array(
      jsonb_build_object('kind', 'expense', 'description', 'Ok', 'amount', 10, 'occurred_on', '2026-10-08', 'ref', '1'),
      jsonb_build_object('kind', 'expense', 'description', 'Zero', 'amount', 0, 'occurred_on', '2026-10-08', 'ref', '2')
    ));
    raise exception 'FALHA: aceitou valor zero';
  exception when check_violation then null;
  end;
  select count(*) into v from public.transactions where space_id = v_space and description in ('Ok', 'Zero');
  if v <> 0 then raise exception 'FALHA: gravação parcial com valor zero'; end if;

  -- 5) Transferência para a mesma conta é recusada.
  begin
    perform public.create_transactions_batch(v_space, gen_random_uuid(), jsonb_build_array(
      jsonb_build_object('kind', 'transfer', 'description', 'Errada', 'amount', 10, 'occurred_on', '2026-10-08', 'account_id', v_itau, 'transfer_account_id', v_itau, 'ref', '1')
    ));
    raise exception 'FALHA: aceitou transferência para a mesma conta';
  exception when check_violation then null;
  end;

  -- 6) Lote vazio.
  begin
    perform public.create_transactions_batch(v_space, gen_random_uuid(), '[]'::jsonb);
    raise exception 'FALHA: aceitou lote vazio';
  exception when invalid_parameter_value then null;
  end;
end $$;

-- ===== BRUNO (membro do espaço) pode lançar em massa =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-f000-00000000000b","role":"authenticated"}', true);
do $$
declare r record;
begin
  select * into r from public.create_transactions_batch(current_setting('test.space')::uuid, gen_random_uuid(), jsonb_build_array(
    jsonb_build_object('kind', 'expense', 'description', 'Padaria', 'amount', 12.5, 'occurred_on', '2026-10-09', 'category_id', current_setting('test.food')::uuid, 'ref', '1')
  ));
  if r.inserted <> 1 then raise exception 'FALHA: membro deveria conseguir lançar'; end if;
end $$;

-- ===== CARLA (de fora) não grava no espaço do casal nem usa as contas dele =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-f000-00000000000c","role":"authenticated"}', true);
do $$
declare v_own uuid; v int;
begin
  begin
    perform public.create_transactions_batch(current_setting('test.space')::uuid, gen_random_uuid(), jsonb_build_array(
      jsonb_build_object('kind', 'expense', 'description', 'Invasão', 'amount', 1, 'occurred_on', '2026-10-09', 'ref', '1')
    ));
    raise exception 'FALHA: Carla gravou no espaço do casal';
  exception when insufficient_privilege then null;
  end;

  -- No próprio espaço, mas com a conta do casal: recusado pelo gatilho.
  select id into v_own from public.spaces where owner_id = '00000000-0000-4000-f000-00000000000c' and type = 'personal';
  begin
    perform public.create_transactions_batch(v_own, gen_random_uuid(), jsonb_build_array(
      jsonb_build_object('kind', 'expense', 'description', 'Conta alheia', 'amount', 1, 'occurred_on', '2026-10-09', 'account_id', current_setting('test.itau')::uuid, 'ref', '1')
    ));
    raise exception 'FALHA: Carla usou conta de outro espaço';
  exception when check_violation then null;
  end;

  select count(*) into v from public.transactions where space_id = current_setting('test.space')::uuid;
  if v <> 0 then raise exception 'FALHA: Carla enxerga movimentações do casal'; end if;
end $$;

-- ===== Visitante anônimo =====
reset role;
set local role anon;
do $$
begin
  begin
    perform public.create_transactions_batch(gen_random_uuid(), gen_random_uuid(), '[]'::jsonb);
    raise exception 'FALHA: anônimo executou a função';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

do $$ begin raise exception 'OK: todos os testes de lançamento em massa passaram'; end $$;

rollback;
