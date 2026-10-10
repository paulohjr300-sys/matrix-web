-- O Supabase concede EXECUTE em funções novas diretamente ao papel anon
-- (não só via PUBLIC), então o "revoke ... from public" das migrations
-- anteriores não bastava. Nenhuma destas funções devolve dados sem login,
-- mas visitante anônimo não tem por que chamá-las.

begin;

revoke execute on function public.current_empresa_id() from anon;
revoke execute on function public.current_user_role() from anon;
revoke execute on function public.is_active_user() from anon;
revoke execute on function public.is_platform_admin() from anon;
revoke execute on function public.can_access_storage_object(text, text) from anon;
revoke execute on function public.equipe_da_loja() from anon;

commit;
