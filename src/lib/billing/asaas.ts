import { timingSafeEqual } from "crypto";

// Cliente da API do Asaas (v3). Ambiente pela variável ASAAS_ENV
// ("producao" usa api.asaas.com; qualquer outro valor, o sandbox).

export class AsaasError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export type AsaasPagamento = {
  id: string;
  customer: string;
  subscription?: string | null;
  value: number;
  status: string;
  billingType?: string;
  dueDate: string;
  paymentDate?: string | null;
  clientPaymentDate?: string | null;
  invoiceUrl?: string | null;
  deleted?: boolean;
};

export type AsaasAssinatura = {
  id: string;
  customer: string;
  value: number;
  status: "ACTIVE" | "EXPIRED" | "INACTIVE";
  billingType: string;
  nextDueDate: string;
  deleted?: boolean;
};

export function asaasConfigurado() {
  return Boolean(process.env.ASAAS_API_KEY);
}

function baseUrl() {
  return process.env.ASAAS_ENV === "producao"
    ? "https://api.asaas.com/v3"
    : "https://api-sandbox.asaas.com/v3";
}

async function asaas<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const apiKey = process.env.ASAAS_API_KEY;
  if (!apiKey) throw new AsaasError("A cobrança ainda não foi configurada na plataforma.", 503);

  let response: Response;

  try {
    response = await fetch(`${baseUrl()}${path}`, {
      method: init.method || "GET",
      headers: {
        access_token: apiKey,
        "Content-Type": "application/json",
        "User-Agent": "painel",
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
    });
  } catch {
    throw new AsaasError("O Asaas não respondeu. Tente de novo em instantes.", 502);
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const descricao = data?.errors?.[0]?.description;
    console.error("Erro do Asaas", response.status, path, JSON.stringify(data));

    if (response.status === 401) {
      throw new AsaasError("A chave de API do Asaas é inválida. Avise o suporte da plataforma.", 502);
    }

    throw new AsaasError(descricao || "O Asaas recusou a operação.", response.status >= 500 ? 502 : 400);
  }

  return data as T;
}

export function criarCliente(dados: {
  nome: string;
  cpfCnpj: string;
  email?: string | null;
  celular?: string | null;
  empresaId: string;
}) {
  return asaas<{ id: string }>("/customers", {
    method: "POST",
    body: {
      name: dados.nome,
      cpfCnpj: dados.cpfCnpj,
      email: dados.email || undefined,
      mobilePhone: dados.celular || undefined,
      externalReference: dados.empresaId,
    },
  });
}

export function criarAssinatura(dados: {
  cliente: string;
  valor: number;
  formaPagamento: string;
  vencimento: string;
  descricao: string;
  empresaId: string;
}) {
  return asaas<AsaasAssinatura>("/subscriptions", {
    method: "POST",
    body: {
      customer: dados.cliente,
      billingType: dados.formaPagamento,
      value: dados.valor,
      nextDueDate: dados.vencimento,
      cycle: "MONTHLY",
      description: dados.descricao,
      externalReference: dados.empresaId,
    },
  });
}

// Troca de plano ou de forma de pagamento: vale também para as cobranças
// pendentes já geradas.
export function atualizarAssinatura(
  id: string,
  dados: { valor: number; formaPagamento: string; descricao: string },
) {
  return asaas<AsaasAssinatura>(`/subscriptions/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: {
      value: dados.valor,
      billingType: dados.formaPagamento,
      description: dados.descricao,
      updatePendingPayments: true,
    },
  });
}

export function cancelarAssinatura(id: string) {
  return asaas<{ deleted: boolean }>(`/subscriptions/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export async function cobrancasDaAssinatura(id: string) {
  const data = await asaas<{ data: AsaasPagamento[] }>(
    `/subscriptions/${encodeURIComponent(id)}/payments`,
  );

  return data.data || [];
}

// O Asaas manda o token configurado no webhook no header
// "asaas-access-token".
export function tokenWebhookConfere(recebido: string | null) {
  const esperado = process.env.ASAAS_WEBHOOK_TOKEN;
  if (!esperado || !recebido) return false;

  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);

  return a.length === b.length && timingSafeEqual(a, b);
}
