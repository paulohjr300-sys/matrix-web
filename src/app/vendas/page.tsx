'use client'

import { useEffect, useState } from 'react'
import { PageContainer } from '../components/page-container'
import { CurrencyInput } from '../components/currency-input'
import { Toast } from '../components/ui/toast'
import { ConfirmDialog } from '../components/ui/confirm-dialog'
import { supabase } from '../../lib/supabase'
import { sincronizarAnuncios } from '../../lib/portal-sync'
import { Check, Copy, ExternalLink, Pencil, Trash2 } from 'lucide-react'

type Vehicle = {
    id: string
    plate: string
    advertised_price?: number | null
    purchase_price?: number | null
    brands?: { name: string } | null
    vehicle_models?: { name: string } | null
}

type PostPendente = {
    id: string
    rede: 'instagram' | 'facebook'
    url: string | null
    vehicle_id: string | null
}

const MARCA_VENDIDO = '✅ VENDIDO'

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

    return `${vehicle.plate} - ${vehicle.brands?.name || ''} ${vehicle.vehicle_models?.name || ''}`
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
    const [custos, setCustos] = useState<number | null>(null)
    const [postsPendentes, setPostsPendentes] = useState<PostPendente[]>([])
    const [copiado, setCopiado] = useState(false)

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
        setCustos(null)
    }

    // Custos lançados no veículo (para o lucro estimado da venda).
    async function loadCustos(id: string) {
        setCustos(null)
        if (!id) return

        const { data } = await supabase.from('vehicle_costs').select('amount').eq('vehicle_id', id)
        setCustos((data || []).reduce((total, item) => total + Number(item.amount || 0), 0))
    }

    // Escolheu o veículo: o valor da venda já vem com o valor anunciado.
    function selecionarVeiculo(id: string) {
        setVehicleId(id)
        void loadCustos(id)

        const vehicle = vehicles.find((item) => item.id === id)
        if (!editingSaleId && vehicle?.advertised_price) {
            setSalePrice(formatCurrency(Number(vehicle.advertised_price)))
        }
    }

    // Posts do Instagram de carros vendidos: a Meta não deixa o painel editar,
    // a loja edita pelo app.
    async function loadPostsPendentes() {
        const response = await fetch('/api/integracoes/meta/posts?pendentes=1', { cache: 'no-store' }).catch(() => null)
        const result = await response?.json().catch(() => null)
        setPostsPendentes(result?.posts || [])
    }

    async function marcarPostEditado(id: string) {
        const response = await fetch('/api/integracoes/meta/posts', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id }),
        })

        if (!response.ok) {
            showToast('error', 'Erro', 'Não foi possível atualizar o post.')
            return
        }

        await loadPostsPendentes()
    }

    async function copiarVendido() {
        try {
            await navigator.clipboard.writeText(MARCA_VENDIDO)
            setCopiado(true)
            setTimeout(() => setCopiado(false), 2000)
        } catch {
            // Sem acesso à área de transferência: o texto está na tela.
        }
    }

    async function loadVehicles() {
        const { data } = await supabase
            .from('vehicles')
            .select(`
        id,
        plate,
        advertised_price,
        purchase_price,
        brands(name),
        vehicle_models(name)
      `)
            .neq('status', 'VENDIDO')
            .order('plate')

        setVehicles((data || []) as unknown as Vehicle[])
    }

    async function loadSales() {
        const { data } = await supabase
            .from('vehicle_sales')
            .select(`
        *,
        vehicles(
          id,
          plate,
          advertised_price,
          purchase_price,
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
            await loadPostsPendentes()
        }

        void loadInitialData()
    }, [])

    function handleEditSale(sale: Sale) {
        setEditingSaleId(sale.id)
        setVehicleId(sale.vehicle_id)
        setSaleDate(sale.sale_date || '')
        setSalePrice(formatCurrency(Number(sale.sale_price)))
        setPaymentMethod(sale.payment_method || '')
        setNotes(sale.notes || '')
        void loadCustos(sale.vehicle_id)
        setShowForm(true)
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    // Na edição, o veículo da venda (já vendido) também entra na lista.
    const editingSale = editingSaleId ? sales.find((sale) => sale.id === editingSaleId) : null
    const vehicleOptions =
        editingSale?.vehicles && !vehicles.some((vehicle) => vehicle.id === editingSale.vehicle_id)
            ? [editingSale.vehicles, ...vehicles]
            : vehicles

    async function marcarVendido(id: string) {
        await supabase
            .from('vehicles')
            .update({
                status: 'VENDIDO',
                is_published: false,
            })
            .eq('id', id)

        // Vendido: encerra os anúncios nos portais e marca "VENDIDO" nos posts.
        void sincronizarAnuncios(id).then((erros) => {
            const avisos = erros.filter((erro) => !erro.includes('Instagram'))
            if (avisos.length) showToast('error', 'Anúncios nos portais', avisos.join(' '))
            void loadPostsPendentes()
        })
    }

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
            advertised_price: vehicleOptions.find((vehicle) => vehicle.id === vehicleId)?.advertised_price ?? null,
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

            // Trocou o veículo da venda: o anterior volta para o estoque.
            if (!error && editingSale && editingSale.vehicle_id !== vehicleId) {
                await supabase
                    .from('vehicles')
                    .update({ status: 'EM_ESTOQUE' })
                    .eq('id', editingSale.vehicle_id)

                await marcarVendido(vehicleId)
            }
        } else {
            const result = await supabase
                .from('vehicle_sales')
                .insert(saleData)

            error = result.error

            if (!error) await marcarVendido(vehicleId)
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

    const selectedVehicle = vehicleOptions.find((vehicle) => vehicle.id === vehicleId) || null
    const lucroEstimado =
        selectedVehicle?.purchase_price && salePrice
            ? parseCurrency(salePrice) - Number(selectedVehicle.purchase_price) - (custos || 0)
            : null

    const veiculoDoPost = (id: string | null) =>
        getVehicleLabel(
            sales.find((sale) => sale.vehicle_id === id)?.vehicles ||
            vehicles.find((vehicle) => vehicle.id === id) ||
            null
        )

    return (
        <>
            <PageContainer
                title="Vendas"
                description="Controle de vendas da loja."
                action={
                    <button
                        onClick={() => {
                            setShowForm(!showForm)
                            resetForm()
                        }}
                        className="rounded-2xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white"
                    >
                        {showForm ? 'Fechar' : '+ Nova venda'}
                    </button>
                }
            >
                {postsPendentes.length > 0 && (
                    <div className="mb-8 rounded-3xl bg-amber-50 p-5 ring-1 ring-amber-200">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <h2 className="font-bold text-amber-900">Posts do Instagram para marcar VENDIDO</h2>
                                <p className="text-sm text-amber-800">
                                    O Instagram não deixa o painel editar o post. Abra pelo app, toque em ⋯ → Editar e
                                    coloque &quot;{MARCA_VENDIDO}&quot; no começo da legenda.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => void copiarVendido()}
                                className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-amber-900 ring-1 ring-amber-300 hover:bg-amber-100"
                            >
                                {copiado ? <Check size={16} /> : <Copy size={16} />}
                                {copiado ? 'Copiado' : `Copiar "${MARCA_VENDIDO}"`}
                            </button>
                        </div>

                        <div className="mt-4 space-y-2">
                            {postsPendentes.map((post) => (
                                <div
                                    key={post.id}
                                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white px-4 py-3 text-sm"
                                >
                                    <span className="font-semibold text-zinc-800">{veiculoDoPost(post.vehicle_id)}</span>
                                    <span className="flex items-center gap-4">
                                        {post.url && (
                                            <a
                                                href={post.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1 font-semibold text-brand-600 hover:underline"
                                            >
                                                Abrir post <ExternalLink size={14} />
                                            </a>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => void marcarPostEditado(post.id)}
                                            className="font-semibold text-zinc-700 hover:underline"
                                        >
                                            Já editei
                                        </button>
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {showForm && (
                    <div className="mb-8 rounded-3xl border bg-white p-6 shadow">
                        <div className="grid gap-5 md:grid-cols-2">
                            <div>
                                <label>Veículo</label>

                                <select
                                    value={vehicleId}
                                    onChange={(e) => selecionarVeiculo(e.target.value)}
                                    className="mt-2 w-full rounded-xl border px-4 py-3"
                                >
                                    <option value="">Selecione</option>

                                    {vehicleOptions.map((vehicle) => (
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

                            {selectedVehicle && (
                                <div className="grid grid-cols-2 gap-3 rounded-2xl bg-zinc-50 p-4 text-sm ring-1 ring-zinc-200 md:col-span-2 md:grid-cols-4">
                                    <div>
                                        <p className="text-xs text-zinc-500">Valor anunciado</p>
                                        <p className="font-bold text-zinc-900">
                                            {selectedVehicle.advertised_price ? formatCurrency(Number(selectedVehicle.advertised_price)) : '-'}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-zinc-500">Valor de compra</p>
                                        <p className="font-bold text-zinc-900">
                                            {selectedVehicle.purchase_price ? formatCurrency(Number(selectedVehicle.purchase_price)) : '-'}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-zinc-500">Custos lançados</p>
                                        <p className="font-bold text-zinc-900">{custos === null ? '...' : formatCurrency(custos)}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-zinc-500">Lucro estimado</p>
                                        <p className={`font-bold ${lucroEstimado !== null && lucroEstimado < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                                            {lucroEstimado === null ? '-' : formatCurrency(lucroEstimado)}
                                        </p>
                                    </div>
                                </div>
                            )}

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
                            {loading ? 'Salvando...' : editingSaleId ? 'Salvar alterações' : 'Salvar venda'}
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
                                                onClick={() => handleEditSale(sale)}
                                                title="Editar venda"
                                                className="rounded-xl bg-zinc-100 p-2 transition hover:bg-zinc-200"
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