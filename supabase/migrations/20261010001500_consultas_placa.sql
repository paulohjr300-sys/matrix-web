-- Consulta de veículo pela placa (API Placas). Cada consulta paga fica
-- registrada: serve de cache (a mesma placa por 30 dias não gera nova
-- cobrança) e de controle de uso por loja (limite diário).
-- Só o servidor acessa: não há dados do proprietário, e o chassi vem
-- mascarado pelo provedor.

begin;

create table if not exists public.consultas_placa (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  placa text not null,
  -- true quando a resposta veio do cache (não consumiu crédito)
  cache boolean not null default false,
  resposta jsonb,
  created_at timestamptz not null default now()
);

create index if not exists consultas_placa_placa_idx on public.consultas_placa (placa, created_at desc);
create index if not exists consultas_placa_empresa_idx on public.consultas_placa (empresa_id, created_at desc);

alter table public.consultas_placa enable row level security;
revoke all on public.consultas_placa from anon, authenticated;

commit;
