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
    return fail("A autorização no Mercado Livre foi cancelada.");
  }

  const code = url.searchParams.get("code");
  const state = verifyState<{ empresaId: string; userId: string }>(url.searchParams.get("state") || "");
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
    return fail(error instanceof PortalError ? error.message : "Não foi possível conectar ao Mercado Livre.");
  }

  return finish("conectado=mercadolivre");
}
