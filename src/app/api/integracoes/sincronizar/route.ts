import { NextResponse } from "next/server";
import { requireRole } from "../../../../lib/auth-server";
import { PortalError } from "../../../../lib/integrations/core";
import { syncMercadoLivre } from "../../../../lib/integrations/mercadolivre";
import { syncOlx } from "../../../../lib/integrations/olx";
import { publicarMercadoLivreAutomatico } from "../../../../lib/integrations/automatico";
import { marcarPostsVendidos } from "../../../../lib/integrations/meta-posts";

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
  const publicados: string[] = [];

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

  // Acabou de entrar no site: publica no Mercado Livre (se a conta estiver
  // conectada e o veículo ainda não tiver anúncio).
  try {
    const ml = await publicarMercadoLivreAutomatico(auth.empresaId, vehicleId);
    if (ml === "publicado") publicados.push("Mercado Livre");
    else if (ml) erros.push(ml);
  } catch (error) {
    console.error("Erro na publicação automática no ML", error);
  }

  // Vendido: marca "VENDIDO" nos posts do carro no Facebook/Instagram.
  try {
    erros.push(...(await marcarPostsVendidos(auth.empresaId, vehicleId)));
  } catch (error) {
    console.error("Erro ao marcar VENDIDO nos posts", error);
  }

  return NextResponse.json({ erros, publicados });
}
