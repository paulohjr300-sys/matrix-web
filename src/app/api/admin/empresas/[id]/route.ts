import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "../../../../../lib/platform-admin";
import { supabaseAdmin } from "../../../../../lib/supabase-admin";

const PLANOS = ["basico", "pro"];
const STATUS = ["trial", "ativa", "inadimplente", "cancelada"];
const DOMAIN_FORMAT = /^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)+$/;

// Altera plano, assinatura, teste, domínio ou suspende/reativa a loja.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requirePlatformAdmin();

  if (!auth.ok) {
    return auth.response;
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const changes: Record<string, unknown> = {};

  if ("plano" in body) {
    if (!PLANOS.includes(body.plano)) {
      return NextResponse.json({ message: "Plano inválido." }, { status: 400 });
    }
    changes.plano = body.plano;
  }

  if ("assinatura_status" in body) {
    if (!STATUS.includes(body.assinatura_status)) {
      return NextResponse.json({ message: "Situação inválida." }, { status: 400 });
    }
    changes.assinatura_status = body.assinatura_status;
  }

  if ("ativo" in body) {
    if (typeof body.ativo !== "boolean") {
      return NextResponse.json({ message: "Valor inválido." }, { status: 400 });
    }
    changes.ativo = body.ativo;
  }

  if ("trial_termina_em" in body) {
    const date = body.trial_termina_em ? new Date(body.trial_termina_em) : null;

    if (date && Number.isNaN(date.getTime())) {
      return NextResponse.json({ message: "Data inválida." }, { status: 400 });
    }
    changes.trial_termina_em = date ? date.toISOString() : null;
  }

  if ("dominio" in body) {
    const dominio = String(body.dominio || "")
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/\/.*$/, "")
      .replace(/^www\./, "");

    if (dominio && !DOMAIN_FORMAT.test(dominio)) {
      return NextResponse.json({ message: "Domínio inválido." }, { status: 400 });
    }
    changes.dominio = dominio || null;
  }

  if (Object.keys(changes).length === 0) {
    return NextResponse.json({ message: "Nada para alterar." }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("empresas")
    .update(changes)
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    const message =
      error.code === "23505" ? "Esse domínio já está em uso por outra loja." : error.message;

    return NextResponse.json({ message }, { status: 400 });
  }

  if (!data) {
    return NextResponse.json({ message: "Loja não encontrada." }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
