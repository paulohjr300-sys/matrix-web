import { NextResponse } from "next/server";
import { requireRole } from "../../../../lib/auth-server";
import { supabaseAdmin } from "../../../../lib/supabase-admin";
import { integrationsAllowed, PortalError } from "../../../../lib/integrations/core";
import { escolherPagina, metaConfigProblem, situacaoMeta } from "../../../../lib/integrations/meta-posts";

// Situação da postagem automática no Instagram/Facebook (sem tokens).
export async function GET() {
  const auth = await requireRole(["ADMIN", "GERENTE", "VENDEDOR"]);
  if (!auth.ok) return auth.response;

  return NextResponse.json({
    liberado: await integrationsAllowed(auth.empresaId),
    pendencia: auth.role === "ADMIN" ? metaConfigProblem() : null,
    conexao: await situacaoMeta(auth.empresaId),
  });
}

// Escolhe a página do Facebook (e o Instagram ligado a ela).
export async function PATCH(request: Request) {
  const auth = await requireRole(["ADMIN"]);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));

  if (typeof body.paginaId !== "string" || !/^\d{1,30}$/.test(body.paginaId)) {
    return NextResponse.json({ message: "Página inválida." }, { status: 400 });
  }

  try {
    await escolherPagina(auth.empresaId, body.paginaId);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof PortalError) return NextResponse.json({ message: error.message }, { status: 400 });
    console.error("Erro ao escolher página", error);
    return NextResponse.json({ message: "Não foi possível escolher a página." }, { status: 500 });
  }
}

// Desconecta: apaga os tokens. Posts já publicados continuam nas redes.
export async function DELETE() {
  const auth = await requireRole(["ADMIN"]);
  if (!auth.ok) return auth.response;

  const { error } = await supabaseAdmin
    .from("integracoes")
    .update({
      status: "desconectado",
      access_token_enc: null,
      refresh_token_enc: null,
      token_expira_em: null,
      updated_at: new Date().toISOString(),
    })
    .eq("empresa_id", auth.empresaId)
    .eq("portal", "meta");

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
