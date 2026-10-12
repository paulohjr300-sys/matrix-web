import { supabaseAdmin } from "../supabase-admin";
import { decrypt, encrypt, signState } from "../server-crypto";
import { PortalError } from "./core";

// Postagem no Instagram e no Facebook pela API da Meta (Graph API).
// A loja conecta pelo Login do Facebook, escolhe a página (e o Instagram
// profissional ligado a ela) e o painel publica com o token da página.
// Docs: developers.facebook.com/docs/instagram-platform/content-publishing
// e developers.facebook.com/docs/pages-api/posts.

const VERSAO = process.env.META_GRAPH_VERSION || "v26.0";
const GRAPH = `https://graph.facebook.com/${VERSAO}`;

const ESCOPOS = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
  "instagram_basic",
  "instagram_content_publish",
  "business_management",
];

export type PaginaMeta = {
  id: string;
  nome: string;
  instagram: { id: string; username: string | null } | null;
};

export type ConfigMeta = {
  paginas?: PaginaMeta[];
  paginaId?: string | null;
};

export function metaConfigProblem() {
  const faltando: string[] = [];

  if (!process.env.META_APP_ID) faltando.push("META_APP_ID");
  if (!process.env.META_APP_SECRET) faltando.push("META_APP_SECRET");
  if (!process.env.META_REDIRECT_URI) faltando.push("META_REDIRECT_URI");
  if ((process.env.INTEGRATIONS_SECRET || "").length < 32) {
    faltando.push("INTEGRATIONS_SECRET (mínimo de 32 caracteres)");
  }

  if (faltando.length) return `Configuração incompleta na Vercel: ${faltando.join(", ")}.`;

  const redirect = process.env.META_REDIRECT_URI!;
  if (!redirect.startsWith("https://") || !redirect.endsWith("/api/integracoes/meta/callback")) {
    return "META_REDIRECT_URI deve ser https://SEU-PAINEL/api/integracoes/meta/callback.";
  }

  return null;
}

export function metaAuthorizationUrl(state: string) {
  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID!,
    redirect_uri: process.env.META_REDIRECT_URI!,
    state,
    scope: ESCOPOS.join(","),
    response_type: "code",
    // Pede de novo o que foi recusado antes (ex.: página desmarcada).
    auth_type: "rerequest",
  });

  return `https://www.facebook.com/${VERSAO}/dialog/oauth?${params}`;
}

type GraphErro = { error?: { message?: string; error_user_msg?: string; code?: number; error_subcode?: number } };

async function graph<T>(
  path: string,
  init: { method?: "GET" | "POST" | "DELETE"; params?: Record<string, string> } = {},
): Promise<T> {
  const params = new URLSearchParams(init.params || {});
  const method = init.method || "GET";
  const url = method === "GET" || method === "DELETE" ? `${GRAPH}${path}?${params}` : `${GRAPH}${path}`;

  let response: Response;

  try {
    response = await fetch(url, {
      method,
      body: method === "POST" ? params : undefined,
      cache: "no-store",
    });
  } catch {
    throw new PortalError("A Meta não respondeu. Tente de novo em instantes.", 502);
  }

  const data = (await response.json().catch(() => null)) as (T & GraphErro) | null;

  if (!response.ok || !data || data.error) {
    const erro = data?.error;
    console.error("Erro da Graph API", response.status, path, JSON.stringify(erro));

    // 190: token inválido/expirado (senha trocada, acesso removido...).
    if (erro?.code === 190) {
      throw new PortalError("A conexão com o Facebook expirou. Conecte de novo em Configurações > Integrações.", 401);
    }

    // 10 / 200: permissão negada.
    if (erro?.code === 10 || erro?.code === 200) {
      throw new PortalError(
        "A Meta negou a permissão para publicar. Conecte de novo e autorize todas as permissões pedidas.",
        403,
      );
    }

    throw new PortalError(erro?.error_user_msg || erro?.message || "A Meta recusou a operação.", 400);
  }

  return data;
}

