-- Permite que o administrador programe o vencimento de vendas ainda pendentes.
ALTER TABLE public.entregas
  ADD COLUMN IF NOT EXISTS vencimento_pagamento date;

CREATE INDEX IF NOT EXISTS entregas_vencimento_pagamento_idx
  ON public.entregas (empresa_id, vencimento_pagamento)
  WHERE status_pagamento = 'pendente';
