-- ============================================================
-- Correção: venda pendente não exige veículo
-- ============================================================

ALTER TABLE public.entregas
  ALTER COLUMN veiculo_id DROP NOT NULL;

UPDATE public.entregas
   SET motorista_venda_id = motorista_id
 WHERE motorista_venda_id IS NULL;

DROP POLICY IF EXISTS "entregas: motorista cria" ON public.entregas;
DROP POLICY IF EXISTS "entregas_insert_motorista" ON public.entregas;
CREATE POLICY "entregas_insert_motorista" ON public.entregas
  FOR INSERT TO authenticated
  WITH CHECK (
    empresa_id = public.current_empresa_id()
    AND public.is_perfil_ativo(auth.uid())
    AND motorista_id = auth.uid()
    AND COALESCE(motorista_venda_id, motorista_id) = auth.uid()
    AND COALESCE(status, 'pendente'::public.entrega_status) = 'pendente'::public.entrega_status
    AND veiculo_id IS NULL
    AND motorista_entrega_id IS NULL
  );

DROP POLICY IF EXISTS "entregas_insert_admin_master" ON public.entregas;
CREATE POLICY "entregas_insert_admin_master" ON public.entregas
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_master()
    OR public.is_admin_da_empresa(empresa_id)
  );

DROP POLICY IF EXISTS "entregas: motorista atualiza as próprias / admin atualiza" ON public.entregas;
DROP POLICY IF EXISTS "entregas_update_finalizar" ON public.entregas;
CREATE POLICY "entregas_update_finalizar" ON public.entregas
  FOR UPDATE TO authenticated
  USING (
    empresa_id = public.current_empresa_id()
    AND (
      public.is_master()
      OR public.is_admin_da_empresa(empresa_id)
      OR motorista_entrega_id = auth.uid()
      OR motorista_id = auth.uid()
      OR motorista_venda_id = auth.uid()
    )
  )
  WITH CHECK (
    empresa_id = public.current_empresa_id()
    AND (
      public.is_master()
      OR public.is_admin_da_empresa(empresa_id)
      OR motorista_entrega_id = auth.uid()
      OR motorista_id = auth.uid()
      OR motorista_venda_id = auth.uid()
    )
  );

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

  IF _veiculo_id IS NULL THEN
    RAISE EXCEPTION 'VEICULO_OBRIGATORIO' USING ERRCODE = 'P0001';
  END IF;

  SELECT empresa_id INTO _emp FROM public.profiles WHERE id = _uid;
  IF _emp IS NULL THEN
    RAISE EXCEPTION 'PERFIL_NAO_ENCONTRADO';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.veiculos
     WHERE id = _veiculo_id
       AND empresa_id = _emp
       AND ativo = true
  ) THEN
    RAISE EXCEPTION 'VEICULO_INVALIDO' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.entregas
     SET status = 'em_rota',
         motorista_entrega_id = _uid,
         veiculo_id = _veiculo_id,
         km_inicial = _km_inicial,
         iniciada_em = now()
   WHERE id = _entrega_id
     AND empresa_id = _emp
     AND status = 'pendente'
     AND motorista_entrega_id IS NULL
  RETURNING * INTO _row;

  IF _row.id IS NULL THEN
    RAISE EXCEPTION 'ENTREGA_JA_INICIADA' USING ERRCODE = 'P0001';
  END IF;

  RETURN _row;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_iniciar_entrega(uuid, uuid, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_iniciar_entrega(uuid, uuid, numeric) TO authenticated;