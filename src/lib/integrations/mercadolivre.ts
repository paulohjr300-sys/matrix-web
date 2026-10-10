import { supabaseAdmin } from "../supabase-admin";
import { decrypt, encrypt } from "../server-crypto";
import {
  getIntegracao,
  loadVehicleForListing,
  PortalError,
  saveAnuncio,
  type VehicleForListing,
} from "./core";

// Integração com o Mercado Livre (classificados de veículos, Brasil).
// Docs: developers.mercadolivre.com.br (autenticação, publicação de
// automóveis, sincronização de publicações).

const AUTH_URL = "https://auth.mercadolivre.com.br/authorization";
const API = "https://api.mercadolibre.com";

// Carros e Caminhonetes
const CATEGORY_CARS = "MLB1744";
const VEHICLE_TYPE_CARS = "398351";

// Combustível/câmbio dos cadastros da loja -> valores da categoria no ML.
const FUEL_MAP: Record<string, string> = {
  flex: "Gasolina e álcool",
  gasolina: "Gasolina",
  etanol: "Etanol",
  alcool: "Álcool",
  diesel: "Diesel",
  eletrico: "Elétrico",
  hibrido: "Híbrido",
  gnv: "Gasolina e gás natural",
};

const TRANSMISSION_MAP: Record<string, string> = {
  manual: "Manual",
  automatico: "Automática",
  cvt: "Automática CVT",
  automatizado: "Semiautomática",
};

function key(value: string | null) {
  return (value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

export function mercadoLivreConfig() {
  const clientId = process.env.ML_CLIENT_ID;
  const clientSecret = process.env.ML_CLIENT_SECRET;
  const redirectUri = process.env.ML_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) return null;

  return { clientId, clientSecret, redirectUri };
}

function requireConfig() {
  const config = mercadoLivreConfig();

  if (!config) {
    throw new PortalError("Integração com o Mercado Livre ainda não configurada na plataforma.");
  }

  return config;
}

export function authorizationUrl(state: string, codeChallenge: string) {
  const { clientId, redirectUri } = requireConfig();
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  return `${AUTH_URL}?${params.toString()}`;
}

type TokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user_id: number;
};

async function tokenRequest(body: Record<string, string>) {
  const response = await fetch(`${API}/oauth/token`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(body).toString(),
    cache: "no-store",
  });

  const data = await response.json().catch(() => null);

  if (!response.ok || !data?.access_token) {
    throw new PortalError(data?.message || "O Mercado Livre recusou a autorização.");
  }

  return data as TokenResponse;
}

export async function exchangeCode(code: string, codeVerifier: string) {
  const { clientId, clientSecret, redirectUri } = requireConfig();

  return tokenRequest({
    grant_type: "authorization_code",
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
  });
}

export async function saveConnection(empresaId: string, tokens: TokenResponse) {
  const me = await mlFetch(tokens.access_token, "/users/me");

  await supabaseAdmin.from("integracoes").upsert(
    {
      empresa_id: empresaId,
      portal: "mercadolivre",
      status: "conectado",
      conta_externa_id: String(tokens.user_id),
      conta_nome: me?.nickname || me?.first_name || null,
      access_token_enc: encrypt(tokens.access_token),
      refresh_token_enc: encrypt(tokens.refresh_token),
      token_expira_em: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      ultimo_erro: null,
      conectado_em: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "empresa_id,portal" },
  );
}

