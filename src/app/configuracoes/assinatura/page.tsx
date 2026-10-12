'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check, ExternalLink, Loader2 } from 'lucide-react'

import { PageContainer } from '../../components/page-container'
import { RouteGuard } from '../../components/auth/route-guard'
import { Toast } from '../../components/ui/toast'
import { DIAS_TOLERANCIA, formatarPreco, PLANOS, type PlanoId } from '../../../lib/planos'

type Pagamento = {
    id: string
    valor: number
    status: string
    forma_pagamento: string | null
    vencimento: string
    pago_em: string | null
    fatura_url: string | null
}

type Situacao = {
    status: 'trial' | 'ativa' | 'inadimplente' | 'cancelada'
    plano: PlanoId
    trialTerminaEm: string | null
    diasDeTeste: number | null
    bloqueado: boolean
    motivo: string | null
    cobrancaDisponivel: boolean
    temAssinatura: boolean
    assinatura: {
        plano: PlanoId | null
        valor: number | null
        formaPagamento: string | null
        proximoVencimento: string | null
        temDocumento: boolean
    } | null
    faturaEmAberto: Pagamento | null
    upgradePendente: { plano: PlanoId; valor: number; fatura_url: string | null } | null
    trocaAgendada: { plano: PlanoId; aPartirDe: string | null } | null
    pagamentos: Pagamento[]
}

const RECURSOS: Record<PlanoId, string[]> = {
    basico: ['Estoque com tabela FIPE', 'Funil de vendas (CRM)', 'Site da loja com sua marca', 'Custos, vendas e DRE'],
    pro: ['Tudo do Básico', 'Mercado Livre, OLX e Webmotors', 'Catálogo do Facebook e Instagram', 'Domínio próprio no site'],
}

const STATUS_LOJA: Record<Situacao['status'], { texto: string; estilo: string }> = {
    trial: { texto: 'Teste grátis', estilo: 'bg-brand-50 text-brand-700' },
    ativa: { texto: 'Ativa', estilo: 'bg-emerald-50 text-emerald-700' },
    inadimplente: { texto: 'Pagamento em atraso', estilo: 'bg-amber-50 text-amber-700' },
    cancelada: { texto: 'Cancelada', estilo: 'bg-red-50 text-red-700' },
}

const STATUS_COBRANCA: Record<string, { texto: string; estilo: string }> = {
    PENDING: { texto: 'Aguardando', estilo: 'bg-zinc-100 text-zinc-700' },
    OVERDUE: { texto: 'Vencida', estilo: 'bg-red-50 text-red-700' },
    RECEIVED: { texto: 'Paga', estilo: 'bg-emerald-50 text-emerald-700' },
    CONFIRMED: { texto: 'Paga', estilo: 'bg-emerald-50 text-emerald-700' },
    RECEIVED_IN_CASH: { texto: 'Paga', estilo: 'bg-emerald-50 text-emerald-700' },
    REFUNDED: { texto: 'Estornada', estilo: 'bg-zinc-100 text-zinc-600' },
}

const FORMAS = [
    { id: 'UNDEFINED', nome: 'Pix ou boleto', descricao: 'Você recebe a fatura todo mês e escolhe como pagar.' },
    { id: 'CREDIT_CARD', nome: 'Cartão de crédito', descricao: 'Informe o cartão na primeira fatura; depois a cobrança é automática.' },
]

function data(valor: string | null) {
    if (!valor) return '-'
    const [ano, mes, dia] = valor.slice(0, 10).split('-')
    return `${dia}/${mes}/${ano}`
}

function mascaraDocumento(valor: string) {
    const d = valor.replace(/\D/g, '').slice(0, 14)

    if (d.length <= 11) {
        return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2')
    }

    return d
        .replace(/^(\d{2})(\d)/, '$1.$2')
        .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
        .replace(/\.(\d{3})(\d)/, '.$1/$2')
        .replace(/(\d{4})(\d)/, '$1-$2')
}

