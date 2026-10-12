import { NextResponse } from "next/server";
import { requireRole } from "../../../../../lib/auth-server";
import { supabaseAdmin } from "../../../../../lib/supabase-admin";
import { postsDoVeiculo } from "../../../../../lib/integrations/meta-posts";

// Posts do veículo publicados pelo painel (Instagram/Facebook).
export async function GET(request: Request) {
  const auth = await requireRole(["ADMIN", "GERENTE", "VENDEDOR"]);
  if (!auth.ok) return auth.response;

  const params = new URL(request.url).searchParams;

  // ?pendentes=1: posts de carros vendidos que a loja precisa editar pelo
  // app (Instagram), para a tela de Vendas.
  if (params.has("pendentes")) {
    const { data } = await supabaseAdmin
      .from("posts_redes")
      .select("id, rede, url, created_at, vehicle_id, vendido_erro")
      .eq("empresa_id", auth.empresaId)
      .not("vendido_erro", "is", null)
      .is("vendido_em", null)
      .order("created_at", { ascending: false })
      .limit(50);

    return NextResponse.json({ posts: data || [] });
  }

  const vehicleId = params.get("vehicleId") || "";
  if (!vehicleId) return NextResponse.json({ message: "Veículo inválido." }, { status: 400 });

  return NextResponse.json({ posts: await postsDoVeiculo(auth.empresaId, vehicleId) });
}

// O lojista editou o post pelo app e escreveu "VENDIDO" (o Instagram não
// deixa editar a legenda pela API).
export async function PATCH(request: Request) {
  const auth = await requireRole(["ADMIN", "GERENTE", "VENDEDOR"]);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  if (typeof body.id !== "string") return NextResponse.json({ message: "Post inválido." }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("posts_redes")
    .update({ vendido_em: new Date().toISOString() })
    .eq("id", body.id)
    .eq("empresa_id", auth.empresaId);

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
