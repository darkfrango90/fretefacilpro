-- =====================================================================
-- FRETE CERTO — Migration inicial
-- Cole este arquivo inteiro no SQL Editor do Supabase e execute.
-- Cria: empresas, roles, profiles, cadastros, entregas, abastecimentos,
-- auditoria, RLS multi-tenant, triggers de signup e auditoria.
-- =====================================================================

-- ============ 1. TIPOS ============
CREATE TYPE public.app_role AS ENUM ('admin', 'motorista');
CREATE TYPE public.entrega_status AS ENUM ('pendente', 'em_rota', 'entregue', 'cancelada');
CREATE TYPE public.unidade_medida AS ENUM ('m3', 'tonelada', 'viagem', 'metro', 'unidade');

-- ============ 2. EMPRESAS ============
CREATE TABLE public.empresas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  criada_em timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.empresas TO authenticated;
GRANT ALL ON public.empresas TO service_role;
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;

-- ============ 3. PROFILES ============
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  telefone text,
  criado_em timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============ 4. USER ROLES ============
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, empresa_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ============ 5. FUNÇÕES DE SEGURANÇA (SECURITY DEFINER) ============
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.current_empresa_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT empresa_id FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.is_admin_da_empresa(_empresa_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND empresa_id = _empresa_id AND role = 'admin'
  )
$$;

-- ============ 6. POLICIES: empresas / profiles / user_roles ============
CREATE POLICY "empresas: usuários veem sua empresa"
  ON public.empresas FOR SELECT TO authenticated
  USING (id = public.current_empresa_id());

CREATE POLICY "profiles: ver próprio profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR empresa_id = public.current_empresa_id());

CREATE POLICY "profiles: editar próprio"
  ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid());

CREATE POLICY "profiles: admin gerencia da empresa"
  ON public.profiles FOR ALL TO authenticated
  USING (public.is_admin_da_empresa(empresa_id))
  WITH CHECK (public.is_admin_da_empresa(empresa_id));

CREATE POLICY "user_roles: ver da própria empresa"
  ON public.user_roles FOR SELECT TO authenticated
  USING (empresa_id = public.current_empresa_id());

CREATE POLICY "user_roles: admin gerencia"
  ON public.user_roles FOR ALL TO authenticated
  USING (public.is_admin_da_empresa(empresa_id))
  WITH CHECK (public.is_admin_da_empresa(empresa_id));

-- ============ 7. TRIGGER DE NOVO USUÁRIO ============
-- Primeiro signup cria nova empresa + profile + role admin.
-- Signups posteriores (via convite) precisam que o admin pré-crie a linha em profiles.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id uuid;
  v_empresa_nome text;
  v_nome text;
  v_existing_profile uuid;
BEGIN
  -- Se já existe profile pré-criado (convite do admin), só vincula role
  SELECT id INTO v_existing_profile FROM public.profiles WHERE id = NEW.id;
  IF v_existing_profile IS NOT NULL THEN
    RETURN NEW;
  END IF;

  v_nome := COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1));
  v_empresa_nome := COALESCE(NEW.raw_user_meta_data->>'empresa_nome', 'Minha Empresa');

  INSERT INTO public.empresas (nome) VALUES (v_empresa_nome)
  RETURNING id INTO v_empresa_id;

  INSERT INTO public.profiles (id, empresa_id, nome)
  VALUES (NEW.id, v_empresa_id, v_nome);

  INSERT INTO public.user_roles (user_id, empresa_id, role)
  VALUES (NEW.id, v_empresa_id, 'admin');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ 8. CADASTROS: clientes / materiais / veiculos ============
