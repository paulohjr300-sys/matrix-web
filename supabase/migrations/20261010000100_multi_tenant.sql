-- =====================================================================
-- Multi-tenant (SaaS): várias lojas no mesmo banco.
--
-- O que esta migration faz:
--   1. Cria a tabela "empresas" (cada loja cliente), já com os dados de
--      identidade do site (nome, logo, cores, telefone, WhatsApp...).
--   2. Cria a loja atual (Matrix) e coloca todos os dados existentes nela.
--   3. Adiciona empresa_id em todas as tabelas, com default automático a
--      partir do usuário logado (o front não precisa enviar o campo).
--   4. Substitui TODAS as policies de RLS dessas tabelas por policies que
--      isolam cada loja.
--   5. Restringe o Storage por pasta da empresa e torna os documentos
--      dos veículos privados.
--   6. Torna únicos por loja os nomes de cadastros e o slug do veículo.
--   7. Recria as views do site com empresa_id.
--
-- ANTES DE RODAR EM PRODUÇÃO:
--   * Rode antes 20261010000000_security_hotfix.sql.
--   * Faça backup (Dashboard > Database > Backups).
--   * Rode junto com o deploy do código novo do painel e do site: o site
--     antigo não filtra por loja e o painel antigo abre documentos por URL
--     pública, que deixa de funcionar.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Empresas
-- ---------------------------------------------------------------------
create table if not exists public.empresas (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  -- Domínio próprio da loja (ex: www.lojax.com.br), sem protocolo.
  dominio text unique,
  ativo boolean not null default true,

  -- Identidade usada no site público e no painel.
  nome text not null,
  logo_url text,
  cor_primaria text not null default '#185FA5',
  telefone text,
  whatsapp text,
  email text,
  endereco text,
  instagram text,
  site_titulo text,
  site_descricao text,

  created_at timestamptz not null default now()
);

insert into public.empresas (slug, nome, telefone, whatsapp, email, endereco, site_titulo, site_descricao)
values (
  'matrix',
  'Matrix Veículos',
  '(27) 3218-3376 / (27) 99723-1083',
  '5527997231083',
  'contato@matrixveiculos.com.br',
  'Av. Central, 157, próx. ao Hospital Dr. Dório Silva - SERRA/ES',
  'Matrix Automóveis',
  'Veículos selecionados, seminovos e oportunidades Matrix.'
)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------
-- 2. Funções de contexto (usadas nas policies e nos defaults)
-- ---------------------------------------------------------------------
alter table public.profiles add column if not exists empresa_id uuid references public.empresas(id);

update public.profiles
set empresa_id = (select id from public.empresas where slug = 'matrix')
where empresa_id is null;

alter table public.profiles alter column empresa_id set not null;
create index if not exists profiles_empresa_id_idx on public.profiles (empresa_id);

-- Empresa do usuário logado. Retorna null para usuário inativo, o que
-- bloqueia todo acesso pelas policies.
create or replace function public.current_empresa_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.empresa_id
  from public.profiles p
  join public.empresas e on e.id = p.empresa_id
  where p.id = auth.uid()
    and coalesce(p.is_active, true)
    and e.ativo
$$;

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid()
    and coalesce(p.is_active, true)
$$;

revoke all on function public.current_empresa_id() from public;
revoke all on function public.current_user_role() from public;
grant execute on function public.current_empresa_id() to authenticated;
grant execute on function public.current_user_role() to authenticated;

-- ---------------------------------------------------------------------
-- 3. empresa_id em todas as tabelas de dados
-- ---------------------------------------------------------------------
do $$
declare
  t text;
  matrix_id uuid := (select id from public.empresas where slug = 'matrix');
  tenant_tables text[] := array[
    -- cadastros base
    'brands', 'vehicle_models', 'colors', 'engines', 'fuels',
    'transmissions', 'vehicle_categories', 'cost_categories',
    'payment_methods',
    -- operação
    'vehicles', 'vehicle_files', 'vehicle_costs', 'vehicle_sales', 'leads',
    -- site
    'site_banners', 'site_category_blocks'
  ];
