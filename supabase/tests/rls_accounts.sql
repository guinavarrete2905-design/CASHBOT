-- Testes de contas, cartões, transferências e saldos.
-- Rodam dentro de uma transação e terminam em ROLLBACK: nada fica gravado.
-- Resultado esperado: o erro proposital "OK: todos os testes de contas passaram".

begin;

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-4000-c000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ac-a@cashbot.test', '{"full_name":"Ana"}', now(), now()),
  ('00000000-0000-4000-c000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ac-b@cashbot.test', '{"full_name":"Bruno"}', now(), now()),
  ('00000000-0000-4000-c000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ac-c@cashbot.test', '{"full_name":"Carla"}', now(), now());

select set_config('test.c_personal', (select id::text from public.spaces where owner_id = '00000000-0000-4000-c000-00000000000c' and type = 'personal'), true);

set local role authenticated;

-- ===== CARLA cria uma conta no próprio espaço (para testar isolamento) =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-c000-00000000000c","role":"authenticated"}', true);
do $$
declare v_id uuid;
begin
  insert into public.accounts (space_id, name, type, initial_balance)
  values (current_setting('test.c_personal')::uuid, 'Conta da Carla', 'checking', 100)
  returning id into v_id;
  perform set_config('test.c_account', v_id::text, true);
end $$;

-- ===== ANA (proprietária) =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-c000-00000000000a","role":"authenticated"}', true);
do $$
declare v int; v_space uuid; v_check uuid; v_card uuid; v_bal numeric;
begin
  v_space := public.create_space('Casa', 'couple');
  perform set_config('test.space', v_space::text, true);
  perform public.add_space_member(v_space, 'ac-b@cashbot.test', 'member');

  insert into public.accounts (space_id, name, type, initial_balance)
  values (v_space, 'Corrente', 'checking', 1000) returning id into v_check;
  insert into public.accounts (space_id, name, type, credit_limit, closing_day, due_day)
  values (v_space, 'Cartão', 'credit_card', 5000, 5, 12) returning id into v_card;
  perform set_config('test.check', v_check::text, true);
  perform set_config('test.card', v_card::text, true);

  -- Cartão exige dias de fechamento e vencimento; conta comum não aceita esses campos.
  begin
    insert into public.accounts (space_id, name, type) values (v_space, 'Cartão sem dias', 'credit_card');
    raise exception 'FALHA: aceitou cartão sem dias de fechamento/vencimento';
  exception when check_violation then null;
  end;
  begin
    insert into public.accounts (space_id, name, type, closing_day, due_day) values (v_space, 'Conta com dia', 'checking', 1, 10);
    raise exception 'FALHA: aceitou conta comum com dia de fechamento';
  exception when check_violation then null;
  end;
  begin
    insert into public.accounts (space_id, name, type, initial_balance) values (v_space, 'corrente', 'savings', 0);
    raise exception 'FALHA: aceitou nome de conta repetido';
  exception when unique_violation then null;
  end;

  -- Movimentações: receita 500 paga, despesa 200 paga, despesa 50 pendente (não entra no saldo).
  insert into public.transactions (space_id, kind, description, amount, occurred_on, account_id, status) values
    (v_space, 'income', 'Salário', 500, current_date, v_check, 'paid'),
    (v_space, 'expense', 'Mercado', 200, current_date, v_check, 'paid'),
    (v_space, 'expense', 'Luz', 50, current_date, v_check, 'pending'),
    (v_space, 'expense', 'Compra no cartão', 300, current_date, v_card, 'paid');

  -- Pagamento de fatura = transferência da corrente para o cartão.
  insert into public.transactions (space_id, kind, description, amount, occurred_on, account_id, transfer_account_id)
  values (v_space, 'transfer', 'Pagamento da fatura', 120, current_date, v_check, v_card);

  select balance into v_bal from public.account_balances where account_id = v_check;
  if v_bal <> 1180 then raise exception 'FALHA: saldo da corrente deveria ser 1180, é %', v_bal; end if;
  select balance into v_bal from public.account_balances where account_id = v_card;
  if v_bal <> -180 then raise exception 'FALHA: saldo do cartão deveria ser -180, é %', v_bal; end if;

  -- Transferência precisa de duas contas diferentes e não tem categoria.
  begin
    insert into public.transactions (space_id, kind, description, amount, occurred_on, account_id, transfer_account_id)
    values (v_space, 'transfer', 'Para ela mesma', 10, current_date, v_check, v_check);
    raise exception 'FALHA: aceitou transferência para a mesma conta';
  exception when check_violation then null;
  end;
  begin
    insert into public.transactions (space_id, kind, description, amount, occurred_on, account_id)
    values (v_space, 'transfer', 'Sem destino', 10, current_date, v_check);
    raise exception 'FALHA: aceitou transferência sem conta de destino';
  exception when check_violation then null;
  end;

  -- Não usa conta de outro espaço (nem a vê).
  begin
    insert into public.transactions (space_id, kind, description, amount, occurred_on, account_id)
    values (v_space, 'expense', 'Conta alheia', 10, current_date, current_setting('test.c_account')::uuid);
    raise exception 'FALHA: aceitou conta de outro espaço';
  exception when check_violation then null;
  end;
  select count(*) into v from public.account_balances where account_id = current_setting('test.c_account')::uuid;
  if v <> 0 then raise exception 'FALHA: Ana vê saldo de conta de outro espaço'; end if;

  -- Conta com movimentações não pode ser excluída (deve ser arquivada).
  begin
    delete from public.accounts where id = v_check;
    raise exception 'FALHA: excluiu conta com movimentações';
  exception when foreign_key_violation then null;
  end;

  -- Conta não vira cartão.
  begin
    update public.accounts set type = 'credit_card', closing_day = 1, due_day = 10 where id = v_check;
    raise exception 'FALHA: conta virou cartão';
  exception when check_violation then null;
  end;
