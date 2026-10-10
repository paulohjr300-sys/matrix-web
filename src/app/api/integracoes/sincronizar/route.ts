import { NextResponse } from "next/server";
import { requireRole } from "../../../../lib/auth-server";
import { PortalError } from "../../../../lib/integrations/core";
import { syncMercadoLivre } from "../../../../lib/integrations/mercadolivre";

// Chamado pelo painel depois de salvar um veículo: leva preço, fotos e
// situação (vendido/reservado) para os anúncios existentes.
export async function POST(request: Request) {
  const auth = await requireRole(["ADMIN", "GERENTE", "VENDEDOR"]);

  if (!auth.ok) {
    return auth.response;
  }

  const body = await request.json().catch(() => ({}));
  const vehicleId = String(body.vehicleId || "");

  if (!vehicleId) {
    return NextResponse.json({ message: "Veículo inválido." }, { status: 400 });
  }

  const erros: string[] = [];

  try {
    await syncMercadoLivre(auth.empresaId, vehicleId);
  } catch (error) {
    erros.push(`Mercado Livre: ${error instanceof PortalError ? error.message : "erro inesperado"}`);
    if (!(error instanceof PortalError)) console.error(error);
  }

  return NextResponse.json({ erros });
}
