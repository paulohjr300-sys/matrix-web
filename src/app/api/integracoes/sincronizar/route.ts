import { NextResponse } from "next/server";
import { requireRole } from "../../../../lib/auth-server";
import { PortalError } from "../../../../lib/integrations/core";
import { syncMercadoLivre } from "../../../../lib/integrations/mercadolivre";
import { syncOlx } from "../../../../lib/integrations/olx";

// Publicar envolve várias chamadas ao Mercado Livre (token, CEP, anúncio,
// fotos): mais tempo que o limite padrão da função na Vercel.
export const maxDuration = 60;

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

  try {
    await syncOlx(auth.empresaId, vehicleId);
  } catch (error) {
    erros.push(`OLX: ${error instanceof PortalError ? error.message : "erro inesperado"}`);
    if (!(error instanceof PortalError)) console.error(error);
  }

  return NextResponse.json({ erros });
}