CREATE TABLE public.clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  telefone text,
  endereco text,
  lat numeric(10, 7),
  lng numeric(10, 7),
  criado_em timestamptz NOT NULL DEFAULT now(),
  criado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE INDEX idx_clientes_empresa ON public.clientes(empresa_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clientes TO authenticated;
GRANT ALL ON public.clientes TO service_role;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clientes: ver da empresa"
  ON public.clientes FOR SELECT TO authenticated
  USING (empresa_id = public.current_empresa_id());
CREATE POLICY "clientes: criar na empresa"
  ON public.clientes FOR INSERT TO authenticated
  WITH CHECK (empresa_id = public.current_empresa_id());
CREATE POLICY "clientes: admin edita/deleta"
  ON public.clientes FOR UPDATE TO authenticated
  USING (public.is_admin_da_empresa(empresa_id));
CREATE POLICY "clientes: admin deleta"
  ON public.clientes FOR DELETE TO authenticated
  USING (public.is_admin_da_empresa(empresa_id));

CREATE TABLE public.materiais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  unidade unidade_medida NOT NULL DEFAULT 'm3',
  preco_base numeric(12, 2) NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_materiais_empresa ON public.materiais(empresa_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.materiais TO authenticated;
GRANT ALL ON public.materiais TO service_role;
ALTER TABLE public.materiais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "materiais: ver da empresa"
  ON public.materiais FOR SELECT TO authenticated
  USING (empresa_id = public.current_empresa_id());
CREATE POLICY "materiais: admin gerencia"
  ON public.materiais FOR ALL TO authenticated
  USING (public.is_admin_da_empresa(empresa_id))
  WITH CHECK (public.is_admin_da_empresa(empresa_id));

CREATE TABLE public.veiculos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  placa text NOT NULL,
  descricao text,
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, placa)
);
CREATE INDEX idx_veiculos_empresa ON public.veiculos(empresa_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.veiculos TO authenticated;
GRANT ALL ON public.veiculos TO service_role;
ALTER TABLE public.veiculos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "veiculos: ver da empresa"
  ON public.veiculos FOR SELECT TO authenticated
  USING (empresa_id = public.current_empresa_id());
CREATE POLICY "veiculos: admin gerencia"
  ON public.veiculos FOR ALL TO authenticated
  USING (public.is_admin_da_empresa(empresa_id))
  WITH CHECK (public.is_admin_da_empresa(empresa_id));

-- ============ 9. JORNADAS (KM inicial do dia) ============
CREATE TABLE public.jornadas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  motorista_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  veiculo_id uuid NOT NULL REFERENCES public.veiculos(id) ON DELETE RESTRICT,
  data date NOT NULL DEFAULT CURRENT_DATE,
  km_inicial integer NOT NULL,
  foto_odometro_inicial_url text,
  km_final integer,
  foto_odometro_final_url text,
  encerrada_em timestamptz,
  criada_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (motorista_id, veiculo_id, data)
);
CREATE INDEX idx_jornadas_empresa ON public.jornadas(empresa_id);
CREATE INDEX idx_jornadas_motorista ON public.jornadas(motorista_id, data DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jornadas TO authenticated;
GRANT ALL ON public.jornadas TO service_role;
ALTER TABLE public.jornadas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jornadas: motorista vê as próprias"
  ON public.jornadas FOR SELECT TO authenticated
  USING (motorista_id = auth.uid() OR public.is_admin_da_empresa(empresa_id));
CREATE POLICY "jornadas: motorista cria as próprias"
  ON public.jornadas FOR INSERT TO authenticated
  WITH CHECK (motorista_id = auth.uid() AND empresa_id = public.current_empresa_id());
CREATE POLICY "jornadas: motorista atualiza as próprias (encerrar)"
  ON public.jornadas FOR UPDATE TO authenticated
  USING (motorista_id = auth.uid() OR public.is_admin_da_empresa(empresa_id));

-- ============ 10. ENTREGAS ============
CREATE TABLE public.entregas (
  id uuid PRIMARY KEY,  -- client-generated (UUID local)
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  jornada_id uuid REFERENCES public.jornadas(id) ON DELETE SET NULL,
  motorista_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  veiculo_id uuid NOT NULL REFERENCES public.veiculos(id) ON DELETE RESTRICT,
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE RESTRICT,
  material_id uuid NOT NULL REFERENCES public.materiais(id) ON DELETE RESTRICT,

  preco_base_no_momento numeric(12, 2) NOT NULL,
  valor_praticado numeric(12, 2) NOT NULL,
  quantidade numeric(12, 3) NOT NULL DEFAULT 1,
  valor_frete numeric(12, 2) NOT NULL DEFAULT 0,

  endereco text,
  lat numeric(10, 7),
  lng numeric(10, 7),

  km_final integer,
  foto_odometro_final_url text,

  gps_inicio_lat numeric(10, 7),
  gps_inicio_lng numeric(10, 7),
  gps_inicio_em timestamptz,
  gps_fim_lat numeric(10, 7),
  gps_fim_lng numeric(10, 7),
  gps_fim_em timestamptz,

  status entrega_status NOT NULL DEFAULT 'pendente',

  -- estrutura preparada (não implementado ainda):
  comprovante_foto_url text,
  comprovante_assinatura_url text,
  forma_pagamento text,
  comissao_motorista numeric(12, 2),

  observacoes text,
  criada_em timestamptz NOT NULL DEFAULT now(),
  atualizada_em timestamptz NOT NULL DEFAULT now(),
  sincronizada_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_entregas_empresa ON public.entregas(empresa_id);
CREATE INDEX idx_entregas_motorista ON public.entregas(motorista_id, criada_em DESC);
CREATE INDEX idx_entregas_jornada ON public.entregas(jornada_id);
CREATE INDEX idx_entregas_status ON public.entregas(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.entregas TO authenticated;
GRANT ALL ON public.entregas TO service_role;
ALTER TABLE public.entregas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "entregas: motorista vê as próprias / admin vê tudo"
  ON public.entregas FOR SELECT TO authenticated
  USING (motorista_id = auth.uid() OR public.is_admin_da_empresa(empresa_id));
CREATE POLICY "entregas: motorista cria"
  ON public.entregas FOR INSERT TO authenticated
  WITH CHECK (motorista_id = auth.uid() AND empresa_id = public.current_empresa_id());
CREATE POLICY "entregas: motorista atualiza as próprias / admin atualiza"
  ON public.entregas FOR UPDATE TO authenticated
  USING (motorista_id = auth.uid() OR public.is_admin_da_empresa(empresa_id));
CREATE POLICY "entregas: admin deleta"
  ON public.entregas FOR DELETE TO authenticated
  USING (public.is_admin_da_empresa(empresa_id));

-- ============ 11. ABASTECIMENTOS ============
CREATE TABLE public.abastecimentos (
  id uuid PRIMARY KEY,  -- client-generated
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  motorista_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  veiculo_id uuid NOT NULL REFERENCES public.veiculos(id) ON DELETE RESTRICT,
  foto_url text,
  litros numeric(10, 3),
  valor_total numeric(12, 2),
  km_atual integer NOT NULL,
  data_hora timestamptz NOT NULL DEFAULT now(),

  -- estrutura preparada (Gemini OCR):
  ia_processada boolean NOT NULL DEFAULT false,
  ia_litros_extraido numeric(10, 3),
  ia_valor_extraido numeric(12, 2),
  ia_resposta jsonb,

  observacoes text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  sincronizado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_abast_empresa ON public.abastecimentos(empresa_id);
CREATE INDEX idx_abast_veiculo ON public.abastecimentos(veiculo_id, data_hora DESC);
CREATE INDEX idx_abast_motorista ON public.abastecimentos(motorista_id, data_hora DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.abastecimentos TO authenticated;
GRANT ALL ON public.abastecimentos TO service_role;
ALTER TABLE public.abastecimentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "abast: motorista vê os próprios / admin vê tudo"
  ON public.abastecimentos FOR SELECT TO authenticated
  USING (motorista_id = auth.uid() OR public.is_admin_da_empresa(empresa_id));
CREATE POLICY "abast: motorista cria"
  ON public.abastecimentos FOR INSERT TO authenticated
  WITH CHECK (motorista_id = auth.uid() AND empresa_id = public.current_empresa_id());
CREATE POLICY "abast: motorista atualiza os próprios / admin atualiza"
  ON public.abastecimentos FOR UPDATE TO authenticated
  USING (motorista_id = auth.uid() OR public.is_admin_da_empresa(empresa_id));
CREATE POLICY "abast: admin deleta"
  ON public.abastecimentos FOR DELETE TO authenticated
  USING (public.is_admin_da_empresa(empresa_id));

-- ============ 12. AUDITORIA (append-only) ============
CREATE TABLE public.auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL,
  tabela text NOT NULL,
  registro_id uuid NOT NULL,
  acao text NOT NULL, -- 'INSERT' | 'UPDATE' | 'DELETE'
  alterado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  alterado_em timestamptz NOT NULL DEFAULT now(),
  dados_antes jsonb,
  dados_depois jsonb
);
CREATE INDEX idx_audit_empresa ON public.auditoria(empresa_id, alterado_em DESC);
CREATE INDEX idx_audit_registro ON public.auditoria(tabela, registro_id);
GRANT SELECT, INSERT ON public.auditoria TO authenticated;
GRANT ALL ON public.auditoria TO service_role;
ALTER TABLE public.auditoria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auditoria: admin vê da empresa"
  ON public.auditoria FOR SELECT TO authenticated
  USING (public.is_admin_da_empresa(empresa_id));
-- INSERT é feito pelos triggers (SECURITY DEFINER bypassa)

CREATE OR REPLACE FUNCTION public.fn_auditoria_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.auditoria(empresa_id, tabela, registro_id, acao, alterado_por, dados_depois)
    VALUES (NEW.empresa_id, TG_TABLE_NAME, NEW.id, 'INSERT', auth.uid(), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.auditoria(empresa_id, tabela, registro_id, acao, alterado_por, dados_antes, dados_depois)
    VALUES (NEW.empresa_id, TG_TABLE_NAME, NEW.id, 'UPDATE', auth.uid(), to_jsonb(OLD), to_jsonb(NEW));
    NEW.atualizada_em := now();
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.auditoria(empresa_id, tabela, registro_id, acao, alterado_por, dados_antes)
    VALUES (OLD.empresa_id, TG_TABLE_NAME, OLD.id, 'DELETE', auth.uid(), to_jsonb(OLD));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- versão para abastecimentos (campo atualizado_em em vez de atualizada_em)
CREATE OR REPLACE FUNCTION public.fn_auditoria_abast()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.auditoria(empresa_id, tabela, registro_id, acao, alterado_por, dados_depois)
    VALUES (NEW.empresa_id, TG_TABLE_NAME, NEW.id, 'INSERT', auth.uid(), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.auditoria(empresa_id, tabela, registro_id, acao, alterado_por, dados_antes, dados_depois)
    VALUES (NEW.empresa_id, TG_TABLE_NAME, NEW.id, 'UPDATE', auth.uid(), to_jsonb(OLD), to_jsonb(NEW));
    NEW.atualizado_em := now();
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.auditoria(empresa_id, tabela, registro_id, acao, alterado_por, dados_antes)
    VALUES (OLD.empresa_id, TG_TABLE_NAME, OLD.id, 'DELETE', auth.uid(), to_jsonb(OLD));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_audit_entregas
  BEFORE INSERT OR UPDATE OR DELETE ON public.entregas
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria_trigger();

CREATE TRIGGER trg_audit_abastecimentos
  BEFORE INSERT OR UPDATE OR DELETE ON public.abastecimentos
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria_abast();

-- ============ 13. STORAGE (buckets criados via UI / API; políticas aqui) ============
-- Crie no Dashboard ou via tool dois buckets PRIVADOS:
--   1) odometros
--   2) abastecimentos
-- Convenção de path: {empresa_id}/{user_id}/{uuid}.jpg

CREATE POLICY "storage: usuários da empresa leem odômetros"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'odometros'
    AND (storage.foldername(name))[1]::uuid = public.current_empresa_id()
  );

CREATE POLICY "storage: motorista envia odômetro próprio"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'odometros'
    AND (storage.foldername(name))[1]::uuid = public.current_empresa_id()
    AND (storage.foldername(name))[2]::uuid = auth.uid()
  );

CREATE POLICY "storage: usuários da empresa leem abastecimentos"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'abastecimentos'
    AND (storage.foldername(name))[1]::uuid = public.current_empresa_id()
  );

CREATE POLICY "storage: motorista envia abastecimento próprio"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'abastecimentos'
    AND (storage.foldername(name))[1]::uuid = public.current_empresa_id()
    AND (storage.foldername(name))[2]::uuid = auth.uid()
  );

-- =====================================================================
-- FIM. Verifique com:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
-- =====================================================================

-- =====================================================================
-- SECURITY HARDENING — SECURITY DEFINER function EXECUTE privileges
-- Restringe quem pode chamar diretamente as funções SECURITY DEFINER
-- via API pública (PostgREST). Triggers continuam funcionando porque
-- são executados pelo Postgres como owner, sem checagem de EXECUTE.
-- =====================================================================

-- Funções de TRIGGER: ninguém deve poder chamá-las via RPC
REVOKE ALL ON FUNCTION public.handle_new_user()      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_auditoria_trigger() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_auditoria_abast()   FROM PUBLIC, anon, authenticated;

-- Helpers usados em policies RLS: removem acesso anônimo,
-- mantêm execução para usuários autenticados (necessário para RLS).
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.current_empresa_id()            FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_admin_da_empresa(uuid)       FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_empresa_id()            TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_da_empresa(uuid)       TO authenticated;
