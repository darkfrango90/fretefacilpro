-- ============================================================
-- Hardening operacional, permissões e Storage
-- Aplicar no SQL Editor do Supabase após as migrações existentes.
-- Idempotente: pode ser reaplicada com segurança.
-- ============================================================

-- Motoristas só podem criar clientes quando a permissão efetiva autorizar.
DROP POLICY IF EXISTS "clientes: criar na empresa" ON public.clientes;
CREATE POLICY "clientes: criar na empresa"
  ON public.clientes
  FOR INSERT TO authenticated
  WITH CHECK (
    empresa_id = public.current_empresa_id()
    AND (
      public.is_master()
      OR public.is_admin_da_empresa(empresa_id)
      OR COALESCE(
        (public.get_permissoes_efetivas(auth.uid())->>'pode_cadastrar_cliente')::boolean,
        true
      )
    )
  );

-- Reforça no banco as regras de venda e de conclusão da entrega.
CREATE OR REPLACE FUNCTION public.fn_valida_permissoes_entrega()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  perms jsonb;
  usuario_permissoes uuid;
  desc_pct numeric;
  total numeric;
  mats uuid[];
  cliente_cpf_cnpj text;
  cliente_telefone text;
BEGIN
  IF public.is_master() OR public.is_admin_da_empresa(NEW.empresa_id) THEN
    RETURN NEW;
  END IF;

  usuario_permissoes := CASE
    WHEN NEW.status IN ('em_rota', 'entregue')
      THEN COALESCE(NEW.motorista_entrega_id, NEW.motorista_venda_id, NEW.motorista_id)
    ELSE COALESCE(NEW.motorista_venda_id, NEW.motorista_id)
  END;

  perms := public.get_permissoes_efetivas(usuario_permissoes);
  IF perms IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT cpf_cnpj, telefone
    INTO cliente_cpf_cnpj, cliente_telefone
  FROM public.clientes
  WHERE id = NEW.cliente_id AND empresa_id = NEW.empresa_id;

  IF (perms->>'cpf_cnpj_obrigatorio')::boolean = true
     AND NULLIF(BTRIM(cliente_cpf_cnpj), '') IS NULL THEN
    RAISE EXCEPTION 'PERMISSAO_NEGADA: CPF/CNPJ do cliente é obrigatório';
  END IF;
  IF (perms->>'telefone_obrigatorio')::boolean = true
     AND NULLIF(BTRIM(cliente_telefone), '') IS NULL THEN
    RAISE EXCEPTION 'PERMISSAO_NEGADA: telefone do cliente é obrigatório';
  END IF;

  IF (perms->>'pode_alterar_valor_produto')::boolean = false
     AND NEW.preco_base_no_momento IS NOT NULL
     AND NEW.valor_praticado IS DISTINCT FROM NEW.preco_base_no_momento THEN
    RAISE EXCEPTION 'PERMISSAO_NEGADA: motorista não pode alterar o valor do produto';
  END IF;

  IF NEW.preco_base_no_momento IS NOT NULL
     AND NEW.preco_base_no_momento > 0
     AND NEW.valor_praticado < NEW.preco_base_no_momento THEN
    desc_pct :=
      (NEW.preco_base_no_momento - NEW.valor_praticado)
      / NEW.preco_base_no_momento * 100;
    IF desc_pct > COALESCE((perms->>'desconto_maximo_percent')::numeric, 0) THEN
      RAISE EXCEPTION 'PERMISSAO_NEGADA: desconto acima do permitido (%.2f%%)', desc_pct;
    END IF;
  END IF;

  IF (perms->>'pode_alterar_frete')::boolean = false
     AND COALESCE(NEW.valor_frete, 0) > 0 THEN
    RAISE EXCEPTION 'PERMISSAO_NEGADA: motorista não pode alterar o valor do frete';
  END IF;
  IF perms->>'frete_maximo' IS NOT NULL
     AND COALESCE(NEW.valor_frete, 0) > (perms->>'frete_maximo')::numeric THEN
    RAISE EXCEPTION 'PERMISSAO_NEGADA: valor de frete acima do máximo permitido';
  END IF;

  IF perms ? 'materiais_permitidos'
     AND jsonb_typeof(perms->'materiais_permitidos') = 'array' THEN
    mats := ARRAY(
      SELECT jsonb_array_elements_text(perms->'materiais_permitidos')
    )::uuid[];
    IF array_length(mats, 1) IS NOT NULL AND NOT (NEW.material_id = ANY(mats)) THEN
      RAISE EXCEPTION 'PERMISSAO_NEGADA: material não permitido para este motorista';
    END IF;
  END IF;

  total := COALESCE(NEW.valor_praticado, 0) * COALESCE(NEW.quantidade, 1)
    + COALESCE(NEW.valor_frete, 0);
  IF perms->>'valor_venda_minimo' IS NOT NULL
     AND total < (perms->>'valor_venda_minimo')::numeric THEN
    RAISE EXCEPTION 'PERMISSAO_NEGADA: valor da venda abaixo do mínimo permitido';
  END IF;
  IF perms->>'valor_venda_maximo' IS NOT NULL
     AND total > (perms->>'valor_venda_maximo')::numeric THEN
    RAISE EXCEPTION 'PERMISSAO_NEGADA: valor da venda acima do máximo permitido';
  END IF;
  IF (perms->>'observacao_obrigatoria')::boolean = true
     AND NULLIF(BTRIM(NEW.observacoes), '') IS NULL THEN
    RAISE EXCEPTION 'PERMISSAO_NEGADA: observação obrigatória';
  END IF;

  IF NEW.status = 'entregue' THEN
    IF NEW.foto_material_url IS NULL THEN
      RAISE EXCEPTION 'PERMISSAO_NEGADA: foto do material obrigatória';
    END IF;
    IF (perms->>'foto_odometro_obrigatoria')::boolean = true
       AND NEW.foto_odometro_final_url IS NULL THEN
      RAISE EXCEPTION 'PERMISSAO_NEGADA: foto do odômetro obrigatória';
    END IF;
    IF (perms->>'gps_obrigatorio')::boolean = true
       AND (NEW.foto_material_gps_lat IS NULL OR NEW.foto_material_gps_lng IS NULL) THEN
      RAISE EXCEPTION 'PERMISSAO_NEGADA: GPS obrigatório';
    END IF;
    IF NEW.km_final IS NULL OR
       (NEW.km_inicial IS NOT NULL AND NEW.km_final < NEW.km_inicial) THEN
      RAISE EXCEPTION 'PERMISSAO_NEGADA: KM final inválido';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_valida_permissoes_entrega ON public.entregas;
