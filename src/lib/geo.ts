import { supabaseAdmin } from "./supabase-admin";

// Endereço e coordenadas da loja a partir do CEP. Usado pelo catálogo da
// Meta, que exige cidade, estado e latitude/longitude.

export type LojaGeo = {
  cidade: string;
  uf: string;
  bairro: string | null;
  logradouro: string | null;
  cep: string;
  latitude: number | null;
  longitude: number | null;
};

const UA = "painel/1.0 (gestao de revendas)";

async function getJson(url: string) {
  const response = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    next: { revalidate: 30 * 24 * 60 * 60 },
  });

  if (!response.ok) return null;
  return response.json().catch(() => null);
}

// BrasilAPI (CEP v2) traz coordenadas para muitos CEPs; quando não traz,
// o OpenStreetMap (Nominatim) resolve pelo CEP ou pela cidade.
async function lookup(cep: string): Promise<LojaGeo | null> {
  const brasil = await getJson(`https://brasilapi.com.br/api/cep/v2/${cep}`).catch(() => null);
  const via = brasil ? null : await getJson(`https://viacep.com.br/ws/${cep}/json/`).catch(() => null);

  const cidade = brasil?.city || via?.localidade;
  const uf = brasil?.state || via?.uf;
  if (!cidade || !uf) return null;

  let latitude = Number(brasil?.location?.coordinates?.latitude) || null;
  let longitude = Number(brasil?.location?.coordinates?.longitude) || null;

  if (!latitude || !longitude) {
    const porCep = await getJson(
      `https://nominatim.openstreetmap.org/search?postalcode=${cep.replace(/^(\d{5})(\d{3})$/, "$1-$2")}&country=Brazil&format=json&limit=1`,
    ).catch(() => null);
    const porCidade = porCep?.[0]
      ? null
      : await getJson(
          `https://nominatim.openstreetmap.org/search?city=${encodeURIComponent(cidade)}&state=${uf}&country=Brazil&format=json&limit=1`,
        ).catch(() => null);
    const lugar = porCep?.[0] || porCidade?.[0];

    latitude = Number(lugar?.lat) || null;
    longitude = Number(lugar?.lon) || null;
  }

  return {
    cidade,
    uf,
    bairro: brasil?.neighborhood || via?.bairro || null,
    logradouro: brasil?.street || via?.logradouro || null,
    cep,
    latitude,
    longitude,
  };
}

export async function lojaGeo(empresa: {
  id: string;
  cep: string | null;
  latitude: number | null;
  longitude: number | null;
  geo_cep: string | null;
}): Promise<LojaGeo | null> {
  const cep = (empresa.cep || "").replace(/\D/g, "");
  if (cep.length !== 8) return null;

  const geo = await lookup(cep);
  if (!geo) return null;

  // Coordenadas já calculadas para este CEP: reaproveita.
  if (empresa.geo_cep === cep && empresa.latitude && empresa.longitude) {
    return { ...geo, latitude: Number(empresa.latitude), longitude: Number(empresa.longitude) };
  }

  if (geo.latitude && geo.longitude) {
    await supabaseAdmin
      .from("empresas")
      .update({ latitude: geo.latitude, longitude: geo.longitude, geo_cep: cep })
      .eq("id", empresa.id);
  }

  return geo;
}
