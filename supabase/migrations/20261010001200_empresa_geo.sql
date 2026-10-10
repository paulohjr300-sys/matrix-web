-- Coordenadas da loja, exigidas pelo catálogo de veículos da Meta
-- (Facebook/Instagram). Calculadas pelo servidor a partir do CEP e
-- guardadas para não consultar de novo; geo_cep diz de qual CEP vieram.

begin;

alter table public.empresas
  add column if not exists latitude numeric,
  add column if not exists longitude numeric,
  add column if not exists geo_cep text;

commit;
