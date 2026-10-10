import { NextResponse } from "next/server";
import { requireRole } from "../../../../lib/auth-server";
import { supabaseAdmin } from "../../../../lib/supabase-admin";

// Encontra (ou cria) a marca e o modelo escolhidos na FIPE no cadastro da
// loja. Roda com a service role porque só ADMIN escreve em brands e
// vehicle_models pelo navegador, e o vendedor também cadastra veículos.

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function clean(value: unknown) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, 80);
}

export async function POST(request: Request) {
  const auth = await requireRole(["ADMIN", "GERENTE", "VENDEDOR"]);

  if (!auth.ok) {
    return auth.response;
  }

  const body = await request.json().catch(() => ({}));
  const brandName = clean(body.brandName);
  const modelName = clean(body.modelName);

  if (!brandName || !modelName) {
    return NextResponse.json({ message: "Informe a marca e o modelo." }, { status: 400 });
  }

  const empresaId = auth.empresaId;

  // Marca
  const { data: brands, error: brandsError } = await supabaseAdmin
    .from("brands")
    .select("id, name")
    .eq("empresa_id", empresaId);

  if (brandsError) {
    return NextResponse.json({ message: brandsError.message }, { status: 500 });
  }

  let brand = (brands || []).find((item) => normalize(item.name) === normalize(brandName));

  if (!brand) {
    const { data, error } = await supabaseAdmin
      .from("brands")
      .insert({ name: brandName, empresa_id: empresaId })
      .select("id, name")
      .single();

    if (error || !data) {
      return NextResponse.json({ message: "Não foi possível cadastrar a marca." }, { status: 500 });
    }

    brand = data;
  }

  // Modelo
  const { data: models, error: modelsError } = await supabaseAdmin
    .from("vehicle_models")
    .select("id, name")
    .eq("empresa_id", empresaId)
    .eq("brand_id", brand.id);

  if (modelsError) {
    return NextResponse.json({ message: modelsError.message }, { status: 500 });
  }

  let model = (models || []).find((item) => normalize(item.name) === normalize(modelName));

  if (!model) {
    const { data, error } = await supabaseAdmin
      .from("vehicle_models")
      .insert({ name: modelName, brand_id: brand.id, empresa_id: empresaId })
      .select("id, name")
      .single();

    if (error || !data) {
      return NextResponse.json({ message: "Não foi possível cadastrar o modelo." }, { status: 500 });
    }

    model = data;
  }

  return NextResponse.json({
    brand: { id: brand.id, name: brand.name },
    model: { id: model.id, name: model.name, brand_id: brand.id },
  });
}
