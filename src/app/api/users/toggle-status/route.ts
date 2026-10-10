import { NextResponse } from "next/server";
import { requireRole } from "../../../../lib/auth-server";
import { supabaseAdmin } from "../../../../lib/supabase-admin";

// Duração usada para bloquear o login de um usuário desativado (~100 anos).
const BAN_DURATION = "876000h";

export async function POST(request: Request) {
  const auth = await requireRole(["ADMIN"]);

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const { userId, isActive } = await request.json();

    if (!userId || typeof isActive !== "boolean") {
      return NextResponse.json(
        { message: "Usuário inválido." },
        { status: 400 },
      );
    }

    if (userId === auth.userId) {
      return NextResponse.json(
        { message: "Você não pode desativar o próprio usuário." },
        { status: 400 },
      );
    }

    const nextActive = !isActive;

    const { data: updated, error } = await supabaseAdmin
      .from("profiles")
      .update({
        is_active: nextActive,
      })
      .eq("id", userId)
      .eq("empresa_id", auth.empresaId)
      .select("id")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    if (!updated) {
      return NextResponse.json(
        { message: "Usuário não encontrado." },
        { status: 404 },
      );
    }

    // Sem o bloqueio no Auth, o usuário desativado continuaria com um
    // token válido para acessar o banco direto pelo navegador.
    const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { ban_duration: nextActive ? "none" : BAN_DURATION },
    );

    if (banError) {
      return NextResponse.json(
        { message: banError.message },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch {
    return NextResponse.json(
      { message: "Erro interno ao alterar status do usuário." },
      { status: 500 },
    );
  }
}