export async function trocarCodigo(code: string) {
  const curto = await graph<{ access_token: string }>("/oauth/access_token", {
    params: {
      client_id: process.env.META_APP_ID!,
      client_secret: process.env.META_APP_SECRET!,
      redirect_uri: process.env.META_REDIRECT_URI!,
      code,
    },
  });

  // Token de usuário de longa duração (~60 dias). Os tokens de página
  // obtidos com ele não expiram.
  const longo = await graph<{ access_token: string; expires_in?: number }>("/oauth/access_token", {
    params: {
      grant_type: "fb_exchange_token",
      client_id: process.env.META_APP_ID!,
      client_secret: process.env.META_APP_SECRET!,
      fb_exchange_token: curto.access_token,
    },
  });

  return longo;
}

type PaginaApi = {
  id: string;
  name: string;
  access_token: string;
  instagram_business_account?: { id: string; username?: string };
};

const CAMPOS_PAGINA = "id,name,access_token,instagram_business_account{id,username}";

async function paginasDoUsuario(userToken: string) {
  const data = await graph<{ data: PaginaApi[] }>("/me/accounts", {
    params: { fields: CAMPOS_PAGINA, limit: "100", access_token: userToken },
  });

  if (data.data?.length) return data.data;

  // Páginas de um portfólio empresarial (Meta Business Suite) podem não
  // aparecer em /me/accounts: pega os ids das páginas autorizadas nas
  // permissões do token e consulta cada uma.
  const { data: token } = await graph<{
    data: { granular_scopes?: { scope: string; target_ids?: string[] }[] };
  }>("/debug_token", {
    params: {
      input_token: userToken,
      access_token: `${process.env.META_APP_ID}|${process.env.META_APP_SECRET}`,
    },
  });

  const ids = new Set<string>();
  for (const escopo of token.granular_scopes || []) {
    if (["pages_show_list", "pages_manage_posts", "pages_read_engagement"].includes(escopo.scope)) {
      for (const id of escopo.target_ids || []) ids.add(id);
    }
  }

  const paginas: PaginaApi[] = [];

  for (const id of ids) {
    const pagina = await graph<PaginaApi>(`/${id}`, {
      params: { fields: CAMPOS_PAGINA, access_token: userToken },
    }).catch((error) => {
      console.error("Erro ao ler página autorizada", id, error);
      return null;
    });

    if (pagina?.access_token) paginas.push(pagina);
  }

  return paginas;
}

function resumo(pagina: PaginaApi): PaginaMeta {
  return {
    id: pagina.id,
    nome: pagina.name,
    instagram: pagina.instagram_business_account
      ? { id: pagina.instagram_business_account.id, username: pagina.instagram_business_account.username || null }
      : null,
  };
}

// Salva a conexão. Já escolhe a página quando há uma só (ou a primeira com
// Instagram); com várias, a loja escolhe na tela de Integrações.
export async function salvarConexaoMeta(empresaId: string, userToken: string, expiraEm: number | undefined) {
  const paginas = await paginasDoUsuario(userToken);

  if (!paginas.length) {
    // Diz quais permissões a Meta concedeu, para saber se faltou marcar a
    // página ou se o app não tem as permissões de página.
    const permissoes = await graph<{ data: { permission: string; status: string }[] }>("/me/permissions", {
      params: { access_token: userToken },
    }).catch(() => ({ data: [] }));

    const concedidas = permissoes.data.filter((p) => p.status === "granted").map((p) => p.permission);
    const faltando = ESCOPOS.filter((escopo) => !concedidas.includes(escopo));

    throw new PortalError(
      `Nenhuma página do Facebook foi autorizada. ` +
        (faltando.length
          ? `A Meta não concedeu: ${faltando.join(", ")}. Confira se essas permissões estão adicionadas nos casos de uso do app e conecte de novo.`
          : "Remova o app em facebook.com > Configurações > Integrações comerciais, conecte de novo e marque a página da loja e o Instagram na lista da Meta."),
    );
  }

  const escolhida = paginas.length === 1 ? paginas[0] : paginas.find((p) => p.instagram_business_account) || null;

  const { error } = await supabaseAdmin.from("integracoes").upsert(
    {
      empresa_id: empresaId,
      portal: "meta",
      status: "conectado",
      conta_externa_id: escolhida?.id || null,
      conta_nome: escolhida?.name || null,
      access_token_enc: escolhida ? encrypt(escolhida.access_token) : null,
      refresh_token_enc: encrypt(userToken),
      token_expira_em: expiraEm ? new Date(Date.now() + expiraEm * 1000).toISOString() : null,
      ultimo_erro: null,
      config: { paginas: paginas.map(resumo), paginaId: escolhida?.id || null } satisfies ConfigMeta,
      conectado_em: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "empresa_id,portal" },
  );

  if (error) throw new PortalError(`Não foi possível salvar a conexão: ${error.message}`);
}

