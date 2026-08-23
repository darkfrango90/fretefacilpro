-- Ativa Row Level Security (RLS) em 3 tabelas críticas
-- Vulnerabilidade: IDOR em pneus, afericoes_tanque, despesas
-- Sem RLS: qualquer usuário podia acessar dados de qualquer empresa

-- ============================================
-- 1. PNEUS - Ativar RLS
-- ============================================

ALTER TABLE public.pneus ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pneus: admin gerencia" ON public.pneus;
CREATE POLICY "pneus: admin gerencia"
  ON public.pneus FOR ALL TO authenticated
  USING (public.is_admin_da_empresa(empresa_id))
  WITH CHECK (public.is_admin_da_empresa(empresa_id));

-- Índice para performance
CREATE INDEX IF NOT EXISTS pneus_empresa_idx ON public.pneus (empresa_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pneus TO authenticated;
GRANT ALL ON public.pneus TO service_role;

-- ============================================
-- 2. AFERICOES_TANQUE - Ativar RLS
-- ============================================

ALTER TABLE public.afericoes_tanque ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "afericoes_tanque: admin gerencia" ON public.afericoes_tanque;
CREATE POLICY "afericoes_tanque: admin gerencia"
  ON public.afericoes_tanque FOR ALL TO authenticated
  USING (public.is_admin_da_empresa(empresa_id))
  WITH CHECK (public.is_admin_da_empresa(empresa_id));

-- Índice para performance
CREATE INDEX IF NOT EXISTS afericoes_tanque_empresa_idx ON public.afericoes_tanque (empresa_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.afericoes_tanque TO authenticated;
GRANT ALL ON public.afericoes_tanque TO service_role;

-- ============================================
-- 3. DESPESAS - Ativar RLS (se não estiver ativo)
-- ============================================

ALTER TABLE public.despesas ENABLE ROW LEVEL SECURITY;

-- Verificar se policy existe, se não, criar
DROP POLICY IF EXISTS "despesas: admin gerencia" ON public.despesas;
CREATE POLICY "despesas: admin gerencia"
  ON public.despesas FOR ALL TO authenticated
  USING (public.is_admin_da_empresa(empresa_id))
  WITH CHECK (public.is_admin_da_empresa(empresa_id));

-- Índice para performance (se não existir)
CREATE INDEX IF NOT EXISTS despesas_empresa_idx ON public.despesas (empresa_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.despesas TO authenticated;
GRANT ALL ON public.despesas TO service_role;

-- ============================================
-- TESTE: Validar que RLS está ativo
-- ============================================
-- Execute após aplicar a migration:
-- SELECT schemaname, tablename, rowsecurity FROM pg_tables
--   WHERE tablename IN ('pneus', 'afericoes_tanque', 'despesas')
--   ORDER BY tablename;
--
-- Esperado: rowsecurity = true para todas as 3 tabelas
