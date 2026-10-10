-- =====================================================================
-- Site fora do ar por falta de pagamento.
--
-- empresas.site_suspenso é ligado pelo servidor quando o painel da loja
-- fica bloqueado (teste encerrado sem plano, mais de 7 dias de atraso ou
-- assinatura cancelada) e desligado quando a fatura é paga. O site público
-- lê a coluna e mostra "temporariamente indisponível"; o formulário de
-- contato deixa de aceitar leads e o catálogo da Meta sai vazio.
-- =====================================================================

begin;

alter table public.empresas
  add column if not exists site_suspenso boolean not null default false;

drop policy if exists site_insert_lead on public.leads;
create policy site_insert_lead on public.leads for insert to anon
with check (
  status = 'NOVO'
  and origem in ('site', 'site-contato')
  and exists (
    select 1 from public.empresas e
    where e.id = empresa_id and e.ativo and not e.site_suspenso
  )
);

commit;
