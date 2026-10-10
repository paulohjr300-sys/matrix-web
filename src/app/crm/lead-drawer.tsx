'use client'

import { useEffect, useState } from 'react'
import {
    CalendarClock,
    Car,
    CheckCircle2,
    DollarSign,
    Flame,
    Loader2,
    MessageCircle,
    Phone,
    Send,
    Trash2,
    X,
} from 'lucide-react'

import { supabase } from '../../lib/supabase'
import { CurrencyInput } from '../components/currency-input'
import { ConfirmDialog } from '../components/ui/confirm-dialog'
import {
    ETAPAS,
    LEAD_SELECT,
    MOTIVOS_PERDA,
    ORIGENS,
    PROXIMAS_ACOES,
    TEMPERATURAS,
    formatDateTime,
    formatMoney,
    iniciais,
    slaEstourado,
    tempoDesde,
    veiculoNome,
    whatsappUrl,
    type CrmLead,
    type Etapa,
    type Membro,
} from './crm-shared'

type Atividade = {
    id: string
    tipo: string
    descricao: string | null
    user_id: string | null
    created_at: string
}

export type VeiculoOpcao = {
    id: string
    plate: string
    advertised_price: number | null
    status: string
    brands?: { name: string } | null
    vehicle_models?: { name: string } | null
}

const TIPOS_ATIVIDADE = [
    { value: 'NOTA', label: 'Nota' },
    { value: 'LIGACAO', label: 'Ligação' },
    { value: 'WHATSAPP', label: 'WhatsApp' },
    { value: 'EMAIL', label: 'E-mail' },
    { value: 'VISITA', label: 'Visita' },
    { value: 'PROPOSTA', label: 'Proposta' },
]

const TIPO_LABEL: Record<string, string> = {
    ...Object.fromEntries(TIPOS_ATIVIDADE.map((tipo) => [tipo.value, tipo.label])),
    ETAPA: 'Etapa',
}

const PAGAMENTOS = ['À vista', 'Financiamento', 'Pix', 'Cartão', 'Troca + volta', 'Consórcio', 'Não informado']

const inputClass =
    'mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10'

function parseCurrency(value: string) {
    return Number(value.replace(/\D/g, '')) / 100
}

function toCurrencyInput(value: number | null | undefined) {
    return value ? value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : ''
}

