import { NextResponse } from "next/server";
import { requireRole } from "../../../../lib/auth-server";
import { integrationsAllowed, PortalError } from "../../../../lib/integrations/core";
import { runMercadoLivre } from "../../../../lib/integrations/mercadolivre";

const ACTIONS = ["publicar", "atualizar", "pausar", "reativar", "encerrar"] as const;

// Publica, atualiza, pausa, reativa ou encerra o anúncio de um veículo.
export async function POST(request: Request) {
  const auth = await requireRole(["ADMIN", "GERENTE", "VENDEDOR"]);

  if (!auth.ok) {
    return auth.response;
  }

  const body = await request.json().catch(() => ({}));
  const vehicleId = String(body.vehicleId || "");
  const portal = String(body.portal || "");
  const action = String(body.action || "") as (typeof ACTIONS)[number];

  if (!vehicleId || portal !== "mercadolivre" || !ACTIONS.includes(action)) {
    return NextResponse.json({ message: "Pedido inválido." }, { status: 400 });
  }

  if (["publicar", "reativar"].includes(action) && !(await integrationsAllowed(auth.empresaId))) {
    return NextResponse.json(
      { message: "As integrações com portais fazem parte do plano Pro." },
      { status: 403 },
    );
  }

  try {
    await runMercadoLivre(auth.empresaId, vehicleId, action);
  } catch (error) {
    const message = error instanceof PortalError ? error.message : "Erro ao falar com o Mercado Livre.";
    if (!(error instanceof PortalError)) console.error(error);

    return NextResponse.json({ message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
