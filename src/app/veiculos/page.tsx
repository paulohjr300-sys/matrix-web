'use client'

import { useEffect, useState } from 'react'
import { PageContainer } from '../components/page-container'
import { CurrencyInput } from '../components/currency-input'
import { Toast } from '../components/ui/toast'
import { ConfirmDialog } from '../components/ui/confirm-dialog'
import { supabase } from '../lib/supabase'
import { Eye, Pencil, Trash2 } from 'lucide-react'

type Brand = {
    id: string
    name: string
}

type VehicleModel = {
    id: string
    name: string
    brand_id: string
}

type SimpleOption = {
    id: string
    name: string
}

type Vehicle = {
    id: string
    plate: string
    brand_id: string | null
    model_id: string | null
    engine_id: string | null
    transmission_id: string | null
    fuel_id: string | null
    color_id: string | null
    manufacture_year: number | null
    model_year: number | null
    km: number | null
    purchase_price: number
    advertised_price: number
    status: string
    brands?: { name: string }[] | null
    vehicle_models?: { name: string }[] | null
    engines?: { name: string }[] | null
    transmissions?: { name: string }[] | null
    fuels?: { name: string }[] | null
    colors?: { name: string }[] | null

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

function parseCurrency(value: string) {
    const onlyNumbers = value.replace(/\D/g, '')
    return Number(onlyNumbers) / 100
}

function getStatusLabel(status: string) {
    return statusOptions.find((item) => item.value === status)?.label || status
}

function getStatusClass(status: string) {
    switch (status) {
        case 'EM_ESTOQUE':
            return 'bg-blue-50 text-blue-700 ring-1 ring-blue-200'

        case 'RESERVADO':
            return 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'

        case 'VENDIDO':
            return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
    }
}

export default function VeiculosPage() {
    const [vehicles, setVehicles] = useState<Vehicle[]>([])
    const [brands, setBrands] = useState<Brand[]>([])
    const [models, setModels] = useState<VehicleModel[]>([])

    const [engines, setEngines] = useState<SimpleOption[]>([])
    const [transmissions, setTransmissions] = useState<SimpleOption[]>([])
    const [fuels, setFuels] = useState<SimpleOption[]>([])
    const [colors, setColors] = useState<SimpleOption[]>([])

    const [showForm, setShowForm] = useState(false)
    const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null)

    const [plate, setPlate] = useState('')
    const [brandId, setBrandId] = useState('')
    const [modelId, setModelId] = useState('')
    const [engineId, setEngineId] = useState('')
    const [transmissionId, setTransmissionId] = useState('')
    const [fuelId, setFuelId] = useState('')
    const [colorId, setColorId] = useState('')
    const [manufactureYear, setManufactureYear] = useState('')
    const [modelYear, setModelYear] = useState('')
    const [km, setKm] = useState('')
    const [purchasePrice, setPurchasePrice] = useState('')
    const [advertisedPrice, setAdvertisedPrice] = useState('')
    const [status, setStatus] = useState('EM_ESTOQUE')

    const [loading, setLoading] = useState(false)
    const [deleteVehicleId, setDeleteVehicleId] = useState<string | null>(null)
    const [deleteLoading, setDeleteLoading] = useState(false)

    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('')

    const [toast, setToast] = useState({
        open: false,
        type: 'success' as 'success' | 'error',
        title: '',
        description: '',
    })

    const filteredModels = models.filter((model) => model.brand_id === brandId)

    const filteredVehicles = vehicles.filter((vehicle) => {
        const brandName = vehicle.brands?.[0]?.name || ''
        const modelName = vehicle.vehicle_models?.[0]?.name || ''
        const colorName = vehicle.colors?.[0]?.name || ''

        const matchesSearch =
            vehicle.plate.toLowerCase().includes(search.toLowerCase()) ||
            brandName.toLowerCase().includes(search.toLowerCase()) ||
            modelName.toLowerCase().includes(search.toLowerCase()) ||
            colorName.toLowerCase().includes(search.toLowerCase())

        const matchesStatus = statusFilter ? vehicle.status === statusFilter : true

        return matchesSearch && matchesStatus
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
        setEditingVehicleId(null)
        setPlate('')
        setBrandId('')
        setModelId('')
        setEngineId('')
        setTransmissionId('')
        setFuelId('')
        setColorId('')
        setManufactureYear('')
        setModelYear('')
        setKm('')
        setPurchasePrice('')
        setAdvertisedPrice('')
        setStatus('EM_ESTOQUE')
    }

    async function loadBrands() {
        const { data, error } = await supabase
            .from('brands')
            .select('id, name')
            .order('name')

        if (error) {
            showToast('error', 'Erro', 'Não foi possível carregar as marcas.')
            return
        }

        setBrands(data || [])
    }

    async function loadModels() {
        const { data, error } = await supabase
            .from('vehicle_models')
            .select('id, name, brand_id')
            .order('name')

        if (error) {
            showToast('error', 'Erro', 'Não foi possível carregar os modelos.')
            return
        }

        setModels(data || [])
    }

    async function loadOptions() {
        const [enginesRes, transmissionsRes, fuelsRes, colorsRes] =
            await Promise.all([
                supabase.from('engines').select('id, name').order('name'),
                supabase.from('transmissions').select('id, name').order('name'),
                supabase.from('fuels').select('id, name').order('name'),
                supabase.from('colors').select('id, name').order('name'),
            ])

        if (enginesRes.error) {
            showToast('error', 'Erro', 'Não foi possível carregar os motores.')
        }

        if (transmissionsRes.error) {
            showToast('error', 'Erro', 'Não foi possível carregar os câmbios.')
        }

        if (fuelsRes.error) {
            showToast('error', 'Erro', 'Não foi possível carregar os combustíveis.')
        }

        if (colorsRes.error) {
            showToast('error', 'Erro', 'Não foi possível carregar as cores.')
        }

        setEngines(enginesRes.data || [])
        setTransmissions(transmissionsRes.data || [])
        setFuels(fuelsRes.data || [])
        setColors(colorsRes.data || [])
    }

    async function loadVehicles() {
        const { data, error } = await supabase
            .from('vehicles')
            .select(`
        id,
        plate,
        brand_id,
        model_id,
        engine_id,
        transmission_id,
        fuel_id,
        color_id,
        manufacture_year,
        model_year,
        km,
        purchase_price,
        advertised_price,
        status,
        brands(name),
        vehicle_models(name),
        engines(name),
        transmissions(name),
        fuels(name),
        colors(name)
      `)
            .order('created_at', { ascending: false })

        if (error) {
            showToast('error', 'Erro', error.message)
            return
        }

        setVehicles((data || []) as Vehicle[])
    }

    useEffect(() => {
        async function loadInitialData() {
            await Promise.all([
                loadBrands(),
                loadModels(),
                loadOptions(),
                loadVehicles(),
            ])
        }

        void loadInitialData()
    }, [])

    function handleBrandChange(value: string) {
        setBrandId(value)
        setModelId('')
    }

    async function handleSaveVehicle() {
        if (!plate.trim()) {
            showToast('error', 'Campo obrigatório', 'Informe a placa do veículo.')
            return
        }

        if (!brandId) {
            showToast('error', 'Campo obrigatório', 'Selecione a marca do veículo.')
            return
        }

        if (!modelId) {
            showToast('error', 'Campo obrigatório', 'Selecione o modelo do veículo.')
            return
        }

        if (!colorId) {
            showToast('error', 'Campo obrigatório', 'Selecione a cor do veículo.')
            return
        }

        setLoading(true)

        const vehicleData = {
            plate: plate.trim().toUpperCase(),
            brand_id: brandId,
            model_id: modelId,
            engine_id: engineId || null,
            transmission_id: transmissionId || null,
            fuel_id: fuelId || null,
            color_id: colorId,
            manufacture_year: manufactureYear ? Number(manufactureYear) : null,
            model_year: modelYear ? Number(modelYear) : null,
            km: km ? Number(km) : null,
            purchase_price: purchasePrice ? parseCurrency(purchasePrice) : 0,
            advertised_price: advertisedPrice ? parseCurrency(advertisedPrice) : 0,
            status,
        }

        if (editingVehicleId) {
            const { error } = await supabase
                .from('vehicles')
                .update(vehicleData)
                .eq('id', editingVehicleId)

            if (error) {
                showToast('error', 'Erro ao editar veículo', error.message)
                setLoading(false)
                return
            }

            showToast('success', 'Veículo atualizado', 'O veículo foi atualizado com sucesso.')
        } else {
            const { error } = await supabase.from('vehicles').insert(vehicleData)

            if (error) {
                showToast('error', 'Erro ao cadastrar veículo', error.message)
                setLoading(false)
                return
            }

            showToast('success', 'Veículo cadastrado', 'O veículo foi cadastrado com sucesso.')
        }

        resetForm()
        setShowForm(false)
        setLoading(false)
        await loadVehicles()
    }

    function handleEditVehicle(vehicle: Vehicle) {
        setEditingVehicleId(vehicle.id)
        setPlate(vehicle.plate)
        setBrandId(vehicle.brand_id || '')
        setModelId(vehicle.model_id || '')
        setEngineId(vehicle.engine_id || '')
        setTransmissionId(vehicle.transmission_id || '')
        setFuelId(vehicle.fuel_id || '')
        setColorId(vehicle.color_id || '')
        setManufactureYear(vehicle.manufacture_year ? String(vehicle.manufacture_year) : '')
        setModelYear(vehicle.model_year ? String(vehicle.model_year) : '')
        setKm(vehicle.km ? String(vehicle.km) : '')
        setPurchasePrice(formatCurrency(Number(vehicle.purchase_price || 0)))
        setAdvertisedPrice(formatCurrency(Number(vehicle.advertised_price || 0)))
        setStatus(vehicle.status)
        setShowForm(true)
    }

    async function handleDeleteVehicle() {
        if (!deleteVehicleId) return

        setDeleteLoading(true)

        const { error } = await supabase
            .from('vehicles')
            .delete()
            .eq('id', deleteVehicleId)

        if (error) {
            showToast('error', 'Erro', 'Não foi possível excluir o veículo.')
            setDeleteLoading(false)
            return
        }

        showToast('success', 'Veículo excluído', 'O veículo foi removido com sucesso.')
        setDeleteVehicleId(null)
        setDeleteLoading(false)
        await loadVehicles()
    }

    return (
        <>
            <PageContainer
                title="Veículos"
                description="Controle de veículos da Matrix."
                action={
                    <button
                        onClick={() => {
                            setShowForm(!showForm)
                            resetForm()
                        }}
                        className="rounded-2xl bg-red-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-red-600/20 transition-all duration-300 hover:-translate-y-0.5 hover:bg-red-700"
                    >
                        {showForm ? 'Fechar formulário' : '+ Novo veículo'}
                    </button>
                }
            >
                {showForm && (
                    <div className="slide-up rounded-3xl border border-zinc-200 bg-white/90 p-6 shadow-xl shadow-zinc-200/60 backdrop-blur">
                        <h2 className="text-xl font-bold">
                            {editingVehicleId ? 'Editar veículo' : 'Cadastrar novo veículo'}
                        </h2>

                        <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-3">
                            <div>
                                <label className="text-sm font-medium text-zinc-700">Placa</label>
                                <input
                                    value={plate}
                                    onChange={(event) => setPlate(event.target.value)}
                                    placeholder="ABC1D23"
                                    className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none transition-all focus:border-red-500 focus:ring-4 focus:ring-red-500/10"
                                />
                            </div>

                            <div>
                                <label className="text-sm font-medium text-zinc-700">Marca</label>
                                <select
                                    value={brandId}
                                    onChange={(event) => handleBrandChange(event.target.value)}
                                    className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none transition-all focus:border-red-500 focus:ring-4 focus:ring-red-500/10"
                                >
                                    <option value="">Selecione</option>
                                    {brands.map((brand) => (
                                        <option key={brand.id} value={brand.id}>
                                            {brand.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="text-sm font-medium text-zinc-700">Modelo</label>
                                <select
                                    value={modelId}
                                    onChange={(event) => setModelId(event.target.value)}
                                    disabled={!brandId}
                                    className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none transition-all focus:border-red-500 focus:ring-4 focus:ring-red-500/10 disabled:bg-zinc-100 disabled:text-zinc-400"
                                >
                                    <option value="">
                                        {brandId ? 'Selecione' : 'Selecione uma marca primeiro'}
                                    </option>
                                    {filteredModels.map((model) => (
                                        <option key={model.id} value={model.id}>
                                            {model.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="text-sm font-medium text-zinc-700">Cor</label>
                                <select
                                    value={colorId}
                                    onChange={(event) => setColorId(event.target.value)}
                                    className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none transition-all focus:border-red-500 focus:ring-4 focus:ring-red-500/10"
                                >
                                    <option value="">Selecione</option>
                                    {colors.map((item) => (
                                        <option key={item.id} value={item.id}>
                                            {item.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="text-sm font-medium text-zinc-700">Motor</label>
                                <select
                                    value={engineId}
                                    onChange={(event) => setEngineId(event.target.value)}
                                    className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none transition-all focus:border-red-500 focus:ring-4 focus:ring-red-500/10"
                                >
                                    <option value="">Selecione</option>
                                    {engines.map((item) => (
                                        <option key={item.id} value={item.id}>
                                            {item.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="text-sm font-medium text-zinc-700">Câmbio</label>
                                <select
                                    value={transmissionId}
                                    onChange={(event) => setTransmissionId(event.target.value)}
                                    className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none transition-all focus:border-red-500 focus:ring-4 focus:ring-red-500/10"
                                >
                                    <option value="">Selecione</option>
                                    {transmissions.map((item) => (
                                        <option key={item.id} value={item.id}>
                                            {item.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="text-sm font-medium text-zinc-700">
                                    Combustível
                                </label>
                                <select
                                    value={fuelId}
                                    onChange={(event) => setFuelId(event.target.value)}
                                    className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none transition-all focus:border-red-500 focus:ring-4 focus:ring-red-500/10"
                                >
                                    <option value="">Selecione</option>
                                    {fuels.map((item) => (
                                        <option key={item.id} value={item.id}>
                                            {item.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="text-sm font-medium text-zinc-700">
                                    Ano fabricação
                                </label>
                                <input
                                    type="number"
                                    value={manufactureYear}
                                    onChange={(event) => setManufactureYear(event.target.value)}
                                    placeholder="2020"
                                    className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none transition-all focus:border-red-500 focus:ring-4 focus:ring-red-500/10"
                                />
                            </div>

                            <div>
                                <label className="text-sm font-medium text-zinc-700">
                                    Ano modelo
                                </label>
                                <input
                                    type="number"
                                    value={modelYear}
                                    onChange={(event) => setModelYear(event.target.value)}
                                    placeholder="2021"
                                    className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none transition-all focus:border-red-500 focus:ring-4 focus:ring-red-500/10"
                                />
                            </div>

                            <div>
                                <label className="text-sm font-medium text-zinc-700">KM</label>
                                <input
                                    type="number"
                                    value={km}
                                    onChange={(event) => setKm(event.target.value)}
                                    placeholder="45000"
                                    className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none transition-all focus:border-red-500 focus:ring-4 focus:ring-red-500/10"
                                />
                            </div>

                            <div>
                                <label className="text-sm font-medium text-zinc-700">
                                    Valor de compra
                                </label>
                                <CurrencyInput value={purchasePrice} onChange={setPurchasePrice} />
                            </div>

                            <div>
                                <label className="text-sm font-medium text-zinc-700">
                                    Valor anunciado
                                </label>

                                <CurrencyInput
                                    value={advertisedPrice}
                                    onChange={setAdvertisedPrice}
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-zinc-700">Status</label>
                                <select
                                    value={status}
                                    onChange={(event) => setStatus(event.target.value)}
                                    className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none transition-all focus:border-red-500 focus:ring-4 focus:ring-red-500/10"
                                >
                                    {statusOptions.map((item) => (
                                        <option key={item.value} value={item.value}>
                                            {item.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <button
                            onClick={handleSaveVehicle}
                            disabled={loading}
                            className="mt-6 rounded-xl bg-zinc-950 px-6 py-3 text-sm font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-zinc-800 disabled:opacity-50"
                        >
                            {loading
                                ? 'Salvando...'
                                : editingVehicleId
                                    ? 'Salvar edição'
                                    : 'Salvar veículo'}
                        </button>
                    </div>
                )}

                <div className="mt-8 grid grid-cols-1 gap-4 rounded-3xl border border-zinc-200 bg-white p-5 shadow-xl shadow-zinc-200/40 md:grid-cols-3">
                    <div className="md:col-span-2">
                        <label className="text-sm font-medium text-zinc-700">
                            Buscar veículo
                        </label>

                        <input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Buscar por placa, marca, modelo ou cor..."
                            className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none transition-all focus:border-red-500 focus:ring-4 focus:ring-red-500/10"
                        />
                    </div>

                    <div>
                        <label className="text-sm font-medium text-zinc-700">Status</label>

                        <select
                            value={statusFilter}
                            onChange={(event) => setStatusFilter(event.target.value)}
                            className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none transition-all focus:border-red-500 focus:ring-4 focus:ring-red-500/10"
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

                <div className="fade-in mt-8 overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-xl shadow-zinc-200/50">
                    <table className="w-full text-sm">
                        <thead className="bg-zinc-950 text-white">
                            <tr>
                                <th className="px-5 py-4 text-left">Placa</th>
                                <th className="px-5 py-4 text-left">Marca</th>
                                <th className="px-5 py-4 text-left">Modelo</th>
                                <th className="px-5 py-4 text-left">Cor</th>
                                <th className="px-5 py-4 text-left">Motor</th>
                                <th className="px-5 py-4 text-left">Câmbio</th>
                                <th className="px-5 py-4 text-left">Ano</th>
                                <th className="px-5 py-4 text-left">KM</th>
                                <th className="px-5 py-4 text-left">Compra</th>
                                <th className="px-5 py-4 text-left">Anunciado</th>
                                <th className="px-5 py-4 text-left">Status</th>
                                <th className="px-5 py-4 text-right">Ações</th>
                            </tr>
                        </thead>

                        <tbody>
                            {filteredVehicles.map((vehicle) => (
                                <tr
                                    key={vehicle.id}
                                    className="border-t transition-colors duration-200 hover:bg-zinc-50"
                                >

                                    <td className="px-5 py-4 font-semibold">{vehicle.plate}</td>
                                    <td className="px-5 py-4">{vehicle.brands?.[0]?.name || '-'}</td>
                                    <td className="px-5 py-4">{vehicle.vehicle_models?.[0]?.name || '-'}</td>
                                    <td className="px-5 py-4">{vehicle.colors?.[0]?.name || '-'}</td>
                                    <td className="px-5 py-4">{vehicle.engines?.[0]?.name || '-'}</td>
                                    <td className="px-5 py-4">{vehicle.transmissions?.[0]?.name || '-'}</td>
                                    <td className="px-5 py-4">
                                        {vehicle.manufacture_year || '-'}
                                        {vehicle.model_year ? `/${vehicle.model_year}` : ''}
                                    </td>
                                    <td className="px-5 py-4">
                                        {vehicle.km ? `${vehicle.km.toLocaleString('pt-BR')} km` : '-'}
                                    </td>
                                    <td className="px-5 py-4">
                                        {formatCurrency(Number(vehicle.purchase_price || 0))}
                                    </td>
                                    <td className="px-5 py-4">
                                        {formatCurrency(Number(vehicle.advertised_price || 0))}
                                    </td>
                                    <td className="px-5 py-4">
                                        <span
                                            className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusClass(
                                                vehicle.status
                                            )}`}
                                        >
                                            {getStatusLabel(vehicle.status)}
                                        </span>
                                    </td>
                                    <td className="px-5 py-4">
                                        <div className="flex justify-end gap-2">
                                            <button
                                                className="rounded-xl bg-zinc-100 p-2 text-zinc-700 transition hover:bg-zinc-200"
                                                title="Visualizar"
                                            >
                                                <Eye size={18} />
                                            </button>

                                            <button
                                                onClick={() => handleEditVehicle(vehicle)}
                                                className="rounded-xl bg-zinc-100 p-2 text-zinc-700 transition hover:bg-zinc-200"
                                                title="Editar"
                                            >
                                                <Pencil size={18} />
                                            </button>

                                            <button
                                                onClick={() => setDeleteVehicleId(vehicle.id)}
                                                className="rounded-xl bg-red-50 p-2 text-red-600 transition hover:bg-red-100"
                                                title="Excluir"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}

                            {filteredVehicles.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={12}
                                        className="px-5 py-10 text-center text-zinc-500"
                                    >
                                        Nenhum veículo cadastrado.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </PageContainer>

            <ConfirmDialog
                open={!!deleteVehicleId}
                title="Excluir veículo"
                description="Deseja realmente excluir este veículo? Essa ação não poderá ser desfeita."
                confirmText="Excluir veículo"
                loading={deleteLoading}
                onCancel={() => setDeleteVehicleId(null)}
                onConfirm={handleDeleteVehicle}
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