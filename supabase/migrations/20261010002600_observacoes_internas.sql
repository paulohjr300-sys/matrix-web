-- =====================================================================
-- "Observações" do veículo são internas.
--
-- A visão pública site_vehicles trazia vehicles.notes, e o site mostrava
-- esse texto quando o carro não tinha descrição. As observações passam a
-- ser só do painel: a chave pública lê as colunas da visão exceto notes.
--
-- RODE DEPOIS de publicar o site com a versão que pede as colunas pelo nome
-- (sem select *), senão as páginas de estoque do site dão erro.
-- =====================================================================

begin;

revoke select on public.site_vehicles from anon;

grant select (
  empresa_id, id, km, status, manufacture_year, model_year, advertised_price,
  description, slug, doors, youtube_url, is_published, is_featured, is_premium,
  is_outlet, brand_name, model_name, engine_name, transmission_name, fuel_name,
  color_name, main_image_url, created_at, category_name, versao
) on public.site_vehicles to anon;

commit;
