-- O banco tinha um gatilho criado fora do repositório (trg_normalize_lead_status)
-- com a lista antiga de etapas: qualquer etapa fora dela, como NEGOCIACAO,
-- era trocada para NOVO antes de gravar, sem erro. O card voltava para "Novo".
-- Mantém a normalização (vazio vira NOVO, maiúsculas) com as seis etapas.

create or replace function public.normalize_lead_status()
returns trigger
language plpgsql
as $$
begin
  if new.status is null or trim(new.status) = '' then
    new.status := 'NOVO';
  else
    new.status := upper(trim(new.status));
  end if;

  if new.status not in ('NOVO', 'EM_ATENDIMENTO', 'PROPOSTA_ENVIADA', 'NEGOCIACAO', 'FECHADO', 'PERDIDO') then
    new.status := 'NOVO';
  end if;

  return new;
end;
$$;
