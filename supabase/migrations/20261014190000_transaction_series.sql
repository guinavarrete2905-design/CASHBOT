-- CashBot v2 — séries de movimentações: compras parceladas e lançamentos recorrentes.
-- Cada parcela/ocorrência é uma movimentação normal; as da mesma série compartilham series_id.
-- Altera somente a tabela transactions (criada na v2).

alter table public.transactions
  add column series_id uuid,
  add column series_kind text check (series_kind in ('installment', 'recurring')),
  add column series_index smallint,
  add column series_total smallint;

alter table public.transactions add constraint transactions_series_shape check (
  (series_id is null and series_kind is null and series_index is null and series_total is null)
  or (
    series_id is not null and series_kind is not null and series_index is not null and series_total is not null
    and series_total between 2 and 120
    and series_index between 1 and series_total
  )
);

-- Parcelas são de despesa ou receita (não de transferência).
alter table public.transactions add constraint transactions_installment_kind check (
  series_kind is distinct from 'installment' or kind in ('income', 'expense')
);

-- Uma posição por série.
create unique index transactions_series_position on public.transactions (series_id, series_index)
  where series_id is not null;
