/* eslint-disable react-hooks/exhaustive-deps */
'use client'

import { useEffect, useState } from 'react'
import { PageContainer } from '../components/page-container'
import { CurrencyInput } from '../components/currency-input'
import { Toast } from '../components/ui/toast'
import { ConfirmDialog } from '../components/ui/confirm-dialog'
import { supabase } from '../../lib/supabase'
import { Pencil, Trash2 } from 'lucide-react'

type Vehicle = {
  id: string
  plate: string
  brands?: { name: string }[] | { name: string } | null
  vehicle_models?: { name: string }[] | { name: string } | null
}

type VehicleCost = {
  id: string
  vehicle_id: string
  description: string
  category: string | null
  amount: number
  cost_date: string | null
  vehicles?: Vehicle | Vehicle[] | null
}

const costCategories = [
  'Manutenção',
  'Funilaria',
  'Documentação',
  'Lavagem',
  'Transporte',
  'Pintura',
  'Mecânica',
  'Comissão',
  'Anúncio',
  'Outros',
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

function formatDate(date?: string | null) {
  if (!date) return '-'

  const [year, month, day] = date.split('-')
  return `${day}/${month}/${year}`
}

function getVehicleLabel(vehicle?: Vehicle | Vehicle[] | null) {
  if (!vehicle) return '-'

  const currentVehicle = Array.isArray(vehicle) ? vehicle[0] : vehicle
  if (!currentVehicle) return '-'

  const brand = Array.isArray(currentVehicle.brands)
    ? currentVehicle.brands[0]?.name || ''
    : currentVehicle.brands?.name || ''
  const model = Array.isArray(currentVehicle.vehicle_models)
    ? currentVehicle.vehicle_models[0]?.name || ''
    : currentVehicle.vehicle_models?.name || ''

  return `${currentVehicle.plate} - ${brand} - ${model}`.trim()
}

export default function CustosPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [costs, setCosts] = useState<VehicleCost[]>([])

  const [showForm, setShowForm] = useState(false)
  const [editingCostId, setEditingCostId] = useState<string | null>(null)

  const [vehicleId, setVehicleId] = useState('')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [costDate, setCostDate] = useState('')

  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [deleteCostId, setDeleteCostId] = useState<string | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const [toast, setToast] = useState({
    open: false,
    type: 'success' as 'success' | 'error',
    title: '',
    description: '',
  })

  const filteredCosts = costs.filter((cost) => {
    const vehicleLabel = getVehicleLabel(cost.vehicles)
    const categoryName = cost.category || ''

    return (
      vehicleLabel.toLowerCase().includes(search.toLowerCase()) ||
      cost.description.toLowerCase().includes(search.toLowerCase()) ||
      categoryName.toLowerCase().includes(search.toLowerCase())
    )
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
    setEditingCostId(null)
    setVehicleId('')
    setCategory('')
    setDescription('')
    setAmount('')
    setCostDate('')
  }

  async function loadVehicles() {
    const { data, error } = await supabase
      .from('vehicles')
      .select(`
        id,
        plate,
        brands(name),
        vehicle_models(name)
      `)
      .order('plate')

    if (error) {
      showToast('error', 'Erro', 'Não foi possível carregar os veículos.')
      return
    }

    setVehicles((data || []) as Vehicle[])
  }

  async function loadCosts() {
    const { data, error } = await supabase
      .from('vehicle_costs')
      .select(`
        id,
        vehicle_id,
        description,
        category,
        amount,
        cost_date,
        vehicles(
          id,
          plate,
          brands(name),
          vehicle_models(name)
        )
      `)
      .order('created_at', { ascending: false })

    if (error) {
      showToast('error', 'Erro', error.message)
      return
    }

    setCosts((data || []) as VehicleCost[])
  }

  useEffect(() => {
    async function loadData() {
      await loadVehicles()
      await loadCosts()
    }

    void loadData()
  }, [])

  async function handleSaveCost() {
    if (!vehicleId) {
      showToast('error', 'Campo obrigatório', 'Selecione um veículo.')
      return
    }

    if (!description.trim()) {
      showToast('error', 'Campo obrigatório', 'Informe a descrição do custo.')
      return
    }

    if (!amount) {
      showToast('error', 'Campo obrigatório', 'Informe o valor do custo.')
      return
    }

    setLoading(true)

    const costData = {
      vehicle_id: vehicleId,
      category: category || null,
      description: description.trim(),
      amount: parseCurrency(amount),
      cost_date: costDate || new Date().toISOString().slice(0, 10),
    }

    if (editingCostId) {
      const { error } = await supabase
        .from('vehicle_costs')
        .update(costData)
        .eq('id', editingCostId)

      if (error) {
        showToast('error', 'Erro ao editar custo', error.message)
        setLoading(false)
        return
      }

      showToast('success', 'Custo atualizado', 'O custo foi atualizado com sucesso.')
    } else {
      const { error } = await supabase.from('vehicle_costs').insert(costData)

      if (error) {
        showToast('error', 'Erro ao cadastrar custo', error.message)
        setLoading(false)
        return
      }

      showToast('success', 'Custo cadastrado', 'O custo foi cadastrado com sucesso.')
    }

    resetForm()
    setShowForm(false)
    setLoading(false)
    await loadCosts()
  }

  function handleEditCost(cost: VehicleCost) {
    setEditingCostId(cost.id)
    setVehicleId(cost.vehicle_id)
    setCategory(cost.category || '')
    setDescription(cost.description)
    setAmount(formatCurrency(Number(cost.amount || 0)))
    setCostDate(cost.cost_date || '')
    setShowForm(true)
  }

  async function handleDeleteCost() {
    if (!deleteCostId) return

    setDeleteLoading(true)

    const { error } = await supabase
      .from('vehicle_costs')
      .delete()
      .eq('id', deleteCostId)

    if (error) {
      showToast('error', 'Erro', 'Não foi possível excluir o custo.')
      setDeleteLoading(false)
      return
    }

    showToast('success', 'Custo excluído', 'O custo foi removido com sucesso.')
    setDeleteCostId(null)
    setDeleteLoading(false)
    await loadCosts()
  }

  return (
    <>
      <PageContainer
        title="Custos"
        description="Controle os custos de cada veículo para calcular o DRE."
        action={
          <button
            onClick={() => {
              setShowForm(!showForm)
              resetForm()
            }}
            className="rounded-2xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-600/20 transition-all duration-300 hover:-translate-y-0.5 hover:bg-brand-700"
          >
            {showForm ? 'Fechar formulário' : '+ Novo custo'}
          </button>
        }
      >
        {showForm && (
          <div className="slide-up rounded-3xl border border-zinc-200 bg-white/90 p-6 shadow-xl shadow-zinc-200/60 backdrop-blur">
            <h2 className="text-xl font-bold">
              {editingCostId ? 'Editar custo' : 'Cadastrar novo custo'}
            </h2>

            <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-3">
              <div>
                <label className="text-sm font-medium text-zinc-700">
                  Veículo
                </label>

                <select
                  value={vehicleId}
                  onChange={(event) => setVehicleId(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none transition-all focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
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
                <label className="text-sm font-medium text-zinc-700">
                  Categoria
                </label>

                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none transition-all focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
                >
                  <option value="">Selecione</option>

                  {costCategories.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-zinc-700">
                  Data do custo
                </label>

                <input
                  type="date"
                  value={costDate}
                  onChange={(event) => setCostDate(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none transition-all focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-sm font-medium text-zinc-700">
                  Descrição
                </label>

                <input
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Ex: Troca de óleo"
                  className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none transition-all focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-zinc-700">
                  Valor
                </label>

                <CurrencyInput value={amount} onChange={setAmount} />
              </div>
            </div>

            <button
              onClick={handleSaveCost}
              disabled={loading}
              className="mt-6 rounded-xl bg-zinc-950 px-6 py-3 text-sm font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-zinc-800 disabled:opacity-50"
            >
              {loading
                ? 'Salvando...'
                : editingCostId
                  ? 'Salvar edição'
                  : 'Salvar custo'}
            </button>
          </div>
        )}

        <div className="mt-8 rounded-3xl border border-zinc-200 bg-white p-5 shadow-xl shadow-zinc-200/40">
          <label className="text-sm font-medium text-zinc-700">
            Buscar custo
          </label>

          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por veículo, descrição ou categoria..."
            className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none transition-all focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
          />
        </div>

        <div className="fade-in mt-8 overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-xl shadow-zinc-200/50">
          <table className="w-full text-sm">
            <thead className="bg-zinc-950 text-white">
              <tr>
                <th className="px-5 py-4 text-left">Veículo</th>
                <th className="px-5 py-4 text-left">Categoria</th>
                <th className="px-5 py-4 text-left">Descrição</th>
                <th className="px-5 py-4 text-left">Data</th>
                <th className="px-5 py-4 text-left">Valor</th>
                <th className="px-5 py-4 text-right">Ações</th>
              </tr>
            </thead>

            <tbody>
              {filteredCosts.map((cost) => (
                <tr
                  key={cost.id}
                  className="border-t transition-colors duration-200 hover:bg-zinc-50"
                >
                  <td className="px-5 py-4 font-semibold">
                    {getVehicleLabel(cost.vehicles)}
                  </td>
                  <td className="px-5 py-4">{cost.category || '-'}</td>
                  <td className="px-5 py-4">{cost.description}</td>
                  <td className="px-5 py-4">{formatDate(cost.cost_date)}</td>
                  <td className="px-5 py-4">
                    {formatCurrency(Number(cost.amount || 0))}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleEditCost(cost)}
                        className="rounded-xl bg-zinc-100 p-2 text-zinc-700 transition hover:bg-zinc-200"
                        title="Editar"
                      >
                        <Pencil size={18} />
                      </button>

                      <button
                        onClick={() => setDeleteCostId(cost.id)}
                        className="rounded-xl bg-red-50 p-2 text-red-600 transition hover:bg-red-100"
                        title="Excluir"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filteredCosts.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-10 text-center text-zinc-500"
                  >
                    Nenhum custo cadastrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </PageContainer>

      <ConfirmDialog
        open={!!deleteCostId}
        title="Excluir custo"
        description="Deseja realmente excluir este custo? Essa ação não poderá ser desfeita."
        confirmText="Excluir custo"
        loading={deleteLoading}
        onCancel={() => setDeleteCostId(null)}
        onConfirm={handleDeleteCost}
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