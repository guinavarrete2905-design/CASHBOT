-- Testes do Assistente Financeiro: histórico, consultas agregadas e duplicidade.
-- Rodam dentro de uma transação e terminam em ROLLBACK: nada fica gravado.
-- Resultado esperado: o erro proposital "OK: todos os testes do assistente passaram".

begin;

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-4000-9000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'as-a@cashbot.test', '{"full_name":"Ana"}', now(), now()),
  ('00000000-0000-4000-9000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'as-c@cashbot.test', '{"full_name":"Carla"}', now(), now());

select set_config('test.a_space', (select id::text from public.spaces where owner_id = '00000000-0000-4000-9000-00000000000a' and type = 'personal'), true),
       set_config('test.c_space', (select id::text from public.spaces where owner_id = '00000000-0000-4000-9000-00000000000c' and type = 'personal'), true);

set local role authenticated;

-- ===== ANA =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-9000-00000000000a","role":"authenticated"}', true);
do $$
declare
  v_space uuid := current_setting('test.a_space')::uuid;
  v_food uuid;
  r record;
  v int;
begin
  select id into v_food from public.categories where space_id = v_space and name = 'Alimentação';

  insert into public.transactions (space_id, kind, description, amount, occurred_on, category_id, status) values
    (v_space, 'income', 'Salário', 5000, '2026-10-05', null, 'paid'),
    (v_space, 'expense', 'Mercado', 300, '2026-10-06', v_food, 'paid'),
    (v_space, 'expense', 'Padaria', 50, '2026-10-07', v_food, 'pending'),
    (v_space, 'expense', 'Cinema', 120, '2026-10-08', null, 'paid'),
    (v_space, 'expense', 'Fora do período', 999, '2026-09-30', v_food, 'paid');

  select * into r from public.assistant_period_summary(v_space, '2026-10-01', '2026-10-31');
  if r.income <> 5000 or r.expense <> 470 or r.pending_expense <> 50 or r.income_count <> 1 or r.expense_count <> 3 then
    raise exception 'FALHA: resumo do período incorreto: %', r;
  end if;

  select * into r from public.assistant_period_summary(v_space, '2026-10-01', '2026-10-31', null, v_food);
  if r.expense <> 350 then raise exception 'FALHA: resumo por categoria deveria ser 350, é %', r.expense; end if;

  select * into r from public.assistant_expenses_by_category(v_space, '2026-10-01', '2026-10-31') limit 1;
  if r.category_name <> 'Alimentação' or r.total <> 350 then
    raise exception 'FALHA: maior categoria deveria ser Alimentação com 350: %', r;
  end if;

  select * into r from public.assistant_top_expenses(v_space, '2026-10-01', '2026-10-31', 1);
  if r.description <> 'Mercado' then raise exception 'FALHA: maior despesa deveria ser Mercado'; end if;
  select count(*) into v from public.assistant_top_expenses(v_space, '2026-01-01', '2026-12-31', 1000);
  if v > 50 then raise exception 'FALHA: limite de 50 linhas não respeitado'; end if;

  select count(*) into v from public.assistant_monthly_totals(v_space, '2026-09-01', '2026-10-31');
  if v <> 2 then raise exception 'FALHA: deveria haver 2 meses, há %', v; end if;

  -- Histórico.
  insert into public.assistant_messages (space_id, role, content, user_id)
  values (v_space, 'user', 'Quanto gastei este mês?', '00000000-0000-4000-9000-00000000000c');
  select count(*) into v from public.assistant_messages where user_id = '00000000-0000-4000-9000-00000000000a';
  if v <> 1 then raise exception 'FALHA: a mensagem deveria ficar no nome de quem está logado'; end if;

  begin
    insert into public.assistant_messages (space_id, role, content) values (current_setting('test.c_space')::uuid, 'user', 'invasão');
    raise exception 'FALHA: gravou mensagem em espaço alheio';
  exception when insufficient_privilege then null;
  end;

  -- Duplicidade: o mesmo código de lançamento do assistente não grava duas vezes.
  insert into public.transactions (space_id, kind, description, amount, occurred_on, external_ref)
  values (v_space, 'expense', 'Combustível', 80, '2026-10-10', 'assistente:teste-1');
  begin
    insert into public.transactions (space_id, kind, description, amount, occurred_on, external_ref)
    values (v_space, 'expense', 'Combustível', 80, '2026-10-10', 'assistente:teste-1');
    raise exception 'FALHA: aceitou o mesmo lançamento duas vezes';
  exception when unique_violation then null;
  end;
end $$;

-- ===== CARLA (outro espaço) =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-9000-00000000000c","role":"authenticated"}', true);
do $$
declare r record; v int;
begin
  select * into r from public.assistant_period_summary(current_setting('test.a_space')::uuid, '2026-01-01', '2026-12-31');
  if r.income <> 0 or r.expense <> 0 or r.income_count <> 0 or r.expense_count <> 0 then
    raise exception 'FALHA: Carla obteve totais do espaço da Ana: %', r;
  end if;
  select count(*) into v from public.assistant_top_expenses(current_setting('test.a_space')::uuid, '2026-01-01', '2026-12-31', 50);
  if v <> 0 then raise exception 'FALHA: Carla viu despesas da Ana'; end if;
  select count(*) into v from public.assistant_messages;
  if v <> 0 then raise exception 'FALHA: Carla viu o histórico da Ana'; end if;
  delete from public.assistant_messages;
  get diagnostics v = row_count;
  if v <> 0 then raise exception 'FALHA: Carla apagou o histórico da Ana'; end if;
end $$;

reset role;
set local role anon;
do $$
begin
  begin
    perform * from public.assistant_period_summary(current_setting('test.a_space')::uuid, '2026-01-01', '2026-12-31');
    raise exception 'FALHA: anon executou consulta do assistente';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

do $$ begin raise exception 'OK: todos os testes do assistente passaram'; end $$;

rollback;
