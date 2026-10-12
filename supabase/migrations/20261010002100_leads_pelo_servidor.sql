-- =====================================================================
-- Leads do site só pelo servidor.
--
-- Os formulários do site passaram a enviar para a rota /api/leads do
-- matrix-site, que barra robôs (campo-armadilha, tempo de preenchimento,
-- limite de envios) e grava com a service role. Sem a regra abaixo, um
-- robô gravaria direto no banco com a chave pública, pulando as checagens.
--
-- RODE SÓ DEPOIS de cadastrar SUPABASE_SERVICE_ROLE_KEY no projeto do site
-- (matrix-site) na Vercel e publicar o site com a rota nova.
-- =====================================================================

drop policy if exists site_insert_lead on public.leads;
