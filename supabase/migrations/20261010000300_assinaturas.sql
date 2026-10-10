-- =====================================================================
-- Base para assinaturas e cadastro de lojas pelo próprio painel.
--
-- Ainda não há cobrança. Os campos abaixo guardam o plano e a situação
-- da assinatura para, mais tarde, liberar recursos pagos (por exemplo a
-- integração com os portais de anúncio) e ligar um meio de pagamento.
-- Nenhum deles é editável pela loja: só a plataforma (service role).
-- =====================================================================

begin;

alter table public.empresas
  add column if not exists plano text not null default 'basico',
  add column if not exists assinatura_status text not null default 'trial',
  add column if not exists trial_termina_em timestamptz default (now() + interval '14 days');

-- Lojas que já existiam antes do cadastro pelo painel não ficam em teste.
-- (Só as lojas criadas daqui em diante recebem o default 'trial'.)
update public.empresas
set assinatura_status = 'ativa', trial_termina_em = null;

alter table public.empresas drop constraint if exists empresas_plano_valido;
alter table public.empresas
  add constraint empresas_plano_valido check (plano in ('basico', 'pro'));

alter table public.empresas drop constraint if exists empresas_assinatura_status_valido;
alter table public.empresas
  add constraint empresas_assinatura_status_valido
  check (assinatura_status in ('trial', 'ativa', 'inadimplente', 'cancelada'));

-- O slug vira o endereço do site (/loja/<slug>).
alter table public.empresas drop constraint if exists empresas_slug_formato;
alter table public.empresas
  add constraint empresas_slug_formato check (slug ~ '^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])$');

commit;
