export type Etapa = 'NOVO' | 'EM_ATENDIMENTO' | 'PROPOSTA_ENVIADA' | 'NEGOCIACAO' | 'FECHADO' | 'PERDIDO'
export type Temperatura = 'FRIO' | 'MORNO' | 'QUENTE'

export type CrmLead = {
    id: string
    nome: string | null
    telefone: string | null
    email: string | null
    mensagem: string | null
    origem: string | null
    status: Etapa
    vehicle_id: string | null
    responsavel_id: string | null
    valor: number | null
    temperatura: Temperatura | null
    proxima_acao_em: string | null
    proxima_acao_tipo: string | null
    primeiro_contato_em: string | null
    motivo_perda: string | null
    sale_generated: boolean | null
    created_at: string
    etapa_atualizada_em: string | null
    vehicles?: {
        plate: string
        advertised_price: number | null
        brands?: { name: string } | null
        vehicle_models?: { name: string } | null
    } | null
}

export type Membro = { id: string; name: string; role: string }

export const LEAD_SELECT = `
    id, nome, telefone, email, mensagem, origem, status, vehicle_id, responsavel_id,
    valor, temperatura, proxima_acao_em, proxima_acao_tipo, primeiro_contato_em,
    motivo_perda, sale_generated, created_at, etapa_atualizada_em,
    vehicles(plate, advertised_price, brands(name), vehicle_models(name))
`

export const ETAPAS: { value: Etapa; label: string; dot: string }[] = [
    { value: 'NOVO', label: 'Novo', dot: 'bg-sky-500' },
    { value: 'EM_ATENDIMENTO', label: 'Em atendimento', dot: 'bg-amber-500' },
    { value: 'PROPOSTA_ENVIADA', label: 'Proposta', dot: 'bg-violet-500' },
    { value: 'NEGOCIACAO', label: 'Negociação', dot: 'bg-brand-500' },
    { value: 'FECHADO', label: 'Ganho', dot: 'bg-emerald-500' },
    { value: 'PERDIDO', label: 'Perdido', dot: 'bg-zinc-400' },
]

export const TEMPERATURAS: { value: Temperatura; label: string; className: string }[] = [
    { value: 'FRIO', label: 'Frio', className: 'bg-sky-50 text-sky-700 ring-sky-200' },
    { value: 'MORNO', label: 'Morno', className: 'bg-amber-50 text-amber-700 ring-amber-200' },
    { value: 'QUENTE', label: 'Quente', className: 'bg-red-50 text-red-700 ring-red-200' },
]

export const PROXIMAS_ACOES = ['Ligar', 'WhatsApp', 'Enviar proposta', 'Agendar visita', 'Retorno', 'Test drive']

export const MOTIVOS_PERDA = [
    'Comprou em outra loja',
    'Preço',
    'Financiamento não aprovado',
    'Desistiu da compra',
    'Sem resposta',
    'Veículo vendido para outro cliente',
    'Outro',
]

export const ORIGENS: Record<string, string> = {
    site: 'Site',
    'site-contato': 'Site',
    manual: 'Manual',
    loja: 'Loja física',
    telefone: 'Telefone',
    whatsapp: 'WhatsApp',
    indicacao: 'Indicação',
    instagram: 'Instagram',
    facebook: 'Facebook',
    mercadolivre: 'Mercado Livre',
    webmotors: 'Webmotors',
    olx: 'OLX',
}

export const ORIGENS_MANUAIS = ['loja', 'telefone', 'whatsapp', 'indicacao', 'instagram', 'facebook', 'manual']

// Sem primeiro contato em 30 minutos, o lead estoura o SLA.
export const SLA_MINUTOS = 30

export function slaEstourado(lead: CrmLead, now = Date.now()) {
    return (
        lead.status === 'NOVO' &&
        !lead.primeiro_contato_em &&
        now - new Date(lead.created_at).getTime() > SLA_MINUTOS * 60 * 1000
    )
}

export function situacaoProximaAcao(lead: CrmLead, now = new Date()) {
    if (lead.status === 'FECHADO' || lead.status === 'PERDIDO') return 'encerrado' as const
    if (!lead.proxima_acao_em) return 'sem' as const

    const quando = new Date(lead.proxima_acao_em)
    const fimDoDia = new Date(now)
    fimDoDia.setHours(23, 59, 59, 999)

    if (quando < now) return 'atrasada' as const
    if (quando <= fimDoDia) return 'hoje' as const

    return 'futura' as const
}

export function veiculoNome(lead: Pick<CrmLead, 'vehicles'>) {
    const v = lead.vehicles
    if (!v) return null

    return [v.brands?.name, v.vehicle_models?.name].filter(Boolean).join(' ') || v.plate
}

export function valorDoLead(lead: CrmLead) {
    return Number(lead.valor ?? lead.vehicles?.advertised_price ?? 0)
}

export function formatMoney(value: number) {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

export function formatDateTime(value: string) {
    return new Date(value).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    })
}

export function tempoDesde(value: string, now = Date.now()) {
    const minutos = Math.max(0, Math.round((now - new Date(value).getTime()) / 60000))

    if (minutos < 60) return `${minutos} min`
    if (minutos < 60 * 24) return `${Math.round(minutos / 60)} h`

    return `${Math.round(minutos / (60 * 24))} d`
}

export function whatsappUrl(telefone: string | null, texto?: string) {
    const digits = (telefone || '').replace(/\D/g, '')
    if (digits.length < 10) return null

    const phone = digits.length <= 11 ? `55${digits}` : digits

    return `https://wa.me/${phone}${texto ? `?text=${encodeURIComponent(texto)}` : ''}`
}

export function iniciais(nome: string | null | undefined) {
    return (nome || '?')
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((parte) => parte[0]?.toUpperCase())
        .join('')
}
