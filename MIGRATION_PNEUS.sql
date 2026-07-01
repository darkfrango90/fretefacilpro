-- =====================================================================
-- MIGRATION: PNEUS (controle por posição, durabilidade, integração com despesas)
-- Frete Fácil PRO — multi-tenant, RLS, offline-first
-- =====================================================================

-- ============ 1. ENUMS ============
DO $$ BEGIN
  CREATE TYPE public.pneu_tipo AS ENUM ('novo','recapado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.pneu_status AS ENUM ('instalado','removido');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.pneu_motivo_remocao AS ENUM ('desgaste','furo','estouro','rodizio','outros');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ 2. TABELA ============
CREATE TABLE IF NOT EXISTS public.pneus (
  id uuid PRIMARY KEY,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  veiculo_id uuid NOT NULL REFERENCES public.veiculos(id) ON DELETE CASCADE,
  posicao text NOT NULL,
  tipo public.pneu_tipo NOT NULL DEFAULT 'novo',
  marca text NOT NULL,
  modelo text,
  km_instalacao numeric(12,1) NOT NULL DEFAULT 0,
  data_instalacao date NOT NULL DEFAULT CURRENT_DATE,
  valor numeric(12,2) NOT NULL DEFAULT 0,
  foto_url text,
  km_remocao numeric(12,1),
  data_remocao date,
  motivo_remocao public.pneu_motivo_remocao,
  status public.pneu_status NOT NULL DEFAULT 'instalado',
  despesa_id uuid REFERENCES public.despesas(id) ON DELETE SET NULL,
  lancado_por uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  observacoes text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pneus_empresa     ON public.pneus(empresa_id, data_instalacao DESC);
CREATE INDEX IF NOT EXISTS idx_pneus_veiculo     ON public.pneus(veiculo_id, status);
CREATE INDEX IF NOT EXISTS idx_pneus_marca       ON public.pneus(empresa_id, marca);
CREATE UNIQUE INDEX IF NOT EXISTS uq_pneus_posicao_instalado
  ON public.pneus(veiculo_id, posicao)
  WHERE status = 'instalado';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pneus TO authenticated;
GRANT ALL ON public.pneus TO service_role;

ALTER TABLE public.pneus ENABLE ROW LEVEL SECURITY;

-- ============ 3. RLS ============
DROP POLICY IF EXISTS "pneus: empresa vê tudo" ON public.pneus;
CREATE POLICY "pneus: empresa vê tudo"
  ON public.pneus FOR SELECT TO authenticated
  USING (
    empresa_id = public.current_empresa_id()
    OR public.is_master()
  );

DROP POLICY IF EXISTS "pneus: usuário cria na sua empresa" ON public.pneus;
CREATE POLICY "pneus: usuário cria na sua empresa"
  ON public.pneus FOR INSERT TO authenticated
  WITH CHECK (
    lancado_por = auth.uid()
    AND empresa_id = public.current_empresa_id()
  );

DROP POLICY IF EXISTS "pneus: lançador atualiza / admin atualiza" ON public.pneus;
CREATE POLICY "pneus: lançador atualiza / admin atualiza"
  ON public.pneus FOR UPDATE TO authenticated
  USING (
    public.is_admin_da_empresa(empresa_id)
    OR public.is_master()
    OR lancado_por = auth.uid()
  );

DROP POLICY IF EXISTS "pneus: admin deleta" ON public.pneus;
CREATE POLICY "pneus: admin deleta"
  ON public.pneus FOR DELETE TO authenticated
  USING (public.is_admin_da_empresa(empresa_id) OR public.is_master());

-- ============ 4. AUDITORIA + BLOQUEIO ============
DROP TRIGGER IF EXISTS trg_audit_pneus ON public.pneus;
CREATE TRIGGER trg_audit_pneus
  BEFORE INSERT OR UPDATE OR DELETE ON public.pneus
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria_abast();

DROP TRIGGER IF EXISTS trg_bloqueia_empresa_pneus ON public.pneus;
CREATE TRIGGER trg_bloqueia_empresa_pneus
  BEFORE INSERT OR UPDATE ON public.pneus
  FOR EACH ROW EXECUTE FUNCTION public.fn_bloqueia_empresa_vencida();

-- ============ 5. STORAGE POLICIES (bucket "pneus") ============
-- Convenção de path: {empresa_id}/{user_id}/{uuid}.jpg
DROP POLICY IF EXISTS "storage: usuários da empresa leem pneus" ON storage.objects;
CREATE POLICY "storage: usuários da empresa leem pneus"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'pneus'
    AND (storage.foldername(name))[1]::uuid = public.current_empresa_id()
  );

DROP POLICY IF EXISTS "storage: usuário envia pneu próprio" ON storage.objects;
CREATE POLICY "storage: usuário envia pneu próprio"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'pneus'
    AND (storage.foldername(name))[1]::uuid = public.current_empresa_id()
    AND (storage.foldername(name))[2]::uuid = auth.uid()
  );

-- =====================================================================
-- FIM
-- =====================================================================
