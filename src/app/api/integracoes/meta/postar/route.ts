import { NextResponse } from "next/server";
import { requireRole } from "../../../../../lib/auth-server";
import { supabaseAdmin } from "../../../../../lib/supabase-admin";
import { integrationsAllowed, PortalError } from "../../../../../lib/integrations/core";
import { postarVeiculo, urlFotoJpeg } from "../../../../../lib/integrations/meta-posts";

// Carrossel do Instagram: várias chamadas e espera do processamento.
export const maxDuration = 60;

const REDES = ["instagram", "facebook"] as const;

// Publica o post do veículo no Instagram e/ou no Facebook da loja.
export async function POST(request: Request) {
  const auth = await requireRole(["ADMIN", "GERENTE", "VENDEDOR"]);
  if (!auth.ok) return auth.response;

  if (!(await integrationsAllowed(auth.empresaId))) {
    return NextResponse.json(
      { message: "A postagem automática no Instagram e no Facebook faz parte do plano Pro." },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const legenda = typeof body.legenda === "string" ? body.legenda.trim() : "";
  const redes = Array.isArray(body.redes) ? REDES.filter((rede) => body.redes.includes(rede)) : [];
  const fotoIds: string[] = Array.isArray(body.fotoIds) ? body.fotoIds.filter((id: unknown) => typeof id === "string") : [];

  if (typeof body.vehicleId !== "string") {
    return NextResponse.json({ message: "Veículo inválido." }, { status: 400 });
  }
  if (!redes.length) {
    return NextResponse.json({ message: "Escolha onde publicar." }, { status: 400 });
  }
  if (!fotoIds.length || fotoIds.length > 10) {
    return NextResponse.json({ message: "Escolha de 1 a 10 fotos." }, { status: 400 });
  }
  if (legenda.length > 2200) {
    return NextResponse.json({ message: "A legenda passa de 2.200 caracteres." }, { status: 400 });
  }
  if ((legenda.match(/#[\p{L}\p{N}_]+/gu) || []).length > 30) {
    return NextResponse.json({ message: "O Instagram aceita no máximo 30 hashtags." }, { status: 400 });
  }

  // As fotos precisam ser do veículo e da loja.
  const { data: veiculo } = await supabaseAdmin
    .from("vehicles")
    .select("id")
    .eq("id", body.vehicleId)
    .eq("empresa_id", auth.empresaId)
    .maybeSingle();

  if (!veiculo) return NextResponse.json({ message: "Veículo não encontrado." }, { status: 404 });

  const { data: arquivos } = await supabaseAdmin
    .from("vehicle_files")
    .select("id, file_path")
    .eq("vehicle_id", veiculo.id)
    .eq("file_type", "IMAGE")
    .in("id", fotoIds);

  const porId = new Map((arquivos || []).map((arquivo) => [arquivo.id, arquivo.file_path as string]));
  const fotos = fotoIds.filter((id) => porId.has(id)).map((id) => urlFotoJpeg(porId.get(id)!));

  if (!fotos.length) return NextResponse.json({ message: "Fotos não encontradas." }, { status: 400 });

  try {
    const resultados = await postarVeiculo(auth.empresaId, { vehicleId: veiculo.id, legenda, fotos, redes });
    return NextResponse.json({ resultados });
  } catch (error) {
    if (error instanceof PortalError) return NextResponse.json({ message: error.message }, { status: 400 });
    console.error("Erro ao postar", error);
    return NextResponse.json({ message: "Não foi possível publicar." }, { status: 500 });
  }
}
