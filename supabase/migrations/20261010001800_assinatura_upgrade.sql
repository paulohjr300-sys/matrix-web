-- Troca de plano: cobrança avulsa da diferença proporcional ao subir de
-- plano no meio de um mês já pago. Enquanto não for paga, o plano novo não
-- é liberado.

alter table public.assinaturas
  add column if not exists upgrade_pagamento_id text;
