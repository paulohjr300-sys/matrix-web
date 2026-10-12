import { NextResponse } from "next/server";
import { requireRole } from "../../../lib/auth-server";
import { asaasConfigurado, AsaasError } from "../../../lib/billing/asaas";
import { assinar, atualizarSuspensao, conferirNoAsaas, FORMAS_PAGAMENTO, situacaoDaLoja, type FormaPagamento } from "../../../lib/billing/assinatura";
import { PLANOS, type PlanoId } from "../../../lib/planos";

export const maxDuration = 30;

// Situação da assinatura da loja (avisos e bloqueio do painel). O
// histórico de cobranças só vai para o administrador da loja.
export async function GET(request: Request) {
  const auth = await requireRole(["ADMIN", "GERENTE", "VENDEDOR"]);
  if (!auth.ok) return auth.response;

  try {
    // Administrador na tela de Assinatura: confere no Asaas o que o webhook
    // possa não ter aplicado.
    if (auth.role === "ADMIN" && asaasConfigurado() && new URL(request.url).searchParams.has("conferir")) {
      await conferirNoAsaas(auth.empresaId).catch((error) => console.error("Erro ao conferir no Asaas", error));
    }

    // Aproveita a consulta para manter o site da loja em dia com o bloqueio.
    await atualizarSuspensao(auth.empresaId).catch((error) => console.error(error));
    const situacao = await situacaoDaLoja(auth.empresaId);
    const admin = auth.role === "ADMIN";

    return NextResponse.json({
      status: situacao.status,
      plano: situacao.plano,
      trialTerminaEm: situacao.trialTerminaEm,
      diasDeTeste: situacao.diasDeTeste,
      bloqueado: situacao.bloqueado,
      motivo: situacao.motivo,
      admin,
      cobrancaDisponivel: asaasConfigurado(),
      ...(admin
        ? {
            temAssinatura: situacao.temAssinatura,
            assinatura: situacao.assinatura
              ? {
                  plano: situacao.assinatura.plano,
                  valor: situacao.assinatura.valor === null ? null : Number(situacao.assinatura.valor),
                  formaPagamento: situacao.assinatura.forma_pagamento,
                  proximoVencimento: situacao.assinatura.proximo_vencimento,
                  temDocumento: Boolean(situacao.assinatura.cpf_cnpj),
                }
              : null,
            faturaEmAberto: situacao.faturaEmAberto,
            upgradePendente: situacao.upgradePendente
              ? {
                  plano: situacao.assinatura?.plano,
                  valor: situacao.upgradePendente.valor,
                  fatura_url: situacao.upgradePendente.fatura_url,
                }
              : null,
            trocaAgendada: situacao.trocaAgendada,
            pagamentos: situacao.pagamentos.map((p) => ({
              id: p.id,
              valor: p.valor,
              status: p.status,
              forma_pagamento: p.forma_pagamento,
              vencimento: p.vencimento,
              pago_em: p.pago_em,
              fatura_url: p.fatura_url,
            })),
          }
        : {}),
    });
  } catch (error) {
    console.error("Erro ao consultar assinatura", error);
    return NextResponse.json({ message: "Não foi possível consultar a assinatura." }, { status: 500 });
  }
}

// Contratar ou trocar de plano.
export async function POST(request: Request) {
  const auth = await requireRole(["ADMIN"]);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const plano = body.plano as PlanoId;
  const formaPagamento = body.formaPagamento as FormaPagamento;

  if (!(plano in PLANOS)) {
    return NextResponse.json({ message: "Plano inválido." }, { status: 400 });
  }

  if (!FORMAS_PAGAMENTO.includes(formaPagamento)) {
    return NextResponse.json({ message: "Forma de pagamento inválida." }, { status: 400 });
  }

  try {
    const resultado = await assinar(auth.empresaId, {
      plano,
      formaPagamento,
      cpfCnpj: typeof body.cpfCnpj === "string" ? body.cpfCnpj : undefined,
    });

    await atualizarSuspensao(auth.empresaId).catch((error) => console.error(error));

    return NextResponse.json(resultado);
  } catch (error) {
    if (error instanceof AsaasError) {
      return NextResponse.json({ message: error.message }, { status: error.status >= 500 ? 502 : 400 });
    }

    console.error("Erro ao contratar plano", error);
    return NextResponse.json({ message: "Não foi possível contratar o plano." }, { status: 500 });
  }
}
