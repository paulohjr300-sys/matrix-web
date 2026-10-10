import { NextResponse } from "next/server";
import { requireRole } from "../../../../../lib/auth-server";
import { getIntegracao, PortalError } from "../../../../../lib/integrations/core";
import {
  accessToken,
  availableListingTypes,
  mlFetch,
} from "../../../../../lib/integrations/mercadolivre";

const CATEGORY_CARS = "MLB1744";

type Pack = {
  id?: string;
  promotion_pack_id?: string;
  description?: string;
  price?: number;
  duration?: number;
  status?: string;
  charge_type_id?: string;
  package_content?: string;
  date_expires?: string | null;
  remaining_listings?: number;
  used_listings?: number;
  listing_details?: { listing_type_id?: string; available_listings?: number; remaining_listings?: number }[];
};

// Pacotes de anúncio de veículos: os que o ML oferece para a conta
// conectada e os que ela já tem (com cotas restantes).
export async function GET() {
  const auth = await requireRole(["ADMIN"]);

  if (!auth.ok) {
    return auth.response;
  }

  const integracao = await getIntegracao(auth.empresaId, "mercadolivre");

  if (!integracao?.conta_externa_id || integracao.status === "desconectado") {
    return NextResponse.json({ message: "Conecte a conta do Mercado Livre primeiro." }, { status: 400 });
  }

  try {
    const token = await accessToken(auth.empresaId);

    const [disponiveis, contratados, tipos] = await Promise.all([
      mlFetch(token, `/categories/${CATEGORY_CARS}/classifieds_promotion_packs`).catch(() => []),
      mlFetch(
        token,
        `/users/${integracao.conta_externa_id}/classifieds_promotion_packs?package_content=ALL`,
      ).catch(() => []),
      availableListingTypes(token, integracao.conta_externa_id).catch(() => []),
    ]);

    const resumo = (pack: Pack) => ({
      id: pack.promotion_pack_id || pack.id || "",
      descricao: pack.description || "Pacote",
      preco: typeof pack.price === "number" ? pack.price : null,
      duracaoDias: pack.duration ?? null,
      tipo: pack.package_content === "highlights" ? "destaque" : "publicação",
      gratuito: pack.charge_type_id === "free" || pack.price === 0,
      status: pack.status || null,
      expiraEm: pack.date_expires || null,
      restantes:
        pack.remaining_listings ??
        pack.listing_details?.reduce((soma, item) => soma + (item.remaining_listings ?? 0), 0) ??
        null,
    });

    return NextResponse.json({
      disponiveis: (Array.isArray(disponiveis) ? disponiveis : []).map(resumo),
      contratados: (Array.isArray(contratados) ? contratados : []).map(resumo),
      // Tipos de anúncio que a conta pode usar agora em carros.
      tiposDisponiveis: tipos,
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof PortalError ? error.message : "Não foi possível consultar os pacotes." },
      { status: 400 },
    );
  }
}
