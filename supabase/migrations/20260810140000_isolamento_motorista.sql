-- Isolamento operacional por motorista.
-- Admin/master continuam enxergando toda a empresa; motorista enxerga apenas
-- vendas que cadastrou ou entregas que estejam atribuídas a ele.

DROP POLICY IF EXISTS "entregas_select_empresa" ON public.entregas;
DROP POLICY IF EXISTS "entregas: motorista vê as próprias / admin vê tudo" ON public.entregas;
DROP POLICY IF EXISTS "entregas_select_por_responsavel" ON public.entregas;

CREATE POLICY "entregas_select_por_responsavel"
  ON public.entregas
  FOR SELECT TO authenticated
  USING (
    public.is_master()
    OR public.is_admin_da_empresa(empresa_id)
    OR (
      empresa_id = public.current_empresa_id()
      AND (
        COALESCE(motorista_venda_id, motorista_id) = auth.uid()
        OR motorista_entrega_id = auth.uid()
      )
    )
  );

CREATE INDEX IF NOT EXISTS entregas_motorista_venda_status_idx
  ON public.entregas (motorista_venda_id, status, criada_em DESC);
