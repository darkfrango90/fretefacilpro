-- ============================================================
-- Reforço de papéis: Aferição de tanque é admin-only para SELECT
-- Rode este SQL no SQL Editor do Supabase.
-- ============================================================

-- Restringe SELECT de aferições aos admins da empresa
DROP POLICY IF EXISTS "afericoes_select_empresa" ON public.afericoes_tanque;
DROP POLICY IF EXISTS "afericoes_select_admin" ON public.afericoes_tanque;
CREATE POLICY "afericoes_select_admin" ON public.afericoes_tanque
  FOR SELECT TO authenticated
  USING (public.is_admin_da_empresa(empresa_id));
