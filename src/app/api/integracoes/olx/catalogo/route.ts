import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "../../../../../lib/auth-server";
import { PortalError } from "../../../../../lib/integrations/core";
import { olxCatalog, olxSuggestCatalog } from "../../../../../lib/integrations/olx";

export const maxDuration = 30;

// Catálogo da OLX para escolher marca/modelo/versão do veículo.
//   ?marca=ID&modelo=ID   lista marcas, modelos ou versões
//   ?sugerir=VEHICLE_ID   sugere a combinação mais parecida com o veículo
export async function GET(request: NextRequest) {
  const auth = await requireRole(["ADMIN", "GERENTE", "VENDEDOR"]);

  if (!auth.ok) {
    return auth.response;
  }

  const params = request.nextUrl.searchParams;
  const id = /^[0-9]{1,6}$/;

  try {
    const sugerir = params.get("sugerir");

    if (sugerir) {
      return NextResponse.json(await olxSuggestCatalog(auth.empresaId, sugerir));
    }

    const marca = params.get("marca") || undefined;
    const modelo = params.get("modelo") || undefined;

    if ((marca && !id.test(marca)) || (modelo && !id.test(modelo)) || (modelo && !marca)) {
      return NextResponse.json({ message: "Consulta inválida." }, { status: 400 });
    }

    return NextResponse.json({ opcoes: await olxCatalog(auth.empresaId, marca, modelo) });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof PortalError ? error.message : "Não foi possível consultar a OLX." },
      { status: 400 },
    );
  }
}
