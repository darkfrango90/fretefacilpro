-- Aceita a casa decimal exibida por odômetros e recupera a responsabilidade
-- das vendas que foram concluídas diretamente pelo administrador.

ALTER TABLE public.abastecimentos
  ALTER COLUMN km_atual TYPE numeric(12,1)
  USING ROUND(km_atual::numeric, 1);

COMMENT ON COLUMN public.abastecimentos.km_atual IS
  'Quilometragem do odômetro com precisão de 0,1 km.';

-- O trigger financeiro também valida fotos/KM de entregas já concluídas.
-- Ele é pausado somente durante este backfill de responsabilidade, sem mudar
-- status nem dados operacionais da entrega.
ALTER TABLE public.entregas DISABLE TRIGGER trg_valida_permissoes_entrega;

UPDATE public.entregas
SET motorista_entrega_id = COALESCE(motorista_venda_id, motorista_id)
WHERE status = 'entregue'
  AND motorista_entrega_id IS NULL
  AND COALESCE(motorista_venda_id, motorista_id) IS NOT NULL;

ALTER TABLE public.entregas ENABLE TRIGGER trg_valida_permissoes_entrega;

CREATE INDEX IF NOT EXISTS entregas_motorista_entrega_finalizada_idx
  ON public.entregas (motorista_entrega_id, status, finalizada_em DESC);
