import { supabaseAdmin } from "../../../../lib/supabase-admin";
import { lojaGeo } from "../../../../lib/geo";

// Catálogo de veículos da loja no formato da Meta (Facebook/Instagram,
// Commerce Manager > Catálogo de veículos > Fonte de dados > URL).
// Público como o site: só veículos publicados e em estoque (view
// site_vehicles), sem placa, chassi ou valores internos.
// Campos: developers.facebook.com/documentation/ads-commerce/marketing-api/auto-ads/reference

export const maxDuration = 60;

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://matrix-site-peach.vercel.app").replace(/\/$/, "");

const BODY_STYLE: Record<string, string> = {
  hatch: "HATCHBACK",
  sedan: "SEDAN",
  seda: "SEDAN",
  suv: "SUV",
  picape: "TRUCK",
  pickup: "TRUCK",
  minivan: "MINIVAN",
  utilitario: "VAN",
  van: "VAN",
  esportivo: "COUPE",
  coupe: "COUPE",
  conversivel: "CONVERTIBLE",
  perua: "WAGON",
  crossover: "CROSSOVER",
};

const FUEL: Record<string, string> = {
  flex: "FLEX",
  gasolina: "GASOLINE",
  diesel: "DIESEL",
  eletrico: "ELECTRIC",
  hibrido: "HYBRID",
};

