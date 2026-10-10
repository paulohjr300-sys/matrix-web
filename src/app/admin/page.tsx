'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ExternalLink, LogOut, Search, Store } from 'lucide-react'

import { PainelLogo } from '../components/brand/painel-logo'
import { Toast } from '../components/ui/toast'
import { ConfirmDialog } from '../components/ui/confirm-dialog'
import { supabase } from '../../lib/supabase'

type Empresa = {
    id: string
    slug: string
    nome: string
    dominio: string | null
    ativo: boolean
    plano: 'basico' | 'pro'
    assinatura_status: 'trial' | 'ativa' | 'inadimplente' | 'cancelada'
    trial_termina_em: string | null
    whatsapp: string | null
    email: string | null
    created_at: string
    responsavel: { name: string; email: string } | null
    usuarios: number
    veiculos: number
    leads30d: number
}

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://matrix-site-peach.vercel.app').replace(/\/$/, '')

const STATUS_LABEL: Record<Empresa['assinatura_status'], string> = {
    trial: 'Em teste',
    ativa: 'Ativa',
    inadimplente: 'Inadimplente',
    cancelada: 'Cancelada',
}

const STATUS_STYLE: Record<Empresa['assinatura_status'], string> = {
    trial: 'bg-amber-50 text-amber-700 ring-amber-200',
    ativa: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    inadimplente: 'bg-red-50 text-red-700 ring-red-200',
    cancelada: 'bg-zinc-100 text-zinc-600 ring-zinc-200',
}

const selectClass =
    'rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs font-semibold outline-none focus:border-brand-500'

function siteUrl(empresa: Empresa) {
    return empresa.dominio ? `https://${empresa.dominio}` : `${SITE_URL}/loja/${empresa.slug}`
}

function formatDate(value: string | null) {
    return value ? new Date(value).toLocaleDateString('pt-BR') : '—'
}

function daysUntil(value: string | null) {
    if (!value) return null
    return Math.ceil((new Date(value).getTime() - Date.now()) / (24 * 60 * 60 * 1000))
}