async function conexao(empresaId: string) {
  const { data } = await supabaseAdmin
    .from("integracoes")
    .select("status, conta_nome, access_token_enc, refresh_token_enc, config, ultimo_erro")
    .eq("empresa_id", empresaId)
    .eq("portal", "meta")
    .maybeSingle();

  return data as {
    status: string;
    conta_nome: string | null;
    access_token_enc: string | null;
    refresh_token_enc: string | null;
    config: ConfigMeta | null;
    ultimo_erro: string | null;
  } | null;
}

// Situação para a tela (sem tokens).
export async function situacaoMeta(empresaId: string) {
  const dados = await conexao(empresaId);
  if (!dados || dados.status === "desconectado") return null;

  const paginas = dados.config?.paginas || [];
  const pagina = paginas.find((p) => p.id === dados.config?.paginaId) || null;

  return {
    status: dados.status,
    paginas,
    pagina,
    ultimoErro: dados.ultimo_erro,
  };
}

export async function escolherPagina(empresaId: string, paginaId: string) {
  const dados = await conexao(empresaId);

  if (!dados?.refresh_token_enc || dados.status === "desconectado") {
    throw new PortalError("Conecte o Facebook antes de escolher a página.");
  }

  const paginas = await paginasDoUsuario(decrypt(dados.refresh_token_enc));
  const pagina = paginas.find((p) => p.id === paginaId);
  if (!pagina) throw new PortalError("Página não encontrada. Conecte de novo e autorize a página na Meta.");

  const { error } = await supabaseAdmin
    .from("integracoes")
    .update({
      conta_externa_id: pagina.id,
      conta_nome: pagina.name,
      access_token_enc: encrypt(pagina.access_token),
      config: { paginas: paginas.map(resumo), paginaId: pagina.id } satisfies ConfigMeta,
      status: "conectado",
      ultimo_erro: null,
      updated_at: new Date().toISOString(),
    })
    .eq("empresa_id", empresaId)
    .eq("portal", "meta");

  if (error) throw new PortalError(`Não foi possível salvar a página: ${error.message}`);
}

// Endereço público e temporário da foto em JPEG (o Instagram só aceita
// JPEG; as fotos do painel são WebP). A Meta baixa a imagem por ele.
export function urlFotoJpeg(filePath: string) {
  const base = new URL(process.env.META_REDIRECT_URI!).origin;
  return `${base}/api/integracoes/meta/foto?t=${encodeURIComponent(signState({ p: filePath }, 3600))}`;
}

