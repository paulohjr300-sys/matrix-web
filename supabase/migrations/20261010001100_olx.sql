-- =====================================================================
-- Integração com a OLX.
--
-- anuncios_portal.dados: informações próprias de cada portal no anúncio.
--   Na OLX: id do anúncio enviado (adId), token da última importação e
--   marca/modelo/versão do catálogo da OLX escolhidos para o veículo.
-- integracoes.config: configurações da conta no portal. Na OLX: token da
--   URL de recebimento de leads, segredo e id da configuração na OLX.
-- leads.ref_externa: identificador do lead no portal, para não gravar o
--   mesmo lead duas vezes.
-- =====================================================================

begin;

alter table public.anuncios_portal add column if not exists dados jsonb not null default '{}'::jsonb;
alter table public.integracoes add column if not exists config jsonb not null default '{}'::jsonb;

alter table public.leads add column if not exists ref_externa text;

create unique index if not exists leads_empresa_ref_externa_key
  on public.leads (empresa_id, ref_externa)
  where ref_externa is not null;

-- O endereço de leads da OLX identifica a loja por este token.
create unique index if not exists integracoes_lead_token_key
  on public.integracoes ((config ->> 'lead_token'))
  where config ? 'lead_token';

commit;
