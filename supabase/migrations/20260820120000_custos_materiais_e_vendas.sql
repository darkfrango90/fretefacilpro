-- Custos de compra visiveis apenas para administradores e snapshot por venda.

CREATE TABLE IF NOT EXISTS public.materiais_custos (
  material_id uuid PRIMARY KEY REFERENCES public.materiais(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  custo_compra numeric(12, 2) NOT NULL DEFAULT 0 CHECK (custo_compra >= 0),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS materiais_custos_empresa_idx
  ON public.materiais_custos (empresa_id);

ALTER TABLE public.materiais_custos ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.materiais_custos TO authenticated;
GRANT ALL ON public.materiais_custos TO service_role;

DROP POLICY IF EXISTS "materiais_custos: admin gerencia" ON public.materiais_custos;
CREATE POLICY "materiais_custos: admin gerencia"
  ON public.materiais_custos FOR ALL TO authenticated
  USING (public.is_admin_da_empresa(empresa_id))
  WITH CHECK (
    public.is_admin_da_empresa(empresa_id)
    AND EXISTS (
      SELECT 1
        FROM public.materiais m
       WHERE m.id = public.materiais_custos.material_id
         AND m.empresa_id = public.materiais_custos.empresa_id
    )
  );

CREATE TABLE IF NOT EXISTS public.entrega_custos (
  entrega_id uuid PRIMARY KEY REFERENCES public.entregas(id) ON DELETE CASCADE,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  itens jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(itens) = 'array'),
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS entrega_custos_empresa_idx
  ON public.entrega_custos (empresa_id);

ALTER TABLE public.entrega_custos ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.entrega_custos TO authenticated;
GRANT ALL ON public.entrega_custos TO service_role;

DROP POLICY IF EXISTS "entrega_custos: admin visualiza" ON public.entrega_custos;
CREATE POLICY "entrega_custos: admin visualiza"
  ON public.entrega_custos FOR SELECT TO authenticated
  USING (public.is_admin_da_empresa(empresa_id));

CREATE OR REPLACE FUNCTION public.fn_registra_custos_entrega()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  custos_itens jsonb;
BEGIN
  IF jsonb_typeof(NEW.itens) = 'array' AND jsonb_array_length(NEW.itens) > 0 THEN
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'material_id', item->>'material_id',
          'custo_unitario', COALESCE(mc.custo_compra, 0)
        )
      ),
      '[]'::jsonb
    )
      INTO custos_itens
      FROM jsonb_array_elements(NEW.itens) AS item
      LEFT JOIN public.materiais_custos mc
        ON mc.material_id = CASE
          WHEN (item->>'material_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          THEN (item->>'material_id')::uuid
          ELSE NULL
        END
       AND mc.empresa_id = NEW.empresa_id
     WHERE item ? 'material_id'
       AND (item->>'material_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
  ELSE
    SELECT jsonb_build_array(
      jsonb_build_object(
        'material_id', NEW.material_id,
        'custo_unitario', COALESCE(mc.custo_compra, 0)
      )
    )
      INTO custos_itens
      FROM public.materiais m
      LEFT JOIN public.materiais_custos mc
        ON mc.material_id = m.id
       AND mc.empresa_id = NEW.empresa_id
     WHERE m.id = NEW.material_id
       AND m.empresa_id = NEW.empresa_id;
  END IF;

  INSERT INTO public.entrega_custos (entrega_id, empresa_id, itens)
  VALUES (NEW.id, NEW.empresa_id, COALESCE(custos_itens, '[]'::jsonb))
  ON CONFLICT (entrega_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_registra_custos_entrega ON public.entregas;
CREATE TRIGGER trg_registra_custos_entrega
  AFTER INSERT ON public.entregas
  FOR EACH ROW EXECUTE FUNCTION public.fn_registra_custos_entrega();

REVOKE ALL ON FUNCTION public.fn_registra_custos_entrega() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_registra_custos_entrega() TO service_role;
