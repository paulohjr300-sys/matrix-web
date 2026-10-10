-- =====================================================================
-- Cobrança das assinaturas pelo Asaas.
--
-- Os ids do Asaas, o documento do pagador e as cobranças ficam em tabelas
-- próprias (e não em "empresas", que o site público lê): só o servidor
-- acessa, com a service role. O painel consulta tudo pela API.
--
-- empresas.plano e empresas.assinatura_status continuam sendo a fonte da
-- verdade para liberar recursos; o webhook do Asaas é quem os atualiza.
-- =====================================================================

begin;

create table if not exists public.assinaturas (
  empresa_id uuid primary key references public.empresas(id) on delete cascade,
  asaas_customer_id text unique,
  asaas_subscription_id text unique,
  cpf_cnpj text,
  plano text check (plano in ('basico', 'pro')),
  valor numeric(10, 2),
  -- UNDEFINED (Pix ou boleto, à escolha na fatura) ou CREDIT_CARD
  forma_pagamento text,
  proximo_vencimento date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pagamentos (
  -- id da cobrança no Asaas (pay_...)
  id text primary key,
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  asaas_subscription_id text,
  valor numeric(10, 2) not null,
  status text not null,
  forma_pagamento text,
  vencimento date not null,
  pago_em date,
  fatura_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pagamentos_empresa_idx on public.pagamentos (empresa_id, vencimento desc);

-- Eventos de webhook já recebidos: o Asaas entrega "pelo menos uma vez",
-- então o id do evento evita processar o mesmo aviso duas vezes.
create table if not exists public.asaas_eventos (
  id text primary key,
  evento text not null,
  payload jsonb not null,
  recebido_em timestamptz not null default now()
);

alter table public.assinaturas enable row level security;
alter table public.pagamentos enable row level security;
alter table public.asaas_eventos enable row level security;

revoke all on public.assinaturas from anon, authenticated;
revoke all on public.pagamentos from anon, authenticated;
revoke all on public.asaas_eventos from anon, authenticated;

commit;
