'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { BarChart3, Car, DollarSign, FileText, Search, TrendingUp } from 'lucide-react'
import { PageContainer } from '../components/page-container'
import { RouteGuard } from '../components/auth/route-guard'
import { Toast } from '../components/ui/toast'
import { supabase } from '../../lib/supabase'

type VehicleReport = {
    id: string
    plate: string
    purchase_price: number
    advertised_price: number
    status: string
    created_at: string
    brands?: { name: string } | null
    vehicle_models?: { name: string } | null
    vehicle_costs?: { amount: number }[]
    vehicle_sales?: { sale_price: number }[]
}

const statusOptions = [
    { label: 'Em estoque', value: 'EM_ESTOQUE' },
    { label: 'Reservado', value: 'RESERVADO' },
    { label: 'Vendido', value: 'VENDIDO' },
]

function formatCurrency(value: number) {
    return value.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    })
}

function formatPercent(value: number) {
    return `${value.toFixed(2).replace('.', ',')}%`
}

function getStatusLabel(status: string) {
    return statusOptions.find((item) => item.value === status)?.label || status
}

function getVehicleName(vehicle: VehicleReport) {
    const brand = vehicle.brands?.name || ''
    const model = vehicle.vehicle_models?.name || ''
    const name = `${brand} ${model}`.trim()

    return name || '-'
}

function getNumbers(vehicle: VehicleReport) {
    const purchase = Number(vehicle.purchase_price || 0)

    const costs = (vehicle.vehicle_costs || []).reduce(
        (sum, cost) => sum + Number(cost.amount || 0),
        0
    )

    const investment = purchase + costs

    const sale = (vehicle.vehicle_sales || []).reduce(
        (sum, saleItem) => sum + Number(saleItem.sale_price || 0),
        0
    )

    const profit = sale - investment
    const margin = sale > 0 ? (profit / sale) * 100 : 0

    return {
        purchase,
        costs,
        investment,
        sale,
        profit,
        margin,
    }
}

