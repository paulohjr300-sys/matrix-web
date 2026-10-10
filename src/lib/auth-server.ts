import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "./supabase-server";

type Role = "ADMIN" | "GERENTE" | "VENDEDOR";

type AuthResult =
  | { ok: true; userId: string; role: Role; empresaId: string }
  | { ok: false; response: NextResponse };

// Confere a sessão pelo cookie e exige um perfil ativo com um dos papéis
// informados. Use em toda rota de API que chama o supabaseAdmin.
export async function requireRole(allowedRoles: Role[]): Promise<AuthResult> {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json(
        { message: "Não autenticado." },
        { status: 401 },
      ),
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active, empresa_id")
    .eq("id", user.id)
    .single();

  if (
    !profile?.empresa_id ||
    profile.is_active === false ||
    !allowedRoles.includes(profile.role)
  ) {
    return {
      ok: false,
      response: NextResponse.json(
        { message: "Sem permissão." },
        { status: 403 },
      ),
    };
  }

  return {
    ok: true,
    userId: user.id,
    role: profile.role,
    empresaId: profile.empresa_id,
  };
}
