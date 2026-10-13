-- =====================================================================
-- Site: preço FIPE riscado ao lado do preço do carro ("FIPE R$ 169.316 /
-- Por R$ 154.990"), como nos portais.
--
-- 1. site_vehicles ganha preco_fipe (coluna nova no fim: "create or
--    replace view" aceita). FIPE é tabela pública; o site só mostra quando
--    o carro está abaixo dela.
-- 2. empresas.mostrar_fipe: a loja pode desligar a comparação
--    (Configurações > Identidade do site). Padrão: ligada.
--
-- RODE ANTES de publicar o site com o visual novo (ele pede essas colunas).
-- =====================================================================

begin;

create or replace view public.site_vehicles as
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
  vc.name as category_name,
  v.versao,
  v.preco_fipe
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


-- A chave pública lê só as colunas públicas da visão (sem notes).
revoke select on public.site_vehicles from anon;
grant select (
  empresa_id, id, km, status, manufacture_year, model_year, advertised_price,
  description, slug, doors, youtube_url, is_published, is_featured, is_premium,
  is_outlet, brand_name, model_name, engine_name, transmission_name, fuel_name,
  color_name, main_image_url, created_at, category_name, versao, preco_fipe
) on public.site_vehicles to anon;

alter table public.empresas
  add column if not exists mostrar_fipe boolean not null default true;

grant select (mostrar_fipe) on public.empresas to anon;
grant update (mostrar_fipe) on public.empresas to authenticated;

commit;