export default function RelatoriosPage() {
    const [vehicles, setVehicles] = useState<VehicleReport[]>([])
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
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

    useEffect(() => {
        async function loadReports() {
            const { data, error } = await supabase
                .from('vehicles')
                .select(`
    id,
    plate,
    purchase_price,
    advertised_price,
    status,
    created_at,
    brands(name),
    vehicle_models(name),
    vehicle_costs!vehicle_costs_vehicle_id_fkey(amount),
    vehicle_sales!vehicle_sales_vehicle_id_fkey(sale_price)
  `)
                .order('created_at', { ascending: false })

            if (error) {
                showToast('error', 'Erro ao carregar relatórios', error.message)
                return
            }

            setVehicles((data || []) as unknown as VehicleReport[])
        }

        void loadReports()
    }, [])

    const filteredVehicles = useMemo(() => {
        return vehicles.filter((vehicle) => {
            const text = [
                vehicle.plate,
                getVehicleName(vehicle),
                vehicle.status,
            ]
                .join(' ')
                .toLowerCase()

            const matchesSearch = search
                ? text.includes(search.toLowerCase())
                : true

            const matchesStatus = statusFilter
                ? vehicle.status === statusFilter
                : true

            const vehicleDate = vehicle.created_at?.slice(0, 10)

            const matchesStartDate = startDate
                ? vehicleDate >= startDate
                : true

            const matchesEndDate = endDate
                ? vehicleDate <= endDate
                : true

            return matchesSearch && matchesStatus && matchesStartDate && matchesEndDate
        })
    }, [vehicles, search, statusFilter, startDate, endDate])

    const totals = filteredVehicles.reduce(
        (acc, vehicle) => {
            const numbers = getNumbers(vehicle)

            acc.quantity += 1
            acc.stock += vehicle.status === 'EM_ESTOQUE' ? 1 : 0
            acc.sold += vehicle.status === 'VENDIDO' ? 1 : 0
            acc.reserved += vehicle.status === 'RESERVADO' ? 1 : 0
            acc.purchase += numbers.purchase
            acc.costs += numbers.costs
            acc.investment += numbers.investment
            acc.sales += numbers.sale
            acc.profit += numbers.profit

            return acc
        },
        {
            quantity: 0,
            stock: 0,
            sold: 0,
            reserved: 0,
            purchase: 0,
            costs: 0,
            investment: 0,
            sales: 0,
            profit: 0,
        }
    )

    const maxFinancialValue = Math.max(
        totals.investment,
        totals.sales,
        Math.abs(totals.profit),
        1
    )

    return (
        <RouteGuard allowedRoles={['ADMIN', 'GERENTE']}>
            <>
                <PageContainer
                    title="Relatórios"
                    description="Relatórios de estoque, vendas, custos e lucro por veículo."
                >
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <SummaryCard
                            title="Veículos filtrados"
                            value={String(totals.quantity)}
                            icon={<Car size={22} />}
                        />

                        <SummaryCard
                            title="Em estoque"
                            value={String(totals.stock)}
                            icon={<BarChart3 size={22} />}
                        />

                        <SummaryCard
                            title="Investimento"
                            value={formatCurrency(totals.investment)}
                            icon={<DollarSign size={22} />}
                        />

                        <SummaryCard
                            title="Lucro"
                            value={formatCurrency(totals.profit)}
                            icon={<TrendingUp size={22} />}
                            dark
                        />
                    </div>

                    <div className="mt-8 grid grid-cols-1 gap-4 rounded-3xl border border-zinc-200 bg-white p-5 shadow-xl shadow-zinc-200/40 md:grid-cols-5">
                        <div className="md:col-span-2">
                            <label className="text-sm font-medium text-zinc-700">
                                Buscar
                            </label>

                            <div className="mt-2 flex items-center gap-2 rounded-xl border border-zinc-200 px-4">
                                <Search size={18} className="text-zinc-400" />
                                <input
                                    value={search}
                                    onChange={(event) => setSearch(event.target.value)}
                                    placeholder="Placa, marca ou modelo..."
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

                                {statusOptions.map((item) => (
                                    <option key={item.value} value={item.value}>
                                        {item.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="text-sm font-medium text-zinc-700">
                                Data inicial
                            </label>

                            <input
                                type="date"
                                value={startDate}
                                onChange={(event) => setStartDate(event.target.value)}
                                className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none"
                            />
                        </div>

                        <div>
                            <label className="text-sm font-medium text-zinc-700">
                                Data final
                            </label>

                            <input
                                type="date"
                                value={endDate}
                                onChange={(event) => setEndDate(event.target.value)}
                                className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none"
                            />
                        </div>
                    </div>

                    <div className="mt-8 grid grid-cols-1 gap-5 xl:grid-cols-2">
                        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl shadow-zinc-200/40">
                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <h2 className="text-xl font-black text-zinc-950">
                                        Veículos por status
                                    </h2>
                                    <p className="mt-1 text-sm text-zinc-500">
                                        Distribuição dos veículos conforme os filtros aplicados.
                                    </p>
                                </div>

                                <div className="rounded-2xl bg-brand-50 p-3 text-brand-600">
                                    <BarChart3 size={22} />
                                </div>
                            </div>

                            <div className="mt-6 space-y-5">
                                <StatusBar
                                    label="Em estoque"
                                    value={totals.stock}
                                    total={totals.quantity}
                                    tone="blue"
                                />

                                <StatusBar
                                    label="Reservados"
                                    value={totals.reserved}
                                    total={totals.quantity}
                                    tone="amber"
                                />

                                <StatusBar
                                    label="Vendidos"
                                    value={totals.sold}
                                    total={totals.quantity}
                                    tone="emerald"
                                />
                            </div>
                        </div>

                        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl shadow-zinc-200/40">
                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <h2 className="text-xl font-black text-zinc-950">
                                        Resultado financeiro
                                    </h2>
                                    <p className="mt-1 text-sm text-zinc-500">
                                        Comparativo entre investimento, venda e lucro.
                                    </p>
                                </div>

                                <div className="rounded-2xl bg-zinc-950 p-3 text-white">
                                    <TrendingUp size={22} />
                                </div>
                            </div>

                            <div className="mt-6 space-y-5">
                                <MoneyBar
                                    label="Investimento"
                                    value={totals.investment}
                                    maxValue={maxFinancialValue}
                                    tone="zinc"
                                />

                                <MoneyBar
                                    label="Vendas"
                                    value={totals.sales}
                                    maxValue={maxFinancialValue}
                                    tone="emerald"
                                />

                                <MoneyBar
                                    label="Lucro"
                                    value={totals.profit}
                                    maxValue={maxFinancialValue}
                                    tone={totals.profit >= 0 ? 'red' : 'negative'}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl shadow-zinc-200/40">
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <h2 className="text-xl font-black text-zinc-950">
                                    Top veículos por lucro
                                </h2>
                                <p className="mt-1 text-sm text-zinc-500">
                                    Ranking dos veículos com melhor resultado financeiro.
                                </p>
                            </div>

                            <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-600">
                                <TrendingUp size={22} />
                            </div>
                        </div>

                        <div className="mt-6 space-y-3">
                            {[...filteredVehicles]
                                .sort((a, b) => getNumbers(b).profit - getNumbers(a).profit)
                                .slice(0, 5)
                                .map((vehicle, index) => {
                                    const numbers = getNumbers(vehicle)

                                    return (
                                        <div
                                            key={vehicle.id}
                                            className="flex flex-col justify-between gap-4 rounded-2xl bg-zinc-50 p-4 md:flex-row md:items-center"
                                        >
                                            <div>
                                                <p className="text-sm font-black text-zinc-950">
                                                    #{index + 1} {vehicle.plate} - {getVehicleName(vehicle)}
                                                </p>

                                                <p className="mt-1 text-xs text-zinc-500">
                                                    Venda: {formatCurrency(numbers.sale)} · Investimento:{' '}
                                                    {formatCurrency(numbers.investment)}
                                                </p>
                                            </div>

                                            <strong
                                                className={
                                                    numbers.profit >= 0
                                                        ? 'text-emerald-700'
                                                        : 'text-red-700'
                                                }
                                            >
                                                {formatCurrency(numbers.profit)}
                                            </strong>
                                        </div>
                                    )
                                })}

                            {filteredVehicles.length === 0 && (
                                <p className="rounded-2xl bg-zinc-50 p-5 text-sm text-zinc-500">
                                    Nenhum veículo encontrado para montar o ranking.
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="mt-8 overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-xl shadow-zinc-200/50">
                        <div className="flex items-center justify-between border-b border-zinc-200 p-6">
                            <div>
                                <h2 className="text-xl font-bold text-zinc-950">
                                    Resultado dos veículos
                                </h2>

                                <p className="mt-1 text-sm text-zinc-500">
                                    {filteredVehicles.length} registro(s) encontrado(s).
                                </p>
                            </div>
                        </div>

                        <table className="w-full text-sm">
                            <thead className="bg-zinc-950 text-white">
                                <tr>
                                    <th className="px-5 py-4 text-left">Placa</th>
                                    <th className="px-5 py-4 text-left">Veículo</th>
                                    <th className="px-5 py-4 text-left">Status</th>
                                    <th className="px-5 py-4 text-left">Compra</th>
                                    <th className="px-5 py-4 text-left">Custos</th>
                                    <th className="px-5 py-4 text-left">Investimento</th>
                                    <th className="px-5 py-4 text-left">Venda</th>
                                    <th className="px-5 py-4 text-left">Lucro</th>
                                    <th className="px-5 py-4 text-left">Margem</th>
                                    <th className="px-5 py-4 text-right">Ação</th>
                                </tr>
                            </thead>

                            <tbody>
                                {filteredVehicles.map((vehicle) => {
                                    const numbers = getNumbers(vehicle)

                                    return (
                                        <tr
                                            key={vehicle.id}
                                            className="border-t transition-colors hover:bg-zinc-50"
                                        >
                                            <td className="px-5 py-4 font-semibold">{vehicle.plate}</td>
                                            <td className="px-5 py-4">{getVehicleName(vehicle)}</td>
                                            <td className="px-5 py-4">{getStatusLabel(vehicle.status)}</td>
                                            <td className="px-5 py-4">{formatCurrency(numbers.purchase)}</td>
                                            <td className="px-5 py-4">{formatCurrency(numbers.costs)}</td>
                                            <td className="px-5 py-4">{formatCurrency(numbers.investment)}</td>
                                            <td className="px-5 py-4">{formatCurrency(numbers.sale)}</td>
                                            <td
                                                className={`px-5 py-4 font-bold ${numbers.profit >= 0
                                                    ? 'text-emerald-700'
                                                    : 'text-red-700'
                                                    }`}
                                            >
                                                {formatCurrency(numbers.profit)}
                                            </td>
                                            <td className="px-5 py-4">{formatPercent(numbers.margin)}</td>
                                            <td className="px-5 py-4 text-right">
                                                <Link
                                                    href={`/dre?vehicleId=${vehicle.id}`}
                                                    className="inline-flex items-center gap-2 rounded-xl bg-zinc-950 px-4 py-2 text-xs font-semibold text-white transition hover:bg-zinc-800"
                                                >
                                                    <FileText size={16} />
                                                    Ver DRE
                                                </Link>
                                            </td>
                                        </tr>
                                    )
                                })}

                                {filteredVehicles.length === 0 && (
                                    <tr>
                                        <td
                                            colSpan={10}
                                            className="px-5 py-10 text-center text-zinc-500"
                                        >
                                            Nenhum registro encontrado.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </PageContainer>

                <Toast
                    open={toast.open}
                    type={toast.type}
                    title={toast.title}
                    description={toast.description}
                    onClose={() => setToast((current) => ({ ...current, open: false }))}
                />
            </>
        </RouteGuard>
    )
}

function SummaryCard({
    title,
    value,
    icon,
    dark = false,
}: {
    title: string
    value: string
    icon: React.ReactNode
    dark?: boolean
}) {
    return (
        <div
            className={`rounded-3xl border p-5 shadow-xl ${dark
                ? 'border-zinc-950 bg-zinc-950 text-white shadow-zinc-300/60'
                : 'border-zinc-200 bg-white text-zinc-950 shadow-zinc-200/40'
                }`}
        >
            <div className="flex items-center justify-between">
                <div>
                    <p className={`text-sm ${dark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                        {title}
                    </p>

                    <strong className="mt-2 block text-2xl">{value}</strong>
                </div>

                <div
                    className={`rounded-2xl p-3 ${dark ? 'bg-white/10 text-white' : 'bg-brand-50 text-brand-600'
                        }`}
                >
                    {icon}
                </div>
            </div>
        </div>
    )
}


function StatusBar({
    label,
    value,
    total,
    tone = 'red',
}: {
    label: string
    value: number
    total: number
    tone?: 'red' | 'blue' | 'amber' | 'emerald'
}) {
    const percent = total > 0 ? (value / total) * 100 : 0

    const toneClass = {
        red: 'bg-red-600',
        blue: 'bg-blue-600',
        amber: 'bg-amber-500',
        emerald: 'bg-emerald-600',
    }[tone]

    return (
        <div>
            <div className="mb-2 flex items-center justify-between gap-4 text-sm">
                <span className="font-semibold text-zinc-700">{label}</span>
                <span className="font-bold text-zinc-950">
                    {value} · {percent.toFixed(1).replace('.', ',')}%
                </span>
            </div>

            <div className="h-3 overflow-hidden rounded-full bg-zinc-100">
                <div
                    className={`h-full rounded-full ${toneClass}`}
                    style={{ width: `${percent}%` }}
                />
            </div>
        </div>
    )
}

function MoneyBar({
    label,
    value,
    maxValue,
    tone = 'zinc',
}: {
    label: string
    value: number
    maxValue: number
    tone?: 'zinc' | 'emerald' | 'red' | 'negative'
}) {
    const percent = maxValue > 0 ? (Math.abs(value) / maxValue) * 100 : 0

    const toneClass = {
        zinc: 'bg-zinc-950',
        emerald: 'bg-emerald-600',
        red: 'bg-red-600',
        negative: 'bg-red-600',
    }[tone]

    const isNegative = value < 0

    return (
        <div>
            <div className="mb-2 flex items-center justify-between gap-4 text-sm">
                <span className="font-semibold text-zinc-700">{label}</span>
                <span
                    className={`font-bold ${isNegative ? 'text-red-700' : 'text-zinc-950'
                        }`}
                >
                    {formatCurrency(value)}
                </span>
            </div>

            <div className="h-3 overflow-hidden rounded-full bg-zinc-100">
                <div
                    className={`h-full rounded-full ${toneClass}`}
                    style={{ width: `${percent}%` }}
                />
            </div>
        </div>
    )
}
