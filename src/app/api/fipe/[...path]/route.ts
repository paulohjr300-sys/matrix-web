import { NextResponse } from "next/server";
import { requireRole } from "../../../../lib/auth-server";

// Proxy da tabela FIPE (API Parallelum v2) com cache no servidor: as listas
// mudam pouco e a API gratuita tem limite diário de consultas.
const FIPE_API = "https://fipe.parallelum.com.br/api/v2";
const VEHICLE_TYPES = new Set(["cars", "motorcycles", "trucks"]);
const CODE = /^[0-9]{1,6}$/;
const YEAR_CODE = /^[0-9]{4,5}-[0-9]$/;

const DAY = 24 * 60 * 60;

// Só os caminhos usados pelo cadastro de veículo:
//   <tipo>/brands
//   <tipo>/brands/<marca>/models
//   <tipo>/brands/<marca>/models/<modelo>/years
//   <tipo>/brands/<marca>/models/<modelo>/years/<ano>
function validPath(parts: string[]) {
  const [type, brands, brand, models, model, years, year] = parts;

  if (!VEHICLE_TYPES.has(type) || brands !== "brands") return false;
  if (parts.length === 2) return true;
  if (!CODE.test(brand) || models !== "models") return false;
  if (parts.length === 4) return true;
  if (!CODE.test(model) || years !== "years") return false;
  if (parts.length === 6) return true;

  return parts.length === 7 && YEAR_CODE.test(year);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const auth = await requireRole(["ADMIN", "GERENTE", "VENDEDOR"]);

  if (!auth.ok) {
    return auth.response;
  }

  const { path } = await params;

  if (!validPath(path)) {
    return NextResponse.json({ message: "Consulta inválida." }, { status: 400 });
  }

  const headers: HeadersInit = {};

  if (process.env.FIPE_API_TOKEN) {
    headers["X-Subscription-Token"] = process.env.FIPE_API_TOKEN;
  }

  // Preço muda todo mês; listas de marcas/modelos/anos quase nunca.
  const revalidate = path.length === 7 ? DAY : 7 * DAY;

  try {
    const response = await fetch(`${FIPE_API}/${path.join("/")}`, {
      headers,
      next: { revalidate },
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const message =
        response.status === 429
          ? "Limite de consultas à FIPE atingido. Tente novamente mais tarde."
          : data?.error || "Não foi possível consultar a FIPE.";

      return NextResponse.json({ message }, { status: response.status === 429 ? 429 : 502 });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ message: "A FIPE não respondeu. Tente novamente." }, { status: 502 });
  }
}
