-- =====================================================================
-- Integrações com portais de anúncio (Mercado Livre, depois Webmotors,
-- OLX...).
--
-- integracoes: a conta da loja em cada portal. Guarda os tokens de acesso
-- criptografados pelo servidor; o navegador nunca lê esta tabela.
-- anuncios_portal: cada veículo publicado em cada portal (status, link,
-- última sincronização e último erro). A loja lê; só o servidor escreve.
-- =====================================================================

begin;

create table if not exists public.integracoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  portal text not null check (portal in ('mercadolivre', 'webmotors', 'olx')),
  status text not null default 'conectado' check (status in ('conectado', 'erro', 'desconectado')),
  conta_externa_id text,
  conta_nome text,
  -- Tokens criptografados (AES-256-GCM) com INTEGRATIONS_SECRET.
  access_token_enc text,
  refresh_token_enc text,
  token_expira_em timestamptz,
  ultimo_erro text,
  conectado_em timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, portal)
);

alter table public.integracoes enable row level security;
-- Sem policies: só a service role (rotas /api/integracoes) acessa.
revoke all on public.integracoes from anon, authenticated;

create table if not exists public.anuncios_portal (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  portal text not null check (portal in ('mercadolivre', 'webmotors', 'olx')),
  external_id text,
  external_url text,
  status text not null default 'pendente'
    check (status in ('pendente', 'publicado', 'pausado', 'encerrado', 'erro')),
  ultimo_erro text,
  sincronizado_em timestamptz,
  created_at timestamptz not null default now(),
  unique (vehicle_id, portal)
);

create index if not exists anuncios_portal_empresa_idx on public.anuncios_portal (empresa_id);

alter table public.anuncios_portal enable row level security;

drop policy if exists tenant_select on public.anuncios_portal;
create policy tenant_select on public.anuncios_portal for select to authenticated
using (empresa_id = public.current_empresa_id());

revoke insert, update, delete on public.anuncios_portal from anon, authenticated;

-- CEP da loja: usado na localização dos anúncios nos portais.
alter table public.empresas add column if not exists cep text;
grant update (cep) on public.empresas to authenticated;

commit;
