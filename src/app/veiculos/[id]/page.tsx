'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
    ArrowLeft,
    Car,
    DollarSign,
    ExternalLink,
    FileText,
    ImageIcon,
    TrendingUp,
} from 'lucide-react'
import { PageContainer } from '../../components/page-container'
import { supabase } from '../../lib/supabase'
import { Toast } from '../../components/ui/toast'



type VehicleFile = {
    id: string
    vehicle_id: string
    file_name: string
    file_path: string
    file_type: 'IMAGE' | 'PDF'
    file_size: number | null
    mime_type: string | null
}
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
    vehicle_files?: VehicleFile[]
}

function formatCurrency(value: number) {
    return value.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
    })
}

function formatFileSize(size?: number | null) {
    if (!size) return '-'

    if (size < 1024 * 1024) {
        return `${(size / 1024).toFixed(1).replace('.', ',')} KB`
    }

    return `${(size / 1024 / 1024).toFixed(1).replace('.', ',')} MB`
}

function getPublicFileUrl(file: VehicleFile) {
    const bucket = file.file_type === 'IMAGE' ? 'vehicle-images' : 'vehicle-documents'

    const { data } = supabase.storage.from(bucket).getPublicUrl(file.file_path)

    return data.publicUrl
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
    const [loading, setLoading] = useState(true)

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

    useEffect(() => {
        let mounted = true

        async function fetchVehicle() {
            setLoading(true)

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
        vehicle_sales(sale_price, sale_date, payment_method),
        vehicle_files(
  id,
  vehicle_id,
  file_name,
  file_path,
  file_type,
  file_size,
  mime_type
)
      `)
                .eq('id', vehicleId)
                .single()

            if (!mounted) {
                return
            }

            if (error) {
                showToast('error', 'Erro ao carregar veículo', error.message)
                setLoading(false)
                return
            }

            setVehicle(data as unknown as Vehicle)
            setLoading(false)
        }

        void fetchVehicle()

        return () => {
            mounted = false
        }
    }, [vehicleId])

    if (loading) {
        return (
            <PageContainer title="Veículo" description="Carregando informações...">
                <div className="rounded-3xl bg-white p-10 text-center text-zinc-500">
                    Carregando veículo...
                </div>
            </PageContainer>
        )
    }

    if (!vehicle) {
        return (
            <PageContainer title="Veículo" description="Não encontrado">
                <Link
                    href="/veiculos"
                    className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-zinc-500 transition hover:text-red-600"
                >
                    <ArrowLeft size={18} />
                    Voltar para veículos
                </Link>

                <div className="rounded-3xl bg-white p-10 text-center text-zinc-500">
                    Veículo não encontrado.
                </div>
            </PageContainer>
        )
    }

    const images = (vehicle.vehicle_files || []).filter(
        (file) => file.file_type === 'IMAGE'
    )

    const documents = (vehicle.vehicle_files || []).filter(
        (file) => file.file_type === 'PDF'
    )
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
                            className={`mt-2 block text-2xl ${profit >= 0 ? 'text-emerald-300' : 'text-red-300'
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
                        <h2 className="text-xl font-bold">Fotos do veículo</h2>
                        <p className="mt-1 text-sm text-zinc-500">
                            Fotos cadastradas no veículo.
                        </p>

                        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                            {images.map((file) => (
                                <a
                                    key={file.id}
                                    href={getPublicFileUrl(file)}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50 transition hover:-translate-y-0.5 hover:shadow-lg"
                                >
                                    <img
                                        src={getPublicFileUrl(file)}
                                        alt={file.file_name}
                                        className="h-48 w-full object-cover"
                                    />

                                    <div className="p-4">
                                        <p className="truncate text-sm font-semibold text-zinc-950">
                                            {file.file_name}
                                        </p>
                                        <p className="text-xs text-zinc-500">
                                            {formatFileSize(file.file_size)}
                                        </p>
                                    </div>
                                </a>
                            ))}

                            {images.length === 0 && (
                                <div className="rounded-2xl bg-zinc-50 p-8 text-center text-sm text-zinc-500 md:col-span-2">
                                    <ImageIcon className="mx-auto mb-3 text-zinc-400" />
                                    Nenhuma foto cadastrada.
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl shadow-zinc-200/50">
                        <h2 className="text-xl font-bold">Documentos PDF</h2>
                        <p className="mt-1 text-sm text-zinc-500">
                            Documentos cadastrados no veículo.
                        </p>

                        <div className="mt-6 space-y-3">
                            {documents.map((file) => (
                                <a
                                    key={file.id}
                                    href={getPublicFileUrl(file)}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center justify-between gap-4 rounded-2xl border border-zinc-200 p-4 transition hover:bg-zinc-50"
                                >
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-semibold text-zinc-950">
                                            {file.file_name}
                                        </p>
                                        <p className="text-xs text-zinc-500">
                                            {formatFileSize(file.file_size)}
                                        </p>
                                    </div>

                                    <ExternalLink size={18} className="shrink-0 text-zinc-500" />
                                </a>
                            ))}

                            {documents.length === 0 && (
                                <div className="rounded-2xl bg-zinc-50 p-8 text-center text-sm text-zinc-500">
                                    <FileText className="mx-auto mb-3 text-zinc-400" />
                                    Nenhum documento cadastrado.
                                </div>
                            )}
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