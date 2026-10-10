-- =====================================================================
-- Dados da tabela FIPE no veículo.
--
-- A FIPE identifica o veículo por marca, modelo/versão e ano. Os portais
-- de anúncio usam essa identificação, por isso ela é guardada no veículo
-- junto com o preço FIPE do mês de referência.
-- =====================================================================

begin;

alter table public.vehicles
  add column if not exists versao text,
  add column if not exists fipe_codigo text,
  add column if not exists fipe_tipo text,
  add column if not exists fipe_marca_codigo text,
  add column if not exists fipe_modelo_codigo text,
  add column if not exists fipe_ano_codigo text,
  add column if not exists preco_fipe numeric,
  add column if not exists fipe_referencia text;

alter table public.vehicles drop constraint if exists vehicles_fipe_tipo_valido;
alter table public.vehicles
  add constraint vehicles_fipe_tipo_valido
  check (fipe_tipo is null or fipe_tipo in ('cars', 'motorcycles', 'trucks'));

-- A versão (ex: "1.0 TSI Comfortline") passa a aparecer no site. Coluna
-- nova no fim da lista: "create or replace view" aceita.
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
  v.versao
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

commit;
