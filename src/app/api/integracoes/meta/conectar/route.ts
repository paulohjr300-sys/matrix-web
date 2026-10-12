import { NextResponse } from "next/server";
import { requireRole } from "../../../../../lib/auth-server";
import { signState } from "../../../../../lib/server-crypto";
import { integrationsAllowed } from "../../../../../lib/integrations/core";
import { metaAuthorizationUrl, metaConfigProblem } from "../../../../../lib/integrations/meta-posts";

// Leva o ADMIN da loja para o Login do Facebook (página e Instagram).
export async function GET(request: Request) {
  const back = (erro: string) =>
    NextResponse.redirect(new URL(`/configuracoes/integracoes?erro=${encodeURIComponent(erro)}`, request.url));

  try {
    const auth = await requireRole(["ADMIN"]);
    if (!auth.ok) return back("Só o administrador da loja pode conectar contas.");

    const problema = metaConfigProblem();
    if (problema) return back(problema);

    if (!(await integrationsAllowed(auth.empresaId))) {
      return back("A postagem automática no Instagram e no Facebook faz parte do plano Pro.");
    }

    const state = signState({ empresaId: auth.empresaId, userId: auth.userId });
    return NextResponse.redirect(metaAuthorizationUrl(state));
  } catch (error) {
    console.error("Erro ao iniciar conexão com a Meta", error);
    return back(error instanceof Error ? error.message : "Não foi possível iniciar a conexão.");
  }
}
