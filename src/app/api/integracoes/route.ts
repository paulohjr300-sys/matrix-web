import { NextResponse } from "next/server";
import { requireRole } from "../../../lib/auth-server";
import { supabaseAdmin } from "../../../lib/supabase-admin";
import { integrationsAllowed } from "../../../lib/integrations/core";
import { mercadoLivreConfigProblem } from "../../../lib/integrations/mercadolivre";
import { olxConfigProblem } from "../../../lib/integrations/olx";

// Situação das integrações da loja (sem nenhum token).
export async function GET() {
  const auth = await requireRole(["ADMIN", "GERENTE", "VENDEDOR"]);

  if (!auth.ok) {
    return auth.response;
  }

  const { data } = await supabaseAdmin
    .from("integracoes")
    .select("portal, status, conta_nome, ultimo_erro, conectado_em")
    .eq("empresa_id", auth.empresaId);

  const { data: empresa } = await supabaseAdmin
    .from("empresas")
    .select("slug, cep")
    .eq("id", auth.empresaId)
    .single();

  const find = (portal: string) => (data || []).find((item) => item.portal === portal) || null;

  return NextResponse.json({
    liberado: await integrationsAllowed(auth.empresaId),
    // Catálogo para Facebook/Instagram: endereço público do arquivo da loja.
    catalogo: empresa ? { slug: empresa.slug, temCep: (empresa.cep || "").replace(/\D/g, "").length === 8 } : null,
    // Ferramenta de desenvolvimento: criar usuário de teste do ML.
    usuarioTeste: process.env.ML_ALLOW_TEST_USERS === "true" && auth.role === "ADMIN",
    portais: [
      {
        portal: "mercadolivre",
        nome: "Mercado Livre",
        disponivel: true,
        // Só o ADMIN precisa ver o que falta configurar.
        pendencia: auth.role === "ADMIN" ? mercadoLivreConfigProblem() : null,
        conexao: find("mercadolivre"),
      },
      { portal: "webmotors", nome: "Webmotors", disponivel: false, conexao: null },
      {
        portal: "olx",
        nome: "OLX",
        disponivel: true,
        pendencia: auth.role === "ADMIN" ? olxConfigProblem() : null,
        conexao: find("olx"),
      },
    ],
  });
}
