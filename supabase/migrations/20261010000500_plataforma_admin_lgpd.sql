-- =====================================================================
-- Área da plataforma (super admin) e registro de consentimento (LGPD).
--
-- platform_admins: quem administra a plataforma (você), separado dos
-- perfis das lojas. Para se tornar admin da plataforma, rode:
--
--   insert into public.platform_admins (user_id)
--   select id from auth.users where email = 'seu-email@exemplo.com';
--
-- O painel /admin lê e altera as lojas pelas rotas /api/admin, com a
-- service role, depois de conferir is_platform_admin().
-- =====================================================================

begin;

create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.platform_admins enable row level security;

drop policy if exists self_select on public.platform_admins;
create policy self_select on public.platform_admins for select to authenticated
using (user_id = auth.uid());

revoke insert, update, delete on public.platform_admins from anon, authenticated;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid())
$$;

revoke all on function public.is_platform_admin() from public;
grant execute on function public.is_platform_admin() to authenticated;

-- Quando o visitante aceitou ser contatado e a política de privacidade.
alter table public.leads add column if not exists consentimento_em timestamptz;

commit;
