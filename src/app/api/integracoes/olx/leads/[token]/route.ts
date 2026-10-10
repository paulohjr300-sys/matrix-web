import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { supabaseAdmin } from "../../../../../../lib/supabase-admin";
import {
  olxIntegrationByLeadToken,
  olxLeadSecretMatches,
} from "../../../../../../lib/integrations/olx";

// A OLX entrega aqui cada lead (POST, JSON), com o segredo da loja no header
// Authorization. Precisa responder em menos de 5 segundos; a OLX não
// reenvia leads que falharam.
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  if (!/^[a-f0-9]{36}$/.test(token)) {
    return NextResponse.json({ message: "Não encontrado." }, { status: 404 });
  }

  const integracao = await olxIntegrationByLeadToken(token);

  if (!integracao || integracao.status === "desconectado") {
    return NextResponse.json({ message: "Não encontrado." }, { status: 404 });
  }

  if (!olxLeadSecretMatches(integracao.config, request.headers.get("authorization"))) {
    return NextResponse.json({ message: "Não autorizado." }, { status: 401 });
  }

  const lead = await request.json().catch(() => null);

  if (!lead || typeof lead !== "object") {
    return NextResponse.json({ message: "Lead inválido." }, { status: 400 });
  }

  const texto = (value: unknown, max = 500) => (typeof value === "string" ? value.trim().slice(0, max) : null);

  // adId é o id que o painel enviou na publicação: leva ao veículo.
  let vehicleId: string | null = null;
  const adId = texto(lead.adId, 40);

  if (adId) {
    const { data } = await supabaseAdmin
      .from("anuncios_portal")
      .select("vehicle_id")
      .eq("empresa_id", integracao.empresa_id)
      .eq("portal", "olx")
      .eq("dados->>adId", adId)
      .maybeSingle();

    vehicleId = data?.vehicle_id || null;
  }

  const origemContato: Record<string, string> = {
    whatsapp: "WhatsApp",
    telefone: "telefone",
    chat: "chat",
    financing: "simulação de financiamento",
  };

  const mensagem = [
    texto(lead.message, 2000),
    lead.source && origemContato[lead.source] ? `(Contato pela OLX via ${origemContato[lead.source]})` : null,
    texto(lead.linkAd, 300),
  ]
    .filter(Boolean)
    .join("\n");

  const refExterna = texto(lead.externalId, 120) || `${texto(lead.listId, 40) || "olx"}-${texto(lead.createdAt, 40) || randomUUID()}`;

  const { error } = await supabaseAdmin.from("leads").insert({
    empresa_id: integracao.empresa_id,
    vehicle_id: vehicleId,
    nome: texto(lead.name, 120),
    telefone: texto(lead.phone, 20),
    email: texto(lead.email, 160),
    mensagem: mensagem || null,
    origem: "olx",
    status: "NOVO",
    ref_externa: refExterna,
  });

  // Lead repetido (mesmo ref_externa): já está no funil, responde sucesso.
  if (error && error.code !== "23505") {
    console.error("Erro ao gravar lead da OLX", error);
    return NextResponse.json({ message: "Erro ao gravar o lead." }, { status: 500 });
  }

  return NextResponse.json({ responseId: refExterna });
}
