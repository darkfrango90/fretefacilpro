-- ============================================================
-- Gestão de motoristas: ativo, troca de senha, RLS reforçada
-- Rode no SQL Editor do Supabase.
-- ============================================================

-- 1) Novas colunas no profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS precisa_trocar_senha boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email text;

-- 2) Admin pode listar/atualizar perfis da sua empresa
DROP POLICY IF EXISTS "profiles_admin_select_empresa" ON public.profiles;
CREATE POLICY "profiles_admin_select_empresa" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.is_admin_da_empresa(empresa_id));

DROP POLICY IF EXISTS "profiles_admin_update_empresa" ON public.profiles;
CREATE POLICY "profiles_admin_update_empresa" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.is_admin_da_empresa(empresa_id))
  WITH CHECK (public.is_admin_da_empresa(empresa_id));

-- 3) Função utilitária: verifica se o motorista atual está ativo
CREATE OR REPLACE FUNCTION public.is_perfil_ativo(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT ativo FROM public.profiles WHERE id = _user_id),
    false
  )
$$;

REVOKE ALL ON FUNCTION public.is_perfil_ativo(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_perfil_ativo(uuid) TO authenticated;

-- 4) Reforço de RLS: motorista inativo não pode inserir entregas nem abastecimentos
DROP POLICY IF EXISTS "entregas_insert_motorista" ON public.entregas;
CREATE POLICY "entregas_insert_motorista" ON public.entregas
  FOR INSERT TO authenticated
  WITH CHECK (
    motorista_id = auth.uid()
    AND empresa_id = public.current_empresa_id()
    AND public.is_perfil_ativo(auth.uid())
  );

DROP POLICY IF EXISTS "abastecimentos_insert_motorista" ON public.abastecimentos;
CREATE POLICY "abastecimentos_insert_motorista" ON public.abastecimentos
  FOR INSERT TO authenticated
  WITH CHECK (
    motorista_id = auth.uid()
    AND empresa_id = public.current_empresa_id()
    AND public.is_perfil_ativo(auth.uid())
  );
