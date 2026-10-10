import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase-admin";
import { PortalError } from "../../../../lib/integrations/core";
import { runMercadoLivre } from "../../../../lib/integrations/mercadolivre";

export const maxDuration = 60;

// Rede de segurança, chamada 1x por dia pelo Cron da Vercel (vercel.json):
// encerra anúncios ainda ativos de veículos que já foram vendidos, venha a
// venda de onde vier (tela de Vendas, funil, banco).
// A Vercel envia "Authorization: Bearer <CRON_SECRET>"; sem CRON_SECRET
// configurado a rota não roda.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;

  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ message: "Não autorizado." }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("anuncios_portal")
    .select("empresa_id, vehicle_id, vehicles!inner(status)")
    .eq("portal", "mercadolivre")
    .in("status", ["publicado", "pausado"])
    .eq("vehicles.status", "VENDIDO")
    .limit(50);

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  let encerrados = 0;
  const erros: string[] = [];

  for (const anuncio of data || []) {
    try {
      await runMercadoLivre(anuncio.empresa_id, anuncio.vehicle_id, "encerrar");
      encerrados++;
    } catch (err) {
      erros.push(`${anuncio.vehicle_id}: ${err instanceof PortalError ? err.message : "erro inesperado"}`);
    }
  }

  return NextResponse.json({ verificados: data?.length || 0, encerrados, erros });
}
