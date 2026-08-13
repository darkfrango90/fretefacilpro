-- Histórico próprio de trocas de óleo. A estrutura separada permite adicionar
-- alertas por veículo/quilometragem em uma atualização futura.

CREATE TABLE IF NOT EXISTS public.trocas_oleo (
  id uuid PRIMARY KEY,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  motorista_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  veiculo_id uuid NOT NULL REFERENCES public.veiculos(id) ON DELETE RESTRICT,
  data date NOT NULL DEFAULT CURRENT_DATE,
  valor numeric(12,2) NOT NULL CHECK (valor >= 0),
  km numeric(12,1) NOT NULL CHECK (km > 0),
  observacoes text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizada_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trocas_oleo_empresa_data_idx
  ON public.trocas_oleo (empresa_id, data DESC);
CREATE INDEX IF NOT EXISTS trocas_oleo_veiculo_km_idx
  ON public.trocas_oleo (veiculo_id, km DESC);
CREATE INDEX IF NOT EXISTS trocas_oleo_motorista_data_idx
  ON public.trocas_oleo (motorista_id, data DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trocas_oleo TO authenticated;
GRANT ALL ON public.trocas_oleo TO service_role;
ALTER TABLE public.trocas_oleo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "trocas_oleo_select_responsavel" ON public.trocas_oleo;
CREATE POLICY "trocas_oleo_select_responsavel"
  ON public.trocas_oleo FOR SELECT TO authenticated
  USING (
    public.is_master()
    OR public.is_admin_da_empresa(empresa_id)
    OR (empresa_id = public.current_empresa_id() AND motorista_id = auth.uid())
  );

DROP POLICY IF EXISTS "trocas_oleo_insert_proprio" ON public.trocas_oleo;
CREATE POLICY "trocas_oleo_insert_proprio"
  ON public.trocas_oleo FOR INSERT TO authenticated
  WITH CHECK (
    empresa_id = public.current_empresa_id()
    AND motorista_id = auth.uid()
  );

DROP POLICY IF EXISTS "trocas_oleo_update_admin" ON public.trocas_oleo;
CREATE POLICY "trocas_oleo_update_admin"
  ON public.trocas_oleo FOR UPDATE TO authenticated
  USING (public.is_master() OR public.is_admin_da_empresa(empresa_id))
  WITH CHECK (public.is_master() OR public.is_admin_da_empresa(empresa_id));

DROP POLICY IF EXISTS "trocas_oleo_delete_admin" ON public.trocas_oleo;
CREATE POLICY "trocas_oleo_delete_admin"
  ON public.trocas_oleo FOR DELETE TO authenticated
  USING (public.is_master() OR public.is_admin_da_empresa(empresa_id));

DROP TRIGGER IF EXISTS trg_audit_trocas_oleo ON public.trocas_oleo;
CREATE TRIGGER trg_audit_trocas_oleo
  BEFORE INSERT OR UPDATE OR DELETE ON public.trocas_oleo
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria_trigger();

REVOKE ALL ON FUNCTION public.fn_auditoria_trigger() FROM PUBLIC, anon, authenticated;
