import { NextResponse } from "next/server";
import { requireRole } from "../../../../lib/auth-server";
import { integrationsAllowed, PortalError } from "../../../../lib/integrations/core";
import { runMercadoLivre } from "../../../../lib/integrations/mercadolivre";
import { runOlx } from "../../../../lib/integrations/olx";

// Publicar envolve várias chamadas ao portal (token, CEP, anúncio, fotos):
// mais tempo que o limite padrão da função na Vercel.
export const maxDuration = 60;

const ACTIONS: Record<string, readonly string[]> = {
  mercadolivre: ["publicar", "atualizar", "pausar", "reativar", "encerrar"],
  // A OLX não tem pausar; "verificar" consulta o resultado da fila de envio.
  olx: ["publicar", "atualizar", "encerrar", "verificar"],
};

const NOMES: Record<string, string> = { mercadolivre: "Mercado Livre", olx: "OLX" };

// Publica, atualiza, pausa, reativa, encerra ou verifica o anúncio de um
// veículo em um portal.
export async function POST(request: Request) {
  const auth = await requireRole(["ADMIN", "GERENTE", "VENDEDOR"]);

  if (!auth.ok) {
    return auth.response;
  }

  const body = await request.json().catch(() => ({}));
  const vehicleId = String(body.vehicleId || "");
  const portal = String(body.portal || "");
  const action = String(body.action || "");

  if (!vehicleId || !ACTIONS[portal]?.includes(action)) {
    return NextResponse.json({ message: "Pedido inválido." }, { status: 400 });
  }

  if (["publicar", "reativar"].includes(action) && !(await integrationsAllowed(auth.empresaId))) {
    return NextResponse.json(
      { message: "As integrações com portais fazem parte do plano Pro." },
      { status: 403 },
    );
  }

  try {
    if (portal === "mercadolivre") {
      await runMercadoLivre(auth.empresaId, vehicleId, action as Parameters<typeof runMercadoLivre>[2]);
    } else {
      // Na OLX, a primeira publicação leva a marca/modelo/versão do catálogo dela.
      const catalogo = body.catalogo;
      const valido =
        catalogo &&
        ["marcaId", "modeloId", "versaoId"].every((campo) => /^[0-9]{1,6}$/.test(String(catalogo[campo] || "")));

      await runOlx(
        auth.empresaId,
        vehicleId,
        action as Parameters<typeof runOlx>[2],
        valido
          ? {
              marcaId: String(catalogo.marcaId),
              modeloId: String(catalogo.modeloId),
              versaoId: String(catalogo.versaoId),
              versaoNome: String(catalogo.versaoNome || "").slice(0, 120),
            }
          : undefined,
      );
    }
  } catch (error) {
    const message =
      error instanceof PortalError ? error.message : `Erro ao falar com ${NOMES[portal]}.`;
    if (!(error instanceof PortalError)) console.error(error);

    return NextResponse.json({ message }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
