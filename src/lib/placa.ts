import { supabaseAdmin } from "./supabase-admin";

// Consulta de veículo pela placa (API Placas — apiplacas.com.br, endpoint
// wdapi2.com.br/consulta/<placa>/<token>). Devolve os dados do veículo e
// os códigos FIPE; o preço é atualizado pela API FIPE (Parallelum) para o
// mês de referência atual.

export class PlacaError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

const PLACA = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/;
const CACHE_DIAS = 30;
const FIPE_API = "https://fipe.parallelum.com.br/api/v2";

export function normalizarPlaca(valor: string) {
  return valor.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function placaConfigurada() {
  return Boolean(process.env.PLACA_API_TOKEN);
}

type RespostaApi = {
  MARCA?: string;
  MODELO?: string;
  ano?: string;
  anoModelo?: string;
  cor?: string;
  situacao?: string;
  municipio?: string;
  uf?: string;
  extra?: { combustivel?: string; ano_fabricacao?: string; ano_modelo?: string; quantidade_passageiro?: string };
  fipe?: {
    dados?: {
      ano_modelo?: string;
      codigo_fipe?: string;
      codigo_marca?: number | string;
      codigo_modelo?: number | string;
      combustivel?: string;
      sigla_combustivel?: string;
      score?: number;
      texto_marca?: string;
      texto_modelo?: string;
      texto_valor?: string;
      mes_referencia?: string;
    }[];
  };
};

export type ResultadoPlaca = {
  placa: string;
  marca: string | null;
  modelo: string | null;
  anoFabricacao: number | null;
  anoModelo: number | null;
  cor: string | null;
  combustivel: string | null;
  situacao: string | null;
  municipio: string | null;
  uf: string | null;
  fipe: {
    tipo: "cars";
    marcaCodigo: string;
    modeloCodigo: string;
    anoCodigo: string | null;
    codigoFipe: string | null;
    marcaFipe: string;
    modeloFipe: string;
    combustivelFipe: string | null;
    preco: number | null;
    referencia: string | null;
  } | null;
  doCache: boolean;
};

function numero(valor: unknown) {
  const n = Number(String(valor ?? "").replace(/\D/g, "").slice(0, 4));
  return n >= 1900 && n <= 2100 ? n : null;
}

function precoDeTexto(valor: string | undefined) {
  if (!valor) return null;
  return Number(valor.replace(/[^\d,]/g, "").replace(",", ".")) || null;
}

async function fipeJson(path: string) {
  const headers: HeadersInit = {};
  if (process.env.FIPE_API_TOKEN) headers["X-Subscription-Token"] = process.env.FIPE_API_TOKEN;

  const response = await fetch(`${FIPE_API}/${path}`, { headers, next: { revalidate: 24 * 60 * 60 } });
  if (!response.ok) return null;
  return response.json().catch(() => null);
}

// Código do ano na FIPE ("2013-1"): o sufixo é o combustível
// (1 gasolina, 2 álcool, 3 diesel, 5 flex).
async function resolverAno(marca: string, modelo: string, anoModelo: number | null, sigla?: string) {
  if (!anoModelo) return null;

  const anos = (await fipeJson(`cars/brands/${marca}/models/${modelo}/years`)) as { code: string }[] | null;
  const doAno = (anos || []).filter((ano) => ano.code.startsWith(`${anoModelo}-`));
  if (!doAno.length) return null;

  // Ordem de preferência do sufixo conforme o combustível informado pela
  // placa; carros flex costumam vir como gasolina ("G") e ter código "-5".
  const preferencia = sigla === "D" ? ["3"] : sigla === "A" ? ["2", "5"] : ["1", "5"];

  for (const sufixo of preferencia) {
    const ano = doAno.find((item) => item.code.endsWith(`-${sufixo}`));
    if (ano) return ano.code;
  }

  return doAno[0].code;
}

export async function montarResultado(placa: string, dados: RespostaApi, doCache: boolean): Promise<ResultadoPlaca> {
  const melhor = [...(dados.fipe?.dados || [])].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0];
  const anoModelo = numero(dados.extra?.ano_modelo || dados.anoModelo);

  let fipe: ResultadoPlaca["fipe"] = null;

  if (melhor?.codigo_marca && melhor.codigo_modelo && melhor.texto_marca && melhor.texto_modelo) {
    const marcaCodigo = String(melhor.codigo_marca);
    const modeloCodigo = String(melhor.codigo_modelo);
    const anoCodigo = await resolverAno(marcaCodigo, modeloCodigo, numero(melhor.ano_modelo) || anoModelo, melhor.sigla_combustivel);

    // Preço do mês atual (o da API de placas pode ser antigo).
    const atual = anoCodigo
      ? ((await fipeJson(`cars/brands/${marcaCodigo}/models/${modeloCodigo}/years/${anoCodigo}`)) as {
          price?: string;
          referenceMonth?: string;
          codeFipe?: string;
          fuel?: string;
        } | null)
      : null;

    fipe = {
      tipo: "cars",
      marcaCodigo,
      modeloCodigo,
      anoCodigo,
      codigoFipe: atual?.codeFipe || melhor.codigo_fipe || null,
      marcaFipe: melhor.texto_marca,
      modeloFipe: melhor.texto_modelo,
      combustivelFipe: atual?.fuel || melhor.combustivel || null,
      preco: precoDeTexto(atual?.price) ?? precoDeTexto(melhor.texto_valor),
      referencia: (atual?.referenceMonth || melhor.mes_referencia || "").trim() || null,
    };
  }

  return {
    placa,
    marca: dados.MARCA || null,
    modelo: dados.MODELO || null,
    anoFabricacao: numero(dados.extra?.ano_fabricacao || dados.ano),
    anoModelo,
    cor: dados.cor || null,
    combustivel: dados.extra?.combustivel || null,
    situacao: dados.situacao || null,
    municipio: dados.municipio || null,
    uf: dados.uf || null,
    fipe,
    doCache,
  };
}

