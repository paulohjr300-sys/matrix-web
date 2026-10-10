-- Ícone da aba do navegador (favicon) separado do logo. Sem ele, o site
-- continua usando o logo.

begin;

alter table public.empresas add column if not exists favicon_url text;

grant update (favicon_url) on public.empresas to authenticated;

commit;