begin
  foreach t in array tenant_tables loop
    execute format(
      'alter table public.%I add column if not exists empresa_id uuid references public.empresas(id)', t);
    execute format(
      'update public.%I set empresa_id = %L where empresa_id is null', t, matrix_id);
    execute format(
      'alter table public.%I alter column empresa_id set not null', t);
    -- O painel não envia empresa_id: o banco preenche a partir do usuário.
    execute format(
      'alter table public.%I alter column empresa_id set default public.current_empresa_id()', t);
    execute format(
      'create index if not exists %I on public.%I (empresa_id)', t || '_empresa_id_idx', t);
  end loop;
end $$;

-- Impede que um registro seja movido para outra empresa por update.
create or replace function public.prevent_empresa_change()
returns trigger
language plpgsql
as $$
begin
  if new.empresa_id is distinct from old.empresa_id then
    raise exception 'empresa_id não pode ser alterado';
  end if;
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'brands', 'vehicle_models', 'colors', 'engines', 'fuels',
    'transmissions', 'vehicle_categories', 'cost_categories',
    'payment_methods', 'vehicles', 'vehicle_files', 'vehicle_costs',
    'vehicle_sales', 'leads', 'site_banners', 'site_category_blocks'
  ] loop
    execute format('drop trigger if exists prevent_empresa_change on public.%I', t);
    execute format(
      'create trigger prevent_empresa_change before update on public.%I
       for each row execute function public.prevent_empresa_change()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 4. RLS: remove as policies antigas e cria as novas
-- ---------------------------------------------------------------------
-- Policies permissivas se somam (OR). Se sobrar qualquer policy antiga
-- do tipo "using (true)", ela anula o isolamento. Por isso todas as
-- policies destas tabelas são apagadas e recriadas aqui.
do $$
declare
  pol record;
begin
  for pol in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'empresas', 'profiles', 'brands', 'vehicle_models', 'colors',
        'engines', 'fuels', 'transmissions', 'vehicle_categories',
        'cost_categories', 'payment_methods', 'vehicles', 'vehicle_files',
        'vehicle_costs', 'vehicle_sales', 'leads', 'site_banners',
        'site_category_blocks'
      )
  loop
    execute format('drop policy %I on %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  end loop;
end $$;

-- 4.1 Tabelas da operação: qualquer usuário ativo da loja lê e escreve.
-- (As restrições por perfil de tela continuam no proxy do painel.)
do $$
declare
  t text;
begin
  foreach t in array array[
    'vehicles', 'vehicle_files', 'vehicle_costs', 'vehicle_sales', 'leads'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy tenant_all on public.%I for all to authenticated
       using (empresa_id = public.current_empresa_id())
       with check (empresa_id = public.current_empresa_id())', t);
  end loop;
end $$;

-- 4.2 Cadastros base e configurações do site: todos da loja leem,
-- só ADMIN altera.
do $$
declare
  t text;
begin
  foreach t in array array[
    'brands', 'vehicle_models', 'colors', 'engines', 'fuels',
    'transmissions', 'vehicle_categories', 'cost_categories',
    'payment_methods', 'site_banners', 'site_category_blocks'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy tenant_select on public.%I for select to authenticated
       using (empresa_id = public.current_empresa_id())', t);
    execute format(
      'create policy tenant_admin_write on public.%I for all to authenticated
       using (empresa_id = public.current_empresa_id() and public.current_user_role() = ''ADMIN'')
       with check (empresa_id = public.current_empresa_id() and public.current_user_role() = ''ADMIN'')', t);
  end loop;
end $$;

-- 4.3 Leitura pública usada pelo site (o site filtra por empresa_id).
create policy site_public_select on public.site_category_blocks for select to anon
using (is_active);

create policy site_public_select on public.vehicle_categories for select to anon
using (true);

-- 4.4 Leads vindos do site (anônimo): só inserir, só como lead novo,
-- e só para uma loja ativa.
create policy site_insert_lead on public.leads for insert to anon
with check (
  status = 'NOVO'
  and origem in ('site', 'site-contato')
  and exists (select 1 from public.empresas e where e.id = empresa_id and e.ativo)
);

-- 4.5 Profiles: cada um vê o próprio perfil; ADMIN vê os da própria loja.
-- Criar, ativar e trocar perfil é feito pelas rotas /api/users com a
-- service role.
alter table public.profiles enable row level security;

create policy tenant_select on public.profiles for select to authenticated
using (
  id = auth.uid()
  or (empresa_id = public.current_empresa_id() and public.current_user_role() = 'ADMIN')
);

create policy self_update on public.profiles for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- Sem isso, um vendedor poderia fazer update role = 'ADMIN' no próprio
-- perfil pelo navegador. O usuário só pode mudar estas colunas:
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (name, must_change_password) on public.profiles to authenticated;

-- 4.6 Empresas: o site público lê os dados de identidade das lojas ativas;
-- o usuário logado lê a própria loja. Alterações só via service role.
alter table public.empresas enable row level security;

create policy public_select on public.empresas for select to anon
using (ativo);

create policy tenant_select on public.empresas for select to authenticated
using (id = public.current_empresa_id());

revoke insert, update, delete on public.empresas from anon, authenticated;

-- ---------------------------------------------------------------------
-- 5. Storage: cada loja grava só na pasta "<empresa_id>/..."
-- ---------------------------------------------------------------------
-- Documentos (CRLV, notas, contratos) não podem ficar em bucket público.
update storage.buckets set public = false where id = 'vehicle-documents';

do $$
declare
  pol record;
begin
  for pol in
    select policyname
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and (
        coalesce(qual, '') ~ '(vehicle-images|vehicle-documents|site-banners|site-category-blocks)'
        or coalesce(with_check, '') ~ '(vehicle-images|vehicle-documents|site-banners|site-category-blocks)'
      )
  loop
    execute format('drop policy %I on storage.objects', pol.policyname);
  end loop;
end $$;

-- Um arquivo pertence à loja se está na pasta dela ou, no caso dos
-- arquivos de veículo enviados antes desta migration (sem a pasta da
-- loja), se está cadastrado em vehicle_files da loja.
create or replace function public.can_access_storage_object(p_bucket text, p_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_empresa_id() is not null
    and p_bucket in ('vehicle-images', 'vehicle-documents', 'site-banners', 'site-category-blocks')
    and (
      (storage.foldername(p_name))[1] = public.current_empresa_id()::text
      or (
        p_bucket in ('vehicle-images', 'vehicle-documents')
        and exists (
          select 1 from public.vehicle_files vf
          where vf.file_path = p_name
            and vf.empresa_id = public.current_empresa_id()
        )
      )
    )
$$;

revoke all on function public.can_access_storage_object(text, text) from public;
grant execute on function public.can_access_storage_object(text, text) to authenticated;

-- Arquivo novo: sempre na pasta da loja.
create policy tenant_insert on storage.objects for insert to authenticated
with check (
  bucket_id in ('vehicle-images', 'vehicle-documents', 'site-banners', 'site-category-blocks')
  and (storage.foldername(name))[1] = public.current_empresa_id()::text
);

create policy tenant_update on storage.objects for update to authenticated
using (public.can_access_storage_object(bucket_id, name));

create policy tenant_delete on storage.objects for delete to authenticated
using (public.can_access_storage_object(bucket_id, name));

-- Necessário para gerar links assinados dos documentos privados.
create policy tenant_select on storage.objects for select to authenticated
using (public.can_access_storage_object(bucket_id, name));

-- ---------------------------------------------------------------------
-- 6. Unicidade por loja
-- ---------------------------------------------------------------------
-- Hoje "name" é único no banco inteiro: a segunda loja não conseguiria
-- cadastrar a marca "Fiat" se a primeira já tivesse. Passa a ser por loja.
do $$
declare
  t text;
begin
  foreach t in array array[
    'brands', 'colors', 'cost_categories', 'engines', 'fuels',
    'payment_methods', 'transmissions', 'vehicle_categories'
  ] loop
    execute format('alter table public.%I drop constraint if exists %I', t, t || '_name_key');
    execute format('drop index if exists public.%I', t || '_name_key');
    execute format(
      'alter table public.%I add constraint %I unique (empresa_id, name)', t, t || '_empresa_name_key');
  end loop;
end $$;

alter table public.vehicle_models drop constraint if exists vehicle_models_brand_id_name_key;
drop index if exists public.vehicle_models_brand_id_name_key;
alter table public.vehicle_models
  add constraint vehicle_models_empresa_brand_name_key unique (empresa_id, brand_id, name);

-- O site busca o veículo pelo slug; dois iguais na mesma loja quebram a
-- página. Se esta linha falhar, há slugs repetidos: corrija antes.
create unique index if not exists vehicles_empresa_slug_key
  on public.vehicles (empresa_id, slug) where slug is not null;

-- ---------------------------------------------------------------------
-- 7. Views do site com empresa_id
-- ---------------------------------------------------------------------
-- Definições copiadas do banco em 10/10/2026, com duas mudanças:
--   * empresa_id, para o site filtrar pela loja;
--   * site_vehicles deixa de expor a placa (o site não usa).
-- As views rodam com a permissão do dono (sem security_invoker), por isso
-- o site lê o estoque sem precisar de policy nas tabelas.
drop view if exists public.site_vehicles;
drop view if exists public.site_vehicle_images;
drop view if exists public.public_site_banners;

create view public.public_site_banners as
select
  empresa_id,
  id,
  title,
  subtitle,
  button_text,
  button_link,
  desktop_image_url,
  mobile_image_url,
  sort_order,
  is_active,
  created_at,
  overlay_enabled,
  overlay_from,
  overlay_middle,
  overlay_to
from public.site_banners
where is_active = true
order by sort_order, created_at desc;

create view public.site_vehicle_images as
select
  vf.empresa_id,
  vf.id,
  vf.vehicle_id,
  vf.file_name,
  vf.file_path,
  vf.created_at,
  'https://liqvionnspkresvwhnnl.supabase.co/storage/v1/object/public/vehicle-images/'::text || vf.file_path as url
from public.vehicle_files vf
join public.vehicles v on v.id = vf.vehicle_id
where vf.file_type = 'IMAGE'
  and v.is_published = true
order by vf.created_at;

create view public.site_vehicles as
select
  v.empresa_id,
  v.id,
  v.km,
  v.status,
  v.manufacture_year,
  v.model_year,
  v.advertised_price,
  v.description,
  v.notes,
  v.slug,
  v.doors,
  v.youtube_url,
  v.is_published,
  v.is_featured,
  v.is_premium,
  v.is_outlet,
  b.name as brand_name,
  m.name as model_name,
  e.name as engine_name,
  t.name as transmission_name,
  f.name as fuel_name,
  c.name as color_name,
  coalesce(main_file.public_url, first_file.public_url, img.url) as main_image_url,
  v.created_at,
  vc.name as category_name
from public.vehicles v
  left join public.brands b on b.id = v.brand_id
  left join public.vehicle_models m on m.id = v.model_id
  left join public.engines e on e.id = v.engine_id
  left join public.transmissions t on t.id = v.transmission_id
  left join public.fuels f on f.id = v.fuel_id
  left join public.colors c on c.id = v.color_id
  left join public.vehicle_categories vc on vc.id = v.category_id
  left join lateral (
    select 'https://liqvionnspkresvwhnnl.supabase.co/storage/v1/object/public/vehicle-images/'::text || vf.file_path as public_url
    from public.vehicle_files vf
    where vf.id = v.main_photo_file_id and vf.file_type = 'IMAGE'
    limit 1
  ) main_file on true
  left join lateral (
    select 'https://liqvionnspkresvwhnnl.supabase.co/storage/v1/object/public/vehicle-images/'::text || vf.file_path as public_url
    from public.vehicle_files vf
    where vf.vehicle_id = v.id and vf.file_type = 'IMAGE'
    order by vf.created_at
    limit 1
  ) first_file on true
  left join lateral (
    select vi.url
    from public.vehicle_images vi
    where vi.vehicle_id = v.id
    order by vi.capa desc, vi.ordem, vi.created_at
    limit 1
  ) img on true
where v.is_published = true
  and v.status::text = 'EM_ESTOQUE';

grant select on public.public_site_banners, public.site_vehicle_images, public.site_vehicles
  to anon, authenticated;

commit;
