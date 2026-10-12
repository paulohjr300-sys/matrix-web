import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabase-admin";
import { DEFAULT_CATALOG } from "../../../lib/default-catalog";
import { captchaValido, ipDaRequisicao } from "../../../lib/turnstile";

// Cadastro de uma loja nova pelo próprio cliente: cria a empresa, o usuário
// ADMIN e o perfil, e popula os cadastros base. Se qualquer passo falhar,
// desfaz os anteriores.

const SLUG_FORMAT = /^[a-z0-9]([a-z0-9-]{1,38}[a-z0-9])$/;
const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Slugs que confundiriam com rotas do site ou da plataforma.
const RESERVED_SLUGS = new Set([
  "admin", "api", "app", "www", "loja", "lojas", "painel", "cadastro",
  "login", "site", "suporte", "ajuda", "blog", "estoque", "contato",
  "favoritos",
]);

function badRequest(message: string, field?: string) {
  return NextResponse.json({ message, field }, { status: 400 });
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;

  try {
    body = await request.json();
  } catch {
    return badRequest("Dados inválidos.");
  }

  // Campo invisível no formulário: só robôs o preenchem.
  if (String(body.website || "").trim()) {
    return NextResponse.json({ message: "Cadastro recebido." });
  }

  if (!(await captchaValido(body.captchaToken, ipDaRequisicao(request)))) {
    return badRequest("Confirme que você não é um robô e tente de novo.");
  }

  const storeName = String(body.storeName || "").trim();
  const slug = String(body.slug || "").trim().toLowerCase();
  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const whatsapp = String(body.whatsapp || "").replace(/\D/g, "");
  const acceptedTerms = body.acceptedTerms === true;

  if (storeName.length < 2) return badRequest("Informe o nome da loja.", "storeName");
  if (!SLUG_FORMAT.test(slug)) {
    return badRequest(
      "O endereço deve ter de 3 a 40 caracteres: letras minúsculas, números e hífen.",
      "slug",
    );
  }
  if (RESERVED_SLUGS.has(slug)) return badRequest("Esse endereço não está disponível.", "slug");
  if (name.length < 2) return badRequest("Informe seu nome.", "name");
  if (!EMAIL_FORMAT.test(email)) return badRequest("Informe um e-mail válido.", "email");
  if (password.length < 8) return badRequest("A senha deve ter pelo menos 8 caracteres.", "password");
  if (whatsapp && (whatsapp.length < 10 || whatsapp.length > 13)) {
    return badRequest("Informe o WhatsApp com DDD.", "whatsapp");
  }
  if (!acceptedTerms) return badRequest("É preciso aceitar os termos de uso.", "acceptedTerms");

  const { data: slugTaken } = await supabaseAdmin
    .from("empresas")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (slugTaken) return badRequest("Esse endereço já está em uso. Escolha outro.", "slug");

  // 1. Loja
  const { data: empresa, error: empresaError } = await supabaseAdmin
    .from("empresas")
    .insert({
      slug,
      nome: storeName,
      whatsapp: whatsapp ? (whatsapp.length <= 11 ? `55${whatsapp}` : whatsapp) : null,
      email,
    })
    .select("id")
    .single();

  if (empresaError || !empresa) {
    // Corrida com outro cadastro usando o mesmo slug.
    if (empresaError?.code === "23505") {
      return badRequest("Esse endereço já está em uso. Escolha outro.", "slug");
    }

    console.error(empresaError);
    return NextResponse.json({ message: "Não foi possível criar a loja." }, { status: 500 });
  }

  const rollbackEmpresa = () => supabaseAdmin.from("empresas").delete().eq("id", empresa.id);

  // 2. Usuário
  const { data: created, error: userError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  });

  if (userError || !created.user) {
    await rollbackEmpresa();

    const alreadyExists = /already|registered|exists/i.test(userError?.message || "");

    return badRequest(
      alreadyExists
        ? "Já existe uma conta com esse e-mail. Faça login ou recupere a senha."
        : "Não foi possível criar a conta.",
      "email",
    );
  }

  const userId = created.user.id;

  const rollbackAll = async () => {
    await supabaseAdmin.from("profiles").delete().eq("id", userId);
    await supabaseAdmin.auth.admin.deleteUser(userId);

    for (const table of Object.keys(DEFAULT_CATALOG)) {
      await supabaseAdmin.from(table).delete().eq("empresa_id", empresa.id);
    }

    await rollbackEmpresa();
  };

  // 3. Perfil ADMIN da loja
  const { error: profileError } = await supabaseAdmin.from("profiles").insert({
    id: userId,
    name,
    email,
    role: "ADMIN",
    empresa_id: empresa.id,
    must_change_password: false,
    is_active: true,
  });

  if (profileError) {
    console.error(profileError);
    await rollbackAll();
    return NextResponse.json({ message: "Não foi possível criar o perfil." }, { status: 500 });
  }

  // 4. Cadastros base
  for (const [table, names] of Object.entries(DEFAULT_CATALOG)) {
    const { error } = await supabaseAdmin
      .from(table)
      .insert(names.map((itemName) => ({ name: itemName, empresa_id: empresa.id })));

    if (error) {
      console.error(table, error);
      await rollbackAll();
      return NextResponse.json(
        { message: "Não foi possível preparar os cadastros da loja." },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ message: "Loja criada com sucesso.", slug });
}
