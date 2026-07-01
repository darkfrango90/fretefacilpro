-- Adiciona cidade e estado (UF) ao cadastro de clientes
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS cidade text,
  ADD COLUMN IF NOT EXISTS estado text;

-- Validação simples de UF (2 letras maiúsculas)
ALTER TABLE public.clientes
  DROP CONSTRAINT IF EXISTS clientes_estado_uf_chk;
ALTER TABLE public.clientes
  ADD CONSTRAINT clientes_estado_uf_chk
  CHECK (estado IS NULL OR estado ~ '^[A-Z]{2}$');
