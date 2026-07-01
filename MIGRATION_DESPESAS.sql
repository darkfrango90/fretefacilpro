-- =====================================================================
-- MIGRATION: DESPESAS (módulo de despesas operacionais)
-- Frete Fácil PRO — multi-tenant, RLS, offline-first
-- =====================================================================

-- ============ 1. ENUM categoria ============
DO $$ BEGIN
  CREATE TYPE public.despesa_categoria AS ENUM (
    'manutencao','pneu','peca','pedagio','alimentacao','documentacao','outros'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.despesa_status AS ENUM ('a_conferir','conferida');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ 2. TABELA ============
CREATE TABLE IF NOT EXISTS public.despesas (
  id uuid PRIMARY KEY,  -- gerado no cliente (idempotência offline)
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  categoria public.despesa_categoria NOT NULL DEFAULT 'outros',
  veiculo_id uuid REFERENCES public.veiculos(id) ON DELETE SET NULL,
  descricao text,
  valor numeric(12,2) NOT NULL DEFAULT 0,
  data date NOT NULL DEFAULT CURRENT_DATE,
  km_veiculo numeric(12,1),
  foto_cupom_url text,
  lancado_por uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  status public.despesa_status NOT NULL DEFAULT 'a_conferir',
  conferida_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  conferida_em timestamptz,
  observacoes text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_despesas_empresa     ON public.despesas(empresa_id, data DESC);
CREATE INDEX IF NOT EXISTS idx_despesas_veiculo     ON public.despesas(veiculo_id, data DESC);
CREATE INDEX IF NOT EXISTS idx_despesas_lancado_por ON public.despesas(lancado_por, data DESC);
CREATE INDEX IF NOT EXISTS idx_despesas_status      ON public.despesas(empresa_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.despesas TO authenticated;
GRANT ALL ON public.despesas TO service_role;

ALTER TABLE public.despesas ENABLE ROW LEVEL SECURITY;

-- ============ 3. RLS ============
DROP POLICY IF EXISTS "desp: motorista vê próprias / admin vê tudo" ON public.despesas;
CREATE POLICY "desp: motorista vê próprias / admin vê tudo"
  ON public.despesas FOR SELECT TO authenticated
  USING (
    lancado_por = auth.uid()
    OR public.is_admin_da_empresa(empresa_id)
    OR public.is_master()
  );

DROP POLICY IF EXISTS "desp: usuário cria na sua empresa" ON public.despesas;
CREATE POLICY "desp: usuário cria na sua empresa"
  ON public.despesas FOR INSERT TO authenticated
  WITH CHECK (
    lancado_por = auth.uid()
    AND empresa_id = public.current_empresa_id()
  );

DROP POLICY IF EXISTS "desp: lançador atualiza enquanto a_conferir / admin atualiza tudo" ON public.despesas;
CREATE POLICY "desp: lançador atualiza enquanto a_conferir / admin atualiza tudo"
  ON public.despesas FOR UPDATE TO authenticated
  USING (
    public.is_admin_da_empresa(empresa_id)
    OR public.is_master()
    OR (lancado_por = auth.uid() AND status = 'a_conferir')
  );

DROP POLICY IF EXISTS "desp: admin deleta" ON public.despesas;
CREATE POLICY "desp: admin deleta"
  ON public.despesas FOR DELETE TO authenticated
  USING (public.is_admin_da_empresa(empresa_id) OR public.is_master());

-- ============ 4. AUDITORIA + bloqueio empresa vencida ============
DROP TRIGGER IF EXISTS trg_audit_despesas ON public.despesas;
CREATE TRIGGER trg_audit_despesas
  BEFORE INSERT OR UPDATE OR DELETE ON public.despesas
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria_abast();
  -- usa a versão que atualiza "atualizado_em"

DROP TRIGGER IF EXISTS trg_bloqueia_empresa_despesas ON public.despesas;
CREATE TRIGGER trg_bloqueia_empresa_despesas
  BEFORE INSERT OR UPDATE ON public.despesas
  FOR EACH ROW EXECUTE FUNCTION public.fn_bloqueia_empresa_vencida();

-- ============ 5. STORAGE POLICIES (bucket "despesas" criado via API) ============
-- Convenção de path: {empresa_id}/{user_id}/{uuid}.jpg
DROP POLICY IF EXISTS "storage: usuários da empresa leem despesas" ON storage.objects;
CREATE POLICY "storage: usuários da empresa leem despesas"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'despesas'
    AND (storage.foldername(name))[1]::uuid = public.current_empresa_id()
  );

DROP POLICY IF EXISTS "storage: usuário envia despesa própria" ON storage.objects;
CREATE POLICY "storage: usuário envia despesa própria"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'despesas'
    AND (storage.foldername(name))[1]::uuid = public.current_empresa_id()
    AND (storage.foldername(name))[2]::uuid = auth.uid()
  );

-- =====================================================================
-- FIM
-- =====================================================================