export async function consultarPlaca(placaInformada: string, empresaId: string): Promise<ResultadoPlaca> {
  const token = process.env.PLACA_API_TOKEN;
  if (!token) throw new PlacaError("A consulta por placa ainda não foi configurada na plataforma.", 503);

  const placa = normalizarPlaca(placaInformada);
  if (!PLACA.test(placa)) throw new PlacaError("Placa inválida. Use o formato ABC1D23 ou ABC1234.");

  // Cache: a mesma placa consultada nos últimos 30 dias (qualquer loja).
  const desde = new Date(Date.now() - CACHE_DIAS * 24 * 60 * 60 * 1000).toISOString();
  const { data: anterior } = await supabaseAdmin
    .from("consultas_placa")
    .select("resposta")
    .eq("placa", placa)
    .eq("cache", false)
    .not("resposta", "is", null)
    .gte("created_at", desde)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (anterior?.resposta) {
    await supabaseAdmin.from("consultas_placa").insert({ empresa_id: empresaId, placa, cache: true });
    return montarResultado(placa, anterior.resposta as RespostaApi, true);
  }

  // Limite diário por loja (só consultas que consomem crédito).
  const limite = Number(process.env.PLACA_LIMITE_DIARIO || 30);
  const inicioDoDia = new Date();
  inicioDoDia.setHours(0, 0, 0, 0);

  const { count } = await supabaseAdmin
    .from("consultas_placa")
    .select("id", { count: "exact", head: true })
    .eq("empresa_id", empresaId)
    .eq("cache", false)
    .gte("created_at", inicioDoDia.toISOString());

  if ((count ?? 0) >= limite) {
    throw new PlacaError(`A loja atingiu o limite de ${limite} consultas por placa hoje. Use a busca na tabela FIPE.`, 429);
  }

  let response: Response;

  try {
    response = await fetch(`https://wdapi2.com.br/consulta/${placa}/${token}`, { cache: "no-store" });
  } catch {
    throw new PlacaError("O serviço de consulta por placa não respondeu. Tente de novo.", 502);
  }

  const dados = (await response.json().catch(() => null)) as (RespostaApi & { message?: string }) | null;

  if (!response.ok || !dados) {
    const mensagens: Record<number, string> = {
      401: "Placa inválida.",
      402: "O serviço de consulta por placa está com o acesso inválido. Avise o suporte da plataforma.",
      406: "Nenhum veículo encontrado para esta placa.",
      429: "As consultas por placa da plataforma acabaram por hoje. Use a busca na tabela FIPE.",
    };

    throw new PlacaError(mensagens[response.status] || dados?.message || "Não foi possível consultar a placa.", response.status);
  }

  await supabaseAdmin.from("consultas_placa").insert({ empresa_id: empresaId, placa, cache: false, resposta: dados });

  return montarResultado(placa, dados, false);
}
