-- ============================================================
-- MIGRATION_FINANCEIRO.sql
-- Forma de pagamento + confirmação financeira por parte do admin.
-- Rode no SQL Editor do Supabase.
-- ============================================================

-- 1) Colunas novas em entregas (forma_pagamento já existe)
ALTER TABLE public.entregas
  ADD COLUMN IF NOT EXISTS status_pagamento text NOT NULL DEFAULT 'a_confirmar',
  ADD COLUMN IF NOT EXISTS pagamento_confirmado_em timestamptz,
  ADD COLUMN IF NOT EXISTS pagamento_confirmado_por uuid,
  ADD COLUMN IF NOT EXISTS vencimento_pagamento date;

-- valores possíveis: 'a_confirmar' | 'pendente' | 'confirmado'
DO $$ BEGIN
  ALTER TABLE public.entregas
    ADD CONSTRAINT entregas_status_pagamento_chk
    CHECK (status_pagamento IN ('a_confirmar','pendente','confirmado'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Backfill financeiro.
-- Em bancos que já receberam as regras operacionais, o trigger também valida
-- fotos/KM de entregas antigas. Ele é pausado somente durante este backfill,
-- que altera exclusivamente o status financeiro.
DO $$
DECLARE
  trigger_estava_ativo boolean;
BEGIN
  SELECT COALESCE(tgenabled <> 'D', false)
    INTO trigger_estava_ativo
    FROM pg_trigger
   WHERE tgrelid = 'public.entregas'::regclass
     AND tgname = 'trg_valida_permissoes_entrega'
     AND NOT tgisinternal;

  IF trigger_estava_ativo THEN
    EXECUTE 'ALTER TABLE public.entregas DISABLE TRIGGER trg_valida_permissoes_entrega';
  END IF;

  BEGIN
    UPDATE public.entregas
    SET status_pagamento = CASE
      WHEN forma_pagamento IN ('boleto','permuta','carteira') THEN 'pendente'
      WHEN forma_pagamento IN ('dinheiro','pix','deposito') THEN 'a_confirmar'
      ELSE COALESCE(status_pagamento,'a_confirmar')
    END
    WHERE status_pagamento IS NULL OR status_pagamento = 'a_confirmar';
  EXCEPTION WHEN OTHERS THEN
    IF trigger_estava_ativo THEN
      EXECUTE 'ALTER TABLE public.entregas ENABLE TRIGGER trg_valida_permissoes_entrega';
    END IF;
    RAISE;
  END;

  IF trigger_estava_ativo THEN
    EXECUTE 'ALTER TABLE public.entregas ENABLE TRIGGER trg_valida_permissoes_entrega';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS entregas_status_pag_idx
  ON public.entregas (empresa_id, status_pagamento);
