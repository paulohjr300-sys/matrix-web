-- =====================================================================
-- Chave pública (anon): só leitura, e só do que o site usa.
--
-- O Supabase concede por padrão SELECT/INSERT/UPDATE/DELETE em todas as
-- tabelas e visões ao papel anon; quem protegia era a RLS. Nas VISÕES a
-- RLS não vale (rodam com o dono), e public_site_banners é uma visão
-- simples de site_banners: com UPDATE liberado, alguém sem login poderia
-- alterar os banners de qualquer loja por ela.
--
-- Agora anon só lê: os dados públicos da loja (colunas de empresas), os
-- veículos e fotos publicados, os banners e os blocos de categoria. Os
-- leads do site já são gravados pelo servidor (rota /api/leads).
-- =====================================================================

begin;

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

-- Tabelas e visões criadas daqui em diante também não vêm abertas.
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;

grant select on public.site_vehicles, public.site_vehicle_images, public.public_site_banners to anon;
grant select on public.site_category_blocks, public.vehicle_categories to anon;

grant select (
  id, slug, dominio, ativo, site_suspenso, nome, logo_url, favicon_url,
  cor_primaria, cor_escura, slogan, telefone, whatsapp, email, endereco,
  horario_atendimento, instagram, facebook, site_titulo, site_descricao
) on public.empresas to anon;

-- As visões do site são só para leitura também para quem está logado (o
-- painel grava nas tabelas).
revoke insert, update, delete, truncate on public.site_vehicles, public.site_vehicle_images, public.public_site_banners
  from authenticated;

commit;