// Token válido da loja. O refresh_token do ML é de uso único: a gravação
// só vale se ninguém trocou o token no meio do caminho (outra requisição
// renovando ao mesmo tempo); se trocou, usa o que ela salvou.
async function accessToken(empresaId: string): Promise<string> {
  const integracao = await getIntegracao(empresaId, "mercadolivre");

  if (!integracao || integracao.status === "desconectado" || !integracao.refresh_token_enc) {
    throw new PortalError("Conecte a conta do Mercado Livre em Configurações > Integrações.");
  }

  const expiresAt = integracao.token_expira_em ? new Date(integracao.token_expira_em).getTime() : 0;

  if (integracao.access_token_enc && expiresAt - Date.now() > 5 * 60 * 1000) {
    return decrypt(integracao.access_token_enc);
  }

  const { clientId, clientSecret } = requireConfig();
  let tokens: TokenResponse;

  try {
    tokens = await tokenRequest({
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: decrypt(integracao.refresh_token_enc),
    });
  } catch (error) {
    const latest = await getIntegracao(empresaId, "mercadolivre");

    if (latest && latest.refresh_token_enc !== integracao.refresh_token_enc && latest.access_token_enc) {
      return decrypt(latest.access_token_enc);
    }

    await supabaseAdmin
      .from("integracoes")
      .update({
        status: "erro",
        ultimo_erro: "A autorização expirou. Conecte a conta do Mercado Livre novamente.",
        updated_at: new Date().toISOString(),
      })
      .eq("id", integracao.id);

    throw error instanceof PortalError
      ? new PortalError("A autorização do Mercado Livre expirou. Conecte a conta novamente.")
      : error;
  }

  const { data: updated } = await supabaseAdmin
    .from("integracoes")
    .update({
      status: "conectado",
      access_token_enc: encrypt(tokens.access_token),
      refresh_token_enc: encrypt(tokens.refresh_token),
      token_expira_em: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      ultimo_erro: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", integracao.id)
    .eq("refresh_token_enc", integracao.refresh_token_enc)
    .select("id");

  if (!updated?.length) {
    const latest = await getIntegracao(empresaId, "mercadolivre");
    if (latest?.access_token_enc) return decrypt(latest.access_token_enc);
  }

  return tokens.access_token;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function mlFetch(token: string, path: string, init: RequestInit = {}): Promise<any> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
    cache: "no-store",
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    // O ML detalha os problemas de validação em "cause".
    const causes = Array.isArray(data?.cause)
      ? data.cause
          .filter((cause: { type?: string }) => cause.type !== "warning")
          .map((cause: { message?: string }) => cause.message)
          .filter(Boolean)
      : [];

    throw new PortalError(
      [data?.message || `Erro ${response.status} no Mercado Livre`, ...causes].join(" — "),
    );
  }

  return data;
}

type Empresa = {
  nome: string;
  whatsapp: string | null;
  telefone: string | null;
  email: string | null;
  endereco: string | null;
  cep: string | null;
};

async function loadEmpresa(empresaId: string) {
  const { data } = await supabaseAdmin
    .from("empresas")
    .select("nome, whatsapp, telefone, email, endereco, cep")
    .eq("id", empresaId)
    .single();

  return data as Empresa;
}

// Problemas que impedem a publicação, em linguagem do lojista.
export function missingForMercadoLivre(vehicle: VehicleForListing, empresa: Empresa) {
  const missing: string[] = [];

  if (!vehicle.brand) missing.push("marca");
  if (!vehicle.model) missing.push("modelo");
  if (!vehicle.model_year) missing.push("ano modelo");
  if (vehicle.km === null || vehicle.km === undefined) missing.push("quilometragem");
  if (!vehicle.doors) missing.push("número de portas");
  if (!vehicle.fuel || !FUEL_MAP[key(vehicle.fuel)]) missing.push("combustível");
  if (!vehicle.advertised_price) missing.push("valor anunciado");
  if (vehicle.pictures.length === 0) missing.push("ao menos uma foto");
  if ((empresa.whatsapp || "").replace(/\D/g, "").length < 12) {
    missing.push("WhatsApp da loja (Configurações > Identidade do site)");
  }

  return missing;
}

function buildAttributes(vehicle: VehicleForListing) {
  const attributes = [
    { id: "BRAND", value_name: vehicle.brand },
    { id: "MODEL", value_name: vehicle.model },
    { id: "VEHICLE_YEAR", value_name: String(vehicle.model_year) },
    { id: "TRIM", value_name: vehicle.versao || vehicle.model },
    { id: "KILOMETERS", value_name: `${vehicle.km ?? 0} km` },
    { id: "FUEL_TYPE", value_name: FUEL_MAP[key(vehicle.fuel)] },
    { id: "DOORS", value_name: String(vehicle.doors) },
    { id: "VEHICLE_TYPE", value_id: VEHICLE_TYPE_CARS },
    { id: "LICENSE_PLATE", value_name: vehicle.plate },
  ];

  const transmission = TRANSMISSION_MAP[key(vehicle.transmission)];
  if (transmission) attributes.push({ id: "TRANSMISSION", value_name: transmission });
  if (vehicle.color) attributes.push({ id: "COLOR", value_name: vehicle.color });

  return attributes;
}

function buildSellerContact(empresa: Empresa) {
  const whatsapp = (empresa.whatsapp || "").replace(/\D/g, "");
  const phone = (empresa.telefone || "").replace(/\D/g, "");

  return {
    contact: empresa.nome,
    other_info: "",
    country_code: phone ? "55" : "",
    area_code: phone.slice(0, 2),
    phone: phone.slice(2),
    // WhatsApp: obrigatório para concessionárias desde 01/10/2026.
    country_code2: whatsapp.slice(0, 2),
    area_code2: "",
    phone2: whatsapp.slice(2),
    email: empresa.email || "",
    webpage: "",
  };
}

function buildTitle(vehicle: VehicleForListing) {
  return [vehicle.brand, vehicle.model, vehicle.versao, vehicle.model_year]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .slice(0, 60)
    .trim();
}

function buildItem(vehicle: VehicleForListing, empresa: Empresa) {
  const cep = (empresa.cep || "").replace(/\D/g, "");

  return {
    title: buildTitle(vehicle),
    category_id: CATEGORY_CARS,
    price: Number(vehicle.advertised_price),
    currency_id: "BRL",
    available_quantity: 1,
    buying_mode: "classified",
    listing_type_id: "silver",
    condition: "used",
    pictures: vehicle.pictures.slice(0, 30).map((source) => ({ source })),
    seller_contact: buildSellerContact(empresa),
    // Sem CEP, o ML usa o endereço cadastrado na conta do vendedor.
    ...(cep.length === 8
      ? { location: { address_line: empresa.endereco || "", zip_code: cep } }
      : {}),
    attributes: buildAttributes(vehicle),
  };
}

type Action = "publicar" | "atualizar" | "pausar" | "reativar" | "encerrar";

// Executa uma ação no anúncio do veículo e registra o resultado.
export async function runMercadoLivre(empresaId: string, vehicleId: string, action: Action) {
  const vehicle = await loadVehicleForListing(empresaId, vehicleId);
  if (!vehicle) throw new PortalError("Veículo não encontrado.");

  const { data: anuncio } = await supabaseAdmin
    .from("anuncios_portal")
    .select("external_id, status")
    .eq("vehicle_id", vehicleId)
    .eq("portal", "mercadolivre")
    .maybeSingle();

  const empresa = await loadEmpresa(empresaId);

  try {
    const token = await accessToken(empresaId);

    if (action === "publicar") {
      if (anuncio?.external_id && anuncio.status !== "encerrado") {
        throw new PortalError("Este veículo já tem um anúncio no Mercado Livre.");
      }

      const missing = missingForMercadoLivre(vehicle, empresa);
      if (missing.length) {
        throw new PortalError(`Complete antes de publicar: ${missing.join(", ")}.`);
      }

      const item = await mlFetch(token, "/items", {
        method: "POST",
        body: JSON.stringify(buildItem(vehicle, empresa)),
      });

      if (vehicle.description?.trim()) {
        await mlFetch(token, `/items/${item.id}/description`, {
          method: "POST",
          body: JSON.stringify({ plain_text: vehicle.description.trim() }),
        }).catch(() => null);
      }

      await saveAnuncio(empresaId, vehicleId, "mercadolivre", {
        status: "publicado",
        external_id: item.id,
        external_url: item.permalink || null,
      });

      return;
    }

    if (!anuncio?.external_id) {
      throw new PortalError("Este veículo ainda não foi publicado no Mercado Livre.");
    }

    if (action === "atualizar") {
      const item = buildItem(vehicle, empresa);

      await mlFetch(token, `/items/${anuncio.external_id}`, {
        method: "PUT",
        body: JSON.stringify({
          title: item.title,
          price: item.price,
          pictures: item.pictures,
          seller_contact: item.seller_contact,
          attributes: item.attributes,
        }),
      });

      await saveAnuncio(empresaId, vehicleId, "mercadolivre", {
        status: anuncio.status === "pausado" ? "pausado" : "publicado",
      });

      return;
    }

    const mlStatus = { pausar: "paused", reativar: "active", encerrar: "closed" }[action];

    await mlFetch(token, `/items/${anuncio.external_id}`, {
      method: "PUT",
      body: JSON.stringify({ status: mlStatus }),
    });

    await saveAnuncio(empresaId, vehicleId, "mercadolivre", {
      status: action === "pausar" ? "pausado" : action === "reativar" ? "publicado" : "encerrado",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro no Mercado Livre.";

    // Publicação que falhou fica registrada para o lojista ver o motivo.
    await saveAnuncio(empresaId, vehicleId, "mercadolivre", {
      status: anuncio?.status && anuncio.status !== "erro" ? (anuncio.status as never) : "erro",
      ultimo_erro: message,
    });

    throw error;
  }
}

// Depois de salvar o veículo: vendido encerra, reservado pausa e o resto
// atualiza preço, fotos e dados. Anúncio pausado pelo lojista continua
// pausado.
export async function syncMercadoLivre(empresaId: string, vehicleId: string) {
  const { data: anuncio } = await supabaseAdmin
    .from("anuncios_portal")
    .select("status")
    .eq("vehicle_id", vehicleId)
    .eq("portal", "mercadolivre")
    .maybeSingle();

  if (!anuncio || !["publicado", "pausado"].includes(anuncio.status)) return;

  const { data: vehicle } = await supabaseAdmin
    .from("vehicles")
    .select("status")
    .eq("id", vehicleId)
    .single();

  if (vehicle?.status === "VENDIDO") return runMercadoLivre(empresaId, vehicleId, "encerrar");
  if (vehicle?.status === "RESERVADO" && anuncio.status === "publicado") {
    return runMercadoLivre(empresaId, vehicleId, "pausar");
  }

  return runMercadoLivre(empresaId, vehicleId, "atualizar");
}
