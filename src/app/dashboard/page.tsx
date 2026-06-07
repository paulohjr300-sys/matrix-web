'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { PageContainer } from '../components/page-container'
import { KpiCard } from '../components/kpi-card'
import { supabase } from '../../lib/supabase'
import {
  AlertTriangle,
  Car,
  DollarSign,
  Lightbulb,
  TrendingDown,
  TrendingUp,
  Trophy,
} from 'lucide-react'
import { Toast } from '../components/ui/toast'

type VehicleDashboard = {
  id: string
  plate: string
  purchase_price: number
  advertised_price: number
  status: string
  is_published: boolean
  created_at: string
  brands?: { name: string } | null
  vehicle_models?: { name: string } | null
  vehicle_costs?: { amount: number }[]
  vehicle_sales?: { sale_price: number; sale_date: string }[]
}

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function getVehicleName(vehicle: VehicleDashboard) {
  const brandName = vehicle.brands?.name || ''
  const modelName = vehicle.vehicle_models?.name || ''

  return `${brandName} - ${modelName}`.trim() || '-'
}

function getNumbers(vehicle: VehicleDashboard) {
  const purchase = Number(vehicle.purchase_price || 0)

  const costs = (vehicle.vehicle_costs || []).reduce(
    (sum, cost) => sum + Number(cost.amount || 0),
    0
  )

  const investment = purchase + costs

  const sales = (vehicle.vehicle_sales || []).reduce(
    (sum, sale) => sum + Number(sale.sale_price || 0),
    0
  )

  const profit = sales - investment
  const estimatedProfit = Number(vehicle.advertised_price || 0) - investment
  const margin = sales > 0 ? (profit / sales) * 100 : 0
  const estimatedMargin =
    vehicle.advertised_price > 0
      ? (estimatedProfit / Number(vehicle.advertised_price)) * 100
      : 0

  return {
    purchase,
    costs,
    investment,
    sales,
    profit,
    estimatedProfit,
    margin,
    estimatedMargin,
  }
}

function getDaysInStock(createdAt: string) {
  const created = new Date(createdAt)
  const today = new Date()
  const diff = today.getTime() - created.getTime()

  return Math.floor(diff / (1000 * 60 * 60 * 24))
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

function getStatusClass(status: string) {
  switch (status) {
    case 'EM_ESTOQUE':
      return 'border-blue-200 bg-blue-50 text-blue-700'
    case 'RESERVADO':
      return 'border-amber-200 bg-amber-50 text-amber-700'
    case 'VENDIDO':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700'
    default:
      return 'border-zinc-200 bg-zinc-50 text-zinc-700'
  }
}

export default function DashboardPage() {
  const [vehicles, setVehicles] = useState<VehicleDashboard[]>([])

  const [toast, setToast] = useState(() => {
    if (typeof window === 'undefined') {
      return {
        open: false,
        type: 'error' as 'success' | 'error',
        title: '',
        description: '',
      }
    }

    const error = localStorage.getItem('matrix_permission_error')

    if (!error) {
      return {
        open: false,
        type: 'error' as 'success' | 'error',
        title: '',
        description: '',
      }
    }

    localStorage.removeItem('matrix_permission_error')

    return {
      open: true,
      type: 'error' as 'success' | 'error',
      title: 'Acesso negado',
      description: error,
    }
  })

  useEffect(() => {
    if (!toast.open) {
      return
    }

    const timer = window.setTimeout(() => {
      setToast((current) => ({
        ...current,
        open: false,
      }))
    }, 4000)

    return () => window.clearTimeout(timer)
  }, [toast.open])

  useEffect(() => {
    async function loadDashboard() {
      const { data } = await supabase
        .from('vehicles')
        .select(`
          id,
          plate,
          purchase_price,
          advertised_price,
          status,
          is_published,
          created_at,
          brands(name),
          vehicle_models(name),
          vehicle_costs(amount),
          vehicle_sales(sale_price, sale_date)
        `)
        .order('created_at', { ascending: false })
        .limit(5)
      setVehicles((data || []) as unknown as VehicleDashboard[])
    }

    loadDashboard()
  }, [])


  const totals = vehicles.reduce(
    (acc, vehicle) => {
      const numbers = getNumbers(vehicle)

      acc.stock += vehicle.status === 'EM_ESTOQUE' ? 1 : 0
      acc.sold += vehicle.status === 'VENDIDO' ? 1 : 0
      acc.investment += numbers.investment
      acc.sales += numbers.sales
      acc.profit += numbers.profit
      acc.costs += numbers.costs
      acc.published += vehicle.is_published ? 1 : 0

      return acc
    },
    {
      stock: 0,
      sold: 0,
      investment: 0,
      sales: 0,
      profit: 0,
      costs: 0,
      published: 0,
    }
  )

  const riskVehicles = vehicles.filter((vehicle) => {
    const numbers = getNumbers(vehicle)

    return (
      vehicle.status !== 'VENDIDO' &&
      vehicle.advertised_price > 0 &&
      numbers.estimatedProfit < 0
    )
  })

  const lowMarginVehicles = vehicles.filter((vehicle) => {
    const numbers = getNumbers(vehicle)

    return (
      vehicle.status !== 'VENDIDO' &&
      vehicle.advertised_price > 0 &&
      numbers.estimatedMargin > 0 &&
      numbers.estimatedMargin < 5
    )
  })

  const stoppedVehicles = vehicles.filter((vehicle) => {
    return vehicle.status === 'EM_ESTOQUE' && getDaysInStock(vehicle.created_at) >= 60
  })

  const soldVehicles = vehicles
    .filter((vehicle) => vehicle.status === 'VENDIDO')
    .map((vehicle) => ({
      ...vehicle,
      numbers: getNumbers(vehicle),
    }))
    .sort((a, b) => b.numbers.profit - a.numbers.profit)

  const topProfitVehicle = soldVehicles[0]

  const latestVehicles = vehicles.slice(0, 5)


  return (
    <PageContainer
      title="Dashboard"
      description="Visão geral da concessionária Matrix."
    >
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        <KpiCard
          title="Veículos em Estoque"
          value={String(totals.stock)}
          icon={<Car className="text-blue-600" />}
        />

        <KpiCard
          title="Publicados no Site"
          value={String(totals.published)}
          icon={<Car className="text-emerald-600" />}
        />

        <KpiCard
          title="Veículos Vendidos"
          value={String(totals.sold)}
          icon={<Trophy className="text-emerald-600" />}
        />

        <KpiCard
          title="Receita Total"
          value={formatCurrency(totals.sales)}
          icon={<TrendingUp className="text-emerald-600" />}
        />

        <KpiCard
          title="Lucro Total"
          value={formatCurrency(totals.profit)}
          icon={<DollarSign className="text-red-600" />}
        />
      </div>

      <div className="mt-8 rounded-3xl border border-zinc-200 bg-zinc-950 p-6 text-white shadow-xl shadow-zinc-300/60">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-red-600 p-3">
            <Lightbulb size={22} />
          </div>

          <div>
            <h2 className="text-xl font-bold">Insights da Matrix</h2>
            <p className="text-sm text-zinc-400">
              Alertas automáticos para ajudar na tomada de decisão.
            </p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-4">
          <div className="rounded-2xl bg-white/10 p-5">
            <div className="flex items-center gap-3">
              <AlertTriangle className="text-red-400" />
              <strong>Risco de prejuízo</strong>
            </div>

            <p className="mt-3 text-3xl font-bold">{riskVehicles.length}</p>

            <p className="mt-1 text-sm text-zinc-400">
              Anúncio abaixo do investimento total.
            </p>
          </div>

          <div className="rounded-2xl bg-white/10 p-5">
            <div className="flex items-center gap-3">
              <TrendingDown className="text-amber-400" />
              <strong>Margem baixa</strong>
            </div>

            <p className="mt-3 text-3xl font-bold">{lowMarginVehicles.length}</p>

            <p className="mt-1 text-sm text-zinc-400">
              Margem estimada abaixo de 5%.
            </p>
          </div>

          <div className="rounded-2xl bg-white/10 p-5">
            <div className="flex items-center gap-3">
              <Car className="text-blue-400" />
              <strong>Parados há 60+ dias</strong>
            </div>

            <p className="mt-3 text-3xl font-bold">{stoppedVehicles.length}</p>

            <p className="mt-1 text-sm text-zinc-400">
              Veículos em estoque por muito tempo.
            </p>
          </div>

          <div className="rounded-2xl bg-white/10 p-5">
            <div className="flex items-center gap-3">
              <Trophy className="text-emerald-400" />
              <strong>Mais lucrativo</strong>
            </div>

            <p className="mt-3 text-lg font-bold">
              {topProfitVehicle ? getVehicleName(topProfitVehicle) : '-'}
            </p>

            <p className="mt-1 text-sm text-emerald-300">
              {topProfitVehicle
                ? formatCurrency(topProfitVehicle.numbers.profit)
                : 'Sem vendas ainda'}
            </p>
          </div>
        </div>

        {(riskVehicles.length > 0 || lowMarginVehicles.length > 0) && (
          <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-5">
            <h3 className="font-bold text-red-200">
              Atenção: veículos que precisam de revisão
            </h3>

            <div className="mt-4 space-y-3">
              {[...riskVehicles, ...lowMarginVehicles].slice(0, 4).map((vehicle) => {
                const numbers = getNumbers(vehicle)

                return (
                  <div
                    key={vehicle.id}
                    className="flex flex-col justify-between gap-2 rounded-xl bg-white/10 p-4 md:flex-row md:items-center"
                  >
                    <div>
                      <strong>{getVehicleName(vehicle)}</strong>
                      <p className="text-sm text-zinc-400">
                        Investimento: {formatCurrency(numbers.investment)} | Anúncio:{' '}
                        {formatCurrency(Number(vehicle.advertised_price || 0))}
                      </p>
                    </div>

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold ${numbers.estimatedProfit < 0
                        ? 'bg-red-400/20 text-red-200'
                        : 'bg-amber-400/20 text-amber-200'
                        }`}
                    >
                      {numbers.estimatedProfit < 0
                        ? `Prejuízo estimado ${formatCurrency(numbers.estimatedProfit)}`
                        : `Margem baixa ${numbers.estimatedMargin.toFixed(2).replace('.', ',')}%`}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl shadow-zinc-200/50 xl:col-span-2">
          <h2 className="text-xl font-bold">Top veículos mais lucrativos</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Ranking baseado nas vendas e custos cadastrados.
          </p>

          <div className="mt-6 space-y-4">
            {soldVehicles.slice(0, 5).map((vehicle, index) => (
              <div
                key={vehicle.id}
                className="flex items-center justify-between rounded-2xl border border-zinc-200 p-4"
              >
                <div>
                  <span className="text-sm font-bold text-red-600">
                    #{index + 1}
                  </span>

                  <h3 className="font-bold">{getVehicleName(vehicle)}</h3>

                  <p className="text-sm text-zinc-500">
                    Receita: {formatCurrency(vehicle.numbers.sales)}
                  </p>
                </div>

                <strong className="text-emerald-700">
                  {formatCurrency(vehicle.numbers.profit)}
                </strong>
              </div>
            ))}

            {soldVehicles.length === 0 && (
              <p className="rounded-2xl bg-zinc-50 p-6 text-center text-sm text-zinc-500">
                Nenhuma venda cadastrada ainda.
              </p>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl shadow-zinc-200/50">
          <h2 className="text-xl font-bold">Resumo Financeiro</h2>
          <p className="mt-1 text-sm text-zinc-500">Indicadores acumulados.</p>

          <div className="mt-6 space-y-5">
            <div>
              <p className="text-sm text-zinc-500">Investimento total</p>
              <strong className="text-2xl">
                {formatCurrency(totals.investment)}
              </strong>
            </div>

            <div>
              <p className="text-sm text-zinc-500">Custos lançados</p>
              <strong className="text-2xl">{formatCurrency(totals.costs)}</strong>
            </div>

            <div>
              <p className="text-sm text-zinc-500">Total vendido</p>
              <strong className="text-2xl">{formatCurrency(totals.sales)}</strong>
            </div>

            <div
              className={`rounded-2xl p-4 ${totals.profit >= 0 ? 'bg-emerald-50' : 'bg-red-50'
                }`}
            >
              <p
                className={`text-sm ${totals.profit >= 0 ? 'text-emerald-700' : 'text-red-700'
                  }`}
              >
                Resultado
              </p>

              <strong
                className={`text-3xl ${totals.profit >= 0 ? 'text-emerald-700' : 'text-red-700'
                  }`}
              >
                {formatCurrency(totals.profit)}
              </strong>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-xl shadow-zinc-200/50">
        <div className="border-b border-zinc-200 p-6">
          <h2 className="text-xl font-bold">Últimos 5 veículos cadastrados</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Acompanhe os veículos adicionados recentemente.
          </p>
        </div>

        <table className="w-full text-sm">
          <thead className="bg-zinc-950 text-white">
            <tr>
              <th className="px-5 py-4 text-left">Placa</th>
              <th className="px-5 py-4 text-left">Veículo</th>
              <th className="px-5 py-4 text-left">Compra</th>
              <th className="px-5 py-4 text-left">Anunciado</th>
              <th className="px-5 py-4 text-left">Site</th>
              <th className="px-5 py-4 text-left">Status</th>
              <th className="px-5 py-4 text-right">Ação</th>
            </tr>
          </thead>

          <tbody>
            {latestVehicles.map((vehicle) => (
              <tr
                key={vehicle.id}
                className="border-t transition-colors duration-200 hover:bg-zinc-50"
              >
                <td className="px-5 py-4 font-semibold">{vehicle.plate}</td>

                <td className="px-5 py-4">{getVehicleName(vehicle)}</td>

                <td className="px-5 py-4">
                  {formatCurrency(Number(vehicle.purchase_price || 0))}
                </td>

                <td className="px-5 py-4">
                  {formatCurrency(Number(vehicle.advertised_price || 0))}
                </td>

                <td className="px-5 py-4">
                  <span
                    className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${vehicle.is_published
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-zinc-200 bg-zinc-50 text-zinc-600'
                      }`}
                  >
                    {vehicle.is_published ? 'Publicado' : 'Não publicado'}
                  </span>
                </td>

                <td className="px-5 py-4">
                  <span
                    className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getStatusClass(
                      vehicle.status
                    )}`}
                  >
                    {getStatusLabel(vehicle.status)}
                  </span>
                </td>

                <td className="px-5 py-4 text-right">
                  <Link
                    href={`/dre?vehicleId=${vehicle.id}`}
                    className="text-sm font-semibold text-red-600 hover:text-red-700"
                  >
                    Ver DRE
                  </Link>
                </td>
              </tr>
            ))}

            {latestVehicles.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-5 py-10 text-center text-zinc-500"
                >
                  Nenhum veículo cadastrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Toast
        open={toast.open}
        type={toast.type}
        title={toast.title}
        description={toast.description}
        onClose={() =>
          setToast((current) => ({
            ...current,
            open: false,
          }))
        }
      />
    </PageContainer>

  )
}