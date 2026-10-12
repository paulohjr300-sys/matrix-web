-- =====================================================================
-- Site público (anon) lê de "empresas" só o que aparece no site.
--
-- Antes, a política public_select liberava as linhas das lojas ativas com
-- TODAS as colunas: plano, situação da assinatura, fim do teste, CEP,
-- coordenadas, dados do catálogo... Qualquer pessoa com a chave pública
-- conseguia listar os clientes da plataforma e o que eles pagam.
--
-- A política continua (linhas das lojas ativas); o que muda é a permissão
-- por coluna. Usuários logados (painel) não mudam: veem a própria loja.
-- =====================================================================

begin;

revoke select on public.empresas from anon;

grant select (
  id,
  slug,
  dominio,
  ativo,
  site_suspenso,
  nome,
  logo_url,
  favicon_url,
  cor_primaria,
  cor_escura,
  slogan,
  telefone,
  whatsapp,
  email,
  endereco,
  horario_atendimento,
  instagram,
  facebook,
  site_titulo,
  site_descricao
) on public.empresas to anon;

commit;
