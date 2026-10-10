'use client'

import { useEffect, useMemo, useState } from 'react'
import { Car, DollarSign, MessageCircle, Search, Trash2, UserRound, X } from 'lucide-react'
import { PageContainer } from '../components/page-container'
import { Toast } from '../components/ui/toast'
import { ConfirmDialog } from '../components/ui/confirm-dialog'
import { CurrencyInput } from '../components/currency-input'
import { supabase } from '../../lib/supabase'

type LeadStatus =
    | 'NOVO'
    | 'EM_ATENDIMENTO'
    | 'PROPOSTA_ENVIADA'
    | 'NEGOCIACAO'
    | 'FECHADO'
    | 'PERDIDO'

type Lead = {
    id: string
    vehicle_id: string | null
    nome: string | null
    telefone: string | null
    email: string | null
    mensagem: string | null
    status: LeadStatus
    sale_generated: boolean
    created_at: string
    vehicles?: {
        plate: string
        brands?: { name: string } | null
        vehicle_models?: { name: string } | null
    } | null
}

type SaleVehicle = {
    id: string
    plate: string
    advertised_price: number
    status: string
    brands?: { name: string } | null
    vehicle_models?: { name: string } | null
}

const paymentMethods = [
    'À Vista',
    'Financiamento',
    'PIX',
    'Cartão',
    'Transferência',
    'Não informado',
]

function formatCurrency(value: number) {
    return value.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    })
}

function parseCurrency(value: string) {
    const onlyNumbers = value.replace(/\D/g, '')
    return Number(onlyNumbers) / 100
}


const leadStatusOptions: { label: string; value: LeadStatus }[] = [
    { label: 'Novo', value: 'NOVO' },
    { label: 'Em atendimento', value: 'EM_ATENDIMENTO' },
    { label: 'Proposta enviada', value: 'PROPOSTA_ENVIADA' },
    { label: 'Negociação', value: 'NEGOCIACAO' },
    { label: 'Fechado', value: 'FECHADO' },
    { label: 'Perdido', value: 'PERDIDO' },
]

function getStatusClass(status: LeadStatus) {
    switch (status) {
        case 'NOVO':
            return 'bg-blue-50 text-blue-700 ring-1 ring-blue-200'
        case 'EM_ATENDIMENTO':
            return 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
        case 'PROPOSTA_ENVIADA':
            return 'bg-purple-50 text-purple-700 ring-1 ring-purple-200'
        case 'FECHADO':
            return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
        case 'PERDIDO':
            return 'bg-red-50 text-red-700 ring-1 ring-red-200'
        default:
            return 'bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200'
    }
}



function getLeadCardClass(status: LeadStatus) {
    switch (status) {
        case 'NOVO':
            return 'border-blue-300 bg-blue-50/30 shadow-blue-100/60'
        case 'EM_ATENDIMENTO':
            return 'border-amber-300 bg-amber-50/30 shadow-amber-100/60'
        case 'PROPOSTA_ENVIADA':
            return 'border-purple-300 bg-purple-50/30 shadow-purple-100/60'
        case 'FECHADO':
            return 'border-emerald-300 bg-emerald-50/30 shadow-emerald-100/60'
        case 'PERDIDO':
            return 'border-brand-300 bg-brand-50/30 shadow-brand-100/60'
        default:
            return 'border-zinc-200 bg-white shadow-zinc-200/50'
    }
}

function getLeadAccentClass(status: LeadStatus) {
    switch (status) {
        case 'NOVO':
            return 'bg-blue-500'
        case 'EM_ATENDIMENTO':
            return 'bg-amber-500'
        case 'PROPOSTA_ENVIADA':
            return 'bg-purple-500'
        case 'FECHADO':
            return 'bg-emerald-500'
        case 'PERDIDO':
            return 'bg-red-500'
        default:
            return 'bg-zinc-300'
    }
}

function formatDate(value: string) {
    return new Date(value).toLocaleString('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short',
    })
}

function onlyNumbers(value?: string | null) {
    return (value || '').replace(/\D/g, '')
}

