/* eslint-disable react-hooks/exhaustive-deps */
'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import { PageContainer } from '../components/page-container'
import { CurrencyInput } from '../components/currency-input'
import { Toast } from '../components/ui/toast'
import { ConfirmDialog } from '../components/ui/confirm-dialog'
import { supabase } from '../../lib/supabase'
import { ChevronDown, ChevronRight, Pencil, Plus, Trash2, X } from 'lucide-react'

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

// Uma linha do formulário (vários custos do mesmo veículo de uma vez).
type CostLine = {
  key: number
  category: string
  description: string
  amount: string
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

const inputClass =
  'mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none transition-all focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10'

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

let nextLineKey = 1
const emptyLine = (): CostLine => ({ key: nextLineKey++, category: '', description: '', amount: '' })

export default function CustosPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [costs, setCosts] = useState<VehicleCost[]>([])

  const [showForm, setShowForm] = useState(false)
  const [editingCostId, setEditingCostId] = useState<string | null>(null)

  const [vehicleId, setVehicleId] = useState('')
  const [costDate, setCostDate] = useState('')
  const [lines, setLines] = useState<CostLine[]>([emptyLine()])

  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [deleteCostId, setDeleteCostId] = useState<string | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const [toast, setToast] = useState({
    open: false,
    type: 'success' as 'success' | 'error',
    title: '',
    description: '',
  })

  // Custos agrupados por veículo (uma linha por carro na lista).
  const groups = useMemo(() => {
    const term = search.toLowerCase()
    const byVehicle = new Map<string, { vehicleId: string; label: string; costs: VehicleCost[]; total: number }>()

    for (const cost of costs) {
      const label = getVehicleLabel(cost.vehicles)
      const matches =
        !term ||
        label.toLowerCase().includes(term) ||
        cost.description.toLowerCase().includes(term) ||
        (cost.category || '').toLowerCase().includes(term)

      if (!matches) continue

      const group = byVehicle.get(cost.vehicle_id) || { vehicleId: cost.vehicle_id, label, costs: [], total: 0 }
      group.costs.push(cost)
      group.total += Number(cost.amount || 0)
      byVehicle.set(cost.vehicle_id, group)
    }

    return [...byVehicle.values()]
  }, [costs, search])

  const formTotal = lines.reduce((total, line) => total + (line.amount ? parseCurrency(line.amount) : 0), 0)

  function showToast(type: 'success' | 'error', title: string, description?: string) {
    setToast({ open: true, type, title, description: description || '' })

    setTimeout(() => {
      setToast((current) => ({ ...current, open: false }))
    }, 3000)
  }

  function resetForm() {
    setEditingCostId(null)
    setVehicleId('')
    setCostDate('')
    setLines([emptyLine()])
  }

  function updateLine(key: number, field: keyof Omit<CostLine, 'key'>, value: string) {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, [field]: value } : line)))
  }

  function removeLine(key: number) {
    setLines((current) => (current.length > 1 ? current.filter((line) => line.key !== key) : current))
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

  async function handleSaveCosts() {
    if (!vehicleId) {
      showToast('error', 'Campo obrigatório', 'Selecione um veículo.')
      return
    }

    // Linhas totalmente vazias são ignoradas; as preenchidas pela metade, não.
    const filled = lines.filter((line) => line.description.trim() || line.amount || line.category)

    if (!filled.length) {
      showToast('error', 'Campo obrigatório', 'Informe ao menos um custo.')
      return
    }

    const incomplete = filled.findIndex((line) => !line.description.trim() || !parseCurrency(line.amount))

    if (incomplete >= 0) {
      showToast('error', 'Custo incompleto', `Informe a descrição e o valor do custo ${incomplete + 1}.`)
      return
    }

    setLoading(true)

    const date = costDate || new Date().toISOString().slice(0, 10)
    const rows = filled.map((line) => ({
      vehicle_id: vehicleId,
      category: line.category || null,
      description: line.description.trim(),
      amount: parseCurrency(line.amount),
      cost_date: date,
    }))

    if (editingCostId) {
      const { error } = await supabase.from('vehicle_costs').update(rows[0]).eq('id', editingCostId)

      if (error) {
        showToast('error', 'Erro ao editar custo', error.message)
        setLoading(false)
        return
      }

      showToast('success', 'Custo atualizado', 'O custo foi atualizado com sucesso.')
    } else {
      const { error } = await supabase.from('vehicle_costs').insert(rows)

      if (error) {
        showToast('error', 'Erro ao cadastrar custos', error.message)
        setLoading(false)
        return
      }

      showToast(
        'success',
        rows.length === 1 ? 'Custo cadastrado' : `${rows.length} custos cadastrados`,
        `Total de ${formatCurrency(rows.reduce((total, row) => total + row.amount, 0))}.`
      )
    }

    setExpanded((current) => (current.includes(vehicleId) ? current : [...current, vehicleId]))
    resetForm()
    setShowForm(false)
    setLoading(false)
    await loadCosts()
  }

  function handleNewCosts(forVehicleId = '') {
    resetForm()
    setVehicleId(forVehicleId)
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleEditCost(cost: VehicleCost) {
    setEditingCostId(cost.id)
    setVehicleId(cost.vehicle_id)
    setCostDate(cost.cost_date || '')
    setLines([
      {
        key: nextLineKey++,
        category: cost.category || '',
        description: cost.description,
        amount: formatCurrency(Number(cost.amount || 0)),
      },
    ])
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleDeleteCost() {
    if (!deleteCostId) return

    setDeleteLoading(true)

    const { error } = await supabase.from('vehicle_costs').delete().eq('id', deleteCostId)

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

  function toggleGroup(id: string) {
    setExpanded((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))
  }

  return (
    <>
      <PageContainer
        title="Custos"
        description="Controle os custos de cada veículo para calcular o DRE."
        action={
          <button
            onClick={() => (showForm ? (resetForm(), setShowForm(false)) : handleNewCosts())}
            className="rounded-2xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-600/20 transition-all duration-300 hover:-translate-y-0.5 hover:bg-brand-700"
          >
            {showForm ? 'Fechar formulário' : '+ Novos custos'}
          </button>
        }
      >
        {showForm && (
          <div className="slide-up rounded-3xl border border-zinc-200 bg-white/90 p-6 shadow-xl shadow-zinc-200/60 backdrop-blur">
            <h2 className="text-xl font-bold">{editingCostId ? 'Editar custo' : 'Lançar custos do veículo'}</h2>
            {!editingCostId && (
              <p className="mt-1 text-sm text-zinc-500">
                Escolha o veículo e lance quantos custos quiser de uma vez.
              </p>
            )}

            <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-3">
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-zinc-700">Veículo</label>

                <select value={vehicleId} onChange={(event) => setVehicleId(event.target.value)} className={inputClass}>
                  <option value="">Selecione</option>

                  {vehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {getVehicleLabel(vehicle)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-zinc-700">Data dos custos</label>

                <input
                  type="date"
                  value={costDate}
                  onChange={(event) => setCostDate(event.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {lines.map((line, index) => (
                <div
                  key={line.key}
                  className="grid grid-cols-1 gap-3 rounded-2xl bg-zinc-50 p-4 ring-1 ring-zinc-200 md:grid-cols-[180px_1fr_180px_auto] md:items-end"
                >
                  <div>
                    <label className="text-xs font-medium text-zinc-600">
                      {lines.length > 1 ? `Custo ${index + 1} · ` : ''}Categoria
                    </label>
                    <select
                      value={line.category}
                      onChange={(event) => updateLine(line.key, 'category', event.target.value)}
                      className={inputClass}
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
                    <label className="text-xs font-medium text-zinc-600">Descrição</label>
                    <input
                      value={line.description}
                      onChange={(event) => updateLine(line.key, 'description', event.target.value)}
                      placeholder="Ex: Troca de óleo"
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-zinc-600">Valor</label>
                    <CurrencyInput value={line.amount} onChange={(value) => updateLine(line.key, 'amount', value)} />
                  </div>

                  {!editingCostId && lines.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeLine(line.key)}
                      title="Remover este custo"
                      className="justify-self-end rounded-xl p-3 text-zinc-500 transition hover:bg-red-50 hover:text-red-600"
                    >
                      <X size={18} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              {!editingCostId ? (
                <button
                  type="button"
                  onClick={() => setLines((current) => [...current, emptyLine()])}
                  className="inline-flex items-center gap-2 rounded-xl bg-zinc-100 px-4 py-2.5 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-200"
                >
                  <Plus size={16} /> Adicionar outro custo
                </button>
              ) : (
                <span />
              )}

              {lines.length > 1 && (
                <p className="text-sm text-zinc-600">
                  Total: <strong className="text-zinc-900">{formatCurrency(formTotal)}</strong>
                </p>
              )}
            </div>

            <button
              onClick={handleSaveCosts}
              disabled={loading}
              className="mt-6 rounded-xl bg-zinc-950 px-6 py-3 text-sm font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-zinc-800 disabled:opacity-50"
            >
              {loading
                ? 'Salvando...'
                : editingCostId
                  ? 'Salvar edição'
                  : lines.length > 1
                    ? `Salvar ${lines.length} custos`
                    : 'Salvar custo'}
            </button>
          </div>
        )}

        <div className="mt-8 rounded-3xl border border-zinc-200 bg-white p-5 shadow-xl shadow-zinc-200/40">
          <label className="text-sm font-medium text-zinc-700">Buscar custo</label>

          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por veículo, descrição ou categoria..."
            className={inputClass}
          />
        </div>

        <div className="fade-in mt-8 overflow-x-auto rounded-3xl border border-zinc-200 bg-white shadow-xl shadow-zinc-200/50">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-zinc-950 text-white">
              <tr>
                <th className="px-5 py-4 text-left">Veículo</th>
                <th className="px-5 py-4 text-left">Custos</th>
                <th className="px-5 py-4 text-left">Total</th>
                <th className="px-5 py-4 text-right">Ações</th>
              </tr>
            </thead>

            <tbody>
              {groups.map((group) => {
                const isOpen = expanded.includes(group.vehicleId) || Boolean(search)

                return (
                  <Fragment key={group.vehicleId}>
                    <tr
                      onClick={() => toggleGroup(group.vehicleId)}
                      className="cursor-pointer border-t transition-colors duration-200 hover:bg-zinc-50"
                    >
                      <td className="px-5 py-4 font-semibold">
                        <span className="inline-flex items-center gap-2">
                          {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          {group.label}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        {group.costs.length} {group.costs.length === 1 ? 'custo' : 'custos'}
                      </td>
                      <td className="px-5 py-4 font-bold">{formatCurrency(group.total)}</td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end">
                          <button
                            onClick={(event) => {
                              event.stopPropagation()
                              handleNewCosts(group.vehicleId)
                            }}
                            className="inline-flex items-center gap-1 rounded-xl bg-brand-50 px-3 py-2 text-xs font-bold text-brand-700 transition hover:bg-brand-100"
                          >
                            <Plus size={14} /> Custos
                          </button>
                        </div>
                      </td>
                    </tr>

                    {isOpen &&
                      group.costs.map((cost) => (
                        <tr key={cost.id} className="border-t border-zinc-100 bg-zinc-50/60">
                          <td className="py-3 pl-12 pr-5 text-zinc-700">
                            <span className="font-medium text-zinc-900">{cost.description}</span>
                            {cost.category && <span className="ml-2 text-xs text-zinc-500">{cost.category}</span>}
                          </td>
                          <td className="px-5 py-3 text-zinc-600">{formatDate(cost.cost_date)}</td>
                          <td className="px-5 py-3">{formatCurrency(Number(cost.amount || 0))}</td>
                          <td className="px-5 py-3">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => handleEditCost(cost)}
                                className="rounded-xl bg-white p-2 text-zinc-700 ring-1 ring-zinc-200 transition hover:bg-zinc-100"
                                title="Editar"
                              >
                                <Pencil size={16} />
                              </button>

                              <button
                                onClick={() => setDeleteCostId(cost.id)}
                                className="rounded-xl bg-red-50 p-2 text-red-600 transition hover:bg-red-100"
                                title="Excluir"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </Fragment>
                )
              })}

              {groups.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center text-zinc-500">
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
