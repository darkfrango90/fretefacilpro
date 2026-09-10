-- ============================================================
-- Contas a receber avulsas (lançadas manualmente pelo admin,
-- normalmente vindas de outro sistema, com documento de origem).
-- Não são entregas: não têm material, motorista nem fluxo de rota.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.contas_receber (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE RESTRICT,
  descricao text,
  valor numeric(12, 2) NOT NULL CHECK (valor > 0),
  vencimento date NOT NULL,
  documento_url text,
  status_pagamento text NOT NULL DEFAULT 'pendente'
    CHECK (status_pagamento IN ('pendente', 'confirmado')),
  forma_pagamento text,
  pagamento_confirmado_em timestamptz,
  pagamento_confirmado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  criado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_contas_receber_empresa
  ON public.contas_receber(empresa_id, vencimento DESC);
CREATE INDEX IF NOT EXISTS idx_contas_receber_cliente
  ON public.contas_receber(cliente_id);
CREATE INDEX IF NOT EXISTS idx_contas_receber_status
  ON public.contas_receber(empresa_id, status_pagamento);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contas_receber TO authenticated;
GRANT ALL ON public.contas_receber TO service_role;

ALTER TABLE public.contas_receber ENABLE ROW LEVEL SECURITY;

-- Somente admin da empresa (ou master) enxerga e mexe: é dado financeiro,
-- a tela Financeiro já é exclusiva de administrador.
DROP POLICY IF EXISTS "contas_receber: admin ve" ON public.contas_receber;
CREATE POLICY "contas_receber: admin ve"
  ON public.contas_receber FOR SELECT TO authenticated
  USING (public.is_master() OR public.is_admin_da_empresa(empresa_id));

DROP POLICY IF EXISTS "contas_receber: admin cria" ON public.contas_receber;
CREATE POLICY "contas_receber: admin cria"
  ON public.contas_receber FOR INSERT TO authenticated
  WITH CHECK (public.is_master() OR public.is_admin_da_empresa(empresa_id));

DROP POLICY IF EXISTS "contas_receber: admin edita" ON public.contas_receber;
CREATE POLICY "contas_receber: admin edita"
  ON public.contas_receber FOR UPDATE TO authenticated
  USING (public.is_master() OR public.is_admin_da_empresa(empresa_id))
  WITH CHECK (public.is_master() OR public.is_admin_da_empresa(empresa_id));

DROP POLICY IF EXISTS "contas_receber: admin apaga" ON public.contas_receber;
CREATE POLICY "contas_receber: admin apaga"
  ON public.contas_receber FOR DELETE TO authenticated
  USING (public.is_master() OR public.is_admin_da_empresa(empresa_id));

-- ============================================================
-- Bucket privado do documento de origem da dívida.
-- Mesmo padrão de caminho dos demais: empresa_id/usuario_id/arquivo.
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('contas-receber', 'contas-receber', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "storage: empresa le contas a receber" ON storage.objects;
CREATE POLICY "storage: empresa le contas a receber"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'contas-receber'
    AND (storage.foldername(name))[1]::uuid = public.current_empresa_id()
  );

DROP POLICY IF EXISTS "storage: usuario envia conta a receber" ON storage.objects;
CREATE POLICY "storage: usuario envia conta a receber"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'contas-receber'
    AND (storage.foldername(name))[1]::uuid = public.current_empresa_id()
    AND (storage.foldername(name))[2]::uuid = auth.uid()
  );

DROP POLICY IF EXISTS "storage: usuario atualiza conta a receber" ON storage.objects;
CREATE POLICY "storage: usuario atualiza conta a receber"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'contas-receber'
    AND (storage.foldername(name))[1]::uuid = public.current_empresa_id()
    AND (storage.foldername(name))[2]::uuid = auth.uid()
  )
  WITH CHECK (
    bucket_id = 'contas-receber'
    AND (storage.foldername(name))[1]::uuid = public.current_empresa_id()
    AND (storage.foldername(name))[2]::uuid = auth.uid()
  );
