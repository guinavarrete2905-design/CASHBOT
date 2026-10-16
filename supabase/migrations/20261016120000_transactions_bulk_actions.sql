-- CashBot v2 — ações em massa na lista de movimentações (excluir, alterar conta, alterar categoria).
-- Funções transacionais: ou todas as movimentações selecionadas são alteradas, ou nenhuma.
-- SECURITY INVOKER: valem o RLS (quem pode editar/excluir) e o gatilho transactions_guard
-- (categoria e conta do mesmo espaço, categoria do mesmo tipo). Somente cria objetos novos.

create or replace function public.delete_transactions_batch(p_space_id uuid, p_ids uuid[])
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_requested integer;
  v_count integer;
begin
  if auth.uid() is null then
    raise exception 'Faça login para continuar.' using errcode = '42501';
  end if;
  if not public.is_space_member(p_space_id) then
    raise exception 'Você não participa deste espaço financeiro.' using errcode = '42501';
  end if;
  select count(distinct x) into v_requested from unnest(coalesce(p_ids, '{}'::uuid[])) as x;
  if v_requested = 0 then
    raise exception 'Nenhuma movimentação selecionada.' using errcode = '22023';
  end if;
  if v_requested > 2000 then
    raise exception 'Selecione no máximo 2.000 movimentações por vez.' using errcode = '22023';
  end if;

  delete from public.transactions t where t.space_id = p_space_id and t.id = any(p_ids);
  get diagnostics v_count = row_count;

  -- O RLS só deixa excluir o que a pessoa lançou (ou tudo, para proprietário/administrador).
  -- Se alguma ficou de fora, desfaz tudo em vez de excluir só uma parte.
  if v_count <> v_requested then
    raise exception 'Você não pode excluir % das % movimentações selecionadas (lançadas por outra pessoa ou já excluídas). Nada foi excluído.',
      v_requested - v_count, v_requested using errcode = '42501';
  end if;
  return v_count;
end;
$$;

create or replace function public.update_transactions_batch(
  p_space_id uuid,
  p_ids uuid[],
  p_set_account boolean,
  p_account_id uuid,
  p_set_category boolean,
  p_category_id uuid
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_requested integer;
  v_count integer;
  v_card boolean := false;
  v_bad integer;
begin
  if auth.uid() is null then
    raise exception 'Faça login para continuar.' using errcode = '42501';
  end if;
  if not public.is_space_member(p_space_id) then
    raise exception 'Você não participa deste espaço financeiro.' using errcode = '42501';
  end if;
  select count(distinct x) into v_requested from unnest(coalesce(p_ids, '{}'::uuid[])) as x;
  if v_requested = 0 then
    raise exception 'Nenhuma movimentação selecionada.' using errcode = '22023';
  end if;
  if v_requested > 2000 then
    raise exception 'Selecione no máximo 2.000 movimentações por vez.' using errcode = '22023';
  end if;
  if not coalesce(p_set_account, false) and not coalesce(p_set_category, false) then
    raise exception 'Nada para alterar.' using errcode = '22023';
  end if;

  if p_set_category then
    select count(*) into v_bad from public.transactions t
    where t.space_id = p_space_id and t.id = any(p_ids) and t.kind = 'transfer';
    if v_bad > 0 then
      raise exception 'Transferências não têm categoria. Tire as transferências da seleção para alterar a categoria.' using errcode = '23514';
    end if;
  end if;

  if p_set_account then
    if p_account_id is null then
      select count(*) into v_bad from public.transactions t
      where t.space_id = p_space_id and t.id = any(p_ids) and t.kind = 'transfer';
      if v_bad > 0 then
        raise exception 'Transferências precisam de uma conta de origem.' using errcode = '23514';
      end if;
    else
      select a.type = 'credit_card' into v_card from public.accounts a where a.id = p_account_id;
      select count(*) into v_bad from public.transactions t
      where t.space_id = p_space_id and t.id = any(p_ids) and t.kind = 'transfer' and t.transfer_account_id = p_account_id;
      if v_bad > 0 then
        raise exception 'A conta de origem e a de destino precisam ser diferentes.' using errcode = '23514';
      end if;
    end if;
  end if;

  update public.transactions t set
    account_id = case when p_set_account then p_account_id else t.account_id end,
    category_id = case when p_set_category then p_category_id else t.category_id end,
    -- Mesma regra do formulário: compras no cartão ficam com a situação da fatura.
    status = case when p_set_account and coalesce(v_card, false) and t.kind <> 'transfer' then 'paid' else t.status end
  where t.space_id = p_space_id and t.id = any(p_ids);
  get diagnostics v_count = row_count;

  if v_count <> v_requested then
    raise exception 'Algumas movimentações selecionadas não existem mais. Nada foi alterado.' using errcode = '42501';
  end if;
  return v_count;
end;
$$;

revoke execute on function public.delete_transactions_batch(uuid, uuid[]) from public, anon;
revoke execute on function public.update_transactions_batch(uuid, uuid[], boolean, uuid, boolean, uuid) from public, anon;
grant execute on function public.delete_transactions_batch(uuid, uuid[]) to authenticated;
grant execute on function public.update_transactions_batch(uuid, uuid[], boolean, uuid, boolean, uuid) to authenticated;
