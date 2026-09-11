-- Checklist semanal obrigatório do motorista.
--
-- Um registro por motorista por semana (semana = data da segunda-feira). O app
-- cobra o checklist a partir de segunda e bloqueia vendas e entregas até ele ser
-- enviado. As perguntas ficam gravadas junto das respostas para que o histórico
-- continue legível mesmo se a lista de itens mudar no futuro.
--
-- Rode no Supabase SQL Editor antes de publicar a versão do app que usa o
-- checklist.

CREATE TABLE IF NOT EXISTS public.checklists_semanais (
  id uuid PRIMARY KEY,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  motorista_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  semana date NOT NULL CHECK (EXTRACT(ISODOW FROM semana) = 1),
  respostas jsonb NOT NULL CHECK (jsonb_typeof(respostas) = 'array'),
  observacoes text,
  preenchido_em timestamptz NOT NULL DEFAULT now(),
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizada_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT checklists_semanais_motorista_semana_key UNIQUE (motorista_id, semana)
);

CREATE INDEX IF NOT EXISTS checklists_semanais_empresa_semana_idx
  ON public.checklists_semanais (empresa_id, semana DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.checklists_semanais TO authenticated;
GRANT ALL ON public.checklists_semanais TO service_role;
ALTER TABLE public.checklists_semanais ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "checklists_semanais_select" ON public.checklists_semanais;
CREATE POLICY "checklists_semanais_select"
  ON public.checklists_semanais FOR SELECT TO authenticated
  USING (
    public.is_master()
    OR public.is_admin_da_empresa(empresa_id)
    OR (empresa_id = public.current_empresa_id() AND motorista_id = auth.uid())
  );

DROP POLICY IF EXISTS "checklists_semanais_insert_proprio" ON public.checklists_semanais;
CREATE POLICY "checklists_semanais_insert_proprio"
  ON public.checklists_semanais FOR INSERT TO authenticated
  WITH CHECK (
    empresa_id = public.current_empresa_id()
    AND motorista_id = auth.uid()
  );

-- Depois de enviado, só o admin corrige ou exclui (o motorista não reescreve as
-- respostas da semana).
DROP POLICY IF EXISTS "checklists_semanais_update_admin" ON public.checklists_semanais;
CREATE POLICY "checklists_semanais_update_admin"
  ON public.checklists_semanais FOR UPDATE TO authenticated
  USING (public.is_master() OR public.is_admin_da_empresa(empresa_id))
  WITH CHECK (public.is_master() OR public.is_admin_da_empresa(empresa_id));

DROP POLICY IF EXISTS "checklists_semanais_delete_admin" ON public.checklists_semanais;
CREATE POLICY "checklists_semanais_delete_admin"
  ON public.checklists_semanais FOR DELETE TO authenticated
  USING (public.is_master() OR public.is_admin_da_empresa(empresa_id));

DROP TRIGGER IF EXISTS trg_audit_checklists_semanais ON public.checklists_semanais;
CREATE TRIGGER trg_audit_checklists_semanais
  BEFORE INSERT OR UPDATE OR DELETE ON public.checklists_semanais
  FOR EACH ROW EXECUTE FUNCTION public.fn_auditoria_trigger();
