-- ============================================================
-- MASTER (dono da plataforma) + Assinatura por empresa
-- Aplicado via Management API. Mantido aqui para referência.
-- ============================================================

-- 1) Enum: adiciona 'master'
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid
    WHERE t.typname='app_role' AND e.enumlabel='master'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'master';
  END IF;
END $$;

-- 2) Colunas de assinatura em empresas
ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS data_inicio date NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS data_vencimento date NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '30 days'),
  ADD COLUMN IF NOT EXISTS limite_usuarios integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS ativa boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS plano text;

-- 3) Funções SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.is_master()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'master')
$$;

CREATE OR REPLACE FUNCTION public.empresa_ativa(_empresa_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT COALESCE(
    (SELECT ativa AND data_vencimento >= CURRENT_DATE FROM public.empresas WHERE id = _empresa_id),
    false
  )
$$;

CREATE OR REPLACE FUNCTION public.contar_usuarios_empresa(_empresa_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT COUNT(*)::int FROM public.profiles
  WHERE empresa_id = _empresa_id AND COALESCE(ativo,true) = true
$$;

-- 4) Policies master (acesso global)
DROP POLICY IF EXISTS "empresas_master_all" ON public.empresas;
CREATE POLICY "empresas_master_all" ON public.empresas
  FOR ALL TO authenticated USING (public.is_master()) WITH CHECK (public.is_master());

DROP POLICY IF EXISTS "user_roles_master_all" ON public.user_roles;
CREATE POLICY "user_roles_master_all" ON public.user_roles
  FOR ALL TO authenticated USING (public.is_master()) WITH CHECK (public.is_master());

DROP POLICY IF EXISTS "profiles_master_all" ON public.profiles;
CREATE POLICY "profiles_master_all" ON public.profiles
  FOR ALL TO authenticated USING (public.is_master()) WITH CHECK (public.is_master());

-- 5) Trigger: bloqueia escrita em empresa vencida/inativa (master ignora)
CREATE OR REPLACE FUNCTION public.fn_bloqueia_empresa_vencida()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _emp uuid;
BEGIN
  IF public.is_master() THEN RETURN NEW; END IF;
  _emp := NEW.empresa_id;
  IF _emp IS NULL THEN RETURN NEW; END IF;
  IF NOT public.empresa_ativa(_emp) THEN
    RAISE EXCEPTION 'EMPRESA_BLOQUEADA: assinatura vencida ou inativa' USING ERRCODE='P0001';
  END IF;
  RETURN NEW;
END $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['entregas','abastecimentos','jornadas','afericoes_tanque','clientes','materiais','veiculos']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_bloqueia_vencida ON public.%I', t);
    EXECUTE format('CREATE TRIGGER trg_bloqueia_vencida BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.fn_bloqueia_empresa_vencida()', t);
  END LOOP;
END $$;

-- 6) Semeadura do master (substitua MASTER_EMAIL)
DO $$
DECLARE
  MASTER_EMAIL text := 'rr84445581@gmail.com';
  v_user uuid; v_emp uuid;
BEGIN
  SELECT id INTO v_user FROM auth.users WHERE email = MASTER_EMAIL;
  IF v_user IS NULL THEN RAISE NOTICE 'Crie a conta % primeiro.', MASTER_EMAIL; RETURN; END IF;
  SELECT empresa_id INTO v_emp FROM public.profiles WHERE id = v_user;
  IF v_emp IS NULL THEN
    INSERT INTO public.empresas(nome, ativa, limite_usuarios, data_vencimento)
    VALUES ('__sistema__', true, 9999, CURRENT_DATE + INTERVAL '100 years')
    RETURNING id INTO v_emp;
    INSERT INTO public.profiles(id, empresa_id, nome, ativo) VALUES (v_user, v_emp, 'Master', true);
  END IF;
  DELETE FROM public.user_roles WHERE user_id = v_user;
  INSERT INTO public.user_roles(user_id, empresa_id, role) VALUES (v_user, v_emp, 'master');
END $$;
