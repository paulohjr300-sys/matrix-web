-- O banco tinha uma regra (CHECK) em leads.status criada fora do
-- repositório, só com as etapas antigas. Mover um lead para "Negociação"
-- era recusado e o painel voltava o card para a etapa anterior.
-- Remove qualquer CHECK que envolva status e cria a regra com as seis
-- etapas do funil.

begin;

do $$
declare
  c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'leads'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%status%'
  loop
    execute format('alter table public.leads drop constraint %I', c.conname);
  end loop;
end $$;

-- Normaliza valores antigos fora do padrão antes da nova regra.
update public.leads set status = upper(status) where status <> upper(status);
update public.leads set status = 'NOVO'
where status not in ('NOVO', 'EM_ATENDIMENTO', 'PROPOSTA_ENVIADA', 'NEGOCIACAO', 'FECHADO', 'PERDIDO');

alter table public.leads
  add constraint leads_status_valido
  check (status in ('NOVO', 'EM_ATENDIMENTO', 'PROPOSTA_ENVIADA', 'NEGOCIACAO', 'FECHADO', 'PERDIDO'));

commit;
