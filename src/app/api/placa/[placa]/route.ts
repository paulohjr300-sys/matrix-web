import { NextResponse } from "next/server";
import { requireRole } from "../../../../lib/auth-server";
import { consultarPlaca, PlacaError } from "../../../../lib/placa";

export const maxDuration = 30;

// Dados do veículo pela placa, para preencher o cadastro.
export async function GET(_request: Request, { params }: { params: Promise<{ placa: string }> }) {
  const auth = await requireRole(["ADMIN", "GERENTE", "VENDEDOR"]);

  if (!auth.ok) {
    return auth.response;
  }

  const { placa } = await params;

  try {
    return NextResponse.json(await consultarPlaca(placa, auth.empresaId));
  } catch (error) {
    if (error instanceof PlacaError) {
      return NextResponse.json({ message: error.message }, { status: error.status >= 500 ? 502 : 400 });
    }

    console.error("Erro na consulta por placa", error);
    return NextResponse.json({ message: "Não foi possível consultar a placa." }, { status: 500 });
  }
}
