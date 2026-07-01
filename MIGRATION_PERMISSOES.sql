-- ============================================================
-- Cadastro de cliente expandido + Permissões por motorista
-- ============================================================

-- 1) Cliente expandido --------------------------------------------------
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS tipo_pessoa text NOT NULL DEFAULT 'fisica'
    CHECK (tipo_pessoa IN ('fisica','juridica')),
  ADD COLUMN IF NOT EXISTS cpf_cnpj text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS razao_social text,
  ADD COLUMN IF NOT EXISTS nome_fantasia text;

CREATE UNIQUE INDEX IF NOT EXISTS clientes_empresa_cpfcnpj_uniq
  ON public.clientes(empresa_id, cpf_cnpj)
  WHERE cpf_cnpj IS NOT NULL;

-- 2) Permissões padrão da empresa --------------------------------------
CREATE TABLE IF NOT EXISTS public.permissoes_padrao (
  empresa_id uuid PRIMARY KEY REFERENCES public.empresas(id) ON DELETE CASCADE,
  cpf_cnpj_obrigatorio boolean NOT NULL DEFAULT false,
  telefone_obrigatorio boolean NOT NULL DEFAULT false,
  pode_cadastrar_cliente boolean NOT NULL DEFAULT true,
  pode_alterar_valor_produto boolean NOT NULL DEFAULT true,
  desconto_maximo_percent numeric NOT NULL DEFAULT 0,
  pode_alterar_frete boolean NOT NULL DEFAULT true,
  frete_maximo numeric,
  materiais_permitidos uuid[],
  valor_venda_minimo numeric,
  valor_venda_maximo numeric,
  foto_odometro_obrigatoria boolean NOT NULL DEFAULT true,
  gps_obrigatorio boolean NOT NULL DEFAULT false,
  observacao_obrigatoria boolean NOT NULL DEFAULT false,
  pode_cancelar_entrega boolean NOT NULL DEFAULT false,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.permissoes_padrao TO authenticated;
GRANT ALL ON public.permissoes_padrao TO service_role;
ALTER TABLE public.permissoes_padrao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pp_select" ON public.permissoes_padrao;
CREATE POLICY "pp_select" ON public.permissoes_padrao
  FOR SELECT TO authenticated
  USING (empresa_id = public.current_empresa_id() OR public.is_master());

DROP POLICY IF EXISTS "pp_admin_write" ON public.permissoes_padrao;
CREATE POLICY "pp_admin_write" ON public.permissoes_padrao
  FOR ALL TO authenticated
  USING (public.is_admin_da_empresa(empresa_id) OR public.is_master())
  WITH CHECK (public.is_admin_da_empresa(empresa_id) OR public.is_master());

-- 3) Permissões individuais (override) ---------------------------------
CREATE TABLE IF NOT EXISTS public.permissoes_motorista (
  motorista_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  cpf_cnpj_obrigatorio boolean,
  telefone_obrigatorio boolean,
  pode_cadastrar_cliente boolean,
  pode_alterar_valor_produto boolean,
  desconto_maximo_percent numeric,
  pode_alterar_frete boolean,
  frete_maximo numeric,
  materiais_permitidos uuid[],
  valor_venda_minimo numeric,
  valor_venda_maximo numeric,
  foto_odometro_obrigatoria boolean,
  gps_obrigatorio boolean,
  observacao_obrigatoria boolean,
  pode_cancelar_entrega boolean,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.permissoes_motorista TO authenticated;
GRANT ALL ON public.permissoes_motorista TO service_role;
ALTER TABLE public.permissoes_motorista ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pm_select" ON public.permissoes_motorista;
CREATE POLICY "pm_select" ON public.permissoes_motorista
  FOR SELECT TO authenticated
  USING (
    motorista_id = auth.uid()
    OR public.is_admin_da_empresa(empresa_id)
    OR public.is_master()
  );

DROP POLICY IF EXISTS "pm_admin_write" ON public.permissoes_motorista;
CREATE POLICY "pm_admin_write" ON public.permissoes_motorista
  FOR ALL TO authenticated
  USING (public.is_admin_da_empresa(empresa_id) OR public.is_master())
  WITH CHECK (public.is_admin_da_empresa(empresa_id) OR public.is_master());

-- 4) Função resolver permissões efetivas -------------------------------
CREATE OR REPLACE FUNCTION public.get_permissoes_efetivas(_motorista_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'cpf_cnpj_obrigatorio',       COALESCE(m.cpf_cnpj_obrigatorio,       p.cpf_cnpj_obrigatorio,       false),
    'telefone_obrigatorio',       COALESCE(m.telefone_obrigatorio,       p.telefone_obrigatorio,       false),
    'pode_cadastrar_cliente',     COALESCE(m.pode_cadastrar_cliente,     p.pode_cadastrar_cliente,     true),
    'pode_alterar_valor_produto', COALESCE(m.pode_alterar_valor_produto, p.pode_alterar_valor_produto, true),
    'desconto_maximo_percent',    COALESCE(m.desconto_maximo_percent,    p.desconto_maximo_percent,    0),
    'pode_alterar_frete',         COALESCE(m.pode_alterar_frete,         p.pode_alterar_frete,         true),
    'frete_maximo',               COALESCE(m.frete_maximo,               p.frete_maximo),
    'materiais_permitidos',       COALESCE(m.materiais_permitidos,       p.materiais_permitidos),
    'valor_venda_minimo',         COALESCE(m.valor_venda_minimo,         p.valor_venda_minimo),
    'valor_venda_maximo',         COALESCE(m.valor_venda_maximo,         p.valor_venda_maximo),
    'foto_odometro_obrigatoria',  COALESCE(m.foto_odometro_obrigatoria,  p.foto_odometro_obrigatoria,  true),
    'gps_obrigatorio',            COALESCE(m.gps_obrigatorio,            p.gps_obrigatorio,            false),
    'observacao_obrigatoria',     COALESCE(m.observacao_obrigatoria,     p.observacao_obrigatoria,     false),
    'pode_cancelar_entrega',      COALESCE(m.pode_cancelar_entrega,      p.pode_cancelar_entrega,      false)
  )
  FROM public.profiles pr
  LEFT JOIN public.permissoes_padrao p ON p.empresa_id = pr.empresa_id
  LEFT JOIN public.permissoes_motorista m ON m.motorista_id = pr.id
  WHERE pr.id = _motorista_id
