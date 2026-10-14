-- Testes de séries (parcelas e recorrências).
-- Rodam dentro de uma transação e terminam em ROLLBACK: nada fica gravado.
-- Resultado esperado: o erro proposital "OK: todos os testes de parcelas passaram".

begin;

insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-4000-d000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sr-a@cashbot.test', '{"full_name":"Ana"}', now(), now()),
  ('00000000-0000-4000-d000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sr-c@cashbot.test', '{"full_name":"Carla"}', now(), now());

select set_config('test.a_space', (select id::text from public.spaces where owner_id = '00000000-0000-4000-d000-00000000000a' and type = 'personal'), true);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-d000-00000000000a","role":"authenticated"}', true);

do $$
declare v int; v_space uuid := current_setting('test.a_space')::uuid; v_series uuid := gen_random_uuid();
begin
  perform set_config('test.series', v_series::text, true);

  -- Parcelamento em 3x, num único insert.
  insert into public.transactions (space_id, kind, description, amount, occurred_on, status, series_id, series_kind, series_index, series_total)
  values
    (v_space, 'expense', 'Geladeira', 1000.00, '2026-10-10', 'paid', v_series, 'installment', 1, 3),
    (v_space, 'expense', 'Geladeira', 1000.00, '2026-11-10', 'pending', v_series, 'installment', 2, 3),
    (v_space, 'expense', 'Geladeira', 1000.00, '2026-12-10', 'pending', v_series, 'installment', 3, 3);

  -- Mesma posição duas vezes na série.
  begin
    insert into public.transactions (space_id, kind, description, amount, occurred_on, series_id, series_kind, series_index, series_total)
    values (v_space, 'expense', 'Duplicada', 10, '2026-10-10', v_series, 'installment', 2, 3);
    raise exception 'FALHA: aceitou parcela repetida na mesma posição';
  exception when unique_violation then null;
  end;

  -- Campos de série incompletos ou fora do intervalo.
  begin
    insert into public.transactions (space_id, kind, description, amount, occurred_on, series_id, series_kind)
    values (v_space, 'expense', 'Incompleta', 10, '2026-10-10', gen_random_uuid(), 'installment');
    raise exception 'FALHA: aceitou série incompleta';
  exception when check_violation then null;
  end;
  begin
    insert into public.transactions (space_id, kind, description, amount, occurred_on, series_id, series_kind, series_index, series_total)
    values (v_space, 'expense', 'Fora', 10, '2026-10-10', gen_random_uuid(), 'installment', 4, 3);
    raise exception 'FALHA: aceitou parcela 4 de 3';
  exception when check_violation then null;
  end;

  -- Transferência não pode ser parcelada.
  begin
    insert into public.accounts (space_id, name, type) values (v_space, 'A', 'checking'), (v_space, 'B', 'savings');
    insert into public.transactions (space_id, kind, description, amount, occurred_on, account_id, transfer_account_id, series_id, series_kind, series_index, series_total)
    select v_space, 'transfer', 'Parcelada', 10, '2026-10-10',
      (select id from public.accounts where space_id = v_space and name = 'A'),
      (select id from public.accounts where space_id = v_space and name = 'B'),
      gen_random_uuid(), 'installment', 1, 2;
    raise exception 'FALHA: aceitou transferência parcelada';
  exception when check_violation then null;
  end;

  -- "Esta e as próximas": muda da parcela 2 em diante.
  update public.transactions set amount = 900 where series_id = v_series and series_index >= 2;
  get diagnostics v = row_count;
  if v <> 2 then raise exception 'FALHA: deveria alterar 2 parcelas, alterou %', v; end if;
  select count(*) into v from public.transactions where series_id = v_series and amount = 1000;
  if v <> 1 then raise exception 'FALHA: a primeira parcela não deveria mudar'; end if;
end $$;

-- ===== CARLA (outro espaço) não altera nem exclui a série da Ana =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-d000-00000000000c","role":"authenticated"}', true);
do $$
declare v int;
begin
  update public.transactions set amount = 1 where series_id = current_setting('test.series')::uuid;
  get diagnostics v = row_count;
  if v <> 0 then raise exception 'FALHA: pessoa de outro espaço alterou a série'; end if;
  delete from public.transactions where series_id = current_setting('test.series')::uuid;
  get diagnostics v = row_count;
  if v <> 0 then raise exception 'FALHA: pessoa de outro espaço excluiu a série'; end if;
end $$;

-- ===== ANA exclui "todas" =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-d000-00000000000a","role":"authenticated"}', true);
do $$
declare v int;
begin
  delete from public.transactions where series_id = current_setting('test.series')::uuid;
  get diagnostics v = row_count;
  if v <> 3 then raise exception 'FALHA: deveria excluir as 3 parcelas, excluiu %', v; end if;
end $$;

reset role;
do $$ begin raise exception 'OK: todos os testes de parcelas passaram'; end $$;

rollback;
