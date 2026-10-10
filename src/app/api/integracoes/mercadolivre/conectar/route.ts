import { NextResponse } from "next/server";
import { requireRole } from "../../../../../lib/auth-server";
import { createPkce, signState } from "../../../../../lib/server-crypto";
import { integrationsAllowed } from "../../../../../lib/integrations/core";
import {
  authorizationUrl,
  mercadoLivreConfigProblem,
} from "../../../../../lib/integrations/mercadolivre";

const PKCE_COOKIE = "ml_pkce";

// Leva o ADMIN da loja para autorizar o acesso no Mercado Livre. É aberta
// pelo navegador: qualquer problema volta para a tela de Integrações com a
// mensagem, nunca para uma página em branco.
export async function GET(request: Request) {
  const back = (erro: string) =>
    NextResponse.redirect(
      new URL(`/configuracoes/integracoes?erro=${encodeURIComponent(erro)}`, request.url),
    );

  try {
    const auth = await requireRole(["ADMIN"]);

    if (!auth.ok) {
      return back("Só o administrador da loja pode conectar contas.");
    }

    const problem = mercadoLivreConfigProblem();
    if (problem) return back(problem);

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
  } catch (error) {
    console.error("Erro ao iniciar conexão com o Mercado Livre", error);
    return back(error instanceof Error ? error.message : "Não foi possível iniciar a conexão.");
  }
}
