-- ============================================================
-- OCR de odômetro: foto inicial e rastreabilidade da leitura IA
-- Aplicar após MIGRATION_HARDENING.sql.
-- ============================================================

ALTER TABLE public.entregas
  ADD COLUMN IF NOT EXISTS foto_odometro_inicial_url text,
  ADD COLUMN IF NOT EXISTS km_inicial_ia_confianca text,
  ADD COLUMN IF NOT EXISTS km_final_ia_confianca text;

ALTER TABLE public.entregas
  DROP CONSTRAINT IF EXISTS entregas_km_inicial_ia_confianca_check,
  ADD CONSTRAINT entregas_km_inicial_ia_confianca_check
    CHECK (km_inicial_ia_confianca IS NULL OR km_inicial_ia_confianca IN ('alta','media','baixa')),
  DROP CONSTRAINT IF EXISTS entregas_km_final_ia_confianca_check,
  ADD CONSTRAINT entregas_km_final_ia_confianca_check
    CHECK (km_final_ia_confianca IS NULL OR km_final_ia_confianca IN ('alta','media','baixa'));

CREATE OR REPLACE FUNCTION public.fn_exige_foto_odometro_inicio()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'pendente'
     AND NEW.status = 'em_rota'
     AND NEW.foto_odometro_inicial_url IS NULL THEN
    RAISE EXCEPTION 'PERMISSAO_NEGADA: foto do odômetro inicial obrigatória';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_exige_foto_odometro_inicio ON public.entregas;
CREATE TRIGGER trg_exige_foto_odometro_inicio
  BEFORE UPDATE ON public.entregas
  FOR EACH ROW EXECUTE FUNCTION public.fn_exige_foto_odometro_inicio();