end $$;

-- ===== BRUNO (membro) =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-c000-00000000000b","role":"authenticated"}', true);
do $$
declare v int;
begin
  select count(*) into v from public.accounts where space_id = current_setting('test.space')::uuid;
  if v <> 2 then raise exception 'FALHA: membro deveria ver as 2 contas do espaço, vê %', v; end if;
  select count(*) into v from public.account_balances where space_id = current_setting('test.space')::uuid;
  if v <> 2 then raise exception 'FALHA: membro deveria ver os saldos do espaço'; end if;

  -- Membro lança usando as contas, mas não cria, edita nem exclui contas.
  insert into public.transactions (space_id, kind, description, amount, occurred_on, account_id)
  values (current_setting('test.space')::uuid, 'expense', 'Padaria', 15, current_date, current_setting('test.check')::uuid);
  begin
    insert into public.accounts (space_id, name, type) values (current_setting('test.space')::uuid, 'Do Bruno', 'wallet');
    raise exception 'FALHA: membro criou conta';
  exception when insufficient_privilege then null;
  end;
  update public.accounts set name = 'Renomeada' where id = current_setting('test.check')::uuid;
  get diagnostics v = row_count;
  if v <> 0 then raise exception 'FALHA: membro editou conta'; end if;
end $$;

-- ===== CARLA (fora do espaço) =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-c000-00000000000c","role":"authenticated"}', true);
do $$
declare v int;
begin
  select count(*) into v from public.accounts where space_id = current_setting('test.space')::uuid;
  if v <> 0 then raise exception 'FALHA: pessoa de fora vê contas do espaço'; end if;
  select count(*) into v from public.account_balances where space_id = current_setting('test.space')::uuid;
  if v <> 0 then raise exception 'FALHA: pessoa de fora vê saldos do espaço'; end if;
end $$;

reset role;
set local role anon;
do $$
begin
  begin
    perform 1 from public.accounts;
    raise exception 'FALHA: anon consultou contas';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.account_balances;
    raise exception 'FALHA: anon consultou saldos';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

do $$ begin raise exception 'OK: todos os testes de contas passaram'; end $$;

rollback;
