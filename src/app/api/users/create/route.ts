import { NextResponse } from "next/server";
import { requireRole } from "../../../../lib/auth-server";
import { supabaseAdmin } from "../../../../lib/supabase-admin";

export async function POST(request: Request) {
  const auth = await requireRole(["ADMIN"]);

  if (!auth.ok) {
    return auth.response;
  }

  const body = await request.json();

  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim();
  const password = String(body.password || "").trim();
  const role = String(body.role || "").trim();

  if (!name || !email || !password || !role) {
    return NextResponse.json(
      { message: "Preencha todos os campos." },
      { status: 400 },
    );
  }

  if (!["ADMIN", "GERENTE", "VENDEDOR"].includes(role)) {
    return NextResponse.json({ message: "Perfil inválido." }, { status: 400 });
  }

  const { data: createdUser, error: createUserError } =
    await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

  if (createUserError || !createdUser.user) {
    return NextResponse.json(
      { message: createUserError?.message || "Erro ao criar usuário." },
      { status: 400 },
    );
  }

  const { error: profileError } = await supabaseAdmin.from("profiles").insert({
    id: createdUser.user.id,
    name,
    email,
    role,
    empresa_id: auth.empresaId,
  });

  if (profileError) {
    await supabaseAdmin.auth.admin.deleteUser(createdUser.user.id);

    return NextResponse.json(
      { message: profileError.message },
      { status: 400 },
    );
  }

  return NextResponse.json({
    message: "Usuário criado com sucesso.",
  });
}
