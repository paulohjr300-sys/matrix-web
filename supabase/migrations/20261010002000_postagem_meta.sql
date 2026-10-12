-- =====================================================================
-- Postagem automática no Instagram e no Facebook (API da Meta).
--
-- A conexão da loja fica em integracoes (portal 'meta'): token da página
-- criptografado, página e conta do Instagram escolhidas em config. Cada
-- post publicado pelo painel fica registrado em posts_redes.
-- =====================================================================

begin;

alter table public.integracoes drop constraint if exists integracoes_portal_check;
alter table public.integracoes
  add constraint integracoes_portal_check
  check (portal in ('mercadolivre', 'webmotors', 'olx', 'meta'));

create table if not exists public.posts_redes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  rede text not null check (rede in ('instagram', 'facebook')),
  external_id text,
  url text,
  created_at timestamptz not null default now()
);

create index if not exists posts_redes_vehicle_idx on public.posts_redes (vehicle_id, created_at desc);

alter table public.posts_redes enable row level security;
revoke all on public.posts_redes from anon, authenticated;

commit;
