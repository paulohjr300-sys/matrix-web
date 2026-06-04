'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { PageContainer } from '../../components/page-container'
import { supabase } from '../../lib/supabase'
import { Toast } from '../../components/ui/toast'
import { ConfirmDialog } from '../../components/ui/confirm-dialog'
import { ArrowLeft, Pencil, Search, Trash2 } from 'lucide-react'

type Brand = {
    id: string
    name: string
}

type VehicleModel = {
    id: string
    name: string
    brand_id: string
    brands?: {
        name: string
    }
}

export default function ModelosPage() {
    const [brands, setBrands] = useState<Brand[]>([])
    const [models, setModels] = useState<VehicleModel[]>([])
    const [showForm, setShowForm] = useState(false)

    const [modelName, setModelName] = useState('')
    const [brandId, setBrandId] = useState('')
    const [editingModelId, setEditingModelId] = useState<string | null>(null)

    const [search, setSearch] = useState('')
    const [loading, setLoading] = useState(false)
    const [deleteModelId, setDeleteModelId] = useState<string | null>(null)
    const [deleteLoading, setDeleteLoading] = useState(false)

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
            .select('id, name, brand_id, brands(name)')
            .order('name')

        if (error) {
            showToast('error', 'Erro', 'Não foi possível carregar os modelos.')
            return
        }

        setModels(data || [])
    }

    useEffect(() => {
        loadBrands()
        loadModels()
    }, [])

    const filteredModels = models.filter((model) => {
        const brandName = model.brands?.name || ''

        return (
            model.name.toLowerCase().includes(search.toLowerCase()) ||
            brandName.toLowerCase().includes(search.toLowerCase())
        )
    })

    async function handleSaveModel() {
        if (!modelName.trim()) {
            showToast('error', 'Campo obrigatório', 'Informe o nome do modelo.')
            return
        }

        if (!brandId) {
            showToast('error', 'Campo obrigatório', 'Selecione uma marca.')
            return
        }

        setLoading(true)

        if (editingModelId) {
            const { error } = await supabase
                .from('vehicle_models')
                .update({
                    name: modelName.trim(),
                    brand_id: brandId,
                })
                .eq('id', editingModelId)

            if (error) {
                showToast('error', 'Erro', 'Não foi possível editar o modelo.')
                setLoading(false)
                return
            }

            showToast('success', 'Modelo atualizado', 'O modelo foi atualizado com sucesso.')
        } else {
            const { error } = await supabase
                .from('vehicle_models')
                .insert({
                    name: modelName.trim(),
                    brand_id: brandId,
                })

            if (error) {
                showToast('error', 'Erro', 'Não foi possível cadastrar o modelo.')
                setLoading(false)
                return
            }

            showToast('success', 'Modelo cadastrado', 'O modelo foi cadastrado com sucesso.')
        }

        setModelName('')
        setBrandId('')
        setEditingModelId(null)
        setShowForm(false)
        setLoading(false)
        await loadModels()
    }

    function handleEditModel(model: VehicleModel) {
        setEditingModelId(model.id)
        setModelName(model.name)
        setBrandId(model.brand_id)
        setShowForm(true)
    }

    async function handleDeleteModel() {
        if (!deleteModelId) return

        setDeleteLoading(true)

        const { error } = await supabase
            .from('vehicle_models')
            .delete()
            .eq('id', deleteModelId)

        if (error) {
            showToast('error', 'Erro', 'Não foi possível excluir o modelo.')
            setDeleteLoading(false)
            return
        }

        showToast('success', 'Modelo excluído', 'O modelo foi removido com sucesso.')
        setDeleteModelId(null)
        setDeleteLoading(false)
        await loadModels()
    }

    return (
        <>
            <PageContainer
                title="Modelos"
                description="Cadastre modelos e vincule cada um a uma marca."
                action={
                    <button
                        onClick={() => {
                            setShowForm(!showForm)
                            setEditingModelId(null)
                            setModelName('')
                            setBrandId('')
                        }}
                        className="rounded-2xl bg-red-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-red-600/20 transition-all duration-300 hover:-translate-y-0.5 hover:bg-red-700"
                    >
                        {showForm ? 'Fechar' : '+ Novo modelo'}
                    </button>
                }
            >
                <Link
                    href="/configuracoes"
                    className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-zinc-500 transition hover:text-red-600"
                >
                    <ArrowLeft size={18} />
                    Voltar para configurações
                </Link>

                {showForm && (
                    <div className="slide-up mb-8 rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl shadow-zinc-200/60">
                        <h2 className="text-xl font-bold">
                            {editingModelId ? 'Editar modelo' : 'Cadastrar modelo'}
                        </h2>

                        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
                            <div>
                                <label className="text-sm font-medium text-zinc-700">
                                    Nome do modelo
                                </label>

                                <input
                                    value={modelName}
                                    onChange={(event) => setModelName(event.target.value)}
                                    placeholder="Ex: HB20"
                                    className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none transition-all focus:border-red-500 focus:ring-4 focus:ring-red-500/10"
                                />
                            </div>

                            <div>
                                <label className="text-sm font-medium text-zinc-700">
                                    Marca
                                </label>

                                <select
                                    value={brandId}
                                    onChange={(event) => setBrandId(event.target.value)}
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

                            <div className="flex items-end">
                                <button
                                    onClick={handleSaveModel}
                                    disabled={loading}
                                    className="w-full rounded-xl bg-zinc-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50"
                                >
                                    {loading
                                        ? 'Salvando...'
                                        : editingModelId
                                            ? 'Salvar edição'
                                            : 'Salvar modelo'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <div className="mb-6 rounded-3xl border border-zinc-200 bg-white p-4 shadow-xl shadow-zinc-200/40">
                    <div className="flex items-center gap-3">
                        <Search size={20} className="text-zinc-400" />

                        <input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Buscar por modelo ou marca..."
                            className="w-full bg-transparent outline-none"
                        />
                    </div>
                </div>

                <div className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-xl shadow-zinc-200/50">
                    <table className="w-full text-sm">
                        <thead className="bg-zinc-950 text-white">
                            <tr>
                                <th className="px-5 py-4 text-left">Modelo</th>
                                <th className="px-5 py-4 text-left">Marca vinculada</th>
                                <th className="px-5 py-4 text-right">Ações</th>
                            </tr>
                        </thead>

                        <tbody>
                            {filteredModels.map((model) => (
                                <tr
                                    key={model.id}
                                    className="border-t transition-colors duration-200 hover:bg-zinc-50"
                                >
                                    <td className="px-5 py-4 font-semibold">{model.name}</td>
                                    <td className="px-5 py-4">{model.brands?.name || '-'}</td>

                                    <td className="px-5 py-4">
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => handleEditModel(model)}
                                                className="rounded-xl bg-zinc-100 p-2 text-zinc-700 transition hover:bg-zinc-200"
                                            >
                                                <Pencil size={18} />
                                            </button>

                                            <button
                                                onClick={() => setDeleteModelId(model.id)}
                                                className="rounded-xl bg-red-50 p-2 text-red-600 transition hover:bg-red-100"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}

                            {filteredModels.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={3}
                                        className="px-5 py-10 text-center text-zinc-500"
                                    >
                                        Nenhum modelo encontrado.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </PageContainer>

            <ConfirmDialog
                open={!!deleteModelId}
                title="Excluir modelo"
                description="Deseja realmente excluir este modelo? Essa ação não poderá ser desfeita."
                confirmText="Excluir modelo"
                loading={deleteLoading}
                onCancel={() => setDeleteModelId(null)}
                onConfirm={handleDeleteModel}
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