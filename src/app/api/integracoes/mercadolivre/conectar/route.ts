import { NextResponse } from "next/server";
import { requireRole } from "../../../../../lib/auth-server";
import { createPkce, signState } from "../../../../../lib/server-crypto";
import { integrationsAllowed } from "../../../../../lib/integrations/core";
import { authorizationUrl, mercadoLivreConfig } from "../../../../../lib/integrations/mercadolivre";

const PKCE_COOKIE = "ml_pkce";

// Leva o ADMIN da loja para autorizar o acesso no Mercado Livre.
export async function GET(request: Request) {
  const auth = await requireRole(["ADMIN"]);

  if (!auth.ok) {
    return auth.response;
  }

  const back = (erro: string) =>
    NextResponse.redirect(
      new URL(`/configuracoes/integracoes?erro=${encodeURIComponent(erro)}`, request.url),
    );

  if (!mercadoLivreConfig()) {
    return back("Integração com o Mercado Livre ainda não configurada na plataforma.");
  }

  if (!(await integrationsAllowed(auth.empresaId))) {
    return back("As integrações com portais fazem parte do plano Pro.");
  }

  const { verifier, challenge } = createPkce();
  const state = signState({ empresaId: auth.empresaId, userId: auth.userId });

  const response = NextResponse.redirect(authorizationUrl(state, challenge));

  response.cookies.set(PKCE_COOKIE, verifier, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/api/integracoes/mercadolivre",
    maxAge: 600,
  });

  return response;
}
