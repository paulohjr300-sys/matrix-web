import { NextResponse } from "next/server";
import { requireRole } from "../../../../../lib/auth-server";
import { PortalError } from "../../../../../lib/integrations/core";
import { accessToken, mlFetch } from "../../../../../lib/integrations/mercadolivre";

// Cria um usuário de teste do Mercado Livre (conta fictícia para testar a
// integração). Só existe quando ML_ALLOW_TEST_USERS=true na Vercel: é uma
// ferramenta de desenvolvimento, não aparece para os clientes.
export async function POST() {
  if (process.env.ML_ALLOW_TEST_USERS !== "true") {
    return NextResponse.json({ message: "Recurso desativado." }, { status: 404 });
  }

  const auth = await requireRole(["ADMIN"]);

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const token = await accessToken(auth.empresaId);
    const user = await mlFetch(token, "/users/test_user", {
      method: "POST",
      body: JSON.stringify({ site_id: "MLB" }),
    });

    return NextResponse.json({
      nickname: user.nickname,
      password: user.password,
      email: user.email || null,
      id: user.id,
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof PortalError ? error.message : "Não foi possível criar o usuário de teste." },
      { status: 400 },
    );
  }
}
