-- ============================================================
-- Aferição semanal de tanque (consumo preciso)
-- Rode este SQL no SQL Editor do Supabase.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.afericoes_tanque (
  id uuid PRIMARY KEY,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  veiculo_id uuid NOT NULL REFERENCES public.veiculos(id) ON DELETE CASCADE,
  data_hora timestamptz NOT NULL DEFAULT now(),
  litros_aferidos numeric(10,3) NOT NULL CHECK (litros_aferidos >= 0),
  km_odometro numeric(12,2),
  observacao text,
  criado_por uuid,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_afericoes_veiculo_data
  ON public.afericoes_tanque (veiculo_id, data_hora);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.afericoes_tanque TO authenticated;
GRANT ALL ON public.afericoes_tanque TO service_role;

ALTER TABLE public.afericoes_tanque ENABLE ROW LEVEL SECURITY;

-- Admins da empresa veem/gerenciam
DROP POLICY IF EXISTS "afericoes_select_empresa" ON public.afericoes_tanque;
CREATE POLICY "afericoes_select_empresa" ON public.afericoes_tanque
  FOR SELECT TO authenticated
  USING (empresa_id = public.current_empresa_id());

DROP POLICY IF EXISTS "afericoes_insert_admin" ON public.afericoes_tanque;
CREATE POLICY "afericoes_insert_admin" ON public.afericoes_tanque
  FOR INSERT TO authenticated
  WITH CHECK (
    empresa_id = public.current_empresa_id()
    AND public.is_admin_da_empresa(empresa_id)
  );

DROP POLICY IF EXISTS "afericoes_update_admin" ON public.afericoes_tanque;
CREATE POLICY "afericoes_update_admin" ON public.afericoes_tanque
  FOR UPDATE TO authenticated
  USING (public.is_admin_da_empresa(empresa_id))
  WITH CHECK (public.is_admin_da_empresa(empresa_id));

DROP POLICY IF EXISTS "afericoes_delete_admin" ON public.afericoes_tanque;
CREATE POLICY "afericoes_delete_admin" ON public.afericoes_tanque
  FOR DELETE TO authenticated
  USING (public.is_admin_da_empresa(empresa_id));
