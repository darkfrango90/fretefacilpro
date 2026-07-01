-- ============================================================
-- MIGRATION_FINANCEIRO.sql
-- Forma de pagamento + confirmação financeira por parte do admin.
-- Rode no SQL Editor do Supabase.
-- ============================================================

-- 1) Colunas novas em entregas (forma_pagamento já existe)
ALTER TABLE public.entregas
  ADD COLUMN IF NOT EXISTS status_pagamento text NOT NULL DEFAULT 'a_confirmar',
  ADD COLUMN IF NOT EXISTS pagamento_confirmado_em timestamptz,
  ADD COLUMN IF NOT EXISTS pagamento_confirmado_por uuid;

-- valores possíveis: 'a_confirmar' | 'pendente' | 'confirmado'
DO $$ BEGIN
  ALTER TABLE public.entregas
    ADD CONSTRAINT entregas_status_pagamento_chk
    CHECK (status_pagamento IN ('a_confirmar','pendente','confirmado'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Backfill: registros antigos sem forma de pagamento -> 'a_confirmar'
UPDATE public.entregas
SET status_pagamento = CASE
  WHEN forma_pagamento IN ('boleto','permuta','carteira') THEN 'pendente'
  WHEN forma_pagamento IN ('dinheiro','pix','deposito') THEN 'a_confirmar'
  ELSE COALESCE(status_pagamento,'a_confirmar')
END
WHERE status_pagamento IS NULL OR status_pagamento = 'a_confirmar';

CREATE INDEX IF NOT EXISTS entregas_status_pag_idx
  ON public.entregas (empresa_id, status_pagamento);
