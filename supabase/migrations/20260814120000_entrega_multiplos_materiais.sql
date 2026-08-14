-- Uma entrega continua representando uma única venda e um único frete, mas
-- pode carregar de um a três itens de material. As colunas legadas permanecem
-- preenchidas para manter compatibilidade com versões anteriores do aplicativo.

ALTER TABLE public.entregas
  ADD COLUMN IF NOT EXISTS itens jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.entregas
  DROP CONSTRAINT IF EXISTS entregas_itens_validos;

ALTER TABLE public.entregas
  ADD CONSTRAINT entregas_itens_validos CHECK (
    jsonb_typeof(itens) = 'array'
    AND jsonb_array_length(itens) <= 3
  );

COMMENT ON COLUMN public.entregas.itens IS
  'Itens da venda (1 a 3 materiais). Vazio identifica registros legados que usam material_id, quantidade e valor_praticado.';
