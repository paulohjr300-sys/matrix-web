import { supabaseAdmin } from "../supabase-admin";
import { DIAS_TOLERANCIA, PLANOS, type PlanoId } from "../planos";
import {
  AsaasError,
  atualizarAssinatura,
  cobrancasDaAssinatura,
  criarAssinatura,
  criarCliente,
  type AsaasAssinatura,
  type AsaasPagamento,
} from "./asaas";

export const FORMAS_PAGAMENTO = ["UNDEFINED", "CREDIT_CARD"] as const;
export type FormaPagamento = (typeof FORMAS_PAGAMENTO)[number];

const PAGOS = ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"];
const EM_ABERTO = ["PENDING", "OVERDUE"];

type Empresa = {
  id: string;
  nome: string;
  email: string | null;
  whatsapp: string | null;
  ativo: boolean;
  plano: PlanoId;
  assinatura_status: "trial" | "ativa" | "inadimplente" | "cancelada";
  trial_termina_em: string | null;
};

type Assinatura = {
  empresa_id: string;
  asaas_customer_id: string | null;
  asaas_subscription_id: string | null;
  cpf_cnpj: string | null;
  plano: PlanoId | null;
  valor: number | null;
  forma_pagamento: string | null;
  proximo_vencimento: string | null;
};

type Pagamento = {
  asaas_subscription_id: string | null;
  id: string;
  valor: number;
  status: string;
  forma_pagamento: string | null;
  vencimento: string;
  pago_em: string | null;
  fatura_url: string | null;
};

// Data de hoje no fuso de Brasília (AAAA-MM-DD), como o Asaas usa.
export function hoje() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

function somarDias(data: string, dias: number) {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

function dataDe(iso: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(iso));
}