async function esperarContainer(id: string, token: string) {
  for (let tentativa = 0; tentativa < 10; tentativa++) {
    const { status_code } = await graph<{ status_code?: string }>(`/${id}`, {
      params: { fields: "status_code", access_token: token },
    });

    if (status_code === "FINISHED") return;
    if (status_code === "ERROR" || status_code === "EXPIRED") {
      throw new PortalError("O Instagram não conseguiu processar as fotos. Tente com outras fotos.");
    }

    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  throw new PortalError("O Instagram demorou para processar as fotos. Tente de novo em instantes.", 502);
}

async function postarInstagram(igId: string, token: string, fotos: string[], legenda: string) {
  let containerId: string;

  if (fotos.length === 1) {
    const item = await graph<{ id: string }>(`/${igId}/media`, {
      method: "POST",
      params: { image_url: fotos[0], caption: legenda, access_token: token },
    });
    containerId = item.id;
  } else {
    const filhos: string[] = [];

    for (const foto of fotos) {
      const item = await graph<{ id: string }>(`/${igId}/media`, {
        method: "POST",
        params: { image_url: foto, is_carousel_item: "true", access_token: token },
      });
      filhos.push(item.id);
    }

    for (const filho of filhos) await esperarContainer(filho, token);

    const carrossel = await graph<{ id: string }>(`/${igId}/media`, {
      method: "POST",
      params: { media_type: "CAROUSEL", children: filhos.join(","), caption: legenda, access_token: token },
    });
    containerId = carrossel.id;
  }

  await esperarContainer(containerId, token);

  const publicado = await graph<{ id: string }>(`/${igId}/media_publish`, {
    method: "POST",
    params: { creation_id: containerId, access_token: token },
  });

  const { permalink } = await graph<{ permalink?: string }>(`/${publicado.id}`, {
    params: { fields: "permalink", access_token: token },
  }).catch(() => ({ permalink: undefined }));

  return { id: publicado.id, url: permalink || null };
}

async function postarFacebook(paginaId: string, token: string, fotos: string[], legenda: string) {
  // Fotos enviadas sem publicar e depois anexadas num único post.
  const anexos: string[] = [];

  for (const foto of fotos) {
    const enviada = await graph<{ id: string }>(`/${paginaId}/photos`, {
      method: "POST",
      params: { url: foto, published: "false", access_token: token },
    });
    anexos.push(enviada.id);
  }

  const post = await graph<{ id: string }>(`/${paginaId}/feed`, {
    method: "POST",
    params: {
      message: legenda,
      attached_media: JSON.stringify(anexos.map((id) => ({ media_fbid: id }))),
      access_token: token,
    },
  });

  return { id: post.id, url: `https://www.facebook.com/${post.id}` };
}

export async function postarVeiculo(
  empresaId: string,
  pedido: { vehicleId: string; legenda: string; fotos: string[]; redes: ("instagram" | "facebook")[] },
) {
  const dados = await conexao(empresaId);

  if (!dados || dados.status === "desconectado" || !dados.access_token_enc) {
    throw new PortalError("Conecte o Facebook e escolha a página em Configurações > Integrações.");
  }

  const pagina = dados.config?.paginas?.find((p) => p.id === dados.config?.paginaId);
  if (!pagina) throw new PortalError("Escolha a página do Facebook em Configurações > Integrações.");

  const token = decrypt(dados.access_token_enc);
  const resultados: { rede: "instagram" | "facebook"; url: string | null; erro?: string }[] = [];

  for (const rede of pedido.redes) {
    try {
      if (rede === "instagram") {
        if (!pagina.instagram) {
          throw new PortalError("A página não tem um Instagram profissional ligado a ela.");
        }

        const post = await postarInstagram(pagina.instagram.id, token, pedido.fotos, pedido.legenda);
        await supabaseAdmin.from("posts_redes").insert({
          empresa_id: empresaId,
          vehicle_id: pedido.vehicleId,
          rede,
          external_id: post.id,
          url: post.url,
        });
        resultados.push({ rede, url: post.url });
      } else {
        const post = await postarFacebook(pagina.id, token, pedido.fotos, pedido.legenda);
        await supabaseAdmin.from("posts_redes").insert({
          empresa_id: empresaId,
          vehicle_id: pedido.vehicleId,
          rede,
          external_id: post.id,
          url: post.url,
        });
        resultados.push({ rede, url: post.url });
      }
    } catch (error) {
      const mensagem = error instanceof PortalError ? error.message : "Erro inesperado.";
      if (!(error instanceof PortalError)) console.error("Erro ao postar na Meta", rede, error);

      if (error instanceof PortalError && error.status === 401) {
        await supabaseAdmin
          .from("integracoes")
          .update({ status: "erro", ultimo_erro: mensagem, updated_at: new Date().toISOString() })
          .eq("empresa_id", empresaId)
          .eq("portal", "meta");
      }

      resultados.push({ rede, url: null, erro: mensagem });
    }
  }

  return resultados;
}
