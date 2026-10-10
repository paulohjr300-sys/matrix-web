'use client'

import { useEffect, useMemo, useState } from 'react'
import {
    AlarmClock,
    CalendarCheck,
    CalendarX,
    Car,
    Clock,
    MessageCircle,
    Plus,
    RefreshCw,
    Search,
    X,
} from 'lucide-react'

import { PageContainer } from '../components/page-container'
import { Toast } from '../components/ui/toast'
import { CurrencyInput } from '../components/currency-input'
import { supabase } from '../../lib/supabase'
import { LeadDrawer, type VeiculoOpcao } from './lead-drawer'
import {
    ETAPAS,
    LEAD_SELECT,
    MOTIVOS_PERDA,
    ORIGENS,
    ORIGENS_MANUAIS,
    TEMPERATURAS,
    formatDateTime,
    formatMoney,
    iniciais,
    situacaoProximaAcao,
    slaEstourado,
    tempoDesde,
    valorDoLead,
    veiculoNome,
    whatsappUrl,
    type CrmLead,
    type Etapa,
    type Membro,
} from './crm-shared'

type Filtro = 'todos' | 'atrasadas' | 'hoje' | 'sla' | 'sem'

// Ganhos e perdidos antigos saem do quadro para ele não crescer sem fim.
const DIAS_ENCERRADOS_NO_QUADRO = 30