// datetime-local usa horário local sem fuso.
function toLocalInput(value: string | null) {
    if (!value) return ''
    const date = new Date(value)
    const offset = date.getTimezoneOffset() * 60000

    return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function veiculoLabel(v: VeiculoOpcao) {
    return [v.brands?.name, v.vehicle_models?.name, v.plate].filter(Boolean).join(' · ')
}

export function LeadDrawer({
    lead,
    equipe,
    veiculos,
    onClose,
    onChanged,
    onDeleted,
    showToast,
}: {
    lead: CrmLead
    equipe: Membro[]
    veiculos: VeiculoOpcao[]
    onClose: () => void
    onChanged: (lead: CrmLead) => void
    onDeleted: (leadId: string) => void
    showToast: (type: 'success' | 'error', title: string, description?: string) => void
}) {
    const [atividades, setAtividades] = useState<Atividade[]>([])
    const [tipoAtividade, setTipoAtividade] = useState('NOTA')
    const [textoAtividade, setTextoAtividade] = useState('')
    const [salvandoAtividade, setSalvandoAtividade] = useState(false)

    const [valor, setValor] = useState(toCurrencyInput(lead.valor))
    const [acaoTipo, setAcaoTipo] = useState(lead.proxima_acao_tipo || 'Ligar')
    const [acaoQuando, setAcaoQuando] = useState(toLocalInput(lead.proxima_acao_em))

    const [motivoPerda, setMotivoPerda] = useState<string | null>(null)

    const [vendaAberta, setVendaAberta] = useState(false)
    const [vendaVeiculo, setVendaVeiculo] = useState(lead.vehicle_id || '')
    const [vendaValor, setVendaValor] = useState(toCurrencyInput(lead.valor ?? lead.vehicles?.advertised_price))
    const [vendaPagamento, setVendaPagamento] = useState('Financiamento')
    const [vendaData, setVendaData] = useState(new Date().toISOString().slice(0, 10))
    const [vendendo, setVendendo] = useState(false)
    const [excluirAberto, setExcluirAberto] = useState(false)
    const [excluindo, setExcluindo] = useState(false)

    async function loadAtividades() {
        const { data } = await supabase
            .from('lead_atividades')
            .select('id, tipo, descricao, user_id, created_at')
            .eq('lead_id', lead.id)
            .order('created_at', { ascending: false })

        setAtividades((data || []) as Atividade[])
    }

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- carga ao abrir o lead
        void loadAtividades()
        // Recarrega quando a etapa muda (o banco registra a mudança no histórico).
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lead.id, lead.status])

    async function update(changes: Partial<CrmLead>, sucesso?: string) {
        const { data, error } = await supabase
            .from('leads')
            .update({ ...changes, updated_at: new Date().toISOString() })
            .eq('id', lead.id)
            .select(LEAD_SELECT)
            .single()

        if (error || !data) {
            showToast('error', 'Erro', error?.message || 'Não foi possível salvar.')
            return null
        }

        onChanged(data as unknown as CrmLead)
        if (sucesso) showToast('success', sucesso)

        return data
    }

    async function registrar(tipo: string, descricao: string | null) {
        const { error } = await supabase.from('lead_atividades').insert({
            lead_id: lead.id,
            tipo,
            descricao,
        })

        if (error) {
            showToast('error', 'Erro', 'Não foi possível registrar a atividade.')
            return false
        }

        // O banco marca o primeiro contato; recarrega o lead para o SLA.
        const { data } = await supabase.from('leads').select(LEAD_SELECT).eq('id', lead.id).single()
        if (data) onChanged(data as unknown as CrmLead)

        await loadAtividades()
        return true
    }

    async function handleRegistrar() {
        if (!textoAtividade.trim() && tipoAtividade === 'NOTA') return

        setSalvandoAtividade(true)
        const ok = await registrar(tipoAtividade, textoAtividade.trim() || null)
        setSalvandoAtividade(false)

        if (ok) setTextoAtividade('')
    }

    async function handleEtapa(etapa: Etapa) {
        if (etapa === lead.status) return

        if (etapa === 'PERDIDO') {
            setMotivoPerda(MOTIVOS_PERDA[0])
            return
        }

        await update({ status: etapa, motivo_perda: null }, 'Etapa atualizada')

        if (etapa === 'FECHADO' && !lead.sale_generated) setVendaAberta(true)
    }

    async function confirmarPerda() {
        if (!motivoPerda) return

        await update(
            { status: 'PERDIDO', motivo_perda: motivoPerda, proxima_acao_em: null, proxima_acao_tipo: null },
            'Lead marcado como perdido'
        )
        setMotivoPerda(null)
    }

    async function salvarProximaAcao() {
        if (!acaoQuando) {
            showToast('error', 'Informe a data', 'Escolha o dia e a hora da próxima ação.')
            return
        }

        await update(
            { proxima_acao_tipo: acaoTipo, proxima_acao_em: new Date(acaoQuando).toISOString() },
            'Próxima ação agendada'
        )
    }

    async function concluirProximaAcao() {
        const tipo = lead.proxima_acao_tipo || 'Ação'

        await registrar('NOTA', `Concluído: ${tipo}`)
        await update({ proxima_acao_em: null, proxima_acao_tipo: null })
        setAcaoQuando('')
    }

    async function excluir() {
        setExcluindo(true)

        const { error } = await supabase.from('leads').delete().eq('id', lead.id)

        setExcluindo(false)
        setExcluirAberto(false)

        if (error) {
            showToast('error', 'Não foi possível excluir', error.message)
            return
        }

        showToast('success', 'Lead excluído')
        onDeleted(lead.id)
    }

    async function gerarVenda() {
        if (!vendaVeiculo) {
            showToast('error', 'Escolha o veículo', 'Selecione o veículo vendido.')
            return
        }

        const preco = parseCurrency(vendaValor)

        if (!preco) {
            showToast('error', 'Informe o valor', 'Informe o valor da venda.')
            return
        }

        setVendendo(true)

        try {
            const saleData = {
                vehicle_id: vendaVeiculo,
                sale_date: vendaData,
                advertised_price: preco,
                sale_price: preco,
                payment_method: vendaPagamento,
                notes: `Venda gerada pelo CRM (lead ${lead.nome || 'sem nome'}).`,
            }

            const { data: existente } = await supabase
                .from('vehicle_sales')
                .select('id')
                .eq('vehicle_id', vendaVeiculo)
                .maybeSingle()

            const venda = existente?.id
                ? await supabase.from('vehicle_sales').update(saleData).eq('id', existente.id)
                : await supabase.from('vehicle_sales').insert(saleData)

            if (venda.error) throw new Error(venda.error.message)

            const veiculo = await supabase
                .from('vehicles')
                .update({ status: 'VENDIDO', is_published: false })
                .eq('id', vendaVeiculo)

            if (veiculo.error) throw new Error(veiculo.error.message)

            await update(
                {
                    status: 'FECHADO',
                    sale_generated: true,
                    vehicle_id: vendaVeiculo,
                    valor: preco,
                    proxima_acao_em: null,
                    proxima_acao_tipo: null,
                },
                'Venda registrada'
            )

            // Encerra os anúncios do veículo nos portais.
            void fetch('/api/integracoes/sincronizar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ vehicleId: vendaVeiculo }),
            }).catch(() => null)

            setVendaAberta(false)
        } catch (error) {
            showToast('error', 'Erro ao registrar venda', (error as Error).message)
        } finally {
            setVendendo(false)
        }
    }

    const whatsapp = whatsappUrl(
        lead.telefone,
        `Olá${lead.nome ? `, ${lead.nome.split(' ')[0]}` : ''}! Tudo bem?`
    )
    const nomeMembro = (id: string | null) => equipe.find((m) => m.id === id)?.name || 'Sistema'
    const veiculo = veiculoNome(lead)
    const sla = slaEstourado(lead)

    return (
        <div className="fixed inset-0 z-[60] flex justify-end">
            <button type="button" aria-label="Fechar" onClick={onClose} className="absolute inset-0 bg-black/40" />

            <aside className="relative flex h-full w-full max-w-xl flex-col overflow-y-auto bg-white shadow-2xl">
                <header className="sticky top-0 z-10 border-b border-zinc-100 bg-white px-6 py-5">
                    <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                            <h2 className="truncate text-xl font-bold text-zinc-950">{lead.nome || 'Sem nome'}</h2>
                            <p className="mt-1 text-sm text-zinc-500">
                                {ORIGENS[lead.origem || ''] || lead.origem || 'Origem não informada'} · entrou há{' '}
                                {tempoDesde(lead.created_at)}
                                {sla && <span className="ml-2 font-semibold text-red-600">SLA estourado</span>}
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-xl bg-zinc-100 p-2 text-zinc-600 hover:bg-zinc-200"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                        {whatsapp && (
                            <a
                                href={whatsapp}
                                target="_blank"
                                rel="noreferrer"
                                onClick={() => void registrar('WHATSAPP', 'Conversa iniciada pelo WhatsApp')}
                                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                            >
                                <MessageCircle size={16} />
                                WhatsApp
                            </a>
                        )}
                        {lead.telefone && (
                            <a
                                href={`tel:${lead.telefone.replace(/\D/g, '')}`}
                                onClick={() => void registrar('LIGACAO', 'Ligação realizada')}
                                className="inline-flex items-center gap-2 rounded-xl bg-zinc-100 px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-200"
                            >
                                <Phone size={16} />
                                {lead.telefone}
                            </a>
                        )}
                        {lead.email && (
                            <a
                                href={`mailto:${lead.email}`}
                                className="inline-flex items-center rounded-xl bg-zinc-100 px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-200"
                            >
                                {lead.email}
                            </a>
                        )}
                    </div>
                </header>

                <div className="space-y-6 px-6 py-6">
                    {/* Etapa */}
                    <section>
                        <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">Etapa</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                            {ETAPAS.map((etapa) => (
                                <button
                                    key={etapa.value}
                                    type="button"
                                    onClick={() => void handleEtapa(etapa.value)}
                                    className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition ${lead.status === etapa.value
                                        ? 'bg-zinc-950 text-white ring-zinc-950'
                                        : 'bg-white text-zinc-600 ring-zinc-200 hover:bg-zinc-50'
                                        }`}
                                >
                                    <span className={`h-2 w-2 rounded-full ${etapa.dot}`} />
                                    {etapa.label}
                                </button>
                            ))}
                        </div>

                        {motivoPerda !== null && (
                            <div className="mt-3 rounded-2xl bg-zinc-50 p-4 ring-1 ring-zinc-200">
                                <label className="text-sm font-medium text-zinc-700">Motivo da perda</label>
                                <select value={motivoPerda} onChange={(e) => setMotivoPerda(e.target.value)} className={inputClass}>
                                    {MOTIVOS_PERDA.map((motivo) => (
                                        <option key={motivo}>{motivo}</option>
                                    ))}
                                </select>
                                <div className="mt-3 flex justify-end gap-2">
                                    <button type="button" onClick={() => setMotivoPerda(null)} className="rounded-xl px-3 py-2 text-sm font-semibold text-zinc-600 hover:bg-zinc-100">
                                        Cancelar
                                    </button>
                                    <button type="button" onClick={() => void confirmarPerda()} className="rounded-xl bg-zinc-950 px-3 py-2 text-sm font-semibold text-white">
                                        Marcar como perdido
                                    </button>
                                </div>
                            </div>
                        )}

                        {lead.status === 'PERDIDO' && lead.motivo_perda && motivoPerda === null && (
                            <p className="mt-2 text-sm text-zinc-500">Motivo: {lead.motivo_perda}</p>
                        )}
                    </section>

                    {/* Venda */}
                    {lead.sale_generated ? (
                        <p className="flex items-center gap-2 rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
                            <CheckCircle2 size={18} />
                            Venda registrada{veiculo ? ` · ${veiculo}` : ''}
                        </p>
                    ) : (
                        lead.status !== 'PERDIDO' && (
                            <section className="rounded-2xl ring-1 ring-zinc-200">
                                <button
                                    type="button"
                                    onClick={() => setVendaAberta((aberta) => !aberta)}
                                    className="flex w-full items-center gap-2 px-4 py-3 text-sm font-semibold text-zinc-800"
                                >
                                    <DollarSign size={16} className="text-emerald-600" />
                                    Registrar venda
                                </button>

                                {vendaAberta && (
                                    <div className="grid grid-cols-1 gap-3 border-t border-zinc-100 p-4 sm:grid-cols-2">
                                        <label className="sm:col-span-2">
                                            <span className="text-sm font-medium text-zinc-700">Veículo vendido</span>
                                            <select value={vendaVeiculo} onChange={(e) => setVendaVeiculo(e.target.value)} className={inputClass}>
                                                <option value="">Selecione</option>
                                                {veiculos.map((v) => (
                                                    <option key={v.id} value={v.id}>
                                                        {veiculoLabel(v)}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>
                                        <label>
                                            <span className="text-sm font-medium text-zinc-700">Valor da venda</span>
                                            <CurrencyInput value={vendaValor} onChange={setVendaValor} />
                                        </label>
                                        <label>
                                            <span className="text-sm font-medium text-zinc-700">Pagamento</span>
                                            <select value={vendaPagamento} onChange={(e) => setVendaPagamento(e.target.value)} className={inputClass}>
                                                {PAGAMENTOS.map((p) => (
                                                    <option key={p}>{p}</option>
                                                ))}
                                            </select>
                                        </label>
                                        <label>
                                            <span className="text-sm font-medium text-zinc-700">Data</span>
                                            <input type="date" value={vendaData} onChange={(e) => setVendaData(e.target.value)} className={inputClass} />
                                        </label>
                                        <div className="flex items-end justify-end">
                                            <button
                                                type="button"
                                                disabled={vendendo}
                                                onClick={() => void gerarVenda()}
                                                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                                            >
                                                {vendendo && <Loader2 size={16} className="animate-spin" />}
                                                Confirmar venda
                                            </button>
                                        </div>
                                        <p className="text-xs text-zinc-500 sm:col-span-2">
                                            O veículo passa para Vendido, sai do site e os anúncios nos portais são encerrados.
                                        </p>
                                    </div>
                                )}
                            </section>
                        )
                    )}

                    {/* Negócio */}
                    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <label>
                            <span className="text-sm font-medium text-zinc-700">Responsável</span>
                            <select
                                value={lead.responsavel_id || ''}
                                onChange={(e) => void update({ responsavel_id: e.target.value || null }, 'Responsável atualizado')}
                                className={inputClass}
                            >
                                <option value="">Não definido</option>
                                {equipe.map((membro) => (
                                    <option key={membro.id} value={membro.id}>
                                        {membro.name}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label>
                            <span className="text-sm font-medium text-zinc-700">Valor do negócio</span>
                            <CurrencyInput value={valor} onChange={setValor} />
                            {parseCurrency(valor) !== Number(lead.valor || 0) && (
                                <button
                                    type="button"
                                    onClick={() => void update({ valor: parseCurrency(valor) || null }, 'Valor atualizado')}
                                    className="mt-1 text-xs font-semibold text-brand-600 hover:underline"
                                >
                                    Salvar valor
                                </button>
                            )}
                        </label>

                        <label className="sm:col-span-2">
                            <span className="flex items-center gap-1.5 text-sm font-medium text-zinc-700">
                                <Car size={14} />
                                Veículo de interesse
                            </span>
                            <select
                                value={lead.vehicle_id || ''}
                                onChange={(e) => void update({ vehicle_id: e.target.value || null }, 'Veículo atualizado')}
                                className={inputClass}
                            >
                                <option value="">Nenhum</option>
                                {lead.vehicle_id && !veiculos.some((v) => v.id === lead.vehicle_id) && (
                                    <option value={lead.vehicle_id}>{veiculo || 'Veículo atual'}</option>
                                )}
                                {veiculos.map((v) => (
                                    <option key={v.id} value={v.id}>
                                        {veiculoLabel(v)}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <div className="sm:col-span-2">
                            <span className="flex items-center gap-1.5 text-sm font-medium text-zinc-700">
                                <Flame size={14} />
                                Temperatura
                            </span>
                            <div className="mt-1.5 flex gap-2">
                                {TEMPERATURAS.map((t) => (
                                    <button
                                        key={t.value}
                                        type="button"
                                        onClick={() => void update({ temperatura: lead.temperatura === t.value ? null : t.value })}
                                        className={`rounded-full px-3 py-1.5 text-xs font-bold ring-1 transition ${lead.temperatura === t.value ? t.className : 'bg-white text-zinc-500 ring-zinc-200 hover:bg-zinc-50'
                                            }`}
                                    >
                                        {t.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </section>

                    {/* Próxima ação */}
                    {lead.status !== 'FECHADO' && lead.status !== 'PERDIDO' && (
                        <section className="rounded-2xl bg-brand-50/50 p-4 ring-1 ring-brand-100">
                            <p className="flex items-center gap-2 text-sm font-bold text-zinc-900">
                                <CalendarClock size={16} className="text-brand-600" />
                                Próxima ação
                            </p>

                            {lead.proxima_acao_em && (
                                <p className="mt-2 text-sm text-zinc-700">
                                    {lead.proxima_acao_tipo} em {formatDateTime(lead.proxima_acao_em)}
                                    <button
                                        type="button"
                                        onClick={() => void concluirProximaAcao()}
                                        className="ml-3 text-xs font-semibold text-emerald-700 hover:underline"
                                    >
                                        Marcar como feita
                                    </button>
                                </p>
                            )}

                            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
                                <select value={acaoTipo} onChange={(e) => setAcaoTipo(e.target.value)} className={inputClass}>
                                    {PROXIMAS_ACOES.map((acao) => (
                                        <option key={acao}>{acao}</option>
                                    ))}
                                </select>
                                <input
                                    type="datetime-local"
                                    value={acaoQuando}
                                    onChange={(e) => setAcaoQuando(e.target.value)}
                                    className={inputClass}
                                />
                                <button
                                    type="button"
                                    onClick={() => void salvarProximaAcao()}
                                    className="mt-1.5 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
                                >
                                    Agendar
                                </button>
                            </div>
                        </section>
                    )}

                    {/* Registrar atividade */}
                    <section>
                        <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">Registrar atividade</p>
                        <div className="mt-2 flex gap-2">
                            <select
                                value={tipoAtividade}
                                onChange={(e) => setTipoAtividade(e.target.value)}
                                className="rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-500"
                            >
                                {TIPOS_ATIVIDADE.map((tipo) => (
                                    <option key={tipo.value} value={tipo.value}>
                                        {tipo.label}
                                    </option>
                                ))}
                            </select>
                            <input
                                value={textoAtividade}
                                onChange={(e) => setTextoAtividade(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') void handleRegistrar()
                                }}
                                placeholder="O que aconteceu? Ex: cliente pediu proposta com troca"
                                className="min-w-0 flex-1 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-500"
                            />
                            <button
                                type="button"
                                disabled={salvandoAtividade}
                                onClick={() => void handleRegistrar()}
                                className="rounded-xl bg-zinc-950 px-3 text-white hover:bg-zinc-800 disabled:opacity-50"
                                aria-label="Registrar"
                            >
                                {salvandoAtividade ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                            </button>
                        </div>
                    </section>

                    {/* Histórico */}
                    <section>
                        <p className="text-xs font-bold uppercase tracking-wide text-zinc-500">Histórico</p>

                        <ol className="mt-3 space-y-4 border-l border-zinc-200 pl-5">
                            {atividades.map((atividade) => (
                                <li key={atividade.id} className="relative">
                                    <span className="absolute -left-[27px] top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-zinc-100 text-[9px] font-bold text-zinc-600 ring-2 ring-white">
                                        {iniciais(nomeMembro(atividade.user_id))}
                                    </span>
                                    <p className="text-sm text-zinc-800">
                                        <span className="font-semibold">{TIPO_LABEL[atividade.tipo] || atividade.tipo}</span>
                                        {atividade.descricao ? ` · ${atividade.descricao}` : ''}
                                    </p>
                                    <p className="text-xs text-zinc-500">
                                        {nomeMembro(atividade.user_id)} · {formatDateTime(atividade.created_at)}
                                    </p>
                                </li>
                            ))}

                            <li className="relative">
                                <span className="absolute -left-[27px] top-0.5 h-5 w-5 rounded-full bg-sky-100 ring-2 ring-white" />
                                <p className="text-sm text-zinc-800">
                                    <span className="font-semibold">Lead criado</span>
                                    {lead.mensagem ? ` · "${lead.mensagem}"` : ''}
                                </p>
                                <p className="text-xs text-zinc-500">
                                    {ORIGENS[lead.origem || ''] || lead.origem || 'Origem não informada'} · {formatDateTime(lead.created_at)}
                                    {lead.vehicles?.advertised_price ? ` · ${formatMoney(Number(lead.vehicles.advertised_price))}` : ''}
                                </p>
                            </li>
                        </ol>
                    </section>

                    <div className="border-t border-zinc-100 pt-5">
                        <button
                            type="button"
                            onClick={() => setExcluirAberto(true)}
                            className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
                        >
                            <Trash2 size={16} />
                            Excluir lead
                        </button>
                    </div>
                </div>
            </aside>

            <ConfirmDialog
                open={excluirAberto}
                title="Excluir lead"
                description="O lead e todo o histórico de atendimento serão apagados. Essa ação não pode ser desfeita."
                confirmText="Excluir"
                loading={excluindo}
                onCancel={() => setExcluirAberto(false)}
                onConfirm={() => void excluir()}
            />
        </div>
    )
}
