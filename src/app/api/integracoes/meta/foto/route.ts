import sharp from "sharp";
import { verifyState } from "../../../../../lib/server-crypto";
import { supabaseAdmin } from "../../../../../lib/supabase-admin";

export const maxDuration = 30;

// Foto do veículo em JPEG para a Meta baixar ao publicar. O endereço é
// assinado e vale 1 hora (gerado em urlFotoJpeg). O Instagram só aceita
// JPEG com proporção entre 4:5 e 1,91:1, então a foto é ajustada aqui.
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("t") || "";
  const dados = verifyState<{ p: string }>(token);

  if (!dados?.p || dados.p.includes("..")) {
    return new Response("Link inválido ou expirado.", { status: 404 });
  }

  const { data: arquivo, error } = await supabaseAdmin.storage.from("vehicle-images").download(dados.p);

  if (error || !arquivo) {
    return new Response("Foto não encontrada.", { status: 404 });
  }

  const imagem = sharp(Buffer.from(await arquivo.arrayBuffer())).rotate();
  const { width = 1080, height = 1080 } = await imagem.metadata();

  const largura = Math.min(width, 1440);
  let altura = Math.round((height * largura) / width);
  const proporcao = largura / altura;

  if (proporcao < 0.8) altura = Math.round(largura / 0.8);
  if (proporcao > 1.91) altura = Math.round(largura / 1.91);

  const jpeg = await imagem
    .resize({ width: largura, height: altura, fit: "cover" })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();

  return new Response(new Uint8Array(jpeg), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