export function documentoValido(valor: string) {
  const d = valor.replace(/\D/g, "");
  if (!/^(\d{11}|\d{14})$/.test(d) || /^(\d)\1+$/.test(d)) return false;

  const digito = (base: string, pesos: number[]) => {
    const soma = base.split("").reduce((total, n, i) => total + Number(n) * pesos[i], 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  if (d.length === 11) {
    const p1 = [10, 9, 8, 7, 6, 5, 4, 3, 2];
    const p2 = [11, 10, 9, 8, 7, 6, 5, 4, 3, 2];
    return digito(d.slice(0, 9), p1) === Number(d[9]) && digito(d.slice(0, 10), p2) === Number(d[10]);
  }

  const p1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const p2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  return digito(d.slice(0, 12), p1) === Number(d[12]) && digito(d.slice(0, 13), p2) === Number(d[13]);
}

async function carregar(empresaId: string) {
  const [{ data: empresa }, { data: assinatura }, { data: pagamentos }] = await Promise.all([
    supabaseAdmin
      .from("empresas")
      .select("id, nome, email, whatsapp, ativo, plano, assinatura_status, trial_termina_em")
      .eq("id", empresaId)
      .single(),
    supabaseAdmin.from("assinaturas").select("*").eq("empresa_id", empresaId).maybeSingle(),
    supabaseAdmin
      .from("pagamentos")
      .select("id, asaas_subscription_id, valor, status, forma_pagamento, vencimento, pago_em, fatura_url")
      .eq("empresa_id", empresaId)
      .neq("status", "DELETED")
      .order("vencimento", { ascending: false })
      .limit(24),
  ]);

  if (!empresa) throw new AsaasError("Loja não encontrada.", 404);

  return {
    empresa: empresa as Empresa,
    assinatura: (assinatura as Assinatura | null) ?? null,
    pagamentos: ((pagamentos as Pagamento[] | null) ?? []).map((p) => ({ ...p, valor: Number(p.valor) })),
  };
}

// Situação da assinatura para o painel: avisos e bloqueio.
export async function situacaoDaLoja(empresaId: string) {
  const { empresa, assinatura, pagamentos } = await carregar(empresaId);
  const dia = hoje();

  const emAberto = pagamentos
    .filter((p) => EM_ABERTO.includes(p.status) && p.asaas_subscription_id === assinatura?.asaas_subscription_id)
    .sort((a, b) => a.vencimento.localeCompare(b.vencimento));
  const maisAntiga = emAberto[0] ?? null;
  const temAssinatura = Boolean(assinatura?.asaas_subscription_id);

  const trialFim = empresa.trial_termina_em ? dataDe(empresa.trial_termina_em) : null;
  const diasDeTeste =
    empresa.assinatura_status === "trial" && trialFim
      ? Math.round((new Date(`${trialFim}T12:00:00Z`).getTime() - new Date(`${dia}T12:00:00Z`).getTime()) / 86400000)
      : null;

  let bloqueado = false;
  let motivo: string | null = null;

  if (empresa.assinatura_status === "cancelada") {
    bloqueado = true;
    motivo = "A assinatura da loja foi cancelada.";
  } else if (empresa.assinatura_status === "trial" && trialFim && trialFim < dia) {
    // Assinou no teste: a primeira cobrança vence no fim do teste e tem a
    // mesma tolerância das demais.
    const limite = temAssinatura && maisAntiga ? somarDias(maisAntiga.vencimento, DIAS_TOLERANCIA) : trialFim;

    if (limite < dia) {
      bloqueado = true;
      motivo = temAssinatura
        ? "O teste grátis terminou e a primeira mensalidade não foi paga."
        : "O teste grátis terminou. Escolha um plano para continuar usando o painel.";
    }
  } else if (empresa.assinatura_status === "inadimplente") {
    const vencida = emAberto.find((p) => p.status === "OVERDUE") ?? maisAntiga;

    if (!vencida || somarDias(vencida.vencimento, DIAS_TOLERANCIA) < dia) {
      bloqueado = true;
      motivo = "Há mensalidade em atraso. Pague a fatura para liberar o painel.";
    }
  }

  return {
    empresa,
    assinatura,
    pagamentos,
    status: empresa.assinatura_status,
    plano: empresa.plano,
    trialTerminaEm: trialFim,
    diasDeTeste,
    temAssinatura,
    faturaEmAberto: maisAntiga,
    bloqueado,
    motivo,
  };
}

export async function salvarPagamento(empresaId: string, pagamento: AsaasPagamento) {
  const { error } = await supabaseAdmin.from("pagamentos").upsert(
    {
      id: pagamento.id,
      empresa_id: empresaId,
      asaas_subscription_id: pagamento.subscription || null,
      valor: pagamento.value,
      status: pagamento.deleted ? "DELETED" : pagamento.status,
      forma_pagamento: pagamento.billingType || null,
      vencimento: pagamento.dueDate,
      pago_em: pagamento.clientPaymentDate || pagamento.paymentDate || null,
      fatura_url: pagamento.invoiceUrl || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  if (error) throw new Error(`Erro ao salvar cobrança: ${error.message}`);
}

// Recalcula o status da loja a partir das cobranças: alguma vencida deixa a
// loja inadimplente; sem vencidas e com algum pagamento, fica ativa.
export async function recalcularStatus(empresaId: string) {
  const { data: empresa } = await supabaseAdmin
    .from("empresas")
    .select("assinatura_status")
    .eq("id", empresaId)
    .single();

  if (!empresa || empresa.assinatura_status === "cancelada") return;

  // Só as cobranças da assinatura atual contam.
  const { data: assinatura } = await supabaseAdmin
    .from("assinaturas")
    .select("asaas_subscription_id")
    .eq("empresa_id", empresaId)
    .maybeSingle();

  if (!assinatura?.asaas_subscription_id) return;

  const { data: pagamentos } = await supabaseAdmin
    .from("pagamentos")
    .select("status")
    .eq("empresa_id", empresaId)
    .eq("asaas_subscription_id", assinatura.asaas_subscription_id);

  const lista = pagamentos ?? [];
  let status = empresa.assinatura_status;

  if (lista.some((p) => p.status === "OVERDUE")) status = "inadimplente";
  else if (lista.some((p) => PAGOS.includes(p.status))) status = "ativa";

  if (status !== empresa.assinatura_status) {
    await supabaseAdmin.from("empresas").update({ assinatura_status: status }).eq("id", empresaId);
  }
}

async function sincronizarCobrancas(empresaId: string, subscriptionId: string) {
  const cobrancas = await cobrancasDaAssinatura(subscriptionId);
  for (const cobranca of cobrancas) await salvarPagamento(empresaId, cobranca);
  return cobrancas;
}

function descricao(plano: PlanoId) {
  return `painel - plano ${PLANOS[plano].nome} (mensal)`;
}

// Contrata ou troca o plano. Na primeira contratação cria o cliente e a
// assinatura no Asaas; depois, só atualiza valor e forma de pagamento.
export async function assinar(
  empresaId: string,
  pedido: { plano: PlanoId; formaPagamento: FormaPagamento; cpfCnpj?: string },
) {
  const valor = PLANOS[pedido.plano]?.preco;
  if (!valor) throw new AsaasError("Este plano ainda não está disponível para contratação.");

  const { empresa, assinatura } = await carregar(empresaId);
  if (!empresa.ativo) throw new AsaasError("A loja está desativada. Fale com o suporte.", 403);

  // Troca de plano/forma numa assinatura existente.
  if (assinatura?.asaas_subscription_id && empresa.assinatura_status !== "cancelada") {
    const atualizada = await atualizarAssinatura(assinatura.asaas_subscription_id, {
      valor,
      formaPagamento: pedido.formaPagamento,
      descricao: descricao(pedido.plano),
    });

    await supabaseAdmin
      .from("assinaturas")
      .update({
        plano: pedido.plano,
        valor,
        forma_pagamento: pedido.formaPagamento,
        proximo_vencimento: atualizada.nextDueDate || assinatura.proximo_vencimento,
        updated_at: new Date().toISOString(),
      })
      .eq("empresa_id", empresaId);

    await supabaseAdmin.from("empresas").update({ plano: pedido.plano }).eq("id", empresaId);

    const cobrancas = await sincronizarCobrancas(empresaId, assinatura.asaas_subscription_id);
    const aberta = cobrancas.find((c) => EM_ABERTO.includes(c.status));

    return { faturaUrl: aberta?.invoiceUrl || null, nova: false };
  }

  // Primeira contratação (ou nova, depois de cancelada).
  let customerId = assinatura?.asaas_customer_id || null;
  let cpfCnpj = assinatura?.cpf_cnpj || null;

  if (!customerId) {
    const documento = (pedido.cpfCnpj || "").replace(/\D/g, "");
    if (!documentoValido(documento)) throw new AsaasError("Informe um CPF ou CNPJ válido.");

    const cliente = await criarCliente({
      nome: empresa.nome,
      cpfCnpj: documento,
      email: empresa.email,
      celular: empresa.whatsapp?.replace(/\D/g, "").slice(-11) || null,
      empresaId,
    });

    customerId = cliente.id;
    cpfCnpj = documento;

    // Guarda o cliente antes da assinatura: os webhooks das cobranças
    // podem chegar antes da resposta e são ligados à loja pelo cliente.
    await supabaseAdmin.from("assinaturas").upsert(
      { empresa_id: empresaId, asaas_customer_id: customerId, cpf_cnpj: cpfCnpj, updated_at: new Date().toISOString() },
      { onConflict: "empresa_id" },
    );
  }

  // No teste, a primeira mensalidade vence no fim do teste.
  const dia = hoje();
  const fimTeste =
    empresa.assinatura_status === "trial" && empresa.trial_termina_em ? dataDe(empresa.trial_termina_em) : null;
  const vencimento = fimTeste && fimTeste > dia ? fimTeste : dia;

  const nova: AsaasAssinatura = await criarAssinatura({
    cliente: customerId,
    valor,
    formaPagamento: pedido.formaPagamento,
    vencimento,
    descricao: descricao(pedido.plano),
    empresaId,
  });

  await supabaseAdmin
    .from("assinaturas")
    .update({
      asaas_subscription_id: nova.id,
      plano: pedido.plano,
      valor,
      forma_pagamento: pedido.formaPagamento,
      proximo_vencimento: nova.nextDueDate,
      updated_at: new Date().toISOString(),
    })
    .eq("empresa_id", empresaId);

  // Depois de cancelada, a loja volta como inadimplente até pagar a nova
  // fatura (assim o painel libera dentro da tolerância).
  await supabaseAdmin
    .from("empresas")
    .update({
      plano: pedido.plano,
      ...(empresa.assinatura_status === "cancelada" ? { assinatura_status: "inadimplente" } : {}),
    })
    .eq("id", empresaId);

  const cobrancas = await sincronizarCobrancas(empresaId, nova.id);
  const primeira = cobrancas.find((c) => EM_ABERTO.includes(c.status)) ?? cobrancas[0];

  return { faturaUrl: primeira?.invoiceUrl || null, nova: true };
}

async function empresaDoAsaas(subscriptionId?: string | null, customerId?: string | null) {
  if (subscriptionId) {
    const { data } = await supabaseAdmin
      .from("assinaturas")
      .select("empresa_id")
      .eq("asaas_subscription_id", subscriptionId)
      .maybeSingle();
    if (data) return data.empresa_id as string;
  }

  if (customerId) {
    const { data } = await supabaseAdmin
      .from("assinaturas")
      .select("empresa_id")
      .eq("asaas_customer_id", customerId)
      .maybeSingle();
    if (data) return data.empresa_id as string;
  }

  return null;
}

// Trata um evento do webhook. Eventos de outras cobranças da conta Asaas
// (que não são de lojas do painel) são ignorados.
export async function processarEvento(evento: {
  event: string;
  payment?: AsaasPagamento;
  subscription?: AsaasAssinatura;
}) {
  if (evento.payment) {
    const pagamento = evento.payment;
    const empresaId = await empresaDoAsaas(pagamento.subscription, pagamento.customer);
    if (!empresaId) return;

    if (evento.event === "PAYMENT_DELETED") pagamento.deleted = true;

    await salvarPagamento(empresaId, pagamento);
    await recalcularStatus(empresaId);
    return;
  }

  if (evento.subscription) {
    const assinatura = evento.subscription;
    const empresaId = await empresaDoAsaas(assinatura.id, null);
    if (!empresaId) return;

    if (
      evento.event === "SUBSCRIPTION_DELETED" ||
      evento.event === "SUBSCRIPTION_INACTIVATED" ||
      assinatura.deleted ||
      assinatura.status === "INACTIVE"
    ) {
      await supabaseAdmin
        .from("assinaturas")
        .update({ asaas_subscription_id: null, proximo_vencimento: null, updated_at: new Date().toISOString() })
        .eq("empresa_id", empresaId);
      await supabaseAdmin.from("empresas").update({ assinatura_status: "cancelada" }).eq("id", empresaId);
      return;
    }

    await supabaseAdmin
      .from("assinaturas")
      .update({
        valor: assinatura.value,
        forma_pagamento: assinatura.billingType,
        proximo_vencimento: assinatura.nextDueDate,
        updated_at: new Date().toISOString(),
      })
      .eq("empresa_id", empresaId);
  }
}
