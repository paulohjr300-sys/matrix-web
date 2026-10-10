import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "../../../../../lib/auth-server";
import { verifyState } from "../../../../../lib/server-crypto";
import { PortalError } from "../../../../../lib/integrations/core";
import { olxExchangeCode, olxSaveConnection } from "../../../../../lib/integrations/olx";

export const maxDuration = 60;

const ERROS: Record<string, string> = {
  access_denied: "A autorização na OLX foi cancelada.",
  invalid_scope: "A OLX não liberou as permissões pedidas para o aplicativo.",
  unauthorized_client: "O aplicativo ainda não está liberado pela OLX.",
};

// A OLX devolve o lojista para cá depois da autorização. Esta URL deve ser
// a mesma de OLX_REDIRECT_URI e a registrada no aplicativo da OLX.
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const finish = (query: string) =>
    NextResponse.redirect(new URL(`/configuracoes/integracoes?${query}`, request.url));
  const fail = (message: string) => finish(`erro=${encodeURIComponent(message)}`);

  const erro = url.searchParams.get("error");
  if (erro) return fail(ERROS[erro] || `A OLX recusou a autorização (${erro}).`);

  const code = url.searchParams.get("code");
  let state: { empresaId: string; userId: string } | null = null;

  try {
    state = verifyState<{ empresaId: string; userId: string }>(url.searchParams.get("state") || "");
  } catch (error) {
    console.error("state inválido no retorno da OLX", error);
  }

  if (!code || !state) return fail("A conexão expirou. Tente conectar novamente.");

  const auth = await requireRole(["ADMIN"]);

  if (!auth.ok || auth.empresaId !== state.empresaId || auth.userId !== state.userId) {
    return fail("Sessão inválida. Entre no painel e tente conectar novamente.");
  }

  try {
    const token = await olxExchangeCode(code);
    await olxSaveConnection(auth.empresaId, token);
  } catch (error) {
    if (!(error instanceof PortalError)) console.error("Erro ao conectar a OLX", error);
    return fail(
      error instanceof PortalError
        ? error.message
        : `Não foi possível conectar à OLX (${error instanceof Error ? error.message : "erro desconhecido"}).`,
    );
  }

  return finish("conectado=olx");
}