export default function AdminPage() {
    const router = useRouter()
    const [empresas, setEmpresas] = useState<Empresa[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [savingId, setSavingId] = useState<string | null>(null)
    const [suspendTarget, setSuspendTarget] = useState<Empresa | null>(null)

    const [toast, setToast] = useState({
        open: false,
        type: 'success' as 'success' | 'error',
        title: '',
        description: '',
    })

    function showToast(type: 'success' | 'error', title: string, description?: string) {
        setToast({ open: true, type, title, description: description || '' })
        setTimeout(() => setToast((current) => ({ ...current, open: false })), 3000)
    }

    async function loadEmpresas() {
        const response = await fetch('/api/admin/empresas')
        const result = await response.json().catch(() => ({}))

        if (!response.ok) {
            showToast('error', 'Erro', result.message || 'Não foi possível carregar as lojas.')
            setLoading(false)
            return
        }

        setEmpresas(result.empresas || [])
        setLoading(false)
    }

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial
        void loadEmpresas()
    }, [])

    async function updateEmpresa(empresa: Empresa, changes: Record<string, unknown>, successMessage: string) {
        setSavingId(empresa.id)

        try {
            const response = await fetch(`/api/admin/empresas/${empresa.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(changes),
            })

            const result = await response.json().catch(() => ({}))

            if (!response.ok) {
                showToast('error', 'Erro', result.message || 'Não foi possível salvar.')
                return
            }

            showToast('success', 'Salvo', successMessage)
            await loadEmpresas()
        } finally {
            setSavingId(null)
        }
    }

    function extendTrial(empresa: Empresa, days: number) {
        const base = empresa.trial_termina_em && daysUntil(empresa.trial_termina_em)! > 0
            ? new Date(empresa.trial_termina_em)
            : new Date()

        base.setDate(base.getDate() + days)

        void updateEmpresa(
            empresa,
            { trial_termina_em: base.toISOString(), assinatura_status: 'trial' },
            `Teste estendido até ${base.toLocaleDateString('pt-BR')}.`
        )
    }

    function editDomain(empresa: Empresa) {
        const value = window.prompt(
            'Domínio próprio da loja (ex: lojasilva.com.br). Deixe vazio para remover.',
            empresa.dominio || ''
        )

        if (value === null) return

        void updateEmpresa(empresa, { dominio: value }, value ? 'Domínio salvo.' : 'Domínio removido.')
    }

    async function handleLogout() {
        await supabase.auth.signOut()
        router.push('/login')
    }

    const filtered = useMemo(() => {
        const term = search.trim().toLowerCase()
        if (!term) return empresas

        return empresas.filter((empresa) =>
            [empresa.nome, empresa.slug, empresa.dominio, empresa.responsavel?.email, empresa.responsavel?.name]
                .filter(Boolean)
                .some((value) => String(value).toLowerCase().includes(term))
        )
    }, [empresas, search])

    const totals = useMemo(
        () => ({
            total: empresas.length,
            ativas: empresas.filter((e) => e.ativo && e.assinatura_status === 'ativa').length,
            teste: empresas.filter((e) => e.ativo && e.assinatura_status === 'trial').length,
            atencao: empresas.filter((e) => !e.ativo || e.assinatura_status === 'inadimplente').length,
        }),
        [empresas]
    )

    return (
        <div className="min-h-screen bg-zinc-100">
            <Toast
                open={toast.open}
                type={toast.type}
                title={toast.title}
                description={toast.description}
                onClose={() => setToast((current) => ({ ...current, open: false }))}
            />

            <ConfirmDialog
                open={suspendTarget !== null}
                title={suspendTarget?.ativo ? 'Suspender loja' : 'Reativar loja'}
                description={
                    suspendTarget?.ativo
                        ? `Os usuários de "${suspendTarget?.nome}" perdem o acesso ao painel e o site da loja sai do ar até a reativação. Nenhum dado é apagado.`
                        : `"${suspendTarget?.nome}" volta a ter acesso ao painel e o site volta ao ar.`
                }
                confirmText={suspendTarget?.ativo ? 'Suspender' : 'Reativar'}
                loading={savingId === suspendTarget?.id}
                onCancel={() => setSuspendTarget(null)}
                onConfirm={async () => {
                    if (!suspendTarget) return
                    await updateEmpresa(
                        suspendTarget,
                        { ativo: !suspendTarget.ativo },
                        suspendTarget.ativo ? 'Loja suspensa.' : 'Loja reativada.'
                    )
                    setSuspendTarget(null)
                }}
            />

            <header className="bg-brand-900 text-white">
                <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
                    <div className="flex items-center gap-4">
                        <PainelLogo variant="dark" />
                        <span className="rounded-full bg-ponteiro px-3 py-1 text-xs font-black uppercase tracking-wide text-brand-900">
                            Plataforma
                        </span>
                    </div>

                    <button
                        type="button"
                        onClick={() => void handleLogout()}
                        className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-brand-100 transition hover:bg-brand-800 hover:text-white"
                    >
                        <LogOut size={18} />
                        Sair
                    </button>
                </div>
            </header>

            <main className="mx-auto max-w-7xl px-6 py-8">
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                    <Kpi label="Lojas" value={totals.total} />
                    <Kpi label="Assinaturas ativas" value={totals.ativas} />
                    <Kpi label="Em teste" value={totals.teste} />
                    <Kpi label="Suspensas ou inadimplentes" value={totals.atencao} />
                </div>

                <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
                    <h1 className="text-2xl font-black text-zinc-950">Lojas</h1>

                    <label className="relative w-full max-w-sm">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Buscar por loja, endereço ou e-mail"
                            className="w-full rounded-xl border border-zinc-200 bg-white py-2.5 pl-9 pr-4 text-sm outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
                        />
                    </label>
                </div>

                <div className="mt-4 overflow-x-auto rounded-3xl border border-zinc-200 bg-white shadow-xl shadow-zinc-200/50">
                    <table className="w-full min-w-[1100px] text-left text-sm">
                        <thead className="border-b border-zinc-100 text-xs uppercase tracking-wide text-zinc-500">
                            <tr>
                                <th className="px-5 py-4">Loja</th>
                                <th className="px-5 py-4">Responsável</th>
                                <th className="px-5 py-4">Plano</th>
                                <th className="px-5 py-4">Assinatura</th>
                                <th className="px-5 py-4">Fim do teste</th>
                                <th className="px-5 py-4 text-right">Uso</th>
                                <th className="px-5 py-4 text-right">Ações</th>
                            </tr>
                        </thead>

                        <tbody className="divide-y divide-zinc-100">
                            {loading && (
                                <tr>
                                    <td colSpan={7} className="px-5 py-10 text-center text-zinc-500">
                                        Carregando...
                                    </td>
                                </tr>
                            )}

                            {!loading && filtered.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-5 py-10 text-center text-zinc-500">
                                        Nenhuma loja encontrada.
                                    </td>
                                </tr>
                            )}

                            {filtered.map((empresa) => {
                                const days = daysUntil(empresa.trial_termina_em)
                                const saving = savingId === empresa.id

                                return (
                                    <tr key={empresa.id} className={empresa.ativo ? '' : 'bg-zinc-50 opacity-70'}>
                                        <td className="px-5 py-4">
                                            <div className="flex items-start gap-3">
                                                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                                                    <Store size={18} />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-bold text-zinc-950">
                                                        {empresa.nome}
                                                        {!empresa.ativo && (
                                                            <span className="ml-2 rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-black uppercase text-zinc-600">
                                                                Suspensa
                                                            </span>
                                                        )}
                                                    </p>
                                                    <a
                                                        href={siteUrl(empresa)}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="inline-flex items-center gap-1 text-xs text-brand-600 hover:underline"
                                                    >
                                                        {empresa.dominio || `/loja/${empresa.slug}`}
                                                        <ExternalLink size={11} />
                                                    </a>
                                                    <p className="text-xs text-zinc-400">
                                                        Desde {formatDate(empresa.created_at)}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>

                                        <td className="px-5 py-4">
                                            <p className="font-medium text-zinc-800">{empresa.responsavel?.name || '—'}</p>
                                            <p className="text-xs text-zinc-500">
                                                {empresa.responsavel?.email || empresa.email || ''}
                                            </p>
                                        </td>

                                        <td className="px-5 py-4">
                                            <select
                                                value={empresa.plano}
                                                disabled={saving}
                                                onChange={(e) =>
                                                    void updateEmpresa(empresa, { plano: e.target.value }, 'Plano alterado.')
                                                }
                                                className={selectClass}
                                            >
                                                <option value="basico">Básico</option>
                                                <option value="pro">Pro</option>
                                            </select>
                                        </td>

                                        <td className="px-5 py-4">
                                            <select
                                                value={empresa.assinatura_status}
                                                disabled={saving}
                                                onChange={(e) =>
                                                    void updateEmpresa(
                                                        empresa,
                                                        { assinatura_status: e.target.value },
                                                        'Situação da assinatura alterada.'
                                                    )
                                                }
                                                className={`${selectClass} ring-1 ${STATUS_STYLE[empresa.assinatura_status]}`}
                                            >
                                                {Object.entries(STATUS_LABEL).map(([value, label]) => (
                                                    <option key={value} value={value}>
                                                        {label}
                                                    </option>
                                                ))}
                                            </select>
                                        </td>

                                        <td className="px-5 py-4">
                                            {empresa.assinatura_status === 'trial' ? (
                                                <div>
                                                    <p className={`text-sm font-semibold ${days !== null && days < 0 ? 'text-red-600' : 'text-zinc-800'}`}>
                                                        {formatDate(empresa.trial_termina_em)}
                                                    </p>
                                                    <p className="text-xs text-zinc-500">
                                                        {days === null ? '' : days < 0 ? 'Expirado' : `${days} dia(s)`}
                                                    </p>
                                                    <button
                                                        type="button"
                                                        disabled={saving}
                                                        onClick={() => extendTrial(empresa, 7)}
                                                        className="mt-1 text-xs font-semibold text-brand-600 hover:underline disabled:opacity-50"
                                                    >
                                                        + 7 dias
                                                    </button>
                                                </div>
                                            ) : (
                                                <span className="text-zinc-400">—</span>
                                            )}
                                        </td>

                                        <td className="px-5 py-4 text-right text-xs text-zinc-600">
                                            <p>{empresa.usuarios} usuário(s)</p>
                                            <p>{empresa.veiculos} veículo(s)</p>
                                            <p>{empresa.leads30d} lead(s) em 30 dias</p>
                                        </td>

                                        <td className="px-5 py-4">
                                            <div className="flex flex-col items-end gap-2">
                                                <button
                                                    type="button"
                                                    disabled={saving}
                                                    onClick={() => editDomain(empresa)}
                                                    className="text-xs font-semibold text-zinc-600 hover:text-brand-600 disabled:opacity-50"
                                                >
                                                    {empresa.dominio ? 'Alterar domínio' : 'Ligar domínio'}
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={saving}
                                                    onClick={() => setSuspendTarget(empresa)}
                                                    className={`rounded-lg px-3 py-1.5 text-xs font-bold transition disabled:opacity-50 ${empresa.ativo
                                                        ? 'bg-red-50 text-red-700 hover:bg-red-100'
                                                        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                                        }`}
                                                >
                                                    {empresa.ativo ? 'Suspender' : 'Reativar'}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </main>
        </div>
    )
}

function Kpi({ label, value }: { label: string; value: number }) {
    return (
        <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-xl shadow-zinc-200/50">
            <p className="text-sm text-zinc-500">{label}</p>
            <p className="mt-2 text-3xl font-black text-zinc-950">{value}</p>
        </div>
    )
}
