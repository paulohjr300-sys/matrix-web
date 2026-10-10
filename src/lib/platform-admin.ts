import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "./supabase-server";

type PlatformAdminResult =
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse };

// Use em toda rota /api/admin: elas usam a service role e enxergam todas
// as lojas.
export async function requirePlatformAdmin(): Promise<PlatformAdminResult> {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ message: "Não autenticado." }, { status: 401 }),
    };
  }

  const { data: isPlatformAdmin } = await supabase.rpc("is_platform_admin");

  if (isPlatformAdmin !== true) {
    return {
      ok: false,
      response: NextResponse.json({ message: "Sem permissão." }, { status: 403 }),
    };
  }

  return { ok: true, userId: user.id };
}
