'use client'

import { useEffect, useMemo, useState } from 'react'
import { Car, MessageCircle, Search, Trash2, UserRound } from 'lucide-react'
import { PageContainer } from '../components/page-container'
import { Toast } from '../components/ui/toast'
import { ConfirmDialog } from '../components/ui/confirm-dialog'
import { supabase } from '../../lib/supabase'

type LeadStatus =
    | 'NOVO'
    | 'EM_ATENDIMENTO'
    | 'PROPOSTA_ENVIADA'
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
    created_at: string
    vehicles?: {
        plate: string
        brands?: { name: string } | null
        vehicle_models?: { name: string } | null
    } | null
}

const leadStatusOptions: { label: string; value: LeadStatus }[] = [
    { label: 'Novo', value: 'NOVO' },
    { label: 'Em atendimento', value: 'EM_ATENDIMENTO' },
    { label: 'Proposta enviada', value: 'PROPOSTA_ENVIADA' },
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

export default function LeadsPage() {
    const [leads, setLeads] = useState<Lead[]>([])
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [loading, setLoading] = useState(false)

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

    async function handleUpdateStatus(leadId: string, status: LeadStatus) {
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
                description="Gerencie os contatos recebidos pelo site público da Matrix."
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
                        const whatsappMessage = `Olá, ${lead.nome || ''}! Recebemos seu contato pelo site da Matrix sobre o veículo ${getVehicleName(
                            lead,
                            false
                        )}.`

                        const whatsappUrl = phone
                            ? `https://wa.me/55${phone}?text=${encodeURIComponent(whatsappMessage)}`
                            : ''

                        return (
                            <div
                                key={lead.id}
                                className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl shadow-zinc-200/50"
                            >
                                <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_1fr_1.2fr_auto]">
                                    <div>
                                        <div className="flex items-start gap-4">
                                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-600">
                                                <UserRound size={22} />
                                            </div>

                                            <div className="min-w-0">
                                                <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-400">
                                                    Cliente
                                                </p>

                                                <h3 className="mt-1 truncate text-xl font-black text-zinc-950">
                                                    {lead.nome || '-'}
                                                </h3>

                                                <p className="mt-2 text-sm text-zinc-500">
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
                                        <select
                                            value={lead.status}
                                            onChange={(event) =>
                                                void handleUpdateStatus(
                                                    lead.id,
                                                    event.target.value as LeadStatus
                                                )
                                            }
                                            className={`h-10 w-full rounded-xl px-3 py-2 text-xs font-bold outline-none ${getStatusClass(
                                                lead.status
                                            )}`}
                                        >
                                            {leadStatusOptions.map((item) => (
                                                <option key={item.value} value={item.value}>
                                                    {item.label}
                                                </option>
                                            ))}
                                        </select>

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