import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabase-admin";
import { tokenWebhookConfere } from "../../../../lib/billing/asaas";
import { processarEvento } from "../../../../lib/billing/assinatura";

export const maxDuration = 30;

// Webhook do Asaas (cobranças e assinaturas). A entrega é "pelo menos uma
// vez": o id do evento fica registrado e repetições só recebem 200. Se o
// processamento falhar, o registro é desfeito e respondemos erro para o
// Asaas tentar de novo.
export async function POST(request: Request) {
  if (!tokenWebhookConfere(request.headers.get("asaas-access-token"))) {
    return NextResponse.json({ message: "Não autorizado." }, { status: 401 });
  }

  const evento = await request.json().catch(() => null);

  if (!evento || typeof evento.event !== "string" || typeof evento.id !== "string") {
    return NextResponse.json({ message: "Evento inválido." }, { status: 400 });
  }

  const { error: duplicado } = await supabaseAdmin
    .from("asaas_eventos")
    .insert({ id: evento.id, evento: evento.event, payload: evento });

  if (duplicado) {
    // 23505: evento já recebido.
    if (duplicado.code === "23505") return NextResponse.json({ received: true });

    console.error("Erro ao registrar evento do Asaas", duplicado);
    return NextResponse.json({ message: "Erro ao registrar." }, { status: 500 });
  }

  try {
    await processarEvento(evento);
  } catch (error) {
    console.error("Erro ao processar evento do Asaas", evento.event, error);
    await supabaseAdmin.from("asaas_eventos").delete().eq("id", evento.id);
    return NextResponse.json({ message: "Erro ao processar." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
