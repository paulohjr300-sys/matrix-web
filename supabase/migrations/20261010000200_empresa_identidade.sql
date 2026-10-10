-- =====================================================================
-- Identidade do site editável pela loja.
--
-- O ADMIN de cada loja passa a editar, pelo painel (Configurações >
-- Identidade do site), o nome, o logo, as cores, os contatos e os textos
-- do site. slug, dominio e ativo continuam só com a plataforma.
-- =====================================================================

begin;

alter table public.empresas
  add column if not exists cor_escura text not null default '#042C53',
  add column if not exists slogan text,
  add column if not exists horario_atendimento text,
  add column if not exists facebook text,
  alter column cor_primaria set default '#185FA5';

-- '#dc2626' era só o default da migration anterior, nunca escolhido por
-- uma loja. Mantém o site como está no ar hoje (paleta painel).
update public.empresas
set cor_primaria = '#185FA5'
where cor_primaria = '#dc2626';

update public.empresas
set
  slogan = coalesce(slogan, 'Veículos selecionados com procedência e atendimento especializado.'),
  horario_atendimento = coalesce(horario_atendimento, 'Segunda a sábado, das 8h às 18h')
where slug = 'matrix';

-- As cores vão direto para o CSS do site: só aceita hexadecimal.
alter table public.empresas drop constraint if exists empresas_cor_primaria_hex;
alter table public.empresas
  add constraint empresas_cor_primaria_hex check (cor_primaria ~ '^#[0-9A-Fa-f]{6}$');

alter table public.empresas drop constraint if exists empresas_cor_escura_hex;
alter table public.empresas
  add constraint empresas_cor_escura_hex check (cor_escura ~ '^#[0-9A-Fa-f]{6}$');

-- ADMIN altera só a própria loja e só as colunas de identidade.
create policy admin_update on public.empresas for update to authenticated
using (id = public.current_empresa_id() and public.current_user_role() = 'ADMIN')
with check (id = public.current_empresa_id() and public.current_user_role() = 'ADMIN');

revoke update on public.empresas from authenticated;
grant update (
  nome, logo_url, cor_primaria, cor_escura, telefone, whatsapp, email,
  endereco, instagram, facebook, slogan, horario_atendimento,
  site_titulo, site_descricao
) on public.empresas to authenticated;

commit;
