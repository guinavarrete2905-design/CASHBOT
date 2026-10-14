-- Testes de patrimônio (bens, dívidas e histórico mensal).
-- Rodam dentro de uma transação e terminam em ROLLBACK: nada fica gravado.
-- Resultado esperado: o erro proposital "OK: todos os testes de patrimônio passaram".

begin;

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-4000-f000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pt-a@cashbot.test', '{"full_name":"Ana"}', now(), now()),
  ('00000000-0000-4000-f000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pt-c@cashbot.test', '{"full_name":"Carla"}', now(), now());

select set_config('test.space', (select id::text from public.spaces where owner_id = '00000000-0000-4000-f000-00000000000a' and type = 'personal'), true);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-f000-00000000000a","role":"authenticated"}', true);

do $$
declare v_space uuid := current_setting('test.space')::uuid; v_check uuid; v_card uuid; r public.net_worth_snapshots;
begin
  -- Conta com 1.000 e cartão com 300 em aberto.
  insert into public.accounts (space_id, name, type, initial_balance) values (v_space, 'Corrente', 'checking', 1000) returning id into v_check;
  insert into public.accounts (space_id, name, type, closing_day, due_day) values (v_space, 'Cartão', 'credit_card', 5, 12) returning id into v_card;
  insert into public.transactions (space_id, kind, description, amount, occurred_on, account_id) values (v_space, 'expense', 'Compra', 300, current_date, v_card);

  insert into public.assets (space_id, name, type, value) values (v_space, 'Apartamento', 'property', 400000), (v_space, 'Tesouro', 'investment', 20000);
  insert into public.assets (space_id, name, type, value, archived) values (v_space, 'Carro vendido', 'vehicle', 50000, true);
  insert into public.liabilities (space_id, name, type, balance, monthly_payment) values (v_space, 'Financiamento', 'financing', 250000, 2500);

  begin
    insert into public.assets (space_id, name, type, value) values (v_space, 'Negativo', 'other', -1);
    raise exception 'FALHA: aceitou bem com valor negativo';
  exception when check_violation then null;
  end;

  r := public.record_net_worth_snapshot(v_space);
  if r.accounts <> 1000 then raise exception 'FALHA: contas deveriam somar 1000, somam %', r.accounts; end if;
  if r.assets <> 420000 then raise exception 'FALHA: bens deveriam somar 420000 (sem o arquivado), somam %', r.assets; end if;
  if r.liabilities <> 250300 then raise exception 'FALHA: dívidas deveriam somar 250300 (com o cartão), somam %', r.liabilities; end if;
  if r.net_worth <> 170700 then raise exception 'FALHA: patrimônio líquido deveria ser 170700, é %', r.net_worth; end if;

  -- Registrar de novo no mesmo mês atualiza a mesma linha.
  update public.assets set value = 21000 where name = 'Tesouro' and space_id = v_space;
  r := public.record_net_worth_snapshot(v_space);
  if r.net_worth <> 171700 then raise exception 'FALHA: atualização do mês deveria dar 171700, deu %', r.net_worth; end if;
  if (select count(*) from public.net_worth_snapshots where space_id = v_space) <> 1 then
    raise exception 'FALHA: deveria haver uma linha por mês';
  end if;

  -- Ninguém grava o histórico diretamente.
  begin
    insert into public.net_worth_snapshots (space_id, month, accounts, assets, liabilities, net_worth)
    values (v_space, '2020-01-01', 0, 0, 0, 999999999);
    raise exception 'FALHA: gravou histórico diretamente';
  exception when insufficient_privilege then null;
  end;
end $$;

-- ===== CARLA (outro espaço) =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-f000-00000000000c","role":"authenticated"}', true);
do $$
declare v int;
begin
  select count(*) into v from public.assets where space_id = current_setting('test.space')::uuid;
  if v <> 0 then raise exception 'FALHA: pessoa de fora vê bens'; end if;
  select count(*) into v from public.liabilities where space_id = current_setting('test.space')::uuid;
  if v <> 0 then raise exception 'FALHA: pessoa de fora vê dívidas'; end if;
  select count(*) into v from public.net_worth_snapshots where space_id = current_setting('test.space')::uuid;
  if v <> 0 then raise exception 'FALHA: pessoa de fora vê o histórico'; end if;
  begin
    perform public.record_net_worth_snapshot(current_setting('test.space')::uuid);
    raise exception 'FALHA: pessoa de fora registrou o patrimônio de outro espaço';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
set local role anon;
do $$
begin
  begin
    perform 1 from public.assets;
    raise exception 'FALHA: anon consultou bens';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

do $$ begin raise exception 'OK: todos os testes de patrimônio passaram'; end $$;

rollback;
