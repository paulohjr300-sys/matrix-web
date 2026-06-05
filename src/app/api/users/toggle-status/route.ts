import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    const { userId, isActive } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { message: "Usuário inválido." },
        { status: 400 },
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { message: "Variáveis do Supabase não configuradas." },
        { status: 500 },
      );
    }

    const adminSupabase = createClient(supabaseUrl, serviceRoleKey);

    const { error } = await adminSupabase
      .from("profiles")
      .update({
        is_active: !isActive,
      })
      .eq("id", userId);

    if (error) {
      return NextResponse.json({ message: error.message }, { status: 400 });
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