CREATE TRIGGER trg_valida_permissoes_entrega
  BEFORE INSERT OR UPDATE ON public.entregas
  FOR EACH ROW EXECUTE FUNCTION public.fn_valida_permissoes_entrega();

-- Buckets privados usados pela aplicação.
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('odometros', 'odometros', false),
  ('abastecimentos', 'abastecimentos', false),
  ('entregas', 'entregas', false),
  ('assinaturas', 'assinaturas', false),
  ('despesas', 'despesas', false),
  ('pneus', 'pneus', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Leitura isolada pelo primeiro segmento do caminho: empresa_id/usuario_id/arquivo.
DROP POLICY IF EXISTS "storage_empresa_select_operacional" ON storage.objects;
CREATE POLICY "storage_empresa_select_operacional"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id IN ('odometros','abastecimentos','entregas','assinaturas','despesas','pneus')
    AND (storage.foldername(name))[1]::uuid = public.current_empresa_id()
  );

DROP POLICY IF EXISTS "storage_usuario_insert_operacional" ON storage.objects;
CREATE POLICY "storage_usuario_insert_operacional"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id IN ('odometros','abastecimentos','entregas','assinaturas','despesas','pneus')
    AND (storage.foldername(name))[1]::uuid = public.current_empresa_id()
    AND (storage.foldername(name))[2]::uuid = auth.uid()
  );

-- Necessária para retries idempotentes feitos com upsert=true.
DROP POLICY IF EXISTS "storage_usuario_update_operacional" ON storage.objects;
CREATE POLICY "storage_usuario_update_operacional"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id IN ('odometros','abastecimentos','entregas','assinaturas','despesas','pneus')
    AND (storage.foldername(name))[1]::uuid = public.current_empresa_id()
    AND (storage.foldername(name))[2]::uuid = auth.uid()
  )
  WITH CHECK (
    bucket_id IN ('odometros','abastecimentos','entregas','assinaturas','despesas','pneus')
    AND (storage.foldername(name))[1]::uuid = public.current_empresa_id()
    AND (storage.foldername(name))[2]::uuid = auth.uid()
  );