function key(value: string | null | undefined) {
  return (value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

function transmission(value: string | null) {
  const k = key(value);
  if (!k) return "";
  return k === "manual" ? "Manual" : "Automatic";
}

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// Descrição sem links e sem tudo em maiúsculas (regras da Meta).
function cleanDescription(text: string) {
  const semLinks = text.replace(/https?:\/\/\S+/g, "").replace(/\s+/g, " ").trim();
  return semLinks === semLinks.toUpperCase() && /[A-Z]/.test(semLinks)
    ? semLinks.charAt(0) + semLinks.slice(1).toLowerCase()
    : semLinks;
}

type Veiculo = {
  id: string;
  slug: string | null;
  km: number | null;
  model_year: number | null;
  advertised_price: number | null;
  description: string | null;
  notes: string | null;
  brand_name: string | null;
  model_name: string | null;
  fuel_name: string | null;
  transmission_name: string | null;
  color_name: string | null;
  category_name: string | null;
  versao: string | null;
  main_image_url: string | null;
  created_at: string | null;
};

// Dois formatos no mesmo endereço:
//   (padrão)            catálogo de Veículos da Meta (exige localização da loja)
//   ?formato=produtos   catálogo de Produtos (e-commerce), disponível em
//                       qualquer conta da Meta
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const produtos = new URL(request.url).searchParams.get("formato") === "produtos";
  // Robô da Meta que baixa o catálogo: a leitura fica registrada na loja
  // para o painel mostrar que a integração está funcionando.
  const leituraDaMeta = /facebookexternalhit|facebookcatalog|facebot|meta-external/i.test(
    request.headers.get("user-agent") || "",
  );

  if (!/^[a-z0-9-]{3,40}$/.test(slug)) {
    return new Response("Loja não encontrada.", { status: 404 });
  }

  const { data: empresa } = await supabaseAdmin
    .from("empresas")
    .select("id, slug, nome, dominio, telefone, whatsapp, endereco, cep, latitude, longitude, geo_cep, ativo, site_suspenso")
    .eq("slug", slug)
    .maybeSingle();

  if (!empresa?.ativo) {
    return new Response("Loja não encontrada.", { status: 404 });
  }

  const geo = produtos ? null : await lojaGeo(empresa);

  if (!produtos && !geo) {
    return new Response(
      "Cadastre o CEP da loja em Configurações > Identidade do site para gerar o catálogo.",
      { status: 409 },
    );
  }

  const { data: veiculos } = await supabaseAdmin
    .from("site_vehicles")
    .select(
      "id, slug, km, model_year, advertised_price, description, notes, brand_name, model_name, fuel_name, transmission_name, color_name, category_name, versao, main_image_url, created_at",
    )
    .eq("empresa_id", empresa.id)
    .order("created_at", { ascending: false })
    .limit(2000);

  // Veículos que o lojista tirou do catálogo (continuam no site).
  const { data: removidos } = await supabaseAdmin
    .from("vehicles")
    .select("id")
    .eq("empresa_id", empresa.id)
    .eq("catalogo_meta", false);

  const foraDoCatalogo = new Set((removidos || []).map((item) => item.id));
  // Loja com o site suspenso por falta de pagamento: catálogo vazio.
  const lista = empresa.site_suspenso
    ? []
    : ((veiculos || []) as Veiculo[]).filter((v) => !foraDoCatalogo.has(v.id));

  const { data: imagens } = lista.length
    ? await supabaseAdmin
        .from("site_vehicle_images")
        .select("vehicle_id, url")
        .eq("empresa_id", empresa.id)
        .in("vehicle_id", lista.map((v) => v.id))
        .order("created_at")
    : { data: [] };

  const fotosPorVeiculo = new Map<string, string[]>();
  for (const imagem of (imagens || []) as { vehicle_id: string; url: string }[]) {
    fotosPorVeiculo.set(imagem.vehicle_id, [...(fotosPorVeiculo.get(imagem.vehicle_id) || []), imagem.url]);
  }

  const siteBase = empresa.dominio ? `https://${empresa.dominio}` : `${SITE_URL}/loja/${empresa.slug}`;
  const telefone = (empresa.whatsapp || empresa.telefone || "").replace(/\D/g, "");
  const dealerPhone = telefone ? `+${telefone.length <= 11 ? `55${telefone}` : telefone}` : "";

  const comFotos = lista
    // Sem foto, preço, marca, modelo ou ano a Meta recusa o item.
    .filter((v) => v.brand_name && v.model_name && v.model_year && v.advertised_price)
    .map((v) => ({
      v,
      fotos: [...new Set([v.main_image_url, ...(fotosPorVeiculo.get(v.id) || [])].filter(Boolean))] as string[],
      titulo: [v.brand_name, v.model_name, v.versao, v.model_year].filter(Boolean).join(" "),
    }))
    .filter((item) => item.fotos.length > 0);

  const descricaoDe = (item: (typeof comFotos)[number]) =>
    cleanDescription(
      item.v.description ||
        item.v.notes ||
        `${item.titulo}. Veículo disponível na ${empresa.nome}. Entre em contato para mais informações.`,
    );

  if (produtos) {
    // Campos do catálogo de produtos: id, title, description, availability,
    // condition, price, link, image_link, brand (+ fotos extras e tipo).
    const cabecalho = [
      "id",
      "title",
      "description",
      "availability",
      "condition",
      "price",
      "link",
      "image_link",
      "additional_image_link",
      "brand",
      "product_type",
    ];

    const linhasProdutos = comFotos.map((item) => {
      const km = Math.max(0, Math.round(Number(item.v.km || 0)));
      const kmTexto = km ? ` · ${km.toLocaleString("pt-BR")} km` : "";

      return [
        item.v.id,
        `${item.titulo}${kmTexto}`.slice(0, 200),
        descricaoDe(item).slice(0, 9999),
        "in stock",
        km === 0 ? "new" : "used",
        `${Math.round(Number(item.v.advertised_price))} BRL`,
        `${siteBase}/estoque/${item.v.slug || item.v.id}`,
        item.fotos[0],
        item.fotos.slice(1, 20).join(","),
        item.v.brand_name,
        `Veículos > ${item.v.category_name || "Carros"}`,
      ]
        .map(csvCell)
        .join(",");
    });

    if (leituraDaMeta) await registrarLeitura(empresa.id, linhasProdutos.length, "produtos");

    return new Response([cabecalho.join(","), ...linhasProdutos].join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `inline; filename="produtos-${empresa.slug}.csv"`,
        // Sem cache: cada leitura da Meta passa pelo servidor e é registrada.
        "Cache-Control": "no-store",
      },
    });
  }

  const MAX_FOTOS = 10;
  const header = [
    "vehicle_id",
    "title",
    "description",
    "url",
    "make",
    "model",
    "year",
    "trim",
    "mileage.value",
    "mileage.unit",
    "price",
    "state_of_vehicle",
    "body_style",
    "exterior_color",
    "transmission",
    "fuel_type",
    "availability",
    "vehicle_type",
    "dealer_name",
    "dealer_phone",
    "address.addr1",
    "address.city",
    "address.region",
    "address.country",
    "address.postal_code",
    "latitude",
    "longitude",
    ...Array.from({ length: MAX_FOTOS }, (_, i) => `image[${i}].url`),
  ];

  const linhas = lista
    // Sem foto, preço, marca, modelo ou ano a Meta recusa o item.
    .filter((v) => v.brand_name && v.model_name && v.model_year && v.advertised_price)
    .map((v) => {
      const fotos = [...new Set([v.main_image_url, ...(fotosPorVeiculo.get(v.id) || [])].filter(Boolean))] as string[];
      if (!fotos.length) return null;

      const titulo = [v.brand_name, v.model_name, v.versao, v.model_year].filter(Boolean).join(" ");
      const descricao = cleanDescription(
        v.description || v.notes || `${titulo}. Veículo disponível na ${empresa.nome}. Entre em contato para mais informações.`,
      );
      const km = Math.max(0, Math.round(Number(v.km || 0)));

      const valores = [
        v.id,
        titulo.slice(0, 500),
        descricao.slice(0, 5000),
        `${siteBase}/estoque/${v.slug || v.id}`,
        v.brand_name,
        v.model_name,
        v.model_year,
        (v.versao || "").slice(0, 50),
        km,
        "KM",
        `${Math.round(Number(v.advertised_price))} BRL`,
        km === 0 ? "New" : "Used",
        BODY_STYLE[key(v.category_name)] || "OTHER",
        v.color_name || "Outra",
        transmission(v.transmission_name),
        FUEL[key(v.fuel_name)] || (v.fuel_name ? "OTHER" : ""),
        "available",
        "car_truck",
        empresa.nome,
        dealerPhone,
        empresa.endereco || geo!.logradouro || "",
        geo!.cidade,
        geo!.uf,
        "BR",
        geo!.cep,
        geo!.latitude ?? "",
        geo!.longitude ?? "",
        ...Array.from({ length: MAX_FOTOS }, (_, i) => fotos[i] || ""),
      ];

      return valores.map(csvCell).join(",");
    })
    .filter(Boolean);

  const csv = [header.join(","), ...linhas].join("\n");

  if (leituraDaMeta) await registrarLeitura(empresa.id, linhas.length, "veiculos");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `inline; filename="catalogo-${empresa.slug}.csv"`,
      // Sem cache: cada leitura da Meta passa pelo servidor e é registrada.
      "Cache-Control": "no-store",
    },
  });
}

async function registrarLeitura(empresaId: string, itens: number, formato: string) {
  await supabaseAdmin
    .from("empresas")
    .update({
      catalogo_meta_lido_em: new Date().toISOString(),
      catalogo_meta_itens: itens,
      catalogo_meta_formato: formato,
    })
    .eq("id", empresaId);
}
