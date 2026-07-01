-- Reestruturação: Venda -> Entrega em etapas
-- Adiciona campos à tabela `entregas` para suportar máquina de estados.

ALTER TABLE public.entregas
  ADD COLUMN IF NOT EXISTS motorista_venda_id uuid,
  ADD COLUMN IF NOT EXISTS motorista_entrega_id uuid,
  ADD COLUMN IF NOT EXISTS km_inicial numeric,
  ADD COLUMN IF NOT EXISTS iniciada_em timestamptz,
  ADD COLUMN IF NOT EXISTS finalizada_em timestamptz,
  ADD COLUMN IF NOT EXISTS foto_material_url text,
  ADD COLUMN IF NOT EXISTS foto_material_gps_lat numeric,
  ADD COLUMN IF NOT EXISTS foto_material_gps_lng numeric,
  ADD COLUMN IF NOT EXISTS foto_material_gps_em timestamptz,
  ADD COLUMN IF NOT EXISTS assinatura_url text,
  ADD COLUMN IF NOT EXISTS assinatura_coletada boolean NOT NULL DEFAULT false;

-- Backfill: registros antigos viram "entregue", motorista_entrega = motorista que registrou
UPDATE public.entregas
   SET motorista_entrega_id = motorista_id
 WHERE motorista_entrega_id IS NULL;

UPDATE public.entregas
   SET motorista_venda_id = motorista_id
 WHERE motorista_venda_id IS NULL;

-- enum entrega_status: pendente | em_rota | entregue | cancelada
-- "em_rota" representa "em entrega" no fluxo novo
UPDATE public.entregas
   SET status = 'entregue'
 WHERE status IS NULL;

UPDATE public.entregas
   SET finalizada_em = COALESCE(finalizada_em, criada_em)
 WHERE status = 'entregue' AND finalizada_em IS NULL;

-- Default para novas vendas
ALTER TABLE public.entregas ALTER COLUMN status SET DEFAULT 'pendente';

-- Índices para consultas de pool
CREATE INDEX IF NOT EXISTS entregas_status_empresa_idx
  ON public.entregas (empresa_id, status);
CREATE INDEX IF NOT EXISTS entregas_motorista_entrega_idx
  ON public.entregas (motorista_entrega_id, status);

-- ====== RPC para iniciar entrega com trava de concorrência ======
CREATE OR REPLACE FUNCTION public.fn_iniciar_entrega(
  _entrega_id uuid,
  _veiculo_id uuid,
  _km_inicial numeric
)
RETURNS public.entregas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _emp uuid;
  _row public.entregas;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'NAO_AUTENTICADO';
  END IF;

  SELECT empresa_id INTO _emp FROM public.profiles WHERE id = _uid;
  IF _emp IS NULL THEN
    RAISE EXCEPTION 'PERFIL_NAO_ENCONTRADO';
  END IF;

  UPDATE public.entregas
     SET status = 'em_rota',
         motorista_entrega_id = _uid,
         veiculo_id = COALESCE(_veiculo_id, veiculo_id),
         km_inicial = _km_inicial,
         iniciada_em = now()
   WHERE id = _entrega_id
     AND empresa_id = _emp
     AND status = 'pendente'
  RETURNING * INTO _row;

  IF _row.id IS NULL THEN
    RAISE EXCEPTION 'ENTREGA_JA_INICIADA' USING ERRCODE = 'P0001';
  END IF;

  RETURN _row;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_iniciar_entrega(uuid, uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_iniciar_entrega(uuid, uuid, numeric) TO authenticated;

-- ====== Policies de SELECT/UPDATE para o pool ======
-- Garante que motoristas da empresa enxerguem as pendentes (pool compartilhado).
-- Mantemos as policies existentes; adicionamos uma SELECT abrangente por empresa.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname='public' AND tablename='entregas'
       AND policyname='entregas_select_empresa'
  ) THEN
    CREATE POLICY entregas_select_empresa ON public.entregas
      FOR SELECT TO authenticated
      USING (empresa_id = public.current_empresa_id() OR public.is_master());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname='public' AND tablename='entregas'
       AND policyname='entregas_update_finalizar'
  ) THEN
    CREATE POLICY entregas_update_finalizar ON public.entregas
      FOR UPDATE TO authenticated
      USING (
        empresa_id = public.current_empresa_id()
        AND (
          public.is_admin_da_empresa(empresa_id)
          OR motorista_entrega_id = auth.uid()
          OR motorista_id = auth.uid()
        )
      )
      WITH CHECK (
        empresa_id = public.current_empresa_id()
      );
  END IF;
END $$;
