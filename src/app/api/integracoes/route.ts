import { NextResponse } from "next/server";
import { requireRole } from "../../../lib/auth-server";
import { supabaseAdmin } from "../../../lib/supabase-admin";
import { integrationsAllowed } from "../../../lib/integrations/core";
import { mercadoLivreConfig } from "../../../lib/integrations/mercadolivre";

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

  const find = (portal: string) => (data || []).find((item) => item.portal === portal) || null;

  return NextResponse.json({
    liberado: await integrationsAllowed(auth.empresaId),
    portais: [
      {
        portal: "mercadolivre",
        nome: "Mercado Livre",
        disponivel: mercadoLivreConfig() !== null,
        conexao: find("mercadolivre"),
      },
      { portal: "webmotors", nome: "Webmotors", disponivel: false, conexao: null },
      { portal: "olx", nome: "OLX", disponivel: false, conexao: null },
    ],
  });
}
