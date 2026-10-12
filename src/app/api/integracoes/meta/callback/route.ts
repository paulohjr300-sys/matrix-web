import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "../../../../../lib/auth-server";
import { verifyState } from "../../../../../lib/server-crypto";
import { PortalError } from "../../../../../lib/integrations/core";
import { salvarConexaoMeta, trocarCodigo } from "../../../../../lib/integrations/meta-posts";

export const maxDuration = 30;

// A Meta devolve o lojista para cá depois do Login do Facebook. Esta URL
// deve ser igual a META_REDIRECT_URI e às "URIs de redirecionamento do
// OAuth válidas" do app na Meta.
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const finish = (query: string) => NextResponse.redirect(new URL(`/configuracoes/integracoes?${query}`, request.url));
  const fail = (mensagem: string) => finish(`erro=${encodeURIComponent(mensagem)}`);

  if (url.searchParams.get("error")) {
    return fail("A autorização no Facebook foi cancelada.");
  }

  const code = url.searchParams.get("code");
  const state = verifyState<{ empresaId: string; userId: string }>(url.searchParams.get("state") || "");

  if (!code || !state) return fail("A conexão expirou. Tente conectar novamente.");

  const auth = await requireRole(["ADMIN"]);

  if (!auth.ok || auth.empresaId !== state.empresaId || auth.userId !== state.userId) {
    return fail("Sessão inválida. Entre no painel e tente conectar novamente.");
  }

  try {
    const token = await trocarCodigo(code);
    await salvarConexaoMeta(auth.empresaId, token.access_token, token.expires_in);
  } catch (error) {
    if (!(error instanceof PortalError)) console.error("Erro ao conectar a Meta", error);
    return fail(error instanceof PortalError ? error.message : "Não foi possível conectar ao Facebook.");
  }

  return finish("conectado=meta");
}
