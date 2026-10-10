-- =====================================================================
-- Correção urgente de segurança (antes do multi-loja).
--
-- Situação encontrada em 10/10/2026: todas as tabelas tinham policies
-- "using (true)" para o papel public. Com a ANON_KEY (que fica exposta no
-- site), qualquer pessoa podia ler, alterar e apagar veículos, vendas,
-- custos e leads, e se tornar ADMIN alterando a tabela profiles. No
-- Storage, qualquer pessoa podia listar, enviar e apagar fotos e
-- documentos dos veículos.
--
-- Esta migration é compatível com o código que está em produção hoje
-- (painel e site antigos). Pode ser aplicada antes do deploy novo.
--
-- Depois dela:
--   * anon (site): só insere leads e lê blocos de categoria/categorias.
--     O estoque e os banners continuam vindo das views, que rodam com
--     permissão do dono e não dependem destas policies.
--   * authenticated: só usuário com perfil ativo acessa. Cadastros base e
--     configurações do site só ADMIN altera.
--   * profiles: cada um lê o próprio perfil; ADMIN lê todos. Ninguém muda
--     role ou is_active pelo navegador (só pelas rotas /api/users).
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Funções auxiliares
-- ---------------------------------------------------------------------
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid()
    and coalesce(p.is_active, true)
$$;

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() is not null
$$;

revoke all on function public.current_user_role() from public;
revoke all on function public.is_active_user() from public;
grant execute on function public.current_user_role() to authenticated;
grant execute on function public.is_active_user() to authenticated;

-- ---------------------------------------------------------------------
-- 2. Remove todas as policies atuais das tabelas do sistema
-- ---------------------------------------------------------------------
do $$
declare
  pol record;
begin
  for pol in
    select tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'profiles', 'brands', 'vehicle_models', 'colors', 'engines', 'fuels',
        'transmissions', 'vehicle_categories', 'cost_categories',
        'payment_methods', 'vehicles', 'vehicle_files', 'vehicle_costs',
        'vehicle_sales', 'leads', 'site_banners', 'site_category_blocks',
        'customers', 'sales', 'vehicle_features', 'vehicle_images'
      )
  loop
    execute format('drop policy %I on public.%I', pol.policyname, pol.tablename);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 3. Operação: qualquer usuário ativo
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'vehicles', 'vehicle_files', 'vehicle_costs', 'vehicle_sales', 'leads'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy active_users_all on public.%I for all to authenticated
       using (public.is_active_user())
       with check (public.is_active_user())', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 4. Cadastros base e configurações do site: todos leem, ADMIN altera
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'brands', 'vehicle_models', 'colors', 'engines', 'fuels',
    'transmissions', 'vehicle_categories', 'cost_categories',
    'payment_methods', 'site_banners', 'site_category_blocks'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy active_users_select on public.%I for select to authenticated
       using (public.is_active_user())', t);
    execute format(
      'create policy admin_write on public.%I for all to authenticated
       using (public.current_user_role() = ''ADMIN'')
       with check (public.current_user_role() = ''ADMIN'')', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 5. Site público (anon)
-- ---------------------------------------------------------------------
-- A home lê site_category_blocks com join em vehicle_categories direto.
create policy site_public_select on public.site_category_blocks for select to anon
using (is_active);

create policy site_public_select on public.vehicle_categories for select to anon
using (true);

-- Formulários do site. O site em produção ainda envia status 'novo' no
-- formulário de contato; a migration multi-loja aceita só 'NOVO'.
create policy site_insert_lead on public.leads for insert to anon
with check (
  status in ('NOVO', 'novo')
  and origem in ('site', 'site-contato')
  and coalesce(sale_generated, false) = false
);

-- ---------------------------------------------------------------------
-- 6. Profiles
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;

create policy own_or_admin_select on public.profiles for select to authenticated
using (id = auth.uid() or public.current_user_role() = 'ADMIN');

create policy self_update on public.profiles for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- O usuário só altera o próprio nome e a flag de troca de senha.
-- Criar usuário, mudar perfil e ativar/desativar: só pelas rotas /api/users
-- (service role).
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (name, must_change_password) on public.profiles to authenticated;

-- ---------------------------------------------------------------------
-- 7. Tabelas antigas que o código não usa (customers tem CPF)
-- ---------------------------------------------------------------------
-- As views do site continuam lendo vehicle_images, porque rodam como dono.
alter table public.customers enable row level security;
alter table public.sales enable row level security;
alter table public.vehicle_features enable row level security;
alter table public.vehicle_images enable row level security;

revoke all on public.customers, public.sales, public.vehicle_features, public.vehicle_images
  from anon, authenticated;

-- ---------------------------------------------------------------------
-- 8. Storage
-- ---------------------------------------------------------------------
-- Remove as policies que deixavam anon listar, enviar e apagar arquivos.
do $$
declare
  pol record;
begin
  for pol in
    select policyname
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and (
        coalesce(qual, '') ~ '(vehicle-images|vehicle-documents|site-banners|site-category-blocks)'
        or coalesce(with_check, '') ~ '(vehicle-images|vehicle-documents|site-banners|site-category-blocks)'
      )
  loop
    execute format('drop policy %I on storage.objects', pol.policyname);
  end loop;
end $$;

create policy active_users_insert on storage.objects for insert to authenticated
with check (
  bucket_id in ('vehicle-images', 'vehicle-documents', 'site-banners', 'site-category-blocks')
  and public.is_active_user()
);

create policy active_users_update on storage.objects for update to authenticated
using (
  bucket_id in ('vehicle-images', 'vehicle-documents', 'site-banners', 'site-category-blocks')
  and public.is_active_user()
);

create policy active_users_delete on storage.objects for delete to authenticated
using (
  bucket_id in ('vehicle-images', 'vehicle-documents', 'site-banners', 'site-category-blocks')
  and public.is_active_user()
);

create policy active_users_select on storage.objects for select to authenticated
using (
  bucket_id in ('vehicle-images', 'vehicle-documents', 'site-banners', 'site-category-blocks')
  and public.is_active_user()
);

-- Os buckets continuam públicos por enquanto: o site precisa das fotos e
-- o painel em produção ainda abre os documentos por URL pública. Sem a
-- policy de SELECT para anon, ninguém consegue mais LISTAR os arquivos;
-- o link direto de um documento só funciona para quem já o tem. A
-- migration multi-loja torna o bucket vehicle-documents privado.

commit;
