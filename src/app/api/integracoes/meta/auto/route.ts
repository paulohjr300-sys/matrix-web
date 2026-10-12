import { NextResponse } from "next/server";
import { requireRole } from "../../../../../lib/auth-server";
import { PortalError } from "../../../../../lib/integrations/core";
import { postarAutomatico } from "../../../../../lib/integrations/automatico";

// Carrossel do Instagram + Facebook: várias chamadas à Meta.
export const maxDuration = 60;

// Chamado pelo painel depois de salvar um veículo: se ele acabou de entrar no
// site e ainda não tem post, publica no Instagram e no Facebook da loja.
export async function POST(request: Request) {
  const auth = await requireRole(["ADMIN", "GERENTE", "VENDEDOR"]);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const vehicleId = String(body.vehicleId || "");
  if (!vehicleId) return NextResponse.json({ message: "Veículo inválido." }, { status: 400 });

  try {
    const resultados = await postarAutomatico(auth.empresaId, vehicleId);
    return NextResponse.json({ resultados: resultados || [] });
  } catch (error) {
    if (!(error instanceof PortalError)) console.error("Erro no post automático", error);
    return NextResponse.json({
      resultados: [],
      erro: error instanceof PortalError ? error.message : "Não foi possível fazer o post automático.",
    });
  }
}
