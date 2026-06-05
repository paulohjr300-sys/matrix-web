'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, Car, DollarSign, FileText, TrendingUp } from 'lucide-react'
import { PageContainer } from '../../components/page-container'
import { supabase } from '../../lib/supabase'
import { Toast } from '../../components/ui/toast'

type Vehicle = {
  id: string
  plate: string
  chassi: string | null
  renavam: string | null
  notes: string | null
  purchase_price: number
  advertised_price: number
  status: string
  manufacture_year: number | null
  model_year: number | null
  km: number | null
  brands?: { name: string } | null
  vehicle_models?: { name: string } | null
  colors?: { name: string } | null
  engines?: { name: string } | null
  transmissions?: { name: string } | null
  fuels?: { name: string } | null
  vehicle_costs?: { amount: number; description: string; category: string | null }[]
  vehicle_sales?: { sale_price: number; sale_date: string; payment_method: string | null }[]
}

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
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

export default function VeiculoDetalhesPage() {
  const params = useParams()
  const vehicleId = String(params.id)

  const [vehicle, setVehicle] = useState<Vehicle | null>(null)

  const [toast, setToast] = useState({
    open: false,
    type: 'success' as 'success' | 'error',
    title: '',
    description: '',
  })

  function showToast(type: 'success' | 'error', title: string, description?: string) {
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

  async function loadVehicle() {
    const { data, error } = await supabase
      .from('vehicles')
      .select(`
        id,
        plate,
        chassi,
        renavam,
        notes,
        purchase_price,
        advertised_price,
        status,
        manufacture_year,
        model_year,
        km,
        brands(name),
        vehicle_models(name),
        colors(name),
        engines(name),
        transmissions(name),
        fuels(name),
        vehicle_costs(amount, description, category),
        vehicle_sales(sale_price, sale_date, payment_method)
      `)
      .eq('id', vehicleId)
      .single()

    if (error) {
      showToast('error', 'Erro', error.message)
      return
    }

    setVehicle(data as Vehicle)
  }

  useEffect(() => {
    loadVehicle()
  }, [vehicleId])

  if (!vehicle) {
    return (
      <PageContainer title="Veículo" description="Carregando informações...">
        <div className="rounded-3xl bg-white p-10 text-center text-zinc-500">
          Carregando veículo...
        </div>
      </PageContainer>
    )
  }

  const totalCosts = (vehicle.vehicle_costs || []).reduce(
    (sum, cost) => sum + Number(cost.amount || 0),
    0
  )

  const saleTotal = (vehicle.vehicle_sales || []).reduce(
    (sum, sale) => sum + Number(sale.sale_price || 0),
    0
  )

  const investment = Number(vehicle.purchase_price || 0) + totalCosts
  const profit = saleTotal - investment
  const margin = saleTotal > 0 ? (profit / saleTotal) * 100 : 0

  return (
    <>
      <PageContainer
        title={vehicle.plate}
        description={`${vehicle.brands?.name || ''} ${vehicle.vehicle_models?.name || ''}`}
      >
        <Link
          href="/veiculos"
          className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-zinc-500 transition hover:text-red-600"
        >
          <ArrowLeft size={18} />
          Voltar para veículos
        </Link>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-4">
          <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl shadow-zinc-200/50">
            <Car className="text-blue-600" />
            <p className="mt-4 text-sm text-zinc-500">Status</p>
            <span
              className={`mt-2 inline-flex rounded-full border px-3 py-1 text-xs font-bold ${getStatusClass(
                vehicle.status
              )}`}
            >
              {getStatusLabel(vehicle.status)}
            </span>
          </div>

          <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl shadow-zinc-200/50">
            <DollarSign className="text-red-600" />
            <p className="mt-4 text-sm text-zinc-500">Investimento</p>
            <strong className="mt-2 block text-2xl">
              {formatCurrency(investment)}
            </strong>
          </div>

          <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl shadow-zinc-200/50">
            <TrendingUp className="text-emerald-600" />
            <p className="mt-4 text-sm text-zinc-500">Venda</p>
            <strong className="mt-2 block text-2xl">
              {formatCurrency(saleTotal)}
            </strong>
          </div>

          <div className="rounded-3xl border border-zinc-200 bg-zinc-950 p-6 text-white shadow-xl shadow-zinc-300/60">
            <FileText className={profit >= 0 ? 'text-emerald-300' : 'text-red-300'} />
            <p className="mt-4 text-sm text-zinc-400">Resultado</p>
            <strong
              className={`mt-2 block text-2xl ${
                profit >= 0 ? 'text-emerald-300' : 'text-red-300'
              }`}
            >
              {formatCurrency(profit)}
            </strong>
            <p className="mt-1 text-xs text-zinc-400">
              Margem: {margin.toFixed(2).replace('.', ',')}%
            </p>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl shadow-zinc-200/50 xl:col-span-2">
            <h2 className="text-xl font-bold">Dados do veículo</h2>

            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
              <Info label="Marca" value={vehicle.brands?.name} />
              <Info label="Modelo" value={vehicle.vehicle_models?.name} />
              <Info
                label="Ano"
                value={`${vehicle.manufacture_year || '-'} / ${vehicle.model_year || '-'}`}
              />
              <Info
                label="KM"
                value={vehicle.km ? `${vehicle.km.toLocaleString('pt-BR')} km` : '-'}
              />
              <Info label="Cor" value={vehicle.colors?.name} />
              <Info label="Motor" value={vehicle.engines?.name} />
              <Info label="Câmbio" value={vehicle.transmissions?.name} />
              <Info label="Combustível" value={vehicle.fuels?.name} />
              <Info label="Chassi" value={vehicle.chassi} />
              <Info label="Renavam" value={vehicle.renavam} />
            </div>

            <div className="mt-6 rounded-2xl bg-zinc-50 p-4">
              <p className="text-sm font-semibold text-zinc-500">Observações</p>
              <p className="mt-2 text-sm text-zinc-700">
                {vehicle.notes || 'Nenhuma observação cadastrada.'}
              </p>
            </div>
          </div>

          <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl shadow-zinc-200/50">
            <h2 className="text-xl font-bold">Valores</h2>

            <div className="mt-6 space-y-4">
              <InfoMoney label="Compra" value={Number(vehicle.purchase_price || 0)} />
              <InfoMoney label="Anunciado" value={Number(vehicle.advertised_price || 0)} />
              <InfoMoney label="Custos" value={totalCosts} />
              <InfoMoney label="Investimento" value={investment} />
              <InfoMoney label="Venda" value={saleTotal} />
              <InfoMoney
                label="Lucro"
                value={profit}
                highlight={profit >= 0 ? 'positive' : 'negative'}
              />
            </div>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl shadow-zinc-200/50">
            <h2 className="text-xl font-bold">Custos lançados</h2>

            <div className="mt-6 space-y-3">
              {(vehicle.vehicle_costs || []).map((cost, index) => (
                <div
                  key={index}
                  className="flex justify-between gap-4 rounded-2xl border border-zinc-200 p-4"
                >
                  <div>
                    <p className="font-semibold">{cost.description}</p>
                    <p className="text-sm text-zinc-500">{cost.category || '-'}</p>
                  </div>

                  <strong>{formatCurrency(Number(cost.amount || 0))}</strong>
                </div>
              ))}

              {(vehicle.vehicle_costs || []).length === 0 && (
                <p className="rounded-2xl bg-zinc-50 p-6 text-center text-sm text-zinc-500">
                  Nenhum custo lançado.
                </p>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl shadow-zinc-200/50">
            <h2 className="text-xl font-bold">Venda</h2>

            <div className="mt-6 space-y-3">
              {(vehicle.vehicle_sales || []).map((sale, index) => (
                <div key={index} className="rounded-2xl border border-zinc-200 p-4">
                  <div className="flex justify-between gap-4">
                    <p className="font-semibold">Venda realizada</p>
                    <strong>{formatCurrency(Number(sale.sale_price || 0))}</strong>
                  </div>

                  <p className="mt-2 text-sm text-zinc-500">
                    Data: {sale.sale_date || '-'} | Pagamento:{' '}
                    {sale.payment_method || '-'}
                  </p>
                </div>
              ))}

              {(vehicle.vehicle_sales || []).length === 0 && (
                <p className="rounded-2xl bg-zinc-50 p-6 text-center text-sm text-zinc-500">
                  Nenhuma venda registrada.
                </p>
              )}
            </div>
          </div>
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
  )
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-2xl bg-zinc-50 p-4">
      <p className="text-xs font-semibold text-zinc-500">{label}</p>
      <strong className="mt-1 block text-sm text-zinc-950">{value || '-'}</strong>
    </div>
  )
}

function InfoMoney({
  label,
  value,
  highlight,
}: {
  label: string
  value: number
  highlight?: 'positive' | 'negative'
}) {
  return (
    <div className="flex justify-between border-b border-zinc-200 pb-3">
      <span className="text-sm text-zinc-500">{label}</span>
      <strong
        className={
          highlight === 'positive'
            ? 'text-emerald-700'
            : highlight === 'negative'
              ? 'text-red-700'
              : 'text-zinc-950'
        }
      >
        {formatCurrency(value)}
      </strong>
    </div>
  )
}