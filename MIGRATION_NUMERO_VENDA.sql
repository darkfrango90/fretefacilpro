-- ============================================================
-- MIGRATION_NUMERO_VENDA.sql
-- Numeração sequencial de vendas por empresa.
-- Rode no SQL Editor do Supabase.
-- ============================================================

-- 1) Coluna numero
ALTER TABLE public.entregas
  ADD COLUMN IF NOT EXISTS numero integer;

-- 2) Tabela de contador por empresa
CREATE TABLE IF NOT EXISTS public.empresa_venda_seq (
  empresa_id uuid PRIMARY KEY REFERENCES public.empresas(id) ON DELETE CASCADE,
  last_numero integer NOT NULL DEFAULT 0
);

ALTER TABLE public.empresa_venda_seq ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.empresa_venda_seq TO authenticated;
GRANT ALL ON public.empresa_venda_seq TO service_role;

DO $$ BEGIN
  CREATE POLICY empresa_venda_seq_select ON public.empresa_venda_seq
    FOR SELECT TO authenticated
    USING (empresa_id = public.current_empresa_id() OR public.is_master());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3) Backfill: numera vendas existentes na ordem de criação
DO $$
DECLARE r record; n integer; cur_emp uuid := NULL;
BEGIN
  n := 0;
  FOR r IN
    SELECT id, empresa_id
      FROM public.entregas
     WHERE numero IS NULL
     ORDER BY empresa_id, criada_em, id
  LOOP
    IF cur_emp IS DISTINCT FROM r.empresa_id THEN
      cur_emp := r.empresa_id;
      SELECT COALESCE(MAX(numero),0) INTO n
        FROM public.entregas WHERE empresa_id = cur_emp;
    END IF;
    n := n + 1;
    UPDATE public.entregas SET numero = n WHERE id = r.id;
  END LOOP;

  -- Atualiza contadores
  INSERT INTO public.empresa_venda_seq (empresa_id, last_numero)
  SELECT empresa_id, MAX(numero) FROM public.entregas
   WHERE numero IS NOT NULL GROUP BY empresa_id
  ON CONFLICT (empresa_id) DO UPDATE
     SET last_numero = GREATEST(public.empresa_venda_seq.last_numero, EXCLUDED.last_numero);
END $$;

-- 4) Trigger BEFORE INSERT para gerar numero
CREATE OR REPLACE FUNCTION public.fn_atribui_numero_entrega()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _n integer;
BEGIN
  IF NEW.numero IS NOT NULL THEN
    -- mantém valor explícito (sincronização idempotente)
    INSERT INTO public.empresa_venda_seq (empresa_id, last_numero)
    VALUES (NEW.empresa_id, NEW.numero)
    ON CONFLICT (empresa_id) DO UPDATE
       SET last_numero = GREATEST(public.empresa_venda_seq.last_numero, EXCLUDED.last_numero);
    RETURN NEW;
  END IF;

  INSERT INTO public.empresa_venda_seq (empresa_id, last_numero)
  VALUES (NEW.empresa_id, 1)
  ON CONFLICT (empresa_id) DO UPDATE
     SET last_numero = public.empresa_venda_seq.last_numero + 1
  RETURNING last_numero INTO _n;

  NEW.numero := _n;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_atribui_numero_entrega ON public.entregas;
CREATE TRIGGER trg_atribui_numero_entrega
  BEFORE INSERT ON public.entregas
  FOR EACH ROW EXECUTE FUNCTION public.fn_atribui_numero_entrega();

-- 5) Índice
CREATE UNIQUE INDEX IF NOT EXISTS entregas_empresa_numero_uniq
  ON public.entregas (empresa_id, numero);
