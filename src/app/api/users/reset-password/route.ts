import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireRole } from "../../../../lib/auth-server";
import { supabaseAdmin } from "../../../../lib/supabase-admin";

export async function POST(request: Request) {
  const auth = await requireRole(["ADMIN"]);

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { message: "E-mail inválido." },
        { status: 400 },
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;

    if (!supabaseUrl || !supabaseAnonKey || !appUrl) {
      return NextResponse.json(
        { message: "Variáveis de ambiente não configuradas." },
        { status: 500 },
      );
    }

    const { data: target } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .eq("empresa_id", auth.empresaId)
      .maybeSingle();

    if (!target) {
      return NextResponse.json(
        { message: "Usuário não encontrado." },
        { status: 404 },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${appUrl}/reset-password`,
    });

    if (error) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: "E-mail de redefinição enviado com sucesso.",
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        message: "Erro interno ao enviar e-mail de redefinição.",
      },
      { status: 500 },
    );
  }
}
