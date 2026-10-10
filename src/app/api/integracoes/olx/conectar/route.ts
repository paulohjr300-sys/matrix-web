import { NextResponse } from "next/server";
import { requireRole } from "../../../../../lib/auth-server";
import { signState } from "../../../../../lib/server-crypto";
import { integrationsAllowed } from "../../../../../lib/integrations/core";
import { olxAuthorizationUrl, olxConfigProblem } from "../../../../../lib/integrations/olx";

// Leva o ADMIN da loja para autorizar o acesso na OLX. Qualquer problema
// volta para a tela de Integrações com a mensagem.
export async function GET(request: Request) {
  const back = (erro: string) =>
    NextResponse.redirect(
      new URL(`/configuracoes/integracoes?erro=${encodeURIComponent(erro)}`, request.url),
    );

  try {
    const auth = await requireRole(["ADMIN"]);
    if (!auth.ok) return back("Só o administrador da loja pode conectar contas.");

    const problem = olxConfigProblem();
    if (problem) return back(problem);

    if (!(await integrationsAllowed(auth.empresaId))) {
      return back("As integrações com portais fazem parte do plano Pro.");
    }

    const state = signState({ empresaId: auth.empresaId, userId: auth.userId, portal: "olx" });

    return NextResponse.redirect(olxAuthorizationUrl(state));
  } catch (error) {
    console.error("Erro ao iniciar conexão com a OLX", error);
    return back(error instanceof Error ? error.message : "Não foi possível iniciar a conexão.");
  }
}
