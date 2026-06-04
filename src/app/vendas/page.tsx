'use client'

import { useEffect, useState } from 'react'
import { PageContainer } from '../components/page-container'
import { CurrencyInput } from '../components/currency-input'
import { Toast } from '../components/ui/toast'
import { ConfirmDialog } from '../components/ui/confirm-dialog'
import { supabase } from '../lib/supabase'
import { Pencil, Trash2 } from 'lucide-react'

type Vehicle = {
    id: string
    plate: string
    brands?: { name: string }[] | null
    vehicle_models?: { name: string }[] | null
}

type Sale = {
    id: string
    vehicle_id: string
    sale_date: string
    sale_price: number
    payment_method: string | null
    notes: string | null
    vehicles?: Vehicle | null
}

const paymentMethods = [
    'À Vista',
    'Financiamento',
    'PIX',
    'Cartão',
    'Transferência',
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

function getVehicleLabel(vehicle?: Vehicle | null) {
    if (!vehicle) return '-'

    const brandName = vehicle.brands?.[0]?.name || ''
    const modelName = vehicle.vehicle_models?.[0]?.name || ''

    return `${vehicle.plate} - ${brandName} ${modelName}`.trim()
}

export default function VendasPage() {
    const [vehicles, setVehicles] = useState<Vehicle[]>([])
    const [sales, setSales] = useState<Sale[]>([])

    const [showForm, setShowForm] = useState(false)
    const [editingSaleId, setEditingSaleId] = useState<string | null>(null)

    const [vehicleId, setVehicleId] = useState('')
    const [saleDate, setSaleDate] = useState('')
    const [salePrice, setSalePrice] = useState('')
    const [paymentMethod, setPaymentMethod] = useState('')
    const [notes, setNotes] = useState('')

    const [loading, setLoading] = useState(false)
    const [deleteSaleId, setDeleteSaleId] = useState<string | null>(null)

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

    function resetForm() {
        setEditingSaleId(null)
        setVehicleId('')
        setSaleDate('')
        setSalePrice('')
        setPaymentMethod('')
        setNotes('')
    }

    async function loadVehicles() {
        const { data } = await supabase
            .from('vehicles')
            .select(`
        id,
        plate,
        brands(name),
        vehicle_models(name)
      `)
            .neq('status', 'VENDIDO')
            .order('plate')

        setVehicles((data || []) as Vehicle[])
    }

    async function loadSales() {
        const { data } = await supabase
            .from('vehicle_sales')
            .select(`
        *,
        vehicles(
          id,
          plate,
          brands(name),
          vehicle_models(name)
        )
      `)
            .order('created_at', { ascending: false })

        setSales((data || []) as Sale[])
    }

    useEffect(() => {
        async function loadInitialData() {
            await loadVehicles()
            await loadSales()
        }

        void loadInitialData()
    }, [])

    async function handleSaveSale() {
        if (!vehicleId) {
            showToast('error', 'Erro', 'Selecione um veículo.')
            return
        }

        if (!salePrice) {
            showToast('error', 'Erro', 'Informe o valor da venda.')
            return
        }

        setLoading(true)

        const saleData = {
            vehicle_id: vehicleId,
            sale_date: saleDate || new Date().toISOString().slice(0, 10),
            sale_price: parseCurrency(salePrice),
            payment_method: paymentMethod,
            notes,
        }

        let error

        if (editingSaleId) {
            const result = await supabase
                .from('vehicle_sales')
                .update(saleData)
                .eq('id', editingSaleId)

            error = result.error
        } else {
            const result = await supabase
                .from('vehicle_sales')
                .insert(saleData)

            error = result.error

            if (!error) {
                await supabase
                    .from('vehicles')
                    .update({
                        status: 'VENDIDO',
                    })
                    .eq('id', vehicleId)
            }
        }

        if (error) {
            showToast('error', 'Erro', error.message)
            setLoading(false)
            return
        }

        showToast('success', 'Sucesso', 'Venda salva com sucesso.')

        resetForm()
        setShowForm(false)
        setLoading(false)

        loadSales()
        loadVehicles()
    }

    async function handleDeleteSale() {
        if (!deleteSaleId) return

        const sale = sales.find((x) => x.id === deleteSaleId)

        const { error } = await supabase
            .from('vehicle_sales')
            .delete()
            .eq('id', deleteSaleId)

        if (!error && sale) {
            await supabase
                .from('vehicles')
                .update({
                    status: 'EM_ESTOQUE',
                })
                .eq('id', sale.vehicle_id)
        }

        showToast('success', 'Sucesso', 'Venda removida.')

        setDeleteSaleId(null)

        loadSales()
        loadVehicles()
    }

    return (
        <>
            <PageContainer
                title="Vendas"
                description="Controle de vendas da Matrix."
                action={
                    <button
                        onClick={() => {
                            setShowForm(!showForm)
                            resetForm()
                        }}
                        className="rounded-2xl bg-red-600 px-5 py-3 text-sm font-semibold text-white"
                    >
                        {showForm ? 'Fechar' : '+ Nova venda'}
                    </button>
                }
            >
                {showForm && (
                    <div className="mb-8 rounded-3xl border bg-white p-6 shadow">
                        <div className="grid gap-5 md:grid-cols-2">
                            <div>
                                <label>Veículo</label>

                                <select
                                    value={vehicleId}
                                    onChange={(e) => setVehicleId(e.target.value)}
                                    className="mt-2 w-full rounded-xl border px-4 py-3"
                                >
                                    <option value="">Selecione</option>

                                    {vehicles.map((vehicle) => (
                                        <option key={vehicle.id} value={vehicle.id}>
                                            {getVehicleLabel(vehicle)}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label>Data da venda</label>

                                <input
                                    type="date"
                                    value={saleDate}
                                    onChange={(e) => setSaleDate(e.target.value)}
                                    className="mt-2 w-full rounded-xl border px-4 py-3"
                                />
                            </div>

                            <div>
                                <label>Valor da venda</label>

                                <CurrencyInput
                                    value={salePrice}
                                    onChange={setSalePrice}
                                />
                            </div>

                            <div>
                                <label>Forma de pagamento</label>

                                <select
                                    value={paymentMethod}
                                    onChange={(e) => setPaymentMethod(e.target.value)}
                                    className="mt-2 w-full rounded-xl border px-4 py-3"
                                >
                                    <option value="">Selecione</option>

                                    {paymentMethods.map((item) => (
                                        <option key={item}>{item}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="md:col-span-2">
                                <label>Observações</label>

                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    className="mt-2 h-24 w-full rounded-xl border px-4 py-3"
                                />
                            </div>
                        </div>

                        <button
                            onClick={handleSaveSale}
                            disabled={loading}
                            className="mt-6 rounded-xl bg-zinc-950 px-6 py-3 text-white"
                        >
                            {loading ? 'Salvando...' : 'Salvar venda'}
                        </button>
                    </div>
                )}

                <div className="overflow-hidden rounded-3xl border bg-white shadow">
                    <table className="w-full text-sm">
                        <thead className="bg-zinc-950 text-white">
                            <tr>
                                <th className="px-5 py-4 text-left">Veículo</th>
                                <th className="px-5 py-4 text-left">Data</th>
                                <th className="px-5 py-4 text-left">Valor</th>
                                <th className="px-5 py-4 text-left">Pagamento</th>
                                <th className="px-5 py-4 text-right">Ações</th>
                            </tr>
                        </thead>

                        <tbody>
                            {sales.map((sale) => (
                                <tr key={sale.id} className="border-t">
                                    <td className="px-5 py-4">
                                        {getVehicleLabel(sale.vehicles)}
                                    </td>

                                    <td className="px-5 py-4">{sale.sale_date}</td>

                                    <td className="px-5 py-4">
                                        {formatCurrency(Number(sale.sale_price))}
                                    </td>

                                    <td className="px-5 py-4">
                                        {sale.payment_method}
                                    </td>

                                    <td className="px-5 py-4">
                                        <div className="flex justify-end gap-2">
                                            <button
                                                className="rounded-xl bg-zinc-100 p-2"
                                            >
                                                <Pencil size={18} />
                                            </button>

                                            <button
                                                onClick={() => setDeleteSaleId(sale.id)}
                                                className="rounded-xl bg-red-50 p-2 text-red-600"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </PageContainer>

            <ConfirmDialog
                open={!!deleteSaleId}
                title="Excluir venda"
                description="Deseja realmente excluir esta venda?"
                confirmText="Excluir"
                loading={false}
                onCancel={() => setDeleteSaleId(null)}
                onConfirm={handleDeleteSale}
            />

            <Toast
                open={toast.open}
                type={toast.type}
                title={toast.title}
                description={toast.description}
                onClose={() =>
                    setToast((current) => ({ ...current, open: false }))
                }
            />
        </>
    )
}