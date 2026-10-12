'use client'

import { useEffect, useState } from 'react'
import { PageContainer } from '../components/page-container'
import { supabase } from '../../lib/supabase'
import { Toast } from '../components/ui/toast'
import {
    TrendingUp,
    TrendingDown,
    Car,
    DollarSign,
    ChevronDown,
    ChevronUp,
} from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { RouteGuard } from '../components/auth/route-guard'

type VehicleDre = {
    id: string
    plate: string
    purchase_price: number
    advertised_price: number
    status: string
    brands?: { name: string } | null
    vehicle_models?: { name: string } | null
    vehicle_costs?: {
        amount: number
    }[]
    vehicle_sales?: {
        sale_price: number
    }[]
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

function getVehicleName(vehicle: VehicleDre) {
    const brandName = vehicle.brands?.name || ''
    const modelName = vehicle.vehicle_models?.name || ''
    const details = [brandName, modelName].filter(Boolean).join(' ')

    return details ? `${vehicle.plate} - ${details}` : vehicle.plate
}

function getStatusBadge(status: string) {
    switch (status) {
        case 'EM_ESTOQUE':
            return 'border-blue-200 bg-blue-50 text-blue-700'
        case 'RESERVADO':
            return 'border-amber-200 bg-amber-50 text-amber-700'
        case 'VENDIDO':
            return 'border-green-200 bg-green-50 text-green-700'
        default:
            return 'border-zinc-200 bg-zinc-50 text-zinc-700'
    }
}

function getStatusDot(status: string) {
    switch (status) {
        case 'EM_ESTOQUE':
            return 'bg-blue-500 animate-pulse'
        case 'RESERVADO':
            return 'bg-amber-500'
        case 'VENDIDO':
            return 'bg-emerald-500'
        default:
            return 'bg-zinc-500'
    }
}

function getStatusBorder(status: string) {
    switch (status) {
        case 'EM_ESTOQUE':
            return 'border-l-blue-500'
        case 'RESERVADO':
            return 'border-l-amber-500'
        case 'VENDIDO':
            return 'border-l-emerald-500'
        default:
            return 'border-l-zinc-300'
    }
}

function getStatusLabel(status: string) {
    switch (status) {
        case 'EM_ESTOQUE':
            return 'Em Estoque'
        case 'RESERVADO':
            return 'Reservado'
        case 'VENDIDO':
            return 'Vendido'
        default:
            return status
    }
}

function DreContent() {
    const [vehicles, setVehicles] = useState<VehicleDre[]>([])
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('')

    const searchParams = useSearchParams()
    const vehicleIdFromUrl = searchParams.get('vehicleId')
    const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(
        vehicleIdFromUrl
    )

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
        let isMounted = true

        async function loadDre() {
            const { data, error } = await supabase
                .from('vehicles')
                .select(`
          id,
          plate,
          purchase_price,
          advertised_price,
          status,
          brands(name),
          vehicle_models(name),
          vehicle_costs(amount),
          vehicle_sales(sale_price)
        `)
                .order('created_at', { ascending: false })

            if (!isMounted) {
                return
            }

            if (error) {
                showToast('error', 'Erro ao carregar DRE', error.message)
                return
            }

            setVehicles((data || []) as unknown as VehicleDre[])
        }

        void loadDre()

        return () => {
            isMounted = false
        }
    }, [])

    const filteredVehicles = vehicles.filter((vehicle) => {
        const name = getVehicleName(vehicle).toLowerCase()

        const matchesSearch = search
            ? name.includes(search.toLowerCase())
            : true

        const matchesStatus = statusFilter
            ? vehicle.status === statusFilter
            : true

        return matchesSearch && matchesStatus
    })

    function getNumbers(vehicle: VehicleDre) {
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

        // Sem venda lançada não há lucro ainda (o carro está no estoque): não
        // conta como prejuízo. Mostra só o previsto pelo valor anunciado.
        const vendido = (vehicle.vehicle_sales || []).length > 0
        const profit = vendido ? sale - investment : null
        const margin = vendido && sale > 0 ? ((sale - investment) / sale) * 100 : null
        const anunciado = Number(vehicle.advertised_price || 0)
        const previsto = !vendido && anunciado > 0 ? anunciado - investment : null

        return {
            purchase,
            costs,
            investment,
            sale,
            vendido,
            profit,
            margin,
            anunciado,
            previsto,
        }
    }

    // Totais do que está filtrado na tela. O lucro soma só os carros vendidos.
    const totals = filteredVehicles.reduce(
        (acc, vehicle) => {
            const numbers = getNumbers(vehicle)

            acc.purchase += numbers.purchase
            acc.costs += numbers.costs
            acc.investment += numbers.investment
            acc.sales += numbers.sale

            if (numbers.profit !== null) {
                acc.profit += numbers.profit
                acc.vendidos += 1
            }

            return acc
        },
        {
            purchase: 0,
            costs: 0,
            investment: 0,
            sales: 0,
            profit: 0,
            vendidos: 0,
        }
    )

    return (
        <RouteGuard allowedRoles={['ADMIN', 'GERENTE']}>
            <>
                <PageContainer
                    title="DRE"
                    description="Demonstrativo de Resultado por veículo."
                >
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl shadow-zinc-200/50">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-zinc-500">Investimento total</p>
                                    <h2 className="mt-2 text-2xl font-bold">
                                        {formatCurrency(totals.investment)}
                                    </h2>
                                </div>

                                <div className="rounded-2xl bg-brand-50 p-3 text-brand-600">
                                    <Car size={22} />
                                </div>
                            </div>
                        </div>

                        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl shadow-zinc-200/50">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-zinc-500">Custos lançados</p>
                                    <h2 className="mt-2 text-2xl font-bold">
                                        {formatCurrency(totals.costs)}
                                    </h2>
                                </div>

                                <div className="rounded-2xl bg-amber-50 p-3 text-amber-600">
                                    <DollarSign size={22} />
                                </div>
                            </div>
                        </div>

                        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl shadow-zinc-200/50">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-zinc-500">Total vendido</p>
                                    <h2 className="mt-2 text-2xl font-bold">
                                        {formatCurrency(totals.sales)}
                                    </h2>
                                </div>

                                <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-600">
                                    <TrendingUp size={22} />
                                </div>
                            </div>
                        </div>

                        <div className="rounded-3xl border border-zinc-200 bg-zinc-950 p-6 text-white shadow-xl shadow-zinc-300/60">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-zinc-400">Lucro total</p>
                                    <h2 className="mt-2 text-2xl font-bold">
                                        {formatCurrency(totals.profit)}
                                    </h2>
                                    <p className="mt-1 text-xs text-zinc-400">
                                        {totals.vendidos === 1
                                            ? 'de 1 carro vendido'
                                            : `de ${totals.vendidos} carros vendidos`}
                                    </p>
                                </div>

                                <div
                                    className={`rounded-2xl p-3 ${totals.profit >= 0
                                        ? 'bg-emerald-500/20 text-emerald-300'
                                        : 'bg-red-500/20 text-red-300'
                                        }`}
                                >
                                    {totals.profit >= 0 ? (
                                        <TrendingUp size={22} />
                                    ) : (
                                        <TrendingDown size={22} />
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 grid grid-cols-1 gap-4 rounded-3xl border border-zinc-200 bg-white p-5 shadow-xl shadow-zinc-200/40 md:grid-cols-3">
                        <div className="md:col-span-2">
                            <label className="text-sm font-medium text-zinc-700">
                                Buscar veículo
                            </label>

                            <input
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder="Buscar por placa, marca ou modelo..."
                                className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none transition-all focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
                            />
                        </div>

                        <div>
                            <label className="text-sm font-medium text-zinc-700">
                                Status
                            </label>

                            <select
                                value={statusFilter}
                                onChange={(event) => setStatusFilter(event.target.value)}
                                className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none transition-all focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
                            >
                                <option value="">Todos</option>

                                {statusOptions.map((item) => (
                                    <option key={item.value} value={item.value}>
                                        {item.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="mt-8 space-y-4">
                        {filteredVehicles.map((vehicle) => {
                            const numbers = getNumbers(vehicle)
                            const isOpen = selectedVehicleId === vehicle.id

                            return (
                                <div
                                    key={vehicle.id}
                                    className={`rounded-3xl border border-l-4 border-zinc-200 bg-white p-5 shadow-xl shadow-zinc-200/50 transition-all duration-300 ${getStatusBorder(
                                        vehicle.status
                                    )}`}
                                >
                                    <div className="grid grid-cols-1 items-center gap-4 xl:grid-cols-6">
                                        <div className="xl:col-span-2">
                                            <h2 className="font-bold text-zinc-950">
                                                {getVehicleName(vehicle)}
                                            </h2>

                                            <div className="mt-2">
                                                <span
                                                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${getStatusBadge(
                                                        vehicle.status
                                                    )}`}
                                                >
                                                    <span
                                                        className={`h-2 w-2 rounded-full ${getStatusDot(
                                                            vehicle.status
                                                        )}`}
                                                    />
                                                    {getStatusLabel(vehicle.status)}
                                                </span>
                                            </div>
                                        </div>

                                        <div>
                                            <p className="text-xs text-zinc-500">Investimento</p>
                                            <strong>{formatCurrency(numbers.investment)}</strong>
                                        </div>

                                        <div>
                                            <p className="text-xs text-zinc-500">Venda</p>
                                            {numbers.vendido ? (
                                                <strong>{formatCurrency(numbers.sale)}</strong>
                                            ) : (
                                                <>
                                                    <strong className="text-zinc-400">Não vendido</strong>
                                                    {numbers.anunciado > 0 && (
                                                        <p className="text-xs text-zinc-500">
                                                            anunciado {formatCurrency(numbers.anunciado)}
                                                        </p>
                                                    )}
                                                </>
                                            )}
                                        </div>

                                        <div>
                                            <p className="text-xs text-zinc-500">Lucro</p>
                                            {numbers.profit !== null ? (
                                                <strong
                                                    className={
                                                        numbers.profit >= 0
                                                            ? 'text-emerald-700'
                                                            : 'text-red-700'
                                                    }
                                                >
                                                    {formatCurrency(numbers.profit)}
                                                </strong>
                                            ) : (
                                                <>
                                                    <strong className="text-zinc-400">—</strong>
                                                    {numbers.previsto !== null && (
                                                        <p className="text-xs text-zinc-500">
                                                            previsto {formatCurrency(numbers.previsto)}
                                                        </p>
                                                    )}
                                                </>
                                            )}
                                        </div>

                                        <div className="flex justify-end">
                                            <button
                                                onClick={() =>
                                                    setSelectedVehicleId(isOpen ? null : vehicle.id)
                                                }
                                                className="inline-flex items-center gap-2 rounded-2xl bg-zinc-950 px-4 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-zinc-800"
                                            >
                                                {isOpen ? 'Ocultar DRE' : 'Ver DRE'}
                                                {isOpen ? (
                                                    <ChevronUp size={18} />
                                                ) : (
                                                    <ChevronDown size={18} />
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    {isOpen && (
                                        <div className="slide-up mt-6 border-t border-zinc-200 pt-6">
                                            <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
                                                <div className="rounded-2xl bg-zinc-50 p-4">
                                                    <p className="text-xs font-semibold text-zinc-500">
                                                        Compra
                                                    </p>
                                                    <strong className="mt-2 block text-lg">
                                                        {formatCurrency(numbers.purchase)}
                                                    </strong>
                                                </div>

                                                <div className="rounded-2xl bg-zinc-50 p-4">
                                                    <p className="text-xs font-semibold text-zinc-500">
                                                        Custos
                                                    </p>
                                                    <strong className="mt-2 block text-lg">
                                                        {formatCurrency(numbers.costs)}
                                                    </strong>
                                                </div>

                                                <div className="rounded-2xl bg-zinc-50 p-4">
                                                    <p className="text-xs font-semibold text-zinc-500">
                                                        Investimento
                                                    </p>
                                                    <strong className="mt-2 block text-lg">
                                                        {formatCurrency(numbers.investment)}
                                                    </strong>
                                                </div>

                                                <div className="rounded-2xl bg-zinc-50 p-4">
                                                    <p className="text-xs font-semibold text-zinc-500">
                                                        Venda
                                                    </p>
                                                    <strong className="mt-2 block text-lg">
                                                        {numbers.vendido ? formatCurrency(numbers.sale) : 'Não vendido'}
                                                    </strong>
                                                </div>

                                                <div className="rounded-2xl bg-zinc-950 p-4 text-white">
                                                    <p className="text-xs font-semibold text-zinc-400">
                                                        Margem
                                                    </p>
                                                    <strong className="mt-2 block text-lg">
                                                        {numbers.margin !== null ? formatPercent(numbers.margin) : '—'}
                                                    </strong>
                                                </div>
                                            </div>

                                            <div className="mt-6 rounded-2xl border border-zinc-200">
                                                <div className="grid grid-cols-2 border-b border-zinc-200 px-5 py-3 text-sm">
                                                    <span className="text-zinc-500">Valor de compra</span>
                                                    <strong className="text-right">
                                                        {formatCurrency(numbers.purchase)}
                                                    </strong>
                                                </div>

                                                <div className="grid grid-cols-2 border-b border-zinc-200 px-5 py-3 text-sm">
                                                    <span className="text-zinc-500">Custos adicionais</span>
                                                    <strong className="text-right">
                                                        {formatCurrency(numbers.costs)}
                                                    </strong>
                                                </div>

                                                <div className="grid grid-cols-2 border-b border-zinc-200 bg-zinc-50 px-5 py-3 text-sm">
                                                    <span className="font-semibold text-zinc-700">
                                                        Investimento total
                                                    </span>
                                                    <strong className="text-right">
                                                        {formatCurrency(numbers.investment)}
                                                    </strong>
                                                </div>

                                                <div className="grid grid-cols-2 border-b border-zinc-200 px-5 py-3 text-sm">
                                                    <span className="text-zinc-500">
                                                        {numbers.vendido ? 'Valor vendido' : 'Valor anunciado'}
                                                    </span>
                                                    <strong className="text-right">
                                                        {formatCurrency(numbers.vendido ? numbers.sale : numbers.anunciado)}
                                                    </strong>
                                                </div>

                                                {numbers.profit !== null ? (
                                                    <div
                                                        className={`grid grid-cols-2 rounded-b-2xl px-5 py-4 text-sm ${numbers.profit >= 0 ? 'bg-emerald-50' : 'bg-red-50'
                                                            }`}
                                                    >
                                                        <span
                                                            className={`font-bold ${numbers.profit >= 0
                                                                ? 'text-emerald-700'
                                                                : 'text-red-700'
                                                                }`}
                                                        >
                                                            Resultado final
                                                        </span>

                                                        <strong
                                                            className={`text-right ${numbers.profit >= 0
                                                                ? 'text-emerald-700'
                                                                : 'text-red-700'
                                                                }`}
                                                        >
                                                            {formatCurrency(numbers.profit)}
                                                        </strong>
                                                    </div>
                                                ) : (
                                                    <div className="grid grid-cols-2 rounded-b-2xl bg-zinc-50 px-5 py-4 text-sm">
                                                        <span className="font-bold text-zinc-600">
                                                            Resultado previsto
                                                            <span className="block text-xs font-normal text-zinc-500">
                                                                pelo valor anunciado, ainda não vendido
                                                            </span>
                                                        </span>

                                                        <strong className="text-right text-zinc-600">
                                                            {numbers.previsto !== null ? formatCurrency(numbers.previsto) : '—'}
                                                        </strong>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )
                        })}

                        {filteredVehicles.length === 0 && (
                            <div className="rounded-3xl border border-zinc-200 bg-white p-10 text-center text-zinc-500 shadow-xl shadow-zinc-200/50">
                                Nenhum veículo encontrado.
                            </div>
                        )}
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

export default function DrePage() {
    return (
        <Suspense
            fallback={
                <div className="p-8 text-sm text-zinc-500">
                    Carregando DRE...
                </div>
            }
        >
            <DreContent />
        </Suspense>
    )
}