-- =====================================================================
-- CRM: funil de vendas sobre a tabela leads.
--
-- Etapas (leads.status): NOVO, EM_ATENDIMENTO, PROPOSTA_ENVIADA,
-- NEGOCIACAO, FECHADO (ganho) e PERDIDO. Os leads atuais continuam nas
-- etapas em que estão.
--
-- lead_atividades: histórico de cada oportunidade (ligação, WhatsApp,
-- visita, proposta, nota e mudança de etapa). Não se edita nem apaga.
-- =====================================================================

begin;

alter table public.leads
  add column if not exists responsavel_id uuid references public.profiles(id) on delete set null,
  add column if not exists valor numeric,
  add column if not exists temperatura text,
  add column if not exists proxima_acao_em timestamptz,
  add column if not exists proxima_acao_tipo text,
  add column if not exists primeiro_contato_em timestamptz,
  add column if not exists motivo_perda text,
  add column if not exists etapa_atualizada_em timestamptz;

alter table public.leads drop constraint if exists leads_temperatura_valida;
alter table public.leads
  add constraint leads_temperatura_valida
  check (temperatura is null or temperatura in ('FRIO', 'MORNO', 'QUENTE'));

create index if not exists leads_empresa_status_idx on public.leads (empresa_id, status);
create index if not exists leads_proxima_acao_idx on public.leads (empresa_id, proxima_acao_em);

create table if not exists public.lead_atividades (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default public.current_empresa_id() references public.empresas(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  user_id uuid default auth.uid() references public.profiles(id) on delete set null,
  tipo text not null check (tipo in ('NOTA', 'LIGACAO', 'WHATSAPP', 'EMAIL', 'VISITA', 'PROPOSTA', 'ETAPA')),
  descricao text,
  created_at timestamptz not null default now()
);

create index if not exists lead_atividades_lead_idx on public.lead_atividades (lead_id, created_at desc);

alter table public.lead_atividades enable row level security;

drop policy if exists tenant_select on public.lead_atividades;
create policy tenant_select on public.lead_atividades for select to authenticated
using (empresa_id = public.current_empresa_id());

-- Cada um registra atividades em nome próprio, só em leads da sua loja.
drop policy if exists tenant_insert on public.lead_atividades;
create policy tenant_insert on public.lead_atividades for insert to authenticated
with check (
  empresa_id = public.current_empresa_id()
  and user_id = auth.uid()
  and exists (
    select 1 from public.leads l
    where l.id = lead_id and l.empresa_id = public.current_empresa_id()
  )
);

revoke update, delete on public.lead_atividades from anon, authenticated;

-- Contato registrado conta como primeiro atendimento (SLA).
create or replace function public.lead_marca_primeiro_contato()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.tipo in ('LIGACAO', 'WHATSAPP', 'EMAIL', 'VISITA', 'PROPOSTA') then
    update public.leads
    set primeiro_contato_em = coalesce(primeiro_contato_em, new.created_at)
    where id = new.lead_id;
  end if;

  return new;
end;
$$;

drop trigger if exists lead_marca_primeiro_contato on public.lead_atividades;
create trigger lead_marca_primeiro_contato
after insert on public.lead_atividades
for each row execute function public.lead_marca_primeiro_contato();

-- Mudança de etapa: registra no histórico e marca a data.
create or replace function public.lead_registra_etapa()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  nomes jsonb := '{
    "NOVO": "Novo",
    "EM_ATENDIMENTO": "Em atendimento",
    "PROPOSTA_ENVIADA": "Proposta",
    "NEGOCIACAO": "Negociação",
    "FECHADO": "Ganho",
    "PERDIDO": "Perdido"
  }';
begin
  if new.status is distinct from old.status then
    new.etapa_atualizada_em := now();

    -- Saiu de "Novo": já houve atendimento.
    if old.status = 'NOVO' then
      new.primeiro_contato_em := coalesce(new.primeiro_contato_em, now());
    end if;

    insert into public.lead_atividades (empresa_id, lead_id, user_id, tipo, descricao)
    values (
      new.empresa_id,
      new.id,
      auth.uid(),
      'ETAPA',
      format(
        'De %s para %s%s',
        coalesce(nomes ->> old.status, old.status),
        coalesce(nomes ->> new.status, new.status),
        case when new.status = 'PERDIDO' and new.motivo_perda is not null
          then ' — motivo: ' || new.motivo_perda else '' end
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists lead_registra_etapa on public.leads;
create trigger lead_registra_etapa
before update on public.leads
for each row execute function public.lead_registra_etapa();

-- Equipe da loja (nome e perfil) para escolher o responsável. A tabela
-- profiles só mostra todos ao ADMIN; esta função expõe só o necessário.
create or replace function public.equipe_da_loja()
returns table (id uuid, name text, role text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.name, p.role
  from public.profiles p
  where p.empresa_id = public.current_empresa_id()
    and coalesce(p.is_active, true)
  order by p.name
$$;

revoke all on function public.equipe_da_loja() from public;
grant execute on function public.equipe_da_loja() to authenticated;

commit;