$$;

REVOKE ALL ON FUNCTION public.get_permissoes_efetivas(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_permissoes_efetivas(uuid) TO authenticated;

-- 5) Trigger de validação financeira em entregas -----------------------
CREATE OR REPLACE FUNCTION public.fn_valida_permissoes_entrega()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  perms jsonb;
  desc_pct numeric;
  total numeric;
  mats uuid[];
BEGIN
  -- Master/admin não são limitados
  IF public.is_master() OR public.is_admin_da_empresa(NEW.empresa_id) THEN
    RETURN NEW;
  END IF;

  perms := public.get_permissoes_efetivas(NEW.motorista_id);
  IF perms IS NULL THEN RETURN NEW; END IF;

  -- Valor do produto
  IF (perms->>'pode_alterar_valor_produto')::boolean = false
     AND NEW.preco_base_no_momento IS NOT NULL
     AND NEW.valor_praticado IS DISTINCT FROM NEW.preco_base_no_momento THEN
    RAISE EXCEPTION 'PERMISSAO_NEGADA: motorista não pode alterar o valor do produto';
  END IF;

  -- Desconto máximo
  IF NEW.preco_base_no_momento IS NOT NULL AND NEW.preco_base_no_momento > 0
     AND NEW.valor_praticado < NEW.preco_base_no_momento THEN
    desc_pct := (NEW.preco_base_no_momento - NEW.valor_praticado) / NEW.preco_base_no_momento * 100;
    IF desc_pct > COALESCE((perms->>'desconto_maximo_percent')::numeric, 0) THEN
      RAISE EXCEPTION 'PERMISSAO_NEGADA: desconto acima do permitido (%.2f%%)', desc_pct;
    END IF;
  END IF;

  -- Frete
  IF (perms->>'pode_alterar_frete')::boolean = false
     AND COALESCE(NEW.valor_frete,0) > 0 THEN
    -- só rejeita se for diferente de zero; valor_frete travado em 0
    NULL;
  END IF;
  IF perms->>'frete_maximo' IS NOT NULL
     AND COALESCE(NEW.valor_frete,0) > (perms->>'frete_maximo')::numeric THEN
    RAISE EXCEPTION 'PERMISSAO_NEGADA: valor de frete acima do máximo permitido';
  END IF;

  -- Materiais permitidos
  IF perms ? 'materiais_permitidos' AND jsonb_typeof(perms->'materiais_permitidos') = 'array' THEN
    mats := ARRAY(SELECT jsonb_array_elements_text(perms->'materiais_permitidos'))::uuid[];
    IF array_length(mats,1) IS NOT NULL AND NOT (NEW.material_id = ANY(mats)) THEN
      RAISE EXCEPTION 'PERMISSAO_NEGADA: material não permitido para este motorista';
    END IF;
  END IF;

  -- Limites de valor total (produto * quantidade + frete)
  total := COALESCE(NEW.valor_praticado,0) * COALESCE(NEW.quantidade,1) + COALESCE(NEW.valor_frete,0);
  IF perms->>'valor_venda_minimo' IS NOT NULL
     AND total < (perms->>'valor_venda_minimo')::numeric THEN
    RAISE EXCEPTION 'PERMISSAO_NEGADA: valor da venda abaixo do mínimo permitido';
  END IF;
  IF perms->>'valor_venda_maximo' IS NOT NULL
     AND total > (perms->>'valor_venda_maximo')::numeric THEN
    RAISE EXCEPTION 'PERMISSAO_NEGADA: valor da venda acima do máximo permitido';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_valida_permissoes_entrega ON public.entregas;
CREATE TRIGGER trg_valida_permissoes_entrega
  BEFORE INSERT OR UPDATE ON public.entregas
  FOR EACH ROW EXECUTE FUNCTION public.fn_valida_permissoes_entrega();

-- 6) Seed: cria linha padrão para empresas existentes ------------------
INSERT INTO public.permissoes_padrao (empresa_id)
SELECT id FROM public.empresas
ON CONFLICT (empresa_id) DO NOTHING;
