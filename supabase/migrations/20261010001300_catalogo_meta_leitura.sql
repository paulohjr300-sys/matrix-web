-- Registro da última leitura do catálogo pela Meta (Facebook/Instagram),
-- para o painel mostrar se a integração está funcionando. Gravado pelo
-- servidor quando o robô da Meta baixa o arquivo.

begin;

alter table public.empresas
  add column if not exists catalogo_meta_lido_em timestamptz,
  add column if not exists catalogo_meta_itens integer,
  add column if not exists catalogo_meta_formato text;

commit;
