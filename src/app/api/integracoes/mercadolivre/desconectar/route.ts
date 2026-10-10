import { NextResponse } from "next/server";
import { requireRole } from "../../../../../lib/auth-server";
import { supabaseAdmin } from "../../../../../lib/supabase-admin";

// Apaga os tokens da loja. Os anúncios já publicados continuam no
// Mercado Livre e podem ser gerenciados por lá.
export async function POST() {
  const auth = await requireRole(["ADMIN"]);

  if (!auth.ok) {
    return auth.response;
  }

  const { error } = await supabaseAdmin
    .from("integracoes")
    .update({
      status: "desconectado",
      access_token_enc: null,
      refresh_token_enc: null,
      token_expira_em: null,
      updated_at: new Date().toISOString(),
    })
    .eq("empresa_id", auth.empresaId)
    .eq("portal", "mercadolivre");

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
