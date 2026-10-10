import { supabaseAdmin } from "../supabase-admin";

export type Portal = "mercadolivre" | "webmotors" | "olx";

export type Integracao = {
  id: string;
  empresa_id: string;
  portal: Portal;
  status: "conectado" | "erro" | "desconectado";
  conta_externa_id: string | null;
  conta_nome: string | null;
  access_token_enc: string | null;
  refresh_token_enc: string | null;
  token_expira_em: string | null;
  ultimo_erro: string | null;
  config?: Record<string, unknown> | null;
};

export type AnuncioStatus = "pendente" | "publicado" | "pausado" | "encerrado" | "erro";

// Integrações fazem parte do plano Pro; no período de teste ficam liberadas.
export async function integrationsAllowed(empresaId: string) {
  const { data } = await supabaseAdmin
    .from("empresas")
    .select("plano, assinatura_status, trial_termina_em, ativo")
    .eq("id", empresaId)
    .single();

  if (!data?.ativo) return false;
  if (data.plano === "pro" && data.assinatura_status === "ativa") return true;

  return (
    data.assinatura_status === "trial" &&
    (!data.trial_termina_em || new Date(data.trial_termina_em) > new Date())
  );
}

export async function getIntegracao(empresaId: string, portal: Portal) {
  const { data } = await supabaseAdmin
    .from("integracoes")
    .select("*")
    .eq("empresa_id", empresaId)
    .eq("portal", portal)
    .maybeSingle();

  return (data as Integracao | null) ?? null;
}

export async function saveAnuncio(
  empresaId: string,
  vehicleId: string,
  portal: Portal,
  changes: {
    status: AnuncioStatus;
    external_id?: string | null;
    external_url?: string | null;
    ultimo_erro?: string | null;
  },
) {
  await supabaseAdmin.from("anuncios_portal").upsert(
    {
      empresa_id: empresaId,
      vehicle_id: vehicleId,
      portal,
      ultimo_erro: null,
      sincronizado_em: new Date().toISOString(),
      ...changes,
    },
    { onConflict: "vehicle_id,portal" },
  );
}

// Dados do veículo no formato usado pelos portais.
export type VehicleForListing = {
  id: string;
  empresa_id: string;
  plate: string;
  status: string;
  km: number | null;
  doors: number | null;
  model_year: number | null;
  manufacture_year: number | null;
  advertised_price: number | null;
  description: string | null;
  versao: string | null;
  brand: string | null;
  model: string | null;
  fuel: string | null;
  transmission: string | null;
  color: string | null;
  pictures: string[];
};

export async function loadVehicleForListing(empresaId: string, vehicleId: string) {
  const { data: vehicle } = await supabaseAdmin
    .from("vehicles")
    .select(
      `id, empresa_id, plate, status, km, doors, model_year, manufacture_year,
       advertised_price, description, versao, main_photo_file_id,
       brands(name), vehicle_models(name), fuels(name), transmissions(name), colors(name)`,
    )
    .eq("id", vehicleId)
    .eq("empresa_id", empresaId)
    .maybeSingle();

  if (!vehicle) return null;

  const { data: files } = await supabaseAdmin
    .from("vehicle_files")
    .select("id, file_path")
    .eq("vehicle_id", vehicleId)
    .eq("file_type", "IMAGE")
    .order("created_at");

  const base = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/vehicle-images/`;
  const sorted = [...(files || [])].sort(
    (a, b) =>
      Number(b.id === vehicle.main_photo_file_id) - Number(a.id === vehicle.main_photo_file_id),
  );

  const name = (relation: unknown) =>
    (Array.isArray(relation) ? relation[0]?.name : (relation as { name?: string } | null)?.name) ??
    null;

  return {
    id: vehicle.id,
    empresa_id: vehicle.empresa_id,
    plate: vehicle.plate,
    status: vehicle.status,
    km: vehicle.km,
    doors: vehicle.doors,
    model_year: vehicle.model_year,
    manufacture_year: vehicle.manufacture_year,
    advertised_price: vehicle.advertised_price,
    description: vehicle.description,
    versao: vehicle.versao,
    brand: name(vehicle.brands),
    model: name(vehicle.vehicle_models),
    fuel: name(vehicle.fuels),
    transmission: name(vehicle.transmissions),
    color: name(vehicle.colors),
    pictures: sorted.map((file) => base + file.file_path),
  } satisfies VehicleForListing;
}

export class PortalError extends Error {
  // Código HTTP devolvido pelo portal, quando houver.
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}