export default function CrmPage() {
    const [leads, setLeads] = useState<CrmLead[]>([])
    const [equipe, setEquipe] = useState<Membro[]>([])
    const [veiculos, setVeiculos] = useState<VeiculoOpcao[]>([])
    const [userId, setUserId] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)

    const [busca, setBusca] = useState('')
    const [responsavel, setResponsavel] = useState('todos')
    const [origem, setOrigem] = useState('todas')
    const [filtro, setFiltro] = useState<Filtro>('todos')

    const [selecionadoId, setSelecionadoId] = useState<string | null>(null)
    const [arrastandoId, setArrastandoId] = useState<string | null>(null)
    const [colunaAlvo, setColunaAlvo] = useState<Etapa | null>(null)
    const [perdaPendente, setPerdaPendente] = useState<{ id: string; motivo: string } | null>(null)
    const [novoAberto, setNovoAberto] = useState(false)
    const [agora, setAgora] = useState(() => Date.now())

    const [toast, setToast] = useState({
        open: false,
        type: 'success' as 'success' | 'error',
        title: '',
        description: '',
    })

    function showToast(type: 'success' | 'error', title: string, description?: string) {
        setToast({ open: true, type, title, description: description || '' })
        setTimeout(() => setToast((current) => ({ ...current, open: false })), 3500)
    }

    async function carregar() {
        const desde = new Date(Date.now() - DIAS_ENCERRADOS_NO_QUADRO * 24 * 60 * 60 * 1000).toISOString()

        const [{ data: auth }, leadsRes, equipeRes, veiculosRes] = await Promise.all([
            supabase.auth.getUser(),
            supabase
                .from('leads')
                .select(LEAD_SELECT)
                .or(`status.not.in.(FECHADO,PERDIDO),updated_at.gte.${desde}`)
                .order('created_at', { ascending: false })
                .limit(1000),
            supabase.rpc('equipe_da_loja'),
            supabase
                .from('vehicles')
                .select('id, plate, advertised_price, status, brands(name), vehicle_models(name)')
                .in('status', ['EM_ESTOQUE', 'RESERVADO'])
                .order('created_at', { ascending: false }),
        ])

        if (leadsRes.error) {
            showToast('error', 'Erro', 'Não foi possível carregar o funil.')
        }

        setUserId(auth.user?.id || null)
        setLeads((leadsRes.data || []) as unknown as CrmLead[])
        setEquipe((equipeRes.data || []) as Membro[])
        setVeiculos((veiculosRes.data || []) as unknown as VeiculoOpcao[])
        setAgora(Date.now())
        setLoading(false)
    }

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial
        void carregar()

        // Atualiza SLA e prazos sem recarregar a página.
        const timer = setInterval(() => setAgora(Date.now()), 60 * 1000)
        return () => clearInterval(timer)
    }, [])

    function substituir(lead: CrmLead) {
        setLeads((current) => current.map((item) => (item.id === lead.id ? lead : item)))
    }

    async function moverPara(leadId: string, etapa: Etapa, motivo?: string) {
        const lead = leads.find((item) => item.id === leadId)
        if (!lead || lead.status === etapa) return

        if (etapa === 'PERDIDO' && !motivo) {
            setPerdaPendente({ id: leadId, motivo: MOTIVOS_PERDA[0] })
            return
        }

        const anterior = lead
        const mudancas: Partial<CrmLead> = {
            status: etapa,
            motivo_perda: etapa === 'PERDIDO' ? motivo || null : null,
            ...(etapa === 'PERDIDO' ? { proxima_acao_em: null, proxima_acao_tipo: null } : {}),
        }

        substituir({ ...lead, ...mudancas })

        const { data, error } = await supabase
            .from('leads')
            .update({ ...mudancas, updated_at: new Date().toISOString() })
            .eq('id', leadId)
            .select(LEAD_SELECT)
            .single()

        if (error || !data) {
            substituir(anterior)
            showToast('error', 'Não foi possível mover o lead', error?.message)
            return
        }

        substituir(data as unknown as CrmLead)

        if (etapa === 'FECHADO' && !lead.sale_generated) {
            setSelecionadoId(leadId)
            showToast('success', 'Negócio ganho!', 'Registre a venda para atualizar o estoque.')
        }
    }

    const filtrados = useMemo(() => {
        const termo = busca.trim().toLowerCase()
        const now = new Date(agora)

        return leads.filter((lead) => {
            if (termo) {
                const texto = [lead.nome, lead.telefone, lead.email, veiculoNome(lead), lead.vehicles?.plate]
                    .filter(Boolean)
                    .join(' ')
                    .toLowerCase()
                if (!texto.includes(termo)) return false
            }

            if (responsavel === 'meus' && lead.responsavel_id !== userId) return false
            if (responsavel === 'sem' && lead.responsavel_id) return false
            if (!['todos', 'meus', 'sem'].includes(responsavel) && lead.responsavel_id !== responsavel) return false

            if (origem !== 'todas' && (ORIGENS[lead.origem || ''] || lead.origem) !== origem) return false

            const situacao = situacaoProximaAcao(lead, now)
            if (filtro === 'atrasadas' && situacao !== 'atrasada') return false
            if (filtro === 'hoje' && situacao !== 'hoje') return false
            if (filtro === 'sem' && situacao !== 'sem') return false
            if (filtro === 'sla' && !slaEstourado(lead, agora)) return false

            return true
        })
    }, [leads, busca, responsavel, origem, filtro, userId, agora])

    const indicadores = useMemo(() => {
        const now = new Date(agora)
        const abertos = leads.filter((lead) => lead.status !== 'FECHADO' && lead.status !== 'PERDIDO')

        return {
            atrasadas: abertos.filter((lead) => situacaoProximaAcao(lead, now) === 'atrasada').length,
            hoje: abertos.filter((lead) => situacaoProximaAcao(lead, now) === 'hoje').length,
            sla: abertos.filter((lead) => slaEstourado(lead, agora)).length,
            sem: abertos.filter((lead) => situacaoProximaAcao(lead, now) === 'sem').length,
        }
    }, [leads, agora])

    const origensDisponiveis = useMemo(
        () => [...new Set(leads.map((lead) => ORIGENS[lead.origem || ''] || lead.origem).filter(Boolean))] as string[],
        [leads]
    )

    const selecionado = leads.find((lead) => lead.id === selecionadoId) || null
    const nomeMembro = (id: string | null) => equipe.find((m) => m.id === id)?.name || null

    return (
        <>
            <Toast
                open={toast.open}
                type={toast.type}
                title={toast.title}
                description={toast.description}
                onClose={() => setToast((current) => ({ ...current, open: false }))}
            />

            <PageContainer
                title="Funil de vendas"
                description="Acompanhe cada oportunidade do primeiro contato até a venda."
                action={
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => void carregar()}
                            className="rounded-2xl bg-white p-3 text-zinc-600 ring-1 ring-zinc-200 transition hover:bg-zinc-50"
                            aria-label="Atualizar"
                        >
                            <RefreshCw size={18} />
                        </button>
                        <button
                            type="button"
                            onClick={() => setNovoAberto(true)}
                            className="inline-flex items-center gap-2 rounded-2xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-600/20 transition hover:-translate-y-0.5 hover:bg-brand-700"
                        >
                            <Plus size={18} />
                            Novo lead
                        </button>
                    </div>
                }
            >
                {/* Indicadores */}
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <Indicador
                        ativo={filtro === 'atrasadas'}
                        onClick={() => setFiltro(filtro === 'atrasadas' ? 'todos' : 'atrasadas')}
                        icon={<CalendarX size={18} />}
                        label="Follow-ups atrasados"
                        valor={indicadores.atrasadas}
                        alerta={indicadores.atrasadas > 0}
                    />
                    <Indicador
                        ativo={filtro === 'hoje'}
                        onClick={() => setFiltro(filtro === 'hoje' ? 'todos' : 'hoje')}
                        icon={<CalendarCheck size={18} />}
                        label="Follow-ups hoje"
                        valor={indicadores.hoje}
                    />
                    <Indicador
                        ativo={filtro === 'sla'}
                        onClick={() => setFiltro(filtro === 'sla' ? 'todos' : 'sla')}
                        icon={<AlarmClock size={18} />}
                        label="SLA estourado (30 min)"
                        valor={indicadores.sla}
                        alerta={indicadores.sla > 0}
                    />
                    <Indicador
                        ativo={filtro === 'sem'}
                        onClick={() => setFiltro(filtro === 'sem' ? 'todos' : 'sem')}
                        icon={<Clock size={18} />}
                        label="Sem próxima ação"
                        valor={indicadores.sem}
                    />
                </div>

                {/* Filtros */}
                <div className="mt-5 flex flex-wrap items-center gap-3">
                    <label className="relative min-w-[220px] flex-1">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                        <input
                            value={busca}
                            onChange={(e) => setBusca(e.target.value)}
                            placeholder="Buscar por nome, telefone ou veículo"
                            className="w-full rounded-xl border border-zinc-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
                        />
                    </label>

                    <select
                        value={responsavel}
                        onChange={(e) => setResponsavel(e.target.value)}
                        className="rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-500"
                    >
                        <option value="todos">Todos os responsáveis</option>
                        <option value="meus">Meus leads</option>
                        <option value="sem">Sem responsável</option>
                        {equipe.map((membro) => (
                            <option key={membro.id} value={membro.id}>
                                {membro.name}
                            </option>
                        ))}
                    </select>

                    <select
                        value={origem}
                        onChange={(e) => setOrigem(e.target.value)}
                        className="rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-500"
                    >
                        <option value="todas">Todas as origens</option>
                        {origensDisponiveis.map((item) => (
                            <option key={item}>{item}</option>
                        ))}
                    </select>

                    {filtro !== 'todos' && (
                        <button
                            type="button"
                            onClick={() => setFiltro('todos')}
                            className="inline-flex items-center gap-1 rounded-xl bg-zinc-950 px-3 py-2.5 text-xs font-semibold text-white"
                        >
                            <X size={14} />
                            Limpar filtro
                        </button>
                    )}
                </div>

                {/* Quadro */}
                {loading ? (
                    <p className="mt-8 text-sm text-zinc-500">Carregando funil...</p>
                ) : (
                    <div className="-mx-8 mt-6 overflow-x-auto px-8 pb-4 xl:mx-0 xl:overflow-visible xl:px-0">
                        <div className="flex min-w-max gap-4 xl:grid xl:min-w-0 xl:grid-cols-6 xl:gap-3">
                            {/* Telas grandes: 6 colunas dividindo a largura, sem rolagem lateral. Menores: rolagem lateral. */}
                            {ETAPAS.map((etapa) => {
                                const daEtapa = filtrados.filter((lead) => lead.status === etapa.value)
                                const total = daEtapa.reduce((soma, lead) => soma + valorDoLead(lead), 0)

                                return (
                                    <div
                                        key={etapa.value}
                                        onDragOver={(e) => {
                                            e.preventDefault()
                                            setColunaAlvo(etapa.value)
                                        }}
                                        onDragLeave={() => setColunaAlvo(null)}
                                        onDrop={(e) => {
                                            e.preventDefault()
                                            setColunaAlvo(null)
                                            const id = e.dataTransfer.getData('text/plain')
                                            if (id) void moverPara(id, etapa.value)
                                        }}
                                        className={`flex w-72 shrink-0 flex-col rounded-3xl p-3 transition xl:w-auto xl:min-w-0 xl:p-2 ${colunaAlvo === etapa.value ? 'bg-brand-50 ring-2 ring-brand-300' : 'bg-zinc-200/50'
                                            }`}
                                    >
                                        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 px-2 pb-3 pt-1">
                                            <div className="flex min-w-0 items-center gap-2">
                                                <span className={`h-2.5 w-2.5 rounded-full ${etapa.dot}`} />
                                                <span className="truncate text-sm font-bold text-zinc-900">{etapa.label}</span>
                                                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-zinc-600">
                                                    {daEtapa.length}
                                                </span>
                                            </div>
                                            {total > 0 && <span className="text-xs font-semibold text-zinc-500">{formatMoney(total)}</span>}
                                        </div>

                                        <div className="flex min-h-[120px] flex-col gap-3">
                                            {daEtapa.map((lead) => (
                                                <LeadCard
                                                    key={lead.id}
                                                    lead={lead}
                                                    agora={agora}
                                                    responsavel={nomeMembro(lead.responsavel_id)}
                                                    arrastando={arrastandoId === lead.id}
                                                    onOpen={() => setSelecionadoId(lead.id)}
                                                    onDragStart={(e) => {
                                                        e.dataTransfer.setData('text/plain', lead.id)
                                                        e.dataTransfer.effectAllowed = 'move'
                                                        setArrastandoId(lead.id)
                                                    }}
                                                    onDragEnd={() => setArrastandoId(null)}
                                                    onMover={(nova) => void moverPara(lead.id, nova)}
                                                />
                                            ))}

                                            {daEtapa.length === 0 && (
                                                <p className="rounded-2xl border-2 border-dashed border-zinc-300 p-4 text-center text-xs text-zinc-400">
                                                    Arraste um lead para cá
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}
            </PageContainer>

            {perdaPendente && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
                    <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
                        <h3 className="text-lg font-bold text-zinc-950">Por que o negócio foi perdido?</h3>
                        <select
                            value={perdaPendente.motivo}
                            onChange={(e) => setPerdaPendente({ ...perdaPendente, motivo: e.target.value })}
                            className="mt-4 w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500"
                        >
                            {MOTIVOS_PERDA.map((motivo) => (
                                <option key={motivo}>{motivo}</option>
                            ))}
                        </select>
                        <div className="mt-5 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setPerdaPendente(null)}
                                className="rounded-xl px-4 py-2.5 text-sm font-semibold text-zinc-600 hover:bg-zinc-100"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    void moverPara(perdaPendente.id, 'PERDIDO', perdaPendente.motivo)
                                    setPerdaPendente(null)
                                }}
                                className="rounded-xl bg-zinc-950 px-4 py-2.5 text-sm font-semibold text-white"
                            >
                                Marcar como perdido
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {selecionado && (
                <LeadDrawer
                    key={selecionado.id}
                    lead={selecionado}
                    equipe={equipe}
                    veiculos={veiculos}
                    onClose={() => setSelecionadoId(null)}
                    onChanged={substituir}
                    onDeleted={(id) => {
                        setLeads((current) => current.filter((item) => item.id !== id))
                        setSelecionadoId(null)
                    }}
                    showToast={showToast}
                />
            )}

            {novoAberto && (
                <NovoLead
                    equipe={equipe}
                    veiculos={veiculos}
                    userId={userId}
                    onClose={() => setNovoAberto(false)}
                    onCreated={(lead) => {
                        setLeads((current) => [lead, ...current])
                        setNovoAberto(false)
                        setSelecionadoId(lead.id)
                        showToast('success', 'Lead criado')
                    }}
                    showToast={showToast}
                />
            )}
        </>
    )
}

function Indicador({
    ativo,
    onClick,
    icon,
    label,
    valor,
    alerta,
}: {
    ativo: boolean
    onClick: () => void
    icon: React.ReactNode
    label: string
    valor: number
    alerta?: boolean
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`flex items-center gap-3 rounded-2xl p-4 text-left ring-1 transition ${ativo ? 'bg-zinc-950 text-white ring-zinc-950' : 'bg-white text-zinc-900 ring-zinc-200 hover:ring-zinc-300'
                }`}
        >
            <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${ativo ? 'bg-white/15' : alerta ? 'bg-red-50 text-red-600' : 'bg-brand-50 text-brand-600'
                    }`}
            >
                {icon}
            </span>
            <span>
                <span className="block text-2xl font-black leading-none">{valor}</span>
                <span className={`mt-1 block text-xs ${ativo ? 'text-zinc-300' : 'text-zinc-500'}`}>{label}</span>
            </span>
        </button>
    )
}

function LeadCard({
    lead,
    agora,
    responsavel,
    arrastando,
    onOpen,
    onDragStart,
    onDragEnd,
    onMover,
}: {
    lead: CrmLead
    agora: number
    responsavel: string | null
    arrastando: boolean
    onOpen: () => void
    onDragStart: (e: React.DragEvent) => void
    onDragEnd: () => void
    onMover: (etapa: Etapa) => void
}) {
    const situacao = situacaoProximaAcao(lead, new Date(agora))
    const sla = slaEstourado(lead, agora)
    const temperatura = TEMPERATURAS.find((t) => t.value === lead.temperatura)
    const veiculo = veiculoNome(lead)
    const valor = valorDoLead(lead)
    const whatsapp = whatsappUrl(lead.telefone)

    return (
        <article
            draggable
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onClick={onOpen}
            className={`min-w-0 cursor-pointer rounded-2xl bg-white p-4 shadow-sm xl:p-3 ring-1 transition hover:shadow-md ${sla ? 'ring-red-300' : 'ring-zinc-200'
                } ${arrastando ? 'opacity-40' : ''}`}
        >
            <div className="flex items-start justify-between gap-2">
                <p className="truncate font-semibold text-zinc-950">{lead.nome || 'Sem nome'}</p>
                {temperatura && (
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${temperatura.className}`}>
                        {temperatura.label}
                    </span>
                )}
            </div>

            {veiculo && (
                <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-zinc-600">
                    <Car size={12} className="shrink-0" />
                    {veiculo}
                </p>
            )}

            {valor > 0 && <p className="mt-2 text-sm font-bold text-zinc-900">{formatMoney(valor)}</p>}

            <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-600">
                    {ORIGENS[lead.origem || ''] || lead.origem || 'Sem origem'}
                </span>
                {sla && (
                    <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700">
                        SLA · {tempoDesde(lead.created_at, agora)} sem contato
                    </span>
                )}
                {lead.sale_generated && (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                        Venda registrada
                    </span>
                )}
            </div>

            {situacao !== 'encerrado' && (
                <p
                    className={`mt-3 text-xs font-medium ${situacao === 'atrasada' ? 'text-red-600' : situacao === 'hoje' ? 'text-amber-700' : situacao === 'sem' ? 'text-zinc-400' : 'text-zinc-600'
                        }`}
                >
                    {situacao === 'sem'
                        ? 'Sem próxima ação'
                        : `${lead.proxima_acao_tipo || 'Ação'} · ${formatDateTime(lead.proxima_acao_em!)}${situacao === 'atrasada' ? ' (atrasado)' : ''}`}
                </p>
            )}

            {lead.status === 'PERDIDO' && lead.motivo_perda && (
                <p className="mt-2 text-xs text-zinc-500">{lead.motivo_perda}</p>
            )}

            <div className="mt-3 flex items-center justify-between gap-2 border-t border-zinc-100 pt-3">
                <span
                    title={responsavel || 'Sem responsável'}
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold ${responsavel ? 'bg-brand-100 text-brand-700' : 'bg-zinc-100 text-zinc-400'
                        }`}
                >
                    {responsavel ? iniciais(responsavel) : '?'}
                </span>

                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    {whatsapp && (
                        <a
                            href={whatsapp}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50"
                            aria-label="WhatsApp"
                        >
                            <MessageCircle size={16} />
                        </a>
                    )}
                    {/* Mover sem arrastar (celular e teclado). */}
                    <select
                        value={lead.status}
                        onChange={(e) => onMover(e.target.value as Etapa)}
                        aria-label="Mover para etapa"
                        className="max-w-[110px] rounded-lg border border-zinc-200 bg-white px-1.5 py-1 text-[11px] text-zinc-600 outline-none xl:hidden"
                    >
                        {ETAPAS.map((etapa) => (
                            <option key={etapa.value} value={etapa.value}>
                                {etapa.label}
                            </option>
                        ))}
                    </select>
                </div>
            </div>
        </article>
    )
}

function NovoLead({
    equipe,
    veiculos,
    userId,
    onClose,
    onCreated,
    showToast,
}: {
    equipe: Membro[]
    veiculos: VeiculoOpcao[]
    userId: string | null
    onClose: () => void
    onCreated: (lead: CrmLead) => void
    showToast: (type: 'success' | 'error', title: string, description?: string) => void
}) {
    const [nome, setNome] = useState('')
    const [telefone, setTelefone] = useState('')
    const [email, setEmail] = useState('')
    const [origem, setOrigem] = useState('loja')
    const [veiculoId, setVeiculoId] = useState('')
    const [valor, setValor] = useState('')
    const [mensagem, setMensagem] = useState('')
    const [responsavelId, setResponsavelId] = useState(userId || '')
    const [salvando, setSalvando] = useState(false)

    const inputClass =
        'mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10'

    async function salvar() {
        if (!nome.trim() || !telefone.trim()) {
            showToast('error', 'Campos obrigatórios', 'Informe o nome e o telefone.')
            return
        }

        setSalvando(true)

        const { data, error } = await supabase
            .from('leads')
            .insert({
                nome: nome.trim(),
                telefone: telefone.trim(),
                email: email.trim() || null,
                origem,
                status: 'NOVO',
                vehicle_id: veiculoId || null,
                valor: valor ? Number(valor.replace(/\D/g, '')) / 100 : null,
                mensagem: mensagem.trim() || null,
                responsavel_id: responsavelId || null,
            })
            .select(LEAD_SELECT)
            .single()

        setSalvando(false)

        if (error || !data) {
            showToast('error', 'Erro', error?.message || 'Não foi possível criar o lead.')
            return
        }

        onCreated(data as unknown as CrmLead)
    }

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4">
            <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-zinc-950">Novo lead</h3>
                    <button type="button" onClick={onClose} className="rounded-xl bg-zinc-100 p-2 text-zinc-600 hover:bg-zinc-200">
                        <X size={18} />
                    </button>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <label className="sm:col-span-2">
                        <span className="text-sm font-medium text-zinc-700">Nome *</span>
                        <input value={nome} onChange={(e) => setNome(e.target.value)} className={inputClass} />
                    </label>
                    <label>
                        <span className="text-sm font-medium text-zinc-700">Telefone / WhatsApp *</span>
                        <input value={telefone} onChange={(e) => setTelefone(e.target.value)} inputMode="tel" className={inputClass} />
                    </label>
                    <label>
                        <span className="text-sm font-medium text-zinc-700">E-mail</span>
                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
                    </label>
                    <label>
                        <span className="text-sm font-medium text-zinc-700">Origem</span>
                        <select value={origem} onChange={(e) => setOrigem(e.target.value)} className={inputClass}>
                            {ORIGENS_MANUAIS.map((item) => (
                                <option key={item} value={item}>
                                    {ORIGENS[item]}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label>
                        <span className="text-sm font-medium text-zinc-700">Responsável</span>
                        <select value={responsavelId} onChange={(e) => setResponsavelId(e.target.value)} className={inputClass}>
                            <option value="">Não definido</option>
                            {equipe.map((membro) => (
                                <option key={membro.id} value={membro.id}>
                                    {membro.name}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="sm:col-span-2">
                        <span className="text-sm font-medium text-zinc-700">Veículo de interesse</span>
                        <select
                            value={veiculoId}
                            onChange={(e) => {
                                setVeiculoId(e.target.value)
                                const preco = veiculos.find((v) => v.id === e.target.value)?.advertised_price
                                if (preco && !valor) {
                                    setValor(Number(preco).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }))
                                }
                            }}
                            className={inputClass}
                        >
                            <option value="">Nenhum</option>
                            {veiculos.map((v) => (
                                <option key={v.id} value={v.id}>
                                    {[v.brands?.name, v.vehicle_models?.name, v.plate].filter(Boolean).join(' · ')}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label>
                        <span className="text-sm font-medium text-zinc-700">Valor do negócio</span>
                        <CurrencyInput value={valor} onChange={setValor} />
                    </label>
                    <label className="sm:col-span-2">
                        <span className="text-sm font-medium text-zinc-700">Observação</span>
                        <textarea
                            value={mensagem}
                            onChange={(e) => setMensagem(e.target.value)}
                            rows={3}
                            placeholder="Ex: quer trocar um Onix 2018 e financiar o restante"
                            className={`${inputClass} resize-none`}
                        />
                    </label>
                </div>

                <div className="mt-6 flex justify-end gap-2">
                    <button type="button" onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-zinc-600 hover:bg-zinc-100">
                        Cancelar
                    </button>
                    <button
                        type="button"
                        disabled={salvando}
                        onClick={() => void salvar()}
                        className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                    >
                        {salvando ? 'Salvando...' : 'Criar lead'}
                    </button>
                </div>
            </div>
        </div>
    )
}
