import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "../../../../lib/platform-admin";
import { supabaseAdmin } from "../../../../lib/supabase-admin";

async function countRows(table: string, empresaId: string, sinceIso?: string) {
  let query = supabaseAdmin
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("empresa_id", empresaId);

  if (sinceIso) query = query.gte("created_at", sinceIso);

  const { count } = await query;

  return count ?? 0;
}

// Lista todas as lojas com os números principais de uso.
export async function GET() {
  const auth = await requirePlatformAdmin();

  if (!auth.ok) {
    return auth.response;
  }

  const { data: empresas, error } = await supabaseAdmin
    .from("empresas")
    .select(
      "id, slug, nome, dominio, ativo, plano, assinatura_status, trial_termina_em, whatsapp, email, created_at",
    )
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  const { data: admins } = await supabaseAdmin
    .from("profiles")
    .select("empresa_id, name, email")
    .eq("role", "ADMIN");

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const result = await Promise.all(
    (empresas || []).map(async (empresa) => {
      const [usuarios, veiculos, leads30d] = await Promise.all([
        countRows("profiles", empresa.id),
        countRows("vehicles", empresa.id),
        countRows("leads", empresa.id, since),
      ]);

      return {
        ...empresa,
        responsavel: (admins || []).find((admin) => admin.empresa_id === empresa.id) || null,
        usuarios,
        veiculos,
        leads30d,
      };
    }),
  );

  return NextResponse.json({ empresas: result });
}
