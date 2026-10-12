import { supabaseAdmin } from "../supabase-admin";
import {
  LEGENDA_PADRAO,
  montarLegenda,
  valoresDaLegenda,
  VEICULO_LEGENDA_SELECT,
  type VeiculoLegenda,
} from "../legenda-post";
import { integrationsAllowed, PortalError, saveAnuncio } from "./core";
import { runMercadoLivre } from "./mercadolivre";
import { postarVeiculo, situacaoMeta, urlFotoJpeg } from "./meta-posts";

// Publicação automática quando o veículo entra no site (publicado e em
// estoque): anúncio no Mercado Livre e post no Instagram/Facebook. O
// catálogo da Meta já é automático (lê o site). Cada um só acontece uma
// vez por veículo; na venda, a sincronização encerra o anúncio e marca
// "VENDIDO" nos posts.

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://matrix-site-peach.vercel.app").replace(/\/$/, "");
const MAX_FOTOS = 10;

async function veiculoNoSite(empresaId: string, vehicleId: string) {
  const { data } = await supabaseAdmin
    .from("vehicles")
    .select("is_published, status")
    .eq("id", vehicleId)
    .eq("empresa_id", empresaId)
    .maybeSingle();

  return data?.is_published === true && data.status === "EM_ESTOQUE";
}

// Mercado Livre: publica se a conta estiver conectada e o veículo ainda não
// tiver anúncio (ou a tentativa anterior falhou, ex.: faltava foto).
// Devolve "publicado", um erro para mostrar, ou null (nada a fazer).
export async function publicarMercadoLivreAutomatico(empresaId: string, vehicleId: string) {
  if (!(await veiculoNoSite(empresaId, vehicleId))) return null;
  if (!(await integrationsAllowed(empresaId))) return null;

  const { data: integracao } = await supabaseAdmin
    .from("integracoes")
    .select("status")
    .eq("empresa_id", empresaId)
    .eq("portal", "mercadolivre")
    .maybeSingle();

  if (integracao?.status !== "conectado") return null;

  // Reserva a publicação (anuncios_portal é único por veículo e portal):
  // dois salvamentos seguidos não criam dois anúncios.
  const { data: anuncio } = await supabaseAdmin
    .from("anuncios_portal")
    .select("status, external_id")
    .eq("vehicle_id", vehicleId)
    .eq("portal", "mercadolivre")
    .maybeSingle();

  if (anuncio) {
    if (anuncio.status !== "erro" || anuncio.external_id) return null;

    const { data: reservado } = await supabaseAdmin
      .from("anuncios_portal")
      .update({ status: "pendente" })
      .eq("vehicle_id", vehicleId)
      .eq("portal", "mercadolivre")
      .eq("status", "erro")
      .select("id");

    if (!reservado?.length) return null;
  } else {
    const { error } = await supabaseAdmin
      .from("anuncios_portal")
      .insert({ empresa_id: empresaId, vehicle_id: vehicleId, portal: "mercadolivre", status: "pendente" });

    if (error) return null; // outro salvamento já reservou
  }

  try {
    await runMercadoLivre(empresaId, vehicleId, "publicar");
    return "publicado" as const;
  } catch (error) {
    const mensagem = error instanceof PortalError ? error.message : "erro inesperado";
    if (!(error instanceof PortalError)) console.error("Erro ao publicar no ML automaticamente", error);

    // Deixa como erro (e não "pendente") para tentar de novo no próximo salvamento.
    await saveAnuncio(empresaId, vehicleId, "mercadolivre", { status: "erro", ultimo_erro: mensagem });
    return `Mercado Livre: ${mensagem}`;
  }
}

// Post no Instagram/Facebook: uma vez por veículo, com a legenda modelo da
// loja e até 10 fotos (a principal primeiro).
export async function postarAutomatico(empresaId: string, vehicleId: string) {
  if (!(await veiculoNoSite(empresaId, vehicleId))) return null;
  if (!(await integrationsAllowed(empresaId))) return null;

  const meta = await situacaoMeta(empresaId);
  if (!meta || meta.status !== "conectado" || !meta.pagina) return null;

  // Já postado (pelo botão ou automático): não posta de novo.
  const { count } = await supabaseAdmin
    .from("posts_redes")
    .select("id", { count: "exact", head: true })
    .eq("vehicle_id", vehicleId);

  if ((count ?? 0) > 0) return null;

  const { data: arquivos } = await supabaseAdmin
    .from("vehicle_files")
    .select("id, file_path")
    .eq("vehicle_id", vehicleId)
    .eq("file_type", "IMAGE")
    .order("created_at");

  // Sem foto não dá para postar; tenta de novo quando o veículo tiver fotos.
  if (!arquivos?.length) return null;

  // Reserva o post: só um salvamento posta.
  const { data: reservado } = await supabaseAdmin
    .from("vehicles")
    .update({ post_automatico_em: new Date().toISOString() })
    .eq("id", vehicleId)
    .eq("empresa_id", empresaId)
    .is("post_automatico_em", null)
    .select(VEICULO_LEGENDA_SELECT)
    .maybeSingle();

  if (!reservado) return null;

  const veiculo = reservado as unknown as VeiculoLegenda & { main_photo_file_id: string | null };

  const { data: empresa } = await supabaseAdmin
    .from("empresas")
    .select("nome, whatsapp, telefone, slug, dominio, legenda_post")
    .eq("id", empresaId)
    .single();

  const siteUrl = empresa?.dominio ? `https://${empresa.dominio}` : `${SITE_URL}/loja/${empresa?.slug}`;
  const legenda = montarLegenda(
    empresa?.legenda_post || LEGENDA_PADRAO,
    valoresDaLegenda(veiculo, vehicleId, empresa, siteUrl),
  );

  const fotos = [...arquivos]
    .sort((a, b) => (a.id === veiculo.main_photo_file_id ? -1 : b.id === veiculo.main_photo_file_id ? 1 : 0))
    .slice(0, MAX_FOTOS)
    .map((arquivo) => urlFotoJpeg(arquivo.file_path));

  const redes: ("instagram" | "facebook")[] = meta.pagina.instagram ? ["instagram", "facebook"] : ["facebook"];
  const resultados = await postarVeiculo(empresaId, { vehicleId, legenda, fotos, redes });

  return resultados;
}
