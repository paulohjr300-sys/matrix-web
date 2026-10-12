-- Modelo de legenda dos posts de veículo (Instagram/Facebook) de cada
-- loja. Vazio usa o modelo padrão do painel. Só o ADMIN altera (política
-- admin_update de empresas).

begin;

alter table public.empresas
  add column if not exists legenda_post text;

alter table public.empresas drop constraint if exists empresas_legenda_post_tamanho;
alter table public.empresas
  add constraint empresas_legenda_post_tamanho check (char_length(legenda_post) <= 2200);

grant update (legenda_post) on public.empresas to authenticated;

commit;
