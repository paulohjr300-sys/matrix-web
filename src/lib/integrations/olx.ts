import { randomBytes } from "crypto";
import { supabaseAdmin } from "../supabase-admin";
import { decrypt, encrypt } from "../server-crypto";
import {
  getIntegracao,
  loadVehicleForListing,
  PortalError,
  type AnuncioStatus,
  type VehicleForListing,
} from "./core";

// Integração com a OLX (categoria Autos > Carros, vans e utilitários).
// Docs: developers.olx.com.br (oauth, autoupload/import, car_info,
// autoupload/balance, autoservice/v1/lead).

const AUTH_URL = "https://auth.olx.com.br/oauth";
const TOKEN_URL = "https://auth.olx.com.br/oauth/token";
const APPS = "https://apps.olx.com.br";
const SCOPES = "basic_user_info autoupload autoservice";
const CATEGORY_CARS = 2020;

// ---------------------------------------------------------------------
// Configuração
// ---------------------------------------------------------------------

export function olxConfigProblem() {
  const missing: string[] = [];

  if (!process.env.OLX_CLIENT_ID) missing.push("OLX_CLIENT_ID");
  if (!process.env.OLX_CLIENT_SECRET) missing.push("OLX_CLIENT_SECRET");
  if (!process.env.OLX_REDIRECT_URI) missing.push("OLX_REDIRECT_URI");
  if ((process.env.INTEGRATIONS_SECRET || "").length < 32) {
    missing.push("INTEGRATIONS_SECRET (mínimo de 32 caracteres)");
  }

  if (missing.length) {
    return `Configuração incompleta na Vercel: ${missing.join(", ")}. As chaves são enviadas pela OLX depois do registro do aplicativo.`;
  }

  if (!process.env.OLX_REDIRECT_URI!.endsWith("/api/integracoes/olx/callback")) {
    return "OLX_REDIRECT_URI deve ser https://SEU-PAINEL/api/integracoes/olx/callback.";
  }

  return null;
}

function config() {
  const problem = olxConfigProblem();
  if (problem) throw new PortalError(problem);

  return {
    clientId: process.env.OLX_CLIENT_ID!,
    clientSecret: process.env.OLX_CLIENT_SECRET!,
    redirectUri: process.env.OLX_REDIRECT_URI!,
  };
}

// Endereço público do painel, usado para a OLX entregar os leads.
function appUrl() {
  return new URL(config().redirectUri).origin;
}

// ---------------------------------------------------------------------
// Autenticação (token da OLX não expira e não tem renovação)
// ---------------------------------------------------------------------

export function olxAuthorizationUrl(state: string) {
  const { clientId, redirectUri } = config();
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: SCOPES,
    state,
  });

  return `${AUTH_URL}?${params.toString()}`;
}

export async function olxExchangeCode(code: string) {
  const { clientId, clientSecret, redirectUri } = config();

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }).toString(),
    cache: "no-store",
  });

  const data = await response.json().catch(() => null);

  if (!response.ok || !data?.access_token) {
    throw new PortalError(`A OLX recusou a autorização${data?.error ? ` (${data.error})` : ""}.`);
  }

  return data.access_token as string;
}

