import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase-admin";
import { PortalError } from "../../../../lib/integrations/core";
import { runMercadoLivre } from "../../../../lib/integrations/mercadolivre";
import { runOlx } from "../../../../lib/integrations/olx";

export const maxDuration = 60;

// Rede de segurança, chamada 1x por dia pelo Cron da Vercel (vercel.json):
//   - encerra anúncios ainda ativos de veículos vendidos, venha a venda de
//     onde vier (tela de Vendas, funil, banco);
//   - na OLX, confere os envios que ficaram aguardando a fila de publicação.
// A Vercel envia "Authorization: Bearer <CRON_SECRET>"; sem CRON_SECRET
// configurado a rota não roda.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;

  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ message: "Não autorizado." }, { status: 401 });
  }

  const { data: vendidos, error } = await supabaseAdmin
    .from("anuncios_portal")
    .select("empresa_id, vehicle_id, portal, vehicles!inner(status)")
    .in("portal", ["mercadolivre", "olx"])
    .in("status", ["publicado", "pausado", "pendente"])
    .eq("vehicles.status", "VENDIDO")
    .limit(50);

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  const { data: pendentesOlx } = await supabaseAdmin
    .from("anuncios_portal")
    .select("empresa_id, vehicle_id, vehicles!inner(status)")
    .eq("portal", "olx")
    .eq("status", "pendente")
    .neq("vehicles.status", "VENDIDO")
    .limit(50);

  let encerrados = 0;
  let verificados = 0;
  const erros: string[] = [];
  const motivo = (err: unknown) => (err instanceof PortalError ? err.message : "erro inesperado");

  for (const anuncio of vendidos || []) {
    try {
      if (anuncio.portal === "mercadolivre") {
        await runMercadoLivre(anuncio.empresa_id, anuncio.vehicle_id, "encerrar");
      } else {
        await runOlx(anuncio.empresa_id, anuncio.vehicle_id, "encerrar");
      }
      encerrados++;
    } catch (err) {
      erros.push(`${anuncio.portal} ${anuncio.vehicle_id}: ${motivo(err)}`);
    }
  }

  for (const anuncio of pendentesOlx || []) {
    try {
      await runOlx(anuncio.empresa_id, anuncio.vehicle_id, "verificar");
      verificados++;
    } catch (err) {
      erros.push(`olx ${anuncio.vehicle_id}: ${motivo(err)}`);
    }
  }

  return NextResponse.json({ encerrados, verificados, erros });
}
