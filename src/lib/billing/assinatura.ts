import { supabaseAdmin } from "../supabase-admin";
import { DIAS_TOLERANCIA, PLANOS, type PlanoId } from "../planos";
import {
  AsaasError,
  atualizarAssinatura,
  cobrancasDaAssinatura,
  criarAssinatura,
  criarCliente,
  criarCobranca,
  removerCobranca,
  buscarCobranca,
  listarCobrancasPorReferencia,
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
  site_suspenso: boolean;
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
  // Cobrança avulsa da diferença ao subir de plano, ainda não paga.
  upgrade_pagamento_id: string | null;
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

export function somarDias(data: string, dias: number) {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export function somarMes(data: string) {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().slice(0, 10);
}

function diasEntre(inicio: string, fim: string) {
  return Math.round((new Date(`${fim}T12:00:00Z`).getTime() - new Date(`${inicio}T12:00:00Z`).getTime()) / 86400000);
}

// Diferença proporcional ao subir de plano: para cada mensalidade paga cujo
// mês ainda não acabou, (novo valor - valor pago) x dias restantes / dias do
// mês.
export function diferencaProporcional(pagamentos: Pagamento[], subscriptionId: string, novoValor: number, dia: string) {
  let total = 0;

  for (const p of pagamentos) {
    if (p.asaas_subscription_id !== subscriptionId || !PAGOS.includes(p.status)) continue;

    const fim = somarMes(p.vencimento);
    if (fim <= dia) continue;

    const ciclo = diasEntre(p.vencimento, fim);
    const restantes = Math.min(ciclo, diasEntre(p.vencimento > dia ? p.vencimento : dia, fim));
    total += Math.max(0, novoValor - p.valor) * (restantes / ciclo);
  }

  return Math.round(total * 100) / 100;
}

// O Asaas não aceita cobranças abaixo de R$ 5,00.
const COBRANCA_MINIMA = 5;

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
      .select("id, nome, email, whatsapp, ativo, plano, assinatura_status, trial_termina_em, site_suspenso")
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
  return calcularSituacao(await carregar(empresaId), hoje());
}

// Regras de aviso e bloqueio, sem banco (testadas em assinatura.test.ts).
export function calcularSituacao(
  { empresa, assinatura, pagamentos }: { empresa: Empresa; assinatura: Assinatura | null; pagamentos: Pagamento[] },
  dia: string,
) {
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

  const upgradePendente = assinatura?.upgrade_pagamento_id
    ? pagamentos.find((p) => p.id === assinatura.upgrade_pagamento_id && EM_ABERTO.includes(p.status)) ?? null
    : null;

  // Plano contratado diferente do que vale hoje e sem diferença a pagar:
  // redução de plano, que começa no próximo mês pago.
  const trocaAgendada =
    temAssinatura && assinatura?.plano && assinatura.plano !== empresa.plano && !upgradePendente
      ? { plano: assinatura.plano, aPartirDe: maisAntiga?.vencimento || assinatura.proximo_vencimento }
      : null;

  return {
    empresa,
    assinatura,
    pagamentos,
    upgradePendente,
    trocaAgendada,
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

// Liga ou desliga o site público da loja junto com o bloqueio do painel.
export async function atualizarSuspensao(empresaId: string) {
  const situacao = await situacaoDaLoja(empresaId);

  if (situacao.bloqueado !== situacao.empresa.site_suspenso) {
    const { error } = await supabaseAdmin
      .from("empresas")
      .update({ site_suspenso: situacao.bloqueado })
      .eq("id", empresaId);

    if (error) throw new Error(`Erro ao atualizar o site da loja: ${error.message}`);
  }

  return situacao.bloqueado;
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

  const status = statusPelasCobrancas(
    empresa.assinatura_status,
    (pagamentos ?? []).map((p) => p.status),
  );

  if (status !== empresa.assinatura_status) {
    await supabaseAdmin.from("empresas").update({ assinatura_status: status }).eq("id", empresaId);
  }
}

// Alguma cobrança vencida: inadimplente. Sem vencidas e com alguma paga:
// ativa. Senão (ex.: teste com a primeira fatura em aberto), não muda.
// Cancelada só muda por nova assinatura.
export function statusPelasCobrancas(atual: Empresa["assinatura_status"], statuses: string[]) {
  if (atual === "cancelada") return atual;
  if (statuses.includes("OVERDUE")) return "inadimplente" as const;
  if (statuses.some((s) => PAGOS.includes(s))) return "ativa" as const;
  return atual;
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

  // Antes de cobrar qualquer coisa: aplica diferenças já pagas (o plano pode
  // já ter mudado) e garante que o banco grava a assinatura; se não gravar,
  // para aqui, sem criar cobrança no Asaas.
  try {
    await conferirNoAsaas(empresaId);
  } catch (error) {
    console.error("Erro ao conferir assinatura antes da troca", error);
    throw new AsaasError("Não foi possível trocar o plano agora. Avise o suporte da plataforma.", 500);
  }

  const { empresa, assinatura, pagamentos } = await carregar(empresaId);
  if (!empresa.ativo) throw new AsaasError("A loja está desativada. Fale com o suporte.", 403);

  // Troca de plano/forma numa assinatura existente. As próximas mensalidades
  // já saem com o novo valor; o que muda é quando o novo plano passa a valer:
  //   - subir de plano com mês já pago: cobra a diferença proporcional e
  //     libera o plano quando ela for paga;
  //   - descer de plano com mês já pago: vale a partir da próxima mensalidade;
  //   - sem mês pago (teste, fatura em aberto): vale na hora.
  if (assinatura?.asaas_subscription_id && assinatura.asaas_customer_id && empresa.assinatura_status !== "cancelada") {
    const subscriptionId = assinatura.asaas_subscription_id;

    // A mesma diferença já gerada e ainda não paga: devolve ela, sem cobrar
    // de novo.
    const pendente = assinatura.upgrade_pagamento_id
      ? pagamentos.find((p) => p.id === assinatura.upgrade_pagamento_id && EM_ABERTO.includes(p.status))
      : null;

    if (pendente && pedido.plano === assinatura.plano && pedido.formaPagamento === assinatura.forma_pagamento) {
      return { faturaUrl: pendente.fatura_url, nova: false, diferenca: pendente.valor, agendado: false };
    }

    const atualizada = await atualizarAssinatura(subscriptionId, {
      valor,
      formaPagamento: pedido.formaPagamento,
      descricao: descricao(pedido.plano),
    });

    // Uma diferença anterior ainda não paga deixa de valer.
    if (assinatura.upgrade_pagamento_id) {
      await removerCobranca(assinatura.upgrade_pagamento_id).catch((error) =>
        console.error("Erro ao remover cobrança de diferença", error),
      );
      await supabaseAdmin.from("pagamentos").update({ status: "DELETED" }).eq("id", assinatura.upgrade_pagamento_id);
    }

    const dia = hoje();
    const temMesPago = pagamentos.some(
      (p) => p.asaas_subscription_id === subscriptionId && PAGOS.includes(p.status) && somarMes(p.vencimento) > dia,
    );
    const valorAtual = PLANOS[empresa.plano]?.preco ?? 0;

    let planoVigente: PlanoId = pedido.plano;
    let upgradePagamentoId: string | null = null;
    let diferenca = 0;
    let faturaUrl: string | null = null;

    if (pedido.plano !== empresa.plano && temMesPago) {
      if (valor > valorAtual) {
        diferenca = diferencaProporcional(pagamentos, subscriptionId, valor, dia);

        if (diferenca >= COBRANCA_MINIMA) {
          const cobranca = await criarCobranca({
            cliente: assinatura.asaas_customer_id,
            valor: diferenca,
            formaPagamento: pedido.formaPagamento,
            vencimento: dia,
            descricao: `painel - diferença para o plano ${PLANOS[pedido.plano].nome} até o fim do mês já pago`,
            referencia: `upgrade:${empresaId}:${pedido.plano}`,
          });

          await salvarPagamento(empresaId, cobranca);
          upgradePagamentoId = cobranca.id;
          faturaUrl = cobranca.invoiceUrl || null;
          planoVigente = empresa.plano;
        }
      } else {
        planoVigente = empresa.plano;
      }
    }

    const { error: erroGravar } = await supabaseAdmin
      .from("assinaturas")
      .update({
        plano: pedido.plano,
        valor,
        forma_pagamento: pedido.formaPagamento,
        proximo_vencimento: atualizada.nextDueDate || assinatura.proximo_vencimento,
        upgrade_pagamento_id: upgradePagamentoId,
        updated_at: new Date().toISOString(),
      })
      .eq("empresa_id", empresaId);

    if (erroGravar) {
      console.error("Erro ao gravar troca de plano", erroGravar);
      throw new AsaasError("Não foi possível salvar a troca de plano. Avise o suporte da plataforma.", 500);
    }

    if (planoVigente !== empresa.plano) {
      await supabaseAdmin.from("empresas").update({ plano: planoVigente }).eq("id", empresaId);
    }

    const cobrancas = await sincronizarCobrancas(empresaId, subscriptionId);
    if (!faturaUrl) faturaUrl = cobrancas.find((c) => EM_ABERTO.includes(c.status))?.invoiceUrl || null;

    return {
      faturaUrl,
      nova: false,
      diferenca: upgradePagamentoId ? diferenca : null,
      agendado: planoVigente !== pedido.plano && !upgradePagamentoId,
    };
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

// Depois de um pagamento, o plano contratado passa a valer quando:
//   - foi paga a diferença do upgrade; ou
//   - foi paga uma mensalidade da assinatura (fim do mês já pago, no caso
//     de redução de plano, ou upgrade cuja diferença ficou sem pagar).
async function aplicarPlanoContratado(empresaId: string, pagamento: AsaasPagamento) {
  const [{ data: assinatura, error: erroAssinatura }, { data: empresa, error: erroEmpresa }] = await Promise.all([
    supabaseAdmin
      .from("assinaturas")
      .select("plano, valor, asaas_subscription_id, upgrade_pagamento_id")
      .eq("empresa_id", empresaId)
      .maybeSingle(),
    supabaseAdmin.from("empresas").select("plano").eq("id", empresaId).single(),
  ]);

  // Erro de banco: falha de verdade, para o webhook responder erro e o
  // Asaas reenviar o aviso depois.
  if (erroAssinatura || erroEmpresa) {
    throw new Error(`Erro ao ler a assinatura: ${(erroAssinatura || erroEmpresa)!.message}`);
  }

  if (!assinatura || !empresa) return;

  const decisao = decidirPlano(empresaId, pagamento, assinatura);
  if (!decisao) return;

  if (decisao.tipo === "diferenca") {
    const plano = decisao.plano;

    await supabaseAdmin
      .from("assinaturas")
      .update({ plano, upgrade_pagamento_id: null, updated_at: new Date().toISOString() })
      .eq("empresa_id", empresaId);

    if (plano !== empresa.plano) {
      await supabaseAdmin.from("empresas").update({ plano }).eq("id", empresaId);
    }
    return;
  }

  const planoContratado = decisao.plano;

  // Mensalidade paga antes da diferença: a diferença não é mais devida.
  if (assinatura.upgrade_pagamento_id) {
    await removerCobranca(assinatura.upgrade_pagamento_id).catch((error) =>
      console.error("Erro ao remover cobrança de diferença", error),
    );
    await supabaseAdmin.from("pagamentos").update({ status: "DELETED" }).eq("id", assinatura.upgrade_pagamento_id);
  }

  if (assinatura.upgrade_pagamento_id) {
    await supabaseAdmin
      .from("assinaturas")
      .update({ upgrade_pagamento_id: null, updated_at: new Date().toISOString() })
      .eq("empresa_id", empresaId);
  }

  if (planoContratado !== empresa.plano) {
    await supabaseAdmin.from("empresas").update({ plano: planoContratado }).eq("id", empresaId);
  }
}

// O que um pagamento confirmado muda no plano (sem banco; testada em
// assinatura.test.ts):
//   - diferença de upgrade (pelo id guardado ou pela referência
//     "upgrade:<loja>:<plano>"): vale o plano da diferença (sem plano na
//     referência, só pode ser o Pro);
//   - mensalidade da assinatura atual já com o valor do plano contratado:
//     vale o plano contratado. A mensalidade do mês pago antes da troca
//     tem o valor antigo (e pode receber outro aviso, ex.: CONFIRMED e
//     depois RECEIVED no cartão), então não conta;
//   - qualquer outro pagamento: nada muda.
export function decidirPlano(
  empresaId: string,
  pagamento: Pick<AsaasPagamento, "id" | "subscription" | "value" | "externalReference">,
  assinatura: { plano: PlanoId | null; valor: number | null; asaas_subscription_id: string | null; upgrade_pagamento_id: string | null },
): { tipo: "diferenca" | "mensalidade"; plano: PlanoId } | null {
  const [prefixo, loja, planoRef] = (pagamento.externalReference || "").split(":");

  if (pagamento.id === assinatura.upgrade_pagamento_id || (prefixo === "upgrade" && loja === empresaId)) {
    return { tipo: "diferenca", plano: planoRef && planoRef in PLANOS ? (planoRef as PlanoId) : "pro" };
  }

  if (
    assinatura.plano &&
    pagamento.subscription &&
    pagamento.subscription === assinatura.asaas_subscription_id &&
    Number(pagamento.value) === Number(assinatura.valor)
  ) {
    return { tipo: "mensalidade", plano: assinatura.plano };
  }

  return null;
}

// Confere no Asaas as cobranças da loja e aplica o que o webhook não
// aplicou (aviso perdido, fila do webhook pausada...). Usada ao abrir a
// tela de Assinatura.
export async function conferirNoAsaas(empresaId: string) {
  const { data: assinatura, error } = await supabaseAdmin
    .from("assinaturas")
    .select("asaas_subscription_id, upgrade_pagamento_id")
    .eq("empresa_id", empresaId)
    .maybeSingle();

  if (error) throw new Error(`Erro ao ler a assinatura: ${error.message}`);
  if (!assinatura) return;

  if (assinatura.asaas_subscription_id) {
    await sincronizarCobrancas(empresaId, assinatura.asaas_subscription_id);
  }

  // Diferenças de upgrade (pela referência, mesmo que o id não tenha sido
  // guardado).
  const avulsas = new Map<string, AsaasPagamento>();
  for (const referencia of [`upgrade:${empresaId}`, ...Object.keys(PLANOS).map((p) => `upgrade:${empresaId}:${p}`)]) {
    for (const cobranca of await listarCobrancasPorReferencia(referencia)) avulsas.set(cobranca.id, cobranca);
  }

  if (assinatura.upgrade_pagamento_id && !avulsas.has(assinatura.upgrade_pagamento_id)) {
    const cobranca = await buscarCobranca(assinatura.upgrade_pagamento_id).catch(() => null);
    if (cobranca) avulsas.set(cobranca.id, cobranca);
  }

  for (const cobranca of avulsas.values()) await salvarPagamento(empresaId, cobranca);

  await recalcularStatus(empresaId);

  // Só as diferenças pagas: aplicar mensalidades antigas aqui poderia
  // antecipar uma redução de plano agendada (isso fica com o webhook).
  const pagas = [...avulsas.values()]
    .filter((c) => PAGOS.includes(c.status) && !c.deleted)
    .sort((a, b) => (a.paymentDate || a.dueDate).localeCompare(b.paymentDate || b.dueDate));

  for (const cobranca of pagas) await aplicarPlanoContratado(empresaId, cobranca);
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
    if (PAGOS.includes(pagamento.status)) await aplicarPlanoContratado(empresaId, pagamento);
    await atualizarSuspensao(empresaId);
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
      await atualizarSuspensao(empresaId);
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
