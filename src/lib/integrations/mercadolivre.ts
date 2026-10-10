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

// O que falta configurar na Vercel (null quando está tudo certo). Mostrado
// na tela de Integrações para não falhar só na hora de conectar.
export function mercadoLivreConfigProblem() {
  const missing: string[] = [];

  if (!process.env.ML_CLIENT_ID) missing.push("ML_CLIENT_ID");
  if (!process.env.ML_CLIENT_SECRET) missing.push("ML_CLIENT_SECRET");
  if (!process.env.ML_REDIRECT_URI) missing.push("ML_REDIRECT_URI");
  if ((process.env.INTEGRATIONS_SECRET || "").length < 32) {
    missing.push("INTEGRATIONS_SECRET (mínimo de 32 caracteres)");
  }

  if (missing.length) {
    return `Configuração incompleta na Vercel: ${missing.join(", ")}.`;
  }

  const redirect = process.env.ML_REDIRECT_URI!;

  if (!redirect.startsWith("https://") || !redirect.endsWith("/api/integracoes/mercadolivre/callback")) {
    return "ML_REDIRECT_URI deve ser https://SEU-PAINEL/api/integracoes/mercadolivre/callback.";
  }

  return null;
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
    throw new PortalError(
      [data?.message, data?.error_description || data?.error].filter(Boolean).join(" — ") ||
        "O Mercado Livre recusou a autorização.",
    );
  }

  // Sem o escopo offline_access o ML não envia o refresh_token, e a conexão
  // cairia em 6 horas.
  if (!data.refresh_token) {
    throw new PortalError(
      "O Mercado Livre não enviou a renovação de acesso. No aplicativo do DevCenter, ative a permissão \"offline_access\" (acesso offline) e conecte de novo.",
    );
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

  const { error } = await supabaseAdmin.from("integracoes").upsert(
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

  if (error) {
    throw new PortalError(`Não foi possível salvar a conexão: ${error.message}`);
  }
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
  if ((empresa.cep || "").replace(/\D/g, "").length !== 8) {
    missing.push("CEP da loja (Configurações > Identidade do site)");
  }
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

type Location = {
  address_line: string;
  zip_code: string;
  neighborhood: { name: string };
  city: { name: string };
  state: { id: string; name: string };
  country: { id: string; name: string };
};

// O ML exige a localização até o nível da cidade. Ela vem do CEP da loja
// pelo ViaCEP (consulta pública de CEP).
async function resolveLocation(empresa: Empresa): Promise<Location> {
  const cep = (empresa.cep || "").replace(/\D/g, "");

  if (cep.length !== 8) {
    throw new PortalError("Cadastre o CEP da loja em Configurações > Identidade do site.");
  }

  let data: {
    erro?: unknown;
    logradouro?: string;
    bairro?: string;
    localidade?: string;
    uf?: string;
    estado?: string;
  } | null = null;

  try {
    const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
      next: { revalidate: 7 * 24 * 60 * 60 },
    });
    data = await response.json();
  } catch {
    throw new PortalError("Não foi possível consultar o CEP da loja agora. Tente novamente em instantes.");
  }

  if (!data || data.erro || !data.localidade || !data.uf) {
    throw new PortalError(
      `O CEP ${cep.replace(/^(\d{5})(\d{3})$/, "$1-$2")} não foi encontrado. Confira o CEP da loja em Configurações > Identidade do site.`,
    );
  }

  return {
    address_line: empresa.endereco || data.logradouro || data.localidade,
    zip_code: cep,
    neighborhood: { name: data.bairro || "" },
    city: { name: data.localidade },
    state: { id: `BR-${data.uf}`, name: data.estado || data.uf },
    country: { id: "BR", name: "Brasil" },
  };
}

function buildItem(vehicle: VehicleForListing, empresa: Empresa, location: Location) {
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
    location,
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

      const location = await resolveLocation(empresa);

      const item = await mlFetch(token, "/items", {
        method: "POST",
        body: JSON.stringify(buildItem(vehicle, empresa, location)),
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
      const item = buildItem(vehicle, empresa, await resolveLocation(empresa));

      await mlFetch(token, `/items/${anuncio.external_id}`, {
        method: "PUT",
        body: JSON.stringify({
          title: item.title,
          price: item.price,
          pictures: item.pictures,
          seller_contact: item.seller_contact,
          location: item.location,
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
