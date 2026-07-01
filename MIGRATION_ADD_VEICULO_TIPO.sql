-- =====================================================================
-- MIGRATION: ADD VEICULO TIPO
-- Adiciona a coluna 'tipo' na tabela de veículos para suportar diagrama de pneus
-- =====================================================================

-- 1. Adiciona a coluna tipo (camionete, toco, truck, carreta) na tabela veiculos
ALTER TABLE public.veiculos ADD COLUMN IF NOT EXISTS tipo text DEFAULT 'toco';

-- 2. Atualiza a restrição check para garantir que apenas valores válidos sejam informados
ALTER TABLE public.veiculos DROP CONSTRAINT IF EXISTS chk_veiculos_tipo;
ALTER TABLE public.veiculos ADD CONSTRAINT chk_veiculos_tipo 
  CHECK (tipo IN ('camionete', 'toco', 'truck', 'carreta'));

-- 3. Atualiza os registros existentes para garantir que tipo não seja nulo
UPDATE public.veiculos SET tipo = 'toco' WHERE tipo IS NULL;

-- 4. Adiciona comentário explicativo
COMMENT ON COLUMN public.veiculos.tipo IS 'Tipo do veículo para renderizar o diagrama de pneus (camionete, toco, truck, carreta)';
