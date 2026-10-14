-- CashBot v2 — lançamento em massa.
-- Função que grava um lote de movimentações numa única transação (tudo ou nada) e de forma idempotente.
-- SECURITY INVOKER: roda com as permissões de quem chama, então o RLS e o gatilho transactions_guard
-- (categoria e contas do mesmo espaço, categoria do mesmo tipo, autor = quem lançou) continuam valendo.
-- Somente cria um objeto novo; não altera tabelas nem dados existentes.

create or replace function public.create_transactions_batch(p_space_id uuid, p_batch_id uuid, p_rows jsonb)
returns table (inserted integer, already_saved boolean)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  -- Cada movimentação do lote recebe external_ref = 'lote:<id do lote>:<posição>'. O índice único
  -- (space_id, external_ref) impede gravar o mesmo lote duas vezes, mesmo com cliques repetidos.
  v_prefix text := 'lote:' || p_batch_id::text || ':';
  v_existing integer;
  v_count integer;
  v_bad integer;
begin
  if auth.uid() is null then
    raise exception 'Faça login para continuar.' using errcode = '42501';
  end if;
  if p_space_id is null or p_batch_id is null then
    raise exception 'Lote inválido.' using errcode = '22023';
  end if;
  if not public.is_space_member(p_space_id) then
    raise exception 'Você não participa deste espaço financeiro.' using errcode = '42501';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'O lote está vazio.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_rows) > 3000 then
    raise exception 'O lote tem movimentações demais (máximo de 3.000, contando parcelas e repetições).' using errcode = '22023';
  end if;

  -- Reenvio do mesmo lote: não grava de novo, só informa.
  select count(*) into v_existing
  from public.transactions t
  where t.space_id = p_space_id and t.external_ref like v_prefix || '%';
  if v_existing > 0 then
    return query select v_existing, true;
    return;
  end if;

  -- Transferência precisa de origem e destino diferentes (mesma regra do formulário).
  select count(*) into v_bad
  from jsonb_to_recordset(p_rows) as r(kind text, account_id uuid, transfer_account_id uuid)
  where r.kind = 'transfer' and (r.account_id is null or r.transfer_account_id is null or r.account_id = r.transfer_account_id);
  if v_bad > 0 then
    raise exception 'Transferência com conta de origem e destino ausentes ou iguais.' using errcode = '23514';
  end if;

  insert into public.transactions (
    space_id, kind, description, amount, occurred_on, category_id, account_id, transfer_account_id,
    status, notes, series_id, series_kind, series_index, series_total, external_ref
  )
  select
    p_space_id,
    r.kind,
    r.description,
    r.amount,
    r.occurred_on,
    case when r.kind = 'transfer' then null else r.category_id end,
    r.account_id,
    case when r.kind = 'transfer' then r.transfer_account_id else null end,
    coalesce(r.status, 'paid'),
    nullif(btrim(coalesce(r.notes, '')), ''),
    r.series_id,
    r.series_kind,
    r.series_index,
    r.series_total,
    v_prefix || r.ref
  from jsonb_to_recordset(p_rows) as r(
    kind text, description text, amount numeric, occurred_on date, category_id uuid, account_id uuid,
    transfer_account_id uuid, status text, notes text, series_id uuid, series_kind text,
    series_index smallint, series_total smallint, ref text
  );
  get diagnostics v_count = row_count;
  return query select v_count, false;
exception
  when unique_violation then
    -- Dois envios simultâneos do mesmo lote: o outro gravou primeiro.
    select count(*) into v_existing
    from public.transactions t
    where t.space_id = p_space_id and t.external_ref like v_prefix || '%';
    if v_existing > 0 then
      return query select v_existing, true;
      return;
    end if;
    raise;
end;
$$;

revoke execute on function public.create_transactions_batch(uuid, uuid, jsonb) from public, anon;
grant execute on function public.create_transactions_batch(uuid, uuid, jsonb) to authenticated;
