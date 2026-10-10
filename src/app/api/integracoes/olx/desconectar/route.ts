import { NextResponse } from "next/server";
import { requireRole } from "../../../../../lib/auth-server";
import { olxDisconnect } from "../../../../../lib/integrations/olx";

// Apaga o acesso da loja e desliga o envio de leads da OLX. Os anúncios já
// publicados continuam na OLX e podem ser gerenciados por lá.
export async function POST() {
  const auth = await requireRole(["ADMIN"]);

  if (!auth.ok) {
    return auth.response;
  }

  try {
    await olxDisconnect(auth.empresaId);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Não foi possível desconectar." },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