function getVehicleName(lead: Lead, showPlate = true) {
    const brand = lead.vehicles?.brands?.name || ''
    const model = lead.vehicles?.vehicle_models?.name || ''
    const plate = lead.vehicles?.plate || ''
    const name = `${brand} - ${model}`.trim()

    if (!brand && !model && !plate) return 'Veículo não informado'

    if (!showPlate) {
        return name || 'veículo de interesse'
    }

    return `${name || 'Veículo'}${plate ? ` · ${plate}` : ''}`
}

function getSaleVehicleLabel(vehicle: SaleVehicle) {
    const brand = vehicle.brands?.name || ''
    const model = vehicle.vehicle_models?.name || ''
    const name = `${brand} - ${model}`.trim()

    return `${vehicle.plate} · ${name || 'Veículo'}`
}

export default function LeadsPage() {
    const [leads, setLeads] = useState<Lead[]>([])
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [loading, setLoading] = useState(false)

    const [saleVehicles, setSaleVehicles] = useState<SaleVehicle[]>([])
    const [saleLead, setSaleLead] = useState<Lead | null>(null)
    const [saleVehicleId, setSaleVehicleId] = useState('')
    const [salePrice, setSalePrice] = useState('')
    const [saleDate, setSaleDate] = useState('')
    const [salePaymentMethod, setSalePaymentMethod] = useState('Não informado')
    const [saleLoading, setSaleLoading] = useState(false)

    const [deleteLead, setDeleteLead] = useState<Lead | null>(null)
    const [deleteLoading, setDeleteLoading] = useState(false)

    const [toast, setToast] = useState({
        open: false,
        type: 'success' as 'success' | 'error',
        title: '',
        description: '',
    })

    function showToast(
        type: 'success' | 'error',
        title: string,
        description?: string
    ) {
        setToast({
            open: true,
            type,
            title,
            description: description || '',
        })

        setTimeout(() => {
            setToast((current) => ({ ...current, open: false }))
        }, 3000)
    }

    async function loadSaleVehicles() {
        const { data, error } = await supabase
            .from('vehicles')
            .select(`
                id,
                plate,
                advertised_price,
                status,
                brands(name),
                vehicle_models(name)
            `)
            .neq('status', 'VENDIDO')
            .order('plate')

        if (error) {
            showToast('error', 'Erro', 'Não foi possível carregar veículos para venda.')
            return
        }

        setSaleVehicles((data || []) as unknown as SaleVehicle[])
    }

    async function loadLeads() {
        setLoading(true)

        const { data, error } = await supabase
            .from('leads')
            .select(`
        id,
        vehicle_id,
        nome,
        telefone,
        email,
        mensagem,
        status,
        sale_generated,
        created_at,
        vehicles!leads_vehicle_id_fkey(
          plate,
          brands(name),
          vehicle_models(name)
        )
      `)
            .order('created_at', { ascending: false })

        setLoading(false)

        if (error) {
            showToast('error', 'Erro ao carregar leads', error.message)
            return
        }

        setLeads((data || []) as unknown as Lead[])
    }

    useEffect(() => {
        const timer = setTimeout(() => {
            void loadLeads()
            void loadSaleVehicles()
        }, 0)

        return () => clearTimeout(timer)
    }, [])

    const filteredLeads = useMemo(() => {
        return leads.filter((lead) => {
            const text = [
                lead.nome,
                lead.telefone,
                lead.email,
                lead.mensagem,
                getVehicleName(lead),
            ]
                .join(' ')
                .toLowerCase()

            const matchesSearch = search
                ? text.includes(search.toLowerCase())
                : true

            const matchesStatus = statusFilter
                ? lead.status === statusFilter
                : true

            return matchesSearch && matchesStatus
        })
    }, [leads, search, statusFilter])

    const totals = leads.reduce(
        (acc, lead) => {
            acc.total += 1

            if (lead.status === 'NOVO') acc.new += 1
            if (lead.status === 'EM_ATENDIMENTO') acc.inProgress += 1
            if (lead.status === 'FECHADO') acc.closed += 1
            if (lead.status === 'PERDIDO') acc.lost += 1

            return acc
        },
        {
            total: 0,
            new: 0,
            inProgress: 0,
            closed: 0,
            lost: 0,
        }
    )

    function openSaleModal(lead: Lead) {
        if (!lead.vehicle_id) {
            showToast(
                'error',
                'Veículo não informado',
                'Este lead não possui veículo vinculado. Selecione um veículo para gerar a venda.'
            )
        }

        const selectedVehicle = saleVehicles.find(
            (vehicle) => vehicle.id === lead.vehicle_id
        )

        setSaleLead(lead)
        setSaleVehicleId(lead.vehicle_id || '')
        setSalePrice(
            selectedVehicle?.advertised_price
                ? formatCurrency(Number(selectedVehicle.advertised_price || 0))
                : ''
        )
        setSaleDate(new Date().toISOString().slice(0, 10))
        setSalePaymentMethod('Não informado')
    }

    async function handleUpdateStatus(leadId: string, status: LeadStatus) {
        const leadBeforeUpdate = leads.find((lead) => lead.id === leadId)

        const { error } = await supabase
            .from('leads')
            .update({
                status,
                updated_at: new Date().toISOString(),
            })
            .eq('id', leadId)

        if (error) {
            showToast('error', 'Erro', 'Não foi possível alterar o status.')
            return
        }

        const updatedLead = leadBeforeUpdate
            ? {
                ...leadBeforeUpdate,
                status,
            }
            : null

        setLeads((current) =>
            current.map((lead) =>
                lead.id === leadId
                    ? {
                        ...lead,
                        status,
                    }
                    : lead
            )
        )

        showToast('success', 'Status atualizado', 'Lead atualizado com sucesso.')

        if (
            status === 'FECHADO' &&
            updatedLead &&
            updatedLead.sale_generated !== true
        ) {
            openSaleModal(updatedLead)
        }
    }

    async function handleGenerateSaleFromLead() {
        if (!saleLead) return

        if (!saleVehicleId) {
            showToast('error', 'Campo obrigatório', 'Selecione o veículo vendido.')
            return
        }

        if (!salePrice) {
            showToast('error', 'Campo obrigatório', 'Informe o valor da venda.')
            return
        }

        setSaleLoading(true)

        const saleData = {
            vehicle_id: saleVehicleId,
            sale_date: saleDate || new Date().toISOString().slice(0, 10),
            advertised_price: parseCurrency(salePrice),
            sale_price: parseCurrency(salePrice),
            payment_method: salePaymentMethod || 'Não informado',
            notes: `Venda gerada pelo lead ${saleLead.nome || 'sem nome'}.`,
        }

        const { data: existingSale } = await supabase
            .from('vehicle_sales')
            .select('id')
            .eq('vehicle_id', saleVehicleId)
            .maybeSingle()

        const saleResult = existingSale?.id
            ? await supabase
                .from('vehicle_sales')
                .update(saleData)
                .eq('id', existingSale.id)
            : await supabase
                .from('vehicle_sales')
                .insert(saleData)

        if (saleResult.error) {
            setSaleLoading(false)
            showToast('error', 'Erro ao gerar venda', saleResult.error.message)
            return
        }

        const vehicleResult = await supabase
            .from('vehicles')
            .update({
                status: 'VENDIDO',
                is_published: false,
            })
            .eq('id', saleVehicleId)

        if (vehicleResult.error) {
            setSaleLoading(false)
            showToast(
                'error',
                'Venda criada com alerta',
                'A venda foi criada, mas não foi possível marcar o veículo como vendido.'
            )
            return
        }

        const leadResult = await supabase
            .from('leads')
            .update({
                sale_generated: true,
                vehicle_id: saleVehicleId,
                updated_at: new Date().toISOString(),
            })
            .eq('id', saleLead.id)

        if (leadResult.error) {
            setSaleLoading(false)
            showToast(
                'error',
                'Venda criada com alerta',
                'A venda foi criada, mas não foi possível marcar o lead como venda gerada.'
            )
            return
        }

        setLeads((current) =>
            current.map((lead) =>
                lead.id === saleLead.id
                    ? {
                        ...lead,
                        sale_generated: true,
                        vehicle_id: saleVehicleId,
                    }
                    : lead
            )
        )

        setSaleLoading(false)
        setSaleLead(null)
        setSaleVehicleId('')
        setSalePrice('')
        setSaleDate('')
        setSalePaymentMethod('Não informado')

        await Promise.all([loadLeads(), loadSaleVehicles()])

        showToast(
            'success',
            'Venda gerada',
            'O veículo foi marcado como vendido e removido do site.'
        )
    }

    async function handleDeleteLead() {
        if (!deleteLead) return

        setDeleteLoading(true)

        const { error } = await supabase
            .from('leads')
            .delete()
            .eq('id', deleteLead.id)

        setDeleteLoading(false)

        if (error) {
            showToast('error', 'Erro', 'Não foi possível excluir o lead.')
            return
        }

        setLeads((current) => current.filter((lead) => lead.id !== deleteLead.id))
        setDeleteLead(null)

        showToast('success', 'Lead excluído', 'Lead removido com sucesso.')
    }

    return (
        <>
            <PageContainer
                title="Leads"
                description="Gerencie os contatos recebidos pelo site da loja."
            >
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <SummaryCard title="Total de leads" value={String(totals.total)} />
                    <SummaryCard title="Novos" value={String(totals.new)} />
                    <SummaryCard title="Em atendimento" value={String(totals.inProgress)} />
                    <SummaryCard title="Fechados" value={String(totals.closed)} />
                </div>

                <div className="mt-8 grid grid-cols-1 gap-4 rounded-3xl border border-zinc-200 bg-white p-5 shadow-xl shadow-zinc-200/40 md:grid-cols-3">
                    <div className="md:col-span-2">
                        <label className="text-sm font-medium text-zinc-700">
                            Buscar lead
                        </label>

                        <div className="mt-2 flex items-center gap-2 rounded-xl border border-zinc-200 px-4">
                            <Search size={18} className="text-zinc-400" />

                            <input
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder="Nome, telefone, e-mail, veículo ou mensagem..."
                                className="w-full py-3 outline-none"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-sm font-medium text-zinc-700">
                            Status
                        </label>

                        <select
                            value={statusFilter}
                            onChange={(event) => setStatusFilter(event.target.value)}
                            className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none"
                        >
                            <option value="">Todos</option>

                            {leadStatusOptions.map((item) => (
                                <option key={item.value} value={item.value}>
                                    {item.label}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="mt-8 space-y-4">
                    <div className="flex items-center justify-between rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl shadow-zinc-200/40">
                        <div>
                            <h2 className="text-xl font-bold text-zinc-950">
                                Leads recebidos
                            </h2>
                            <p className="mt-1 text-sm text-zinc-500">
                                {filteredLeads.length} registro(s) encontrado(s).
                            </p>
                        </div>

                        {loading && (
                            <span className="rounded-full bg-zinc-100 px-4 py-2 text-xs font-bold text-zinc-500">
                                Carregando...
                            </span>
                        )}
                    </div>

                    {filteredLeads.map((lead) => {
                        const phone = onlyNumbers(lead.telefone)
                        const whatsappMessage = `Olá, ${lead.nome || ''}! Recebemos seu contato pelo nosso site sobre o veículo ${getVehicleName(
                            lead,
                            false
                        )}.`

                        const whatsappUrl = phone
                            ? `https://wa.me/55${phone}?text=${encodeURIComponent(whatsappMessage)}`
                            : ''

                        return (
                            <div
                                key={lead.id}
                                className={`relative overflow-hidden rounded-3xl border p-6 shadow-xl transition-all duration-300 hover:-translate-y-0.5 ${getLeadCardClass(
                                    lead.status
                                )}`}
                            >
                                <div
                                    className={`absolute left-0 top-0 h-full w-2 ${getLeadAccentClass(
                                        lead.status
                                    )}`}
                                />

                                <div className="grid grid-cols-1 gap-6 pl-2 xl:grid-cols-[1.2fr_1fr_1.2fr_auto]">
                                    <div>
                                        <div className="flex items-start gap-4">
                                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                                                <UserRound size={22} />
                                            </div>

                                            <div className="min-w-0">
                                                <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-400">
                                                    Cliente
                                                </p>

                                                <h3 className="mt-1 truncate text-xl font-black text-zinc-950">
                                                    {lead.nome || '-'}
                                                </h3>

                                                <div className="mt-3">
                                                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-400">
                                                        Status atual
                                                    </p>

                                                    <span
                                                        className={`mt-2 inline-flex rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wide ${getStatusClass(
                                                            lead.status
                                                        )}`}
                                                    >
                                                        {
                                                            leadStatusOptions.find(
                                                                (item) => item.value === lead.status
                                                            )?.label
                                                        }
                                                    </span>
                                                </div>

                                                {lead.sale_generated && (
                                                    <span className="mt-3 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200">
                                                        Venda gerada
                                                    </span>
                                                )}

                                                <p className="mt-3 text-sm text-zinc-500">
                                                    Recebido em {formatDate(lead.created_at)}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-400">
                                            Contato
                                        </p>

                                        <div className="mt-3 space-y-2">
                                            <p className="text-sm font-semibold text-zinc-800">
                                                Telefone: {lead.telefone || '-'}
                                            </p>

                                            <p className="text-sm text-zinc-600">
                                                E-mail: {lead.email || '-'}
                                            </p>
                                        </div>
                                    </div>

                                    <div>
                                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-400">
                                            Veículo de interesse
                                        </p>

                                        <div className="mt-3 flex items-center gap-3 rounded-2xl bg-zinc-50 p-4">
                                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-950 text-white">
                                                <Car size={18} />
                                            </div>

                                            <p className="text-sm font-bold text-zinc-950">
                                                {getVehicleName(lead)}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex w-full flex-col gap-3 xl:w-56">
                                        <div className="space-y-3">
                                            <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-400">
                                                Alterar status
                                            </p>

                                            <div className="grid grid-cols-2 gap-2">
                                                {lead.status !== 'NOVO' && (
                                                    <button
                                                        onClick={() => void handleUpdateStatus(lead.id, 'NOVO')}
                                                        className="h-10 rounded-xl bg-blue-50 px-3 text-xs font-bold text-blue-700 transition hover:bg-blue-100"
                                                    >
                                                        Novo
                                                    </button>
                                                )}

                                                {lead.status !== 'EM_ATENDIMENTO' && (
                                                    <button
                                                        onClick={() => void handleUpdateStatus(lead.id, 'EM_ATENDIMENTO')}
                                                        className="h-10 rounded-xl bg-amber-50 px-3 text-xs font-bold text-amber-700 transition hover:bg-amber-100"
                                                    >
                                                        Atendimento
                                                    </button>
                                                )}

                                                {lead.status !== 'PROPOSTA_ENVIADA' && (
                                                    <button
                                                        onClick={() => void handleUpdateStatus(lead.id, 'PROPOSTA_ENVIADA')}
                                                        className="h-10 rounded-xl bg-purple-50 px-3 text-xs font-bold text-purple-700 transition hover:bg-purple-100"
                                                    >
                                                        Proposta
                                                    </button>
                                                )}

                                                {lead.status !== 'FECHADO' && (
                                                    <button
                                                        onClick={() => void handleUpdateStatus(lead.id, 'FECHADO')}
                                                        className="h-10 rounded-xl bg-emerald-50 px-3 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100"
                                                    >
                                                        Fechado
                                                    </button>
                                                )}

                                                {lead.status !== 'PERDIDO' && (
                                                    <button
                                                        onClick={() => void handleUpdateStatus(lead.id, 'PERDIDO')}
                                                        className="h-10 rounded-xl bg-brand-50 px-3 text-xs font-bold text-brand-700 transition hover:bg-brand-100"
                                                    >
                                                        Perdido
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex gap-2">
                                            {whatsappUrl && (
                                                <a
                                                    href={whatsappUrl}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    onClick={() => {
                                                        if (lead.status === 'NOVO') {
                                                            void handleUpdateStatus(lead.id, 'EM_ATENDIMENTO')
                                                        }
                                                    }}
                                                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100"
                                                >
                                                    <MessageCircle size={16} />
                                                    WhatsApp
                                                </a>
                                            )}

                                            <button
                                                onClick={() => setDeleteLead(lead)}
                                                className="rounded-xl bg-red-50 p-2 text-red-600 transition hover:bg-red-100"
                                                title="Excluir lead"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-6 rounded-2xl bg-zinc-50 p-5">
                                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-400">
                                        Mensagem
                                    </p>

                                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-700">
                                        {lead.mensagem || 'Nenhuma mensagem enviada.'}
                                    </p>
                                </div>
                            </div>
                        )
                    })}

                    {filteredLeads.length === 0 && (
                        <div className="rounded-3xl border border-zinc-200 bg-white p-10 text-center text-zinc-500 shadow-xl shadow-zinc-200/40">
                            Nenhum lead encontrado.
                        </div>
                    )}
                </div>
            </PageContainer>

            {saleLead && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                                    <DollarSign size={22} />
                                </div>

                                <h2 className="mt-4 text-2xl font-black text-zinc-950">
                                    Esse lead virou venda?
                                </h2>

                                <p className="mt-2 text-sm leading-6 text-zinc-500">
                                    Confirme o veículo e o valor da venda. O sistema vai criar a venda,
                                    marcar o veículo como vendido e remover do site público.
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() => setSaleLead(null)}
                                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-600 transition hover:bg-zinc-200"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
                            <div className="md:col-span-2">
                                <label className="text-sm font-medium text-zinc-700">
                                    Veículo vendido
                                </label>

                                <select
                                    value={saleVehicleId}
                                    onChange={(event) => {
                                        const selectedId = event.target.value
                                        setSaleVehicleId(selectedId)

                                        const selectedVehicle = saleVehicles.find(
                                            (vehicle) => vehicle.id === selectedId
                                        )

                                        if (selectedVehicle?.advertised_price) {
                                            setSalePrice(
                                                formatCurrency(
                                                    Number(selectedVehicle.advertised_price || 0)
                                                )
                                            )
                                        }
                                    }}
                                    className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
                                >
                                    <option value="">Selecione o veículo</option>

                                    {saleVehicles.map((vehicle) => (
                                        <option key={vehicle.id} value={vehicle.id}>
                                            {getSaleVehicleLabel(vehicle)}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="text-sm font-medium text-zinc-700">
                                    Data da venda
                                </label>

                                <input
                                    type="date"
                                    value={saleDate}
                                    onChange={(event) => setSaleDate(event.target.value)}
                                    className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
                                />
                            </div>

                            <div>
                                <label className="text-sm font-medium text-zinc-700">
                                    Valor da venda
                                </label>

                                <CurrencyInput value={salePrice} onChange={setSalePrice} />
                            </div>

                            <div className="md:col-span-2">
                                <label className="text-sm font-medium text-zinc-700">
                                    Forma de pagamento
                                </label>

                                <select
                                    value={salePaymentMethod}
                                    onChange={(event) => setSalePaymentMethod(event.target.value)}
                                    className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
                                >
                                    {paymentMethods.map((item) => (
                                        <option key={item} value={item}>
                                            {item}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="mt-6 flex flex-wrap justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setSaleLead(null)}
                                className="rounded-xl bg-zinc-100 px-5 py-3 text-sm font-bold text-zinc-700 transition hover:bg-zinc-200"
                            >
                                Não gerar agora
                            </button>

                            <button
                                type="button"
                                onClick={handleGenerateSaleFromLead}
                                disabled={saleLoading}
                                className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                            >
                                {saleLoading ? 'Gerando venda...' : 'Sim, gerar venda'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmDialog
                open={!!deleteLead}
                title="Excluir lead"
                description={
                    deleteLead
                        ? `Deseja realmente excluir o lead de ${deleteLead.nome || 'sem nome'}?`
                        : ''
                }
                confirmText="Excluir lead"
                loading={deleteLoading}
                onCancel={() => setDeleteLead(null)}
                onConfirm={handleDeleteLead}
            />

            <Toast
                open={toast.open}
                type={toast.type}
                title={toast.title}
                description={toast.description}
                onClose={() => setToast((current) => ({ ...current, open: false }))}
            />
        </>
    )
}

function SummaryCard({ title, value }: { title: string; value: string }) {
    return (
        <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-xl shadow-zinc-200/40">
            <p className="text-sm text-zinc-500">{title}</p>
            <strong className="mt-2 block text-3xl text-zinc-950">{value}</strong>
        </div>
    )
}