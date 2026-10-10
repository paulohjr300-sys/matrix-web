import { NextResponse } from "next/server";
import { requireRole } from "../../../../../lib/auth-server";
import { PortalError } from "../../../../../lib/integrations/core";
import { olxBalance } from "../../../../../lib/integrations/olx";

// Plano profissional da conta OLX: nome, anúncios usados e disponíveis.
export async function GET() {
  const auth = await requireRole(["ADMIN"]);

  if (!auth.ok) {
    return auth.response;
  }

  try {
    return NextResponse.json(await olxBalance(auth.empresaId));
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof PortalError ? error.message : "Não foi possível consultar o plano da OLX." },
      { status: 400 },
    );
  }
}