export default function AssinaturaPage() {
    const [situacao, setSituacao] = useState<Situacao | null>(null)
    const [plano, setPlano] = useState<PlanoId>('pro')
    const [forma, setForma] = useState('UNDEFINED')
    const [documento, setDocumento] = useState('')
    const [enviando, setEnviando] = useState(false)

    const [toast, setToast] = useState({
        open: false,
        type: 'success' as 'success' | 'error',
        title: '',
        description: '',
    })

    function showToast(type: 'success' | 'error', title: string, description?: string) {
        setToast({ open: true, type, title, description: description || '' })

        setTimeout(() => {
            setToast((current) => ({ ...current, open: false }))
        }, 4000)
    }

    const load = useCallback(async () => {
        const response = await fetch('/api/assinatura?conferir=1', { cache: 'no-store' })
        const result = await response.json().catch(() => null)

        if (!response.ok || !result) {
            showToast('error', 'Assinatura', result?.message || 'Não foi possível carregar a assinatura.')
            return
        }

        setSituacao(result)
        setPlano(result.assinatura?.plano || result.plano || 'pro')
        if (result.assinatura?.formaPagamento) setForma(result.assinatura.formaPagamento)
    }, [])

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial
        void load()
    }, [load])

    async function contratar() {
        setEnviando(true)

        try {
            const response = await fetch('/api/assinatura', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ plano, formaPagamento: forma, cpfCnpj: documento }),
            })
            const result = await response.json().catch(() => ({}))

            if (!response.ok) {
                showToast('error', 'Não foi possível contratar', result.message)
                return
            }

            if (result.diferenca) {
                showToast(
                    'success',
                    'Falta pagar a diferença',
                    `O plano ${PLANOS[plano].nome} é liberado assim que a diferença de ${formatarPreco(result.diferenca)} for paga.`
                )
            } else if (result.agendado) {
                showToast('success', 'Troca agendada', `O plano ${PLANOS[plano].nome} começa a valer na próxima mensalidade.`)
            } else {
                showToast(
                    'success',
                    result.nova ? 'Assinatura criada' : 'Plano atualizado',
                    result.faturaUrl ? 'A fatura já está disponível abaixo.' : undefined
                )
            }
            await load()
        } finally {
            setEnviando(false)
        }
    }

    const assinaturaAtiva = Boolean(situacao?.temAssinatura && situacao.status !== 'cancelada')
    const precisaDocumento = !situacao?.assinatura?.temDocumento
    const mudouAlgo =
        !assinaturaAtiva ||
        plano !== situacao?.assinatura?.plano ||
        forma !== situacao?.assinatura?.formaPagamento
    const status = situacao ? STATUS_LOJA[situacao.status] : null

    return (
        <RouteGuard allowedRoles={['ADMIN']}>
            <Toast
                open={toast.open}
                type={toast.type}
                title={toast.title}
                description={toast.description}
                onClose={() => setToast((current) => ({ ...current, open: false }))}
            />

            <PageContainer title="Assinatura" description="Plano do painel, forma de pagamento e faturas.">
                <Link
                    href="/configuracoes"
                    className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-zinc-600 hover:text-zinc-900"
                >
                    <ArrowLeft size={16} /> Configurações
                </Link>

                {!situacao ? (
                    <div className="flex items-center gap-2 text-zinc-500">
                        <Loader2 size={18} className="animate-spin" /> Carregando...
                    </div>
                ) : (
                    <div className="space-y-6">
                        {/* Situação */}
                        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-zinc-200">
                            <div className="flex flex-wrap items-center gap-3">
                                <h2 className="text-lg font-black text-zinc-900">Plano {PLANOS[situacao.plano].nome}</h2>
                                {status && (
                                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${status.estilo}`}>
                                        {status.texto}
                                    </span>
                                )}
                            </div>

                            <div className="mt-3 space-y-1 text-sm text-zinc-600">
                                {situacao.status === 'trial' && situacao.diasDeTeste !== null && (
                                    <p>
                                        {situacao.diasDeTeste > 0
                                            ? `O teste grátis termina em ${situacao.diasDeTeste} dia(s), em ${data(situacao.trialTerminaEm)}.`
                                            : situacao.diasDeTeste === 0
                                                ? 'O teste grátis termina hoje.'
                                                : `O teste grátis terminou em ${data(situacao.trialTerminaEm)}.`}
                                        {situacao.temAssinatura && ' A primeira mensalidade vence no fim do teste.'}
                                    </p>
                                )}

                                {situacao.assinatura?.valor && assinaturaAtiva && (
                                    <p>
                                        {formatarPreco(situacao.assinatura.valor)}/mês ·{' '}
                                        {FORMAS.find((f) => f.id === situacao.assinatura?.formaPagamento)?.nome || 'Pix ou boleto'}
                                        {situacao.assinatura.proximoVencimento &&
                                            ` · próxima cobrança em ${data(situacao.assinatura.proximoVencimento)}`}
                                    </p>
                                )}

                                {situacao.motivo && <p className="font-semibold text-red-700">{situacao.motivo}</p>}

                                {situacao.status === 'inadimplente' && !situacao.bloqueado && (
                                    <p className="text-amber-700">
                                        Pague a fatura em atraso para evitar o bloqueio do painel ({DIAS_TOLERANCIA} dias após o
                                        vencimento).
                                    </p>
                                )}
                            </div>

                            {situacao.upgradePendente && (
                                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-brand-50 p-4 ring-1 ring-brand-200">
                                    <div>
                                        <p className="font-bold text-zinc-900">
                                            Diferença para o plano {PLANOS[situacao.upgradePendente.plano]?.nome}:{' '}
                                            {formatarPreco(situacao.upgradePendente.valor)}
                                        </p>
                                        <p className="text-sm text-zinc-600">
                                            Proporcional aos dias que faltam do mês já pago. O plano é liberado assim que
                                            ela for paga.
                                        </p>
                                    </div>
                                    {situacao.upgradePendente.fatura_url && (
                                        <a
                                            href={situacao.upgradePendente.fatura_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-700"
                                        >
                                            Pagar diferença <ExternalLink size={16} />
                                        </a>
                                    )}
                                </div>
                            )}

                            {situacao.trocaAgendada && (
                                <p className="mt-5 rounded-2xl bg-zinc-50 p-4 text-sm text-zinc-700 ring-1 ring-zinc-200">
                                    O plano <strong>{PLANOS[situacao.trocaAgendada.plano]?.nome}</strong> começa a valer na
                                    próxima mensalidade
                                    {situacao.trocaAgendada.aPartirDe && ` (${data(situacao.trocaAgendada.aPartirDe)})`}. Até
                                    lá, continua o plano {PLANOS[situacao.plano].nome}, que já está pago.
                                </p>
                            )}

                            {situacao.faturaEmAberto?.fatura_url && (
                                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-ponteiro/10 p-4 ring-1 ring-ponteiro/30">
                                    <div>
                                        <p className="font-bold text-zinc-900">
                                            Fatura de {formatarPreco(situacao.faturaEmAberto.valor)}
                                        </p>
                                        <p className="text-sm text-zinc-600">
                                            {situacao.faturaEmAberto.status === 'OVERDUE' ? 'Venceu' : 'Vence'} em{' '}
                                            {data(situacao.faturaEmAberto.vencimento)}
                                        </p>
                                    </div>
                                    <a
                                        href={situacao.faturaEmAberto.fatura_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-700"
                                    >
                                        Pagar fatura <ExternalLink size={16} />
                                    </a>
                                </div>
                            )}
                        </section>

                        {/* Contratar / trocar */}
                        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-zinc-200">
                            <h2 className="text-lg font-black text-zinc-900">
                                {assinaturaAtiva ? 'Trocar plano ou forma de pagamento' : 'Escolha seu plano'}
                            </h2>

                            {!situacao.cobrancaDisponivel ? (
                                <p className="mt-3 text-sm text-zinc-600">
                                    A contratação pelo painel ainda não está disponível. Fale com o suporte para assinar.
                                </p>
                            ) : (
                                <>
                                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                                        {(Object.keys(PLANOS) as PlanoId[]).map((id) => {
                                            const item = PLANOS[id]
                                            const selecionado = plano === id

                                            return (
                                                <button
                                                    key={id}
                                                    type="button"
                                                    disabled={!item.preco}
                                                    onClick={() => setPlano(id)}
                                                    className={`rounded-2xl p-5 text-left ring-2 transition disabled:cursor-not-allowed disabled:opacity-50 ${selecionado ? 'bg-brand-50 ring-brand-500' : 'bg-white ring-zinc-200 hover:ring-brand-200'}`}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-lg font-black text-zinc-900">{item.nome}</span>
                                                        {selecionado && <Check size={20} className="text-brand-600" />}
                                                    </div>
                                                    <p className="mt-1 text-2xl font-black text-brand-700">
                                                        {item.preco ? (
                                                            <>
                                                                {formatarPreco(item.preco)}
                                                                <span className="text-sm font-semibold text-zinc-500">/mês</span>
                                                            </>
                                                        ) : (
                                                            <span className="text-base">Indisponível</span>
                                                        )}
                                                    </p>
                                                    <ul className="mt-3 space-y-1 text-sm text-zinc-600">
                                                        {RECURSOS[id].map((recurso) => (
                                                            <li key={recurso} className="flex items-center gap-2">
                                                                <Check size={14} className="text-brand-600" /> {recurso}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </button>
                                            )
                                        })}
                                    </div>

                                    <div className="mt-6 grid gap-4 md:grid-cols-2">
                                        {FORMAS.map((item) => (
                                            <label
                                                key={item.id}
                                                className={`flex cursor-pointer gap-3 rounded-2xl p-4 ring-2 transition ${forma === item.id ? 'bg-brand-50 ring-brand-500' : 'ring-zinc-200'}`}
                                            >
                                                <input
                                                    type="radio"
                                                    name="forma"
                                                    checked={forma === item.id}
                                                    onChange={() => setForma(item.id)}
                                                    className="mt-1"
                                                />
                                                <span>
                                                    <span className="block font-bold text-zinc-900">{item.nome}</span>
                                                    <span className="text-sm text-zinc-600">{item.descricao}</span>
                                                </span>
                                            </label>
                                        ))}
                                    </div>

                                    {precisaDocumento && (
                                        <div className="mt-6 max-w-sm">
                                            <label className="text-sm font-medium text-zinc-700">CPF ou CNPJ do pagador</label>
                                            <input
                                                value={documento}
                                                onChange={(event) => setDocumento(mascaraDocumento(event.target.value))}
                                                placeholder="00.000.000/0000-00"
                                                inputMode="numeric"
                                                className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none transition-all focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
                                            />
                                            <p className="mt-1 text-xs text-zinc-500">Usado na fatura e na nota fiscal.</p>
                                        </div>
                                    )}

                                    <button
                                        type="button"
                                        onClick={() => void contratar()}
                                        disabled={enviando || !mudouAlgo || !PLANOS[plano].preco}
                                        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-brand-700 disabled:opacity-50"
                                    >
                                        {enviando && <Loader2 size={16} className="animate-spin" />}
                                        {assinaturaAtiva ? 'Salvar alterações' : 'Assinar'}
                                    </button>

                                    {assinaturaAtiva && (
                                        <p className="mt-2 text-xs text-zinc-500">
                                            Subir de plano: você paga só a diferença proporcional aos dias que faltam do
                                            mês já pago. Descer de plano: vale a partir da próxima mensalidade.
                                        </p>
                                    )}

                                    {!assinaturaAtiva && situacao.status === 'trial' && (situacao.diasDeTeste ?? 0) > 0 && (
                                        <p className="mt-2 text-xs text-zinc-500">
                                            Você continua no teste grátis: a primeira cobrança vence só em{' '}
                                            {data(situacao.trialTerminaEm)}.
                                        </p>
                                    )}
                                </>
                            )}
                        </section>

                        {/* Histórico */}
                        {situacao.pagamentos.length > 0 && (
                            <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-zinc-200">
                                <h2 className="text-lg font-black text-zinc-900">Faturas</h2>

                                <div className="mt-4 overflow-x-auto">
                                    <table className="w-full min-w-[480px] text-sm">
                                        <thead>
                                            <tr className="text-left text-xs uppercase text-zinc-500">
                                                <th className="py-2">Vencimento</th>
                                                <th className="py-2">Valor</th>
                                                <th className="py-2">Situação</th>
                                                <th className="py-2">Pago em</th>
                                                <th className="py-2" />
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {situacao.pagamentos.map((pagamento) => {
                                                const st = STATUS_COBRANCA[pagamento.status] || {
                                                    texto: pagamento.status,
                                                    estilo: 'bg-zinc-100 text-zinc-600',
                                                }

                                                return (
                                                    <tr key={pagamento.id} className="border-t border-zinc-100">
                                                        <td className="py-3">{data(pagamento.vencimento)}</td>
                                                        <td className="py-3">{formatarPreco(pagamento.valor)}</td>
                                                        <td className="py-3">
                                                            <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${st.estilo}`}>
                                                                {st.texto}
                                                            </span>
                                                        </td>
                                                        <td className="py-3">{data(pagamento.pago_em)}</td>
                                                        <td className="py-3 text-right">
                                                            {pagamento.fatura_url && (
                                                                <a
                                                                    href={pagamento.fatura_url}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="font-semibold text-brand-600 hover:underline"
                                                                >
                                                                    Ver fatura
                                                                </a>
                                                            )}
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </section>
                        )}
                    </div>
                )}
            </PageContainer>
        </RouteGuard>
    )
}