async function olxToken(empresaId: string) {
  const integracao = await getIntegracao(empresaId, "olx");

  if (!integracao?.access_token_enc || integracao.status === "desconectado") {
    throw new PortalError("Conecte a conta da OLX em Configurações > Integrações.");
  }

  return { token: decrypt(integracao.access_token_enc), integracao };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function olxRequest(path: string, init: RequestInit & { bearer?: string } = {}): Promise<any> {
  const { bearer, ...rest } = init;

  const response = await fetch(`${APPS}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "painel/1.0",
      ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
      ...rest.headers,
    },
    cache: "no-store",
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 401) {
      throw new PortalError("A OLX não aceitou o acesso da conta. Conecte a conta da OLX novamente.", 401);
    }
    if (response.status === 429) {
      throw new PortalError("A OLX limitou as consultas por alguns segundos. Tente de novo em instantes.", 429);
    }
    if (response.status === 410) {
      throw new PortalError("A conta da OLX não tem um plano profissional com limite de anúncios.", 410);
    }

    throw new PortalError(
      data?.message || data?.reason || `Erro ${response.status} na OLX.`,
      response.status,
    );
  }

  return data;
}

// Grava a conexão e configura o envio de leads da OLX para o painel.
export async function olxSaveConnection(empresaId: string, accessToken: string) {
  const info = await olxRequest("/oauth_api/basic_user_info", {
    method: "POST",
    body: JSON.stringify({ access_token: accessToken }),
  }).catch(() => null);

  const anterior = await getIntegracao(empresaId, "olx");
  const leadToken = (anterior?.config as { lead_token?: string } | undefined)?.lead_token ||
    randomBytes(18).toString("hex");
  const leadSecret = randomBytes(24).toString("base64url");

  const { error } = await supabaseAdmin.from("integracoes").upsert(
    {
      empresa_id: empresaId,
      portal: "olx",
      status: "conectado",
      conta_externa_id: info?.user_email || null,
      conta_nome: info?.user_name || info?.user_email || null,
      access_token_enc: encrypt(accessToken),
      refresh_token_enc: null,
      token_expira_em: null,
      ultimo_erro: null,
      conectado_em: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      config: { lead_token: leadToken, lead_secret_enc: encrypt(leadSecret) },
    },
    { onConflict: "empresa_id,portal" },
  );

  if (error) throw new PortalError(`Não foi possível salvar a conexão: ${error.message}`);

  // Leads: a OLX entrega cada lead neste endereço, com o segredo no header
  // Authorization. Se falhar (ex.: integração de leads ainda não homologada
  // pela OLX), a publicação continua funcionando.
  try {
    const lead = await olxRequest("/autoservice/v1/lead", {
      method: "POST",
      bearer: accessToken,
      body: JSON.stringify({
        url: `${appUrl()}/api/integracoes/olx/leads/${leadToken}`,
        token: leadSecret,
      }),
    });

    await supabaseAdmin
      .from("integracoes")
      .update({ config: { lead_token: leadToken, lead_secret_enc: encrypt(leadSecret), lead_config_id: lead?.id || null } })
      .eq("empresa_id", empresaId)
      .eq("portal", "olx");
  } catch (error) {
    await supabaseAdmin
      .from("integracoes")
      .update({
        ultimo_erro: `Anúncios conectados, mas o envio de leads não foi ativado: ${error instanceof Error ? error.message : "erro"}`,
      })
      .eq("empresa_id", empresaId)
      .eq("portal", "olx");
  }
}

export async function olxDisconnect(empresaId: string) {
  const integracao = await getIntegracao(empresaId, "olx");
  const leadConfigId = (integracao?.config as { lead_config_id?: string } | undefined)?.lead_config_id;

  if (integracao?.access_token_enc && leadConfigId) {
    await olxRequest(`/autoservice/v1/lead/${leadConfigId}`, {
      method: "DELETE",
      bearer: decrypt(integracao.access_token_enc),
    }).catch(() => null);
  }

  await supabaseAdmin
    .from("integracoes")
    .update({
      status: "desconectado",
      access_token_enc: null,
      updated_at: new Date().toISOString(),
    })
    .eq("empresa_id", empresaId)
    .eq("portal", "olx");
}

// ---------------------------------------------------------------------
// Plano e saldo da conta
// ---------------------------------------------------------------------

export async function olxBalance(empresaId: string) {
  const { token } = await olxToken(empresaId);
  const data = await olxRequest("/autoupload/balance", { method: "GET", bearer: token });

  return {
    plano: data?.name || "Plano profissional",
    usados: data?.ads?.performed ?? null,
    disponiveis: data?.ads?.available ?? null,
    total: data?.ads?.total ?? null,
    renovaEm: data?.next_renew_date || null,
  };
}

// ---------------------------------------------------------------------
// Catálogo de marcas, modelos e versões da OLX
// ---------------------------------------------------------------------

export type OlxOpcao = { id: string; nome: string };

export async function olxCatalog(empresaId: string, marca?: string, modelo?: string): Promise<OlxOpcao[]> {
  const { token } = await olxToken(empresaId);
  const path = ["/autoupload/car_info", marca, modelo].filter(Boolean).join("/");

  const data = await olxRequest(path, {
    method: "POST",
    body: JSON.stringify({ access_token: token }),
  });

  return Object.entries((data?.data || {}) as Record<string, number>)
    .map(([nome, id]) => ({ id: String(id), nome }))
    .sort((a, b) => a.nome.localeCompare(b.nome));
}

function normalize(value: string | null | undefined) {
  return (value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

function tokens(value: string) {
  return new Set(normalize(value).split(" ").filter((part) => part.length > 0));
}

// Escolhe a opção mais parecida pelo nome (palavras em comum).
function bestMatch(options: OlxOpcao[], ...names: (string | null | undefined)[]) {
  const alvo = tokens(names.filter(Boolean).join(" "));
  if (!alvo.size) return null;

  let melhor: { opcao: OlxOpcao; nota: number } | null = null;

  for (const opcao of options) {
    const nome = normalize(opcao.nome);
    const partes = tokens(opcao.nome);

    let nota = [...partes].filter((parte) => alvo.has(parte)).length / Math.max(partes.size, 1);
    if (names.some((name) => normalize(name) === nome)) nota += 2;

    if (!melhor || nota > melhor.nota) melhor = { opcao, nota };
  }

  return melhor && melhor.nota > 0 ? melhor.opcao : null;
}

// Sugere marca, modelo e versão da OLX a partir dos dados do veículo.
export async function olxSuggestCatalog(empresaId: string, vehicleId: string) {
  const vehicle = await loadVehicleForListing(empresaId, vehicleId);
  if (!vehicle) throw new PortalError("Veículo não encontrado.");

  const marcas = await olxCatalog(empresaId);
  const marca = bestMatch(marcas, vehicle.brand);
  if (!marca) return { marca: null, modelo: null, versao: null };

  const modelos = await olxCatalog(empresaId, marca.id);
  const modelo = bestMatch(modelos, vehicle.model);
  if (!modelo) return { marca, modelo: null, versao: null };

  const versoes = await olxCatalog(empresaId, marca.id, modelo.id);
  const versao = bestMatch(versoes, vehicle.model, vehicle.versao);

  return { marca, modelo, versao };
}

// ---------------------------------------------------------------------
// Anúncio
// ---------------------------------------------------------------------

type OlxDados = {
  adId?: string;
  importToken?: string;
  marcaId?: string;
  modeloId?: string;
  versaoId?: string;
  versaoNome?: string;
  listId?: string;
};

const GEARBOX: Record<string, string> = { manual: "1", automatico: "2", cvt: "2", automatizado: "4" };
const FUEL: Record<string, string> = {
  gasolina: "1",
  etanol: "2",
  alcool: "2",
  flex: "3",
  diesel: "5",
  hibrido: "6",
  eletrico: "7",
};
const COLOR: Record<string, string> = {
  preto: "1",
  branco: "2",
  prata: "3",
  vermelho: "4",
  cinza: "5",
  azul: "6",
  amarelo: "7",
  verde: "8",
  laranja: "9",
};
// OLX: 1 = 2 portas, 2 = 4 portas, 3 = 3 portas. 5 portas conta como 4.
const DOORS: Record<number, string> = { 2: "1", 3: "3", 4: "2", 5: "2" };

function key(value: string | null) {
  return (value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

// Id do anúncio na OLX: até 19 caracteres [A-Za-z0-9_-].
function adIdFor(vehicleId: string) {
  return `p${vehicleId.replace(/-/g, "").slice(0, 18)}`;
}

type Empresa = { telefone: string | null; whatsapp: string | null; cep: string | null; nome: string };

function phoneFor(empresa: Empresa) {
  const fromWhats = (empresa.whatsapp || "").replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  const fromPhone = (empresa.telefone || "").replace(/\D/g, "").slice(0, 11);
  const phone = fromWhats.length >= 10 ? fromWhats : fromPhone;

  return phone.length >= 10 && phone.length <= 11 ? Number(phone) : null;
}

export function missingForOlx(vehicle: VehicleForListing, empresa: Empresa, dados: OlxDados) {
  const missing: string[] = [];

  if (!dados.marcaId || !dados.modeloId || !dados.versaoId) missing.push("marca, modelo e versão do catálogo da OLX");
  if (!vehicle.model_year) missing.push("ano modelo");
  if (vehicle.km === null || vehicle.km === undefined) missing.push("quilometragem");
  if (!vehicle.advertised_price) missing.push("valor anunciado");
  if (!vehicle.plate || vehicle.plate.length < 7) missing.push("placa");
  if (vehicle.pictures.length === 0) missing.push("ao menos uma foto");
  if ((empresa.cep || "").replace(/\D/g, "").length !== 8) missing.push("CEP da loja (Configurações > Identidade do site)");
  if (!phoneFor(empresa)) missing.push("telefone ou WhatsApp da loja com DDD");

  return missing;
}

export function buildAd(vehicle: VehicleForListing, empresa: Empresa, dados: OlxDados) {
  const params: Record<string, unknown> = {
    vehicle_brand: dados.marcaId,
    vehicle_model: dados.modeloId,
    vehicle_version: dados.versaoId,
    regdate: String(vehicle.model_year),
    mileage: Number(vehicle.km ?? 0),
    vehicle_tag: vehicle.plate.toUpperCase().replace(/[^A-Z0-9]/g, ""),
  };

  // Parâmetros opcionais só entram com valor válido (vazio faz a OLX recusar).
  const gearbox = GEARBOX[key(vehicle.transmission)];
  if (gearbox) params.gearbox = gearbox;
  const fuel = FUEL[key(vehicle.fuel)];
  if (fuel) params.fuel = fuel;
  const doors = vehicle.doors ? DOORS[vehicle.doors] : undefined;
  if (doors) params.doors = doors;
  if (vehicle.color) params.carcolor = COLOR[key(vehicle.color)] || "10";

  const body =
    vehicle.description?.trim() ||
    [vehicle.brand, vehicle.model, vehicle.versao, vehicle.model_year].filter(Boolean).join(" ") +
      `. Fale com a ${empresa.nome}.`;

  return {
    id: dados.adId!,
    operation: "insert",
    category: CATEGORY_CARS,
    body: body.slice(0, 6000),
    phone: phoneFor(empresa),
    type: "s",
    price: Math.round(Number(vehicle.advertised_price)),
    zipcode: (empresa.cep || "").replace(/\D/g, ""),
    params,
    images: [...new Set(vehicle.pictures)].slice(0, 20),
  };
}

const IMPORT_ERRORS: Record<string, string> = {
  NO_IMAGE: "anúncio sem fotos",
  NO_REGION: "CEP da loja inválido",
  ERROR_VEHICLE_TAG_INVALID: "placa não enviada ou inválida",
  INVALID_PLATE: "placa não encontrada no catálogo da OLX",
  ERROR_VEHICLE_BRAND_INVALID: "marca inválida no catálogo da OLX",
  ERROR_VEHICLE_MODEL_INVALID: "modelo inválido no catálogo da OLX",
  ERROR_VEHICLE_VERSION_INVALID: "versão inválida no catálogo da OLX",
  ERROR_VEHICLE_BRAND_MODEL_VERSION_INVALID: "marca, modelo e versão não batem com o catálogo da OLX",
  ERROR_FUEL_4_DEPRECATED: "combustível não aceito pela OLX",
  NOT_ENOUGH_AD_SLOTS: "o plano da OLX não tem saldo de anúncios",
  ERROR_IMAGE_TOO_SMALL: "foto pequena demais",
  ERROR_DOWNLOADING_IMAGE: "a OLX não conseguiu baixar uma das fotos",
  REFUSED_SUSPECT_DUPLICATES: "anúncio recusado por parecer duplicado",
  REFUSED_SUSPECT_AUTOS: "anúncio recusado pela moderação da OLX",
  REFUSED_GENERIC: "anúncio recusado pela OLX",
};

function explain(codes: unknown) {
  const list = (Array.isArray(codes) ? codes : [codes])
    .map((item) =>
      typeof item === "string" ? item : (item as { category?: string; error?: string })?.category ||
        (item as { error?: string })?.error,
    )
    .filter(Boolean) as string[];

  return list.map((code) => IMPORT_ERRORS[code] || code).join(", ");
}

async function importAds(token: string, adList: unknown[]) {
  const result = await olxRequest("/autoupload/import", {
    method: "PUT",
    body: JSON.stringify({ access_token: token, ad_list: adList }),
  });

  if (result?.statusCode === 0) return result.token as string;

  if (result?.statusCode === -6) {
    throw new PortalError(
      "A conta da OLX não tem um plano para empresas que permita integração (Essencial, Plus ou Premium Empresa). Os planos para autônomos não aceitam integração.",
    );
  }

  if (result?.statusCode === -7 || result?.statusCode === -8) {
    throw new PortalError(`O plano da OLX não tem saldo de anúncios suficiente. (${result.statusMessage})`);
  }

  if (result?.statusCode === -4) {
    const detalhes = (result.errors || [])
      .map((erro: { messages?: unknown }) => explain(erro.messages))
      .filter(Boolean)
      .join("; ");
    throw new PortalError(`A OLX recusou o anúncio: ${detalhes || result.statusMessage}.`);
  }

  throw new PortalError(result?.statusMessage || "A OLX não aceitou o envio.");
}

async function loadEmpresa(empresaId: string) {
  const { data } = await supabaseAdmin
    .from("empresas")
    .select("nome, telefone, whatsapp, cep")
    .eq("id", empresaId)
    .single();

  return data as Empresa;
}

async function loadAnuncio(vehicleId: string) {
  const { data } = await supabaseAdmin
    .from("anuncios_portal")
    .select("external_id, external_url, status, dados")
    .eq("vehicle_id", vehicleId)
    .eq("portal", "olx")
    .maybeSingle();

  return data as {
    external_id: string | null;
    external_url: string | null;
    status: AnuncioStatus;
    dados: OlxDados;
  } | null;
}

async function saveOlx(
  empresaId: string,
  vehicleId: string,
  changes: {
    status: AnuncioStatus;
    dados: OlxDados;
    external_id?: string | null;
    external_url?: string | null;
    ultimo_erro?: string | null;
  },
) {
  await supabaseAdmin.from("anuncios_portal").upsert(
    {
      empresa_id: empresaId,
      vehicle_id: vehicleId,
      portal: "olx",
      ultimo_erro: null,
      sincronizado_em: new Date().toISOString(),
      ...changes,
    },
    { onConflict: "vehicle_id,portal" },
  );
}

export type OlxAction = "publicar" | "atualizar" | "encerrar" | "verificar";

export async function runOlx(
  empresaId: string,
  vehicleId: string,
  action: OlxAction,
  catalogo?: { marcaId: string; modeloId: string; versaoId: string; versaoNome?: string },
) {
  const vehicle = await loadVehicleForListing(empresaId, vehicleId);
  if (!vehicle) throw new PortalError("Veículo não encontrado.");

  const anuncio = await loadAnuncio(vehicleId);
  const dados: OlxDados = { ...(anuncio?.dados || {}), adId: anuncio?.dados?.adId || adIdFor(vehicleId) };
  if (catalogo) Object.assign(dados, catalogo);

  try {
    const { token } = await olxToken(empresaId);

    if (action === "verificar") {
      await checkImport(empresaId, vehicleId, token, anuncio, dados);
      return;
    }

    if (action === "encerrar") {
      if (!anuncio || anuncio.status === "encerrado") {
        throw new PortalError("Este veículo não tem anúncio ativo na OLX.");
      }

      const importToken = await importAds(token, [{ id: dados.adId, operation: "delete" }]);
      await saveOlx(empresaId, vehicleId, { status: "encerrado", dados: { ...dados, importToken } });
      return;
    }

    // publicar e atualizar usam a mesma operação ("insert" insere ou edita).
    const empresa = await loadEmpresa(empresaId);
    const missing = missingForOlx(vehicle, empresa, dados);

    if (missing.length) {
      throw new PortalError(`Complete antes de enviar para a OLX: ${missing.join(", ")}.`);
    }

    if (action === "atualizar" && (!anuncio || anuncio.status === "encerrado")) {
      throw new PortalError("Este veículo ainda não foi publicado na OLX.");
    }

    const importToken = await importAds(token, [buildAd(vehicle, empresa, dados)]);

    await saveOlx(empresaId, vehicleId, {
      // A OLX processa em fila: até a confirmação, o anúncio fica pendente.
      status: action === "atualizar" && anuncio?.status === "publicado" ? "publicado" : "pendente",
      dados: { ...dados, importToken },
      external_id: anuncio?.external_id ?? null,
      external_url: anuncio?.external_url ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro na OLX.";

    await saveOlx(empresaId, vehicleId, {
      status: anuncio?.status && anuncio.status !== "erro" ? anuncio.status : "erro",
      dados,
      external_id: anuncio?.external_id ?? null,
      external_url: anuncio?.external_url ?? null,
      ultimo_erro: message,
    });

    throw error;
  }
}

// Consulta o resultado da última importação (a OLX processa em fila).
async function checkImport(
  empresaId: string,
  vehicleId: string,
  token: string,
  anuncio: Awaited<ReturnType<typeof loadAnuncio>>,
  dados: OlxDados,
) {
  if (!dados.importToken) {
    throw new PortalError("Não há envio para a OLX aguardando confirmação.");
  }

  const result = await olxRequest(`/autoupload/import/${dados.importToken}`, {
    method: "POST",
    body: JSON.stringify({ access_token: token }),
  });

  const ad = result?.ads?.[dados.adId!];
  if (!ad || ad.status === "pending" || ad.status === "queued") return;

  if (ad.status === "accepted") {
    const encerrado = ad.operation === "delete";

    await saveOlx(empresaId, vehicleId, {
      status: encerrado ? "encerrado" : "publicado",
      dados: { ...dados, listId: ad.list_id || dados.listId },
      external_id: ad.list_id || anuncio?.external_id || null,
      external_url: ad.url || anuncio?.external_url || null,
    });
    return;
  }

  await saveOlx(empresaId, vehicleId, {
    status: "erro",
    dados,
    external_id: anuncio?.external_id ?? null,
    external_url: anuncio?.external_url ?? null,
    ultimo_erro: `A OLX não publicou: ${explain(ad.message) || ad.status}.`,
  });
}

// Depois de salvar o veículo: vendido sai da OLX; os demais atualizam.
// A OLX não tem "pausar": reservado continua no ar.
export async function syncOlx(empresaId: string, vehicleId: string) {
  const anuncio = await loadAnuncio(vehicleId);
  if (!anuncio || !["publicado", "pendente"].includes(anuncio.status)) return;

  const { data: vehicle } = await supabaseAdmin.from("vehicles").select("status").eq("id", vehicleId).single();

  const acao = acaoSincronizacaoOlx(anuncio.status, vehicle?.status);
  if (acao) return runOlx(empresaId, vehicleId, acao);
}

// O que fazer com o anúncio da OLX depois de uma mudança no veículo (sem
// banco; testada em olx.test.ts). Vendido encerra (mesmo ainda na fila);
// na fila confere o resultado; publicado atualiza.
export function acaoSincronizacaoOlx(
  anuncioStatus: string | null | undefined,
  vehicleStatus: string | null | undefined,
) {
  if (!anuncioStatus || !["publicado", "pendente"].includes(anuncioStatus)) return null;
  if (vehicleStatus === "VENDIDO") return "encerrar" as const;
  if (anuncioStatus === "pendente") return "verificar" as const;
  return "atualizar" as const;
}

// ---------------------------------------------------------------------
// Leads recebidos da OLX
// ---------------------------------------------------------------------

export async function olxIntegrationByLeadToken(leadToken: string) {
  const { data } = await supabaseAdmin
    .from("integracoes")
    .select("empresa_id, config, status")
    .eq("portal", "olx")
    .eq("config->>lead_token", leadToken)
    .maybeSingle();

  return data as { empresa_id: string; config: { lead_secret_enc?: string }; status: string } | null;
}

export function olxLeadSecretMatches(config: { lead_secret_enc?: string }, header: string | null) {
  if (!config.lead_secret_enc || !header) return false;

  const secret = decrypt(config.lead_secret_enc);
  return header === secret || header === `Bearer ${secret}`;
}
