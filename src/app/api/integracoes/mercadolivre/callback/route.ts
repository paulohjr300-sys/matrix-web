import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "../../../../../lib/auth-server";
import { verifyState } from "../../../../../lib/server-crypto";
import { exchangeCode, saveConnection } from "../../../../../lib/integrations/mercadolivre";
import { PortalError } from "../../../../../lib/integrations/core";

const PKCE_COOKIE = "ml_pkce";

// O Mercado Livre devolve o lojista para cá depois da autorização.
// Esta URL deve ser cadastrada exatamente igual em ML_REDIRECT_URI e no
// aplicativo do Mercado Livre.
export async function GET(request: NextRequest) {
  const url = request.nextUrl;

  const finish = (query: string) => {
    const response = NextResponse.redirect(new URL(`/configuracoes/integracoes?${query}`, request.url));
    response.cookies.delete({ name: PKCE_COOKIE, path: "/api/integracoes/mercadolivre" });
    return response;
  };

  const fail = (message: string) => finish(`erro=${encodeURIComponent(message)}`);

  if (url.searchParams.get("error")) {
    const detalhe = url.searchParams.get("error_description");
    return fail(
      detalhe
        ? `O Mercado Livre recusou a autorização: ${detalhe}`
        : "A autorização no Mercado Livre foi cancelada.",
    );
  }

  const code = url.searchParams.get("code");
  let state: { empresaId: string; userId: string } | null = null;

  try {
    state = verifyState<{ empresaId: string; userId: string }>(url.searchParams.get("state") || "");
  } catch (error) {
    console.error("state inválido no retorno do Mercado Livre", error);
  }
  const verifier = request.cookies.get(PKCE_COOKIE)?.value;

  if (!code || !state || !verifier) {
    return fail("A conexão expirou. Tente conectar novamente.");
  }

  // Quem volta precisa ser o mesmo ADMIN da mesma loja que iniciou.
  const auth = await requireRole(["ADMIN"]);

  if (!auth.ok || auth.empresaId !== state.empresaId || auth.userId !== state.userId) {
    return fail("Sessão inválida. Entre no painel e tente conectar novamente.");
  }

  try {
    const tokens = await exchangeCode(code, verifier);
    await saveConnection(auth.empresaId, tokens);
  } catch (error) {
    if (!(error instanceof PortalError)) console.error("Erro ao conectar o Mercado Livre", error);
    return fail(error instanceof PortalError ? error.message : "Não foi possível conectar ao Mercado Livre.");
  }

  return finish("conectado=mercadolivre");
}
