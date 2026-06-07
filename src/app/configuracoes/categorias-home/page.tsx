'use client'

import { useEffect, useState } from 'react'
import { ImageIcon, Pencil, Trash2, Upload } from 'lucide-react'
import { PageContainer } from '../../components/page-container'
import { Toast } from '../../components/ui/toast'
import { ConfirmDialog } from '../../components/ui/confirm-dialog'
import { supabase } from '../../../lib/supabase'

type VehicleCategory = {
    id: string
    name: string
}

type CategoryBlock = {
    id: string
    category_id: string | null
    title: string
    image_url: string
    is_active: boolean
    sort_order: number
    created_at: string
    vehicle_categories?: {
        name: string
    } | null
}

function createFilePath(file: File) {
    const safeName = file.name
        .toLowerCase()
        .replace(/\s/g, '-')
        .replace(/[^a-z0-9.-]/g, '')

    return `${Date.now()}-${safeName}`
}

async function compressImage(file: File): Promise<File> {
    return new Promise((resolve, reject) => {
        const image = new Image()
        const reader = new FileReader()

        reader.onload = () => {
            image.src = String(reader.result)
        }

        image.onload = () => {
            const canvas = document.createElement('canvas')
            const maxWidth = 1200
            const scale = Math.min(1, maxWidth / image.width)

            canvas.width = Math.round(image.width * scale)
            canvas.height = Math.round(image.height * scale)

            const ctx = canvas.getContext('2d')

            if (!ctx) {
                resolve(file)
                return
            }

            ctx.drawImage(image, 0, 0, canvas.width, canvas.height)

            canvas.toBlob(
                (blob) => {
                    if (!blob) {
                        resolve(file)
                        return
                    }

                    resolve(
                        new File([blob], file.name.replace(/\.[^/.]+$/, '.webp'), {
                            type: 'image/webp',
                            lastModified: Date.now(),
                        })
                    )
                },
                'image/webp',
                0.8
            )
        }

        image.onerror = reject
        reader.onerror = reject
        reader.readAsDataURL(file)
    })
}

export default function CategoriasHomePage() {
    const [categories, setCategories] = useState<VehicleCategory[]>([])
    const [blocks, setBlocks] = useState<CategoryBlock[]>([])

    const [showForm, setShowForm] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)

    const [categoryId, setCategoryId] = useState('')
    const [title, setTitle] = useState('')
    const [sortOrder, setSortOrder] = useState('0')
    const [isActive, setIsActive] = useState(true)
    const [imageUrl, setImageUrl] = useState('')
    const [imageFile, setImageFile] = useState<File | null>(null)

    const [loading, setLoading] = useState(false)
    const [deleteBlock, setDeleteBlock] = useState<CategoryBlock | null>(null)
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

    function resetForm() {
        setEditingId(null)
        setCategoryId('')
        setTitle('')
        setSortOrder('0')
        setIsActive(true)
        setImageUrl('')
        setImageFile(null)
    }

    async function loadCategories() {
        const { data, error } = await supabase
            .from('vehicle_categories')
            .select('id, name')
            .order('name')

        if (error) {
            showToast('error', 'Erro', 'Não foi possível carregar as categorias.')
            return
        }

        setCategories(data || [])
    }

    async function loadBlocks() {
        const { data, error } = await supabase
            .from('site_category_blocks')
            .select(`
        id,
        category_id,
        title,
        image_url,
        is_active,
        sort_order,
        created_at,
        vehicle_categories(name)
      `)
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: false })

        if (error) {
            showToast('error', 'Erro', 'Não foi possível carregar os blocos.')
            return
        }

        setBlocks((data || []) as unknown as CategoryBlock[])
    }

    useEffect(() => {
        async function loadInitialData() {
            await Promise.all([loadCategories(), loadBlocks()])
        }

        void loadInitialData()
    }, [])

    async function uploadImage(file: File) {
        const compressedFile = await compressImage(file)
        const filePath = createFilePath(compressedFile)

        const { error } = await supabase.storage
            .from('site-category-blocks')
            .upload(filePath, compressedFile, {
                cacheControl: '3600',
                upsert: false,
            })

        if (error) {
            throw new Error(error.message)
        }

        const { data } = supabase.storage
            .from('site-category-blocks')
            .getPublicUrl(filePath)

        return data.publicUrl
    }

    async function handleSaveBlock() {
        if (!categoryId) {
            showToast('error', 'Campo obrigatório', 'Selecione uma categoria.')
            return
        }

        if (!title.trim()) {
            showToast('error', 'Campo obrigatório', 'Informe o título da categoria.')
            return
        }

        if (!imageUrl && !imageFile) {
            showToast('error', 'Imagem obrigatória', 'Envie uma imagem para a categoria.')
            return
        }

        setLoading(true)

        try {
            let finalImageUrl = imageUrl

            if (imageFile) {
                finalImageUrl = await uploadImage(imageFile)
            }

            const blockData = {
                category_id: categoryId,
                title: title.trim(),
                image_url: finalImageUrl,
                is_active: isActive,
                sort_order: sortOrder ? Number(sortOrder) : 0,
            }

            if (editingId) {
                const { error } = await supabase
                    .from('site_category_blocks')
                    .update(blockData)
                    .eq('id', editingId)

                if (error) {
                    showToast('error', 'Erro ao editar categoria da home', error.message)
                    return
                }

                showToast(
                    'success',
                    'Categoria atualizada',
                    'O bloco da home foi atualizado com sucesso.'
                )
            } else {
                const { error } = await supabase
                    .from('site_category_blocks')
                    .insert(blockData)

                if (error) {
                    showToast('error', 'Erro ao cadastrar categoria da home', error.message)
                    return
                }

                showToast(
                    'success',
                    'Categoria cadastrada',
                    'O bloco da home foi cadastrado com sucesso.'
                )
            }

            resetForm()
            setShowForm(false)
            await loadBlocks()
        } catch (error) {
            showToast(
                'error',
                'Erro no upload',
                error instanceof Error ? error.message : 'Não foi possível enviar a imagem.'
            )
        } finally {
            setLoading(false)
        }
    }

    function handleEditBlock(block: CategoryBlock) {
        setEditingId(block.id)
        setCategoryId(block.category_id || '')
        setTitle(block.title || '')
        setSortOrder(String(block.sort_order || 0))
        setIsActive(block.is_active)
        setImageUrl(block.image_url)
        setImageFile(null)
        setShowForm(true)
    }

    async function handleDeleteBlock() {
        if (!deleteBlock) return

        setDeleteLoading(true)

        const { error } = await supabase
            .from('site_category_blocks')
            .delete()
            .eq('id', deleteBlock.id)

        setDeleteLoading(false)

        if (error) {
            showToast('error', 'Erro', 'Não foi possível excluir a categoria da home.')
            return
        }

        setDeleteBlock(null)
        showToast('success', 'Categoria excluída', 'O bloco foi removido da home.')
        await loadBlocks()
    }

    return (
        <>
            <PageContainer
                title="Categorias da home"
                description="Gerencie os cards de categorias exibidos na home do site público."
                action={
                    <button
                        onClick={() => {
                            setShowForm(!showForm)
                            resetForm()
                        }}
                        className="rounded-2xl bg-red-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-red-600/20 transition-all hover:-translate-y-0.5 hover:bg-red-700"
                    >
                        {showForm ? 'Fechar formulário' : '+ Nova categoria'}
                    </button>
                }
            >
                {showForm && (
                    <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl shadow-zinc-200/60">
                        <h2 className="text-xl font-bold">
                            {editingId ? 'Editar categoria da home' : 'Cadastrar categoria da home'}
                        </h2>

                        <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
                            <div>
                                <label className="text-sm font-medium text-zinc-700">
                                    Categoria vinculada
                                </label>

                                <select
                                    value={categoryId}
                                    onChange={(event) => {
                                        const selectedId = event.target.value
                                        setCategoryId(selectedId)

                                        const selectedCategory = categories.find(
                                            (category) => category.id === selectedId
                                        )

                                        if (!title && selectedCategory?.name) {
                                            setTitle(selectedCategory.name)
                                        }
                                    }}
                                    className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none focus:border-red-500 focus:ring-4 focus:ring-red-500/10"
                                >
                                    <option value="">Selecione</option>

                                    {categories.map((category) => (
                                        <option key={category.id} value={category.id}>
                                            {category.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="text-sm font-medium text-zinc-700">
                                    Título exibido no site
                                </label>

                                <input
                                    value={title}
                                    onChange={(event) => setTitle(event.target.value)}
                                    placeholder="Ex: SUVs"
                                    className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none focus:border-red-500 focus:ring-4 focus:ring-red-500/10"
                                />
                            </div>

                            <div>
                                <label className="text-sm font-medium text-zinc-700">
                                    Ordem
                                </label>

                                <input
                                    type="number"
                                    value={sortOrder}
                                    onChange={(event) => setSortOrder(event.target.value)}
                                    placeholder="0"
                                    className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none focus:border-red-500 focus:ring-4 focus:ring-red-500/10"
                                />
                            </div>

                            <div>
                                <label className="text-sm font-medium text-zinc-700">
                                    Status
                                </label>

                                <button
                                    type="button"
                                    onClick={() => setIsActive((current) => !current)}
                                    className={`mt-2 w-full rounded-xl px-4 py-3 text-sm font-bold transition ${isActive
                                            ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                            : 'bg-zinc-200 text-zinc-700 hover:bg-zinc-300'
                                        }`}
                                >
                                    {isActive ? 'Ativo no site' : 'Inativo'}
                                </button>
                            </div>

                            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 md:col-span-2">
                                <label className="text-sm font-bold text-zinc-800">
                                    Imagem da categoria
                                </label>

                                <p className="mt-1 text-xs text-zinc-500">
                                    Recomendado: imagem horizontal, como 800x500 ou similar.
                                </p>

                                <label className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-zinc-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800">
                                    <Upload size={18} />
                                    Enviar imagem
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(event) => {
                                            const file = event.target.files?.[0]
                                            event.target.value = ''

                                            if (file) setImageFile(file)
                                        }}
                                    />
                                </label>

                                {(imageFile || imageUrl) && (
                                    <div className="mt-4 overflow-hidden rounded-xl border border-zinc-200 bg-white">
                                        <img
                                            src={imageFile ? URL.createObjectURL(imageFile) : imageUrl}
                                            alt="Prévia da categoria"
                                            className="h-64 w-full object-cover"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        <button
                            onClick={handleSaveBlock}
                            disabled={loading}
                            className="mt-6 rounded-xl bg-zinc-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50"
                        >
                            {loading
                                ? 'Salvando...'
                                : editingId
                                    ? 'Salvar edição'
                                    : 'Salvar categoria'}
                        </button>
                    </div>
                )}

                <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                    {blocks.map((block) => (
                        <div
                            key={block.id}
                            className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-xl shadow-zinc-200/50"
                        >
                            <div className="relative h-56 bg-zinc-100">
                                <img
                                    src={block.image_url}
                                    alt={block.title}
                                    className="h-full w-full object-cover"
                                />

                                <span
                                    className={`absolute left-4 top-4 rounded-full px-3 py-1 text-xs font-bold ${block.is_active
                                            ? 'bg-emerald-50 text-emerald-700'
                                            : 'bg-zinc-100 text-zinc-700'
                                        }`}
                                >
                                    {block.is_active ? 'Ativo' : 'Inativo'}
                                </span>

                                <span className="absolute right-4 top-4 rounded-full bg-white px-3 py-1 text-xs font-bold text-zinc-700">
                                    Ordem {block.sort_order}
                                </span>
                            </div>

                            <div className="p-5">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <h3 className="text-xl font-black text-zinc-950">
                                            {block.title}
                                        </h3>

                                        <p className="mt-2 text-sm text-zinc-500">
                                            Categoria vinculada: {block.vehicle_categories?.name || '-'}
                                        </p>

                                        <p className="mt-3 text-sm font-semibold text-red-600">
                                            Link no site: /estoque?categoria=
                                            {encodeURIComponent(block.vehicle_categories?.name || '')}
                                        </p>
                                    </div>

                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleEditBlock(block)}
                                            className="rounded-xl bg-zinc-100 p-2 text-zinc-700 transition hover:bg-zinc-200"
                                            title="Editar"
                                        >
                                            <Pencil size={18} />
                                        </button>

                                        <button
                                            onClick={() => setDeleteBlock(block)}
                                            className="rounded-xl bg-red-50 p-2 text-red-600 transition hover:bg-red-100"
                                            title="Excluir"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>

                                <div className="mt-4 flex items-center gap-2 rounded-xl bg-zinc-50 px-3 py-2 text-xs font-semibold text-zinc-500">
                                    <ImageIcon size={16} />
                                    Card de categoria da home
                                </div>
                            </div>
                        </div>
                    ))}

                    {blocks.length === 0 && (
                        <div className="rounded-3xl border border-zinc-200 bg-white p-10 text-center text-zinc-500 shadow-xl shadow-zinc-200/40 md:col-span-2 xl:col-span-3">
                            Nenhuma categoria da home cadastrada.
                        </div>
                    )}
                </div>
            </PageContainer>

            <ConfirmDialog
                open={!!deleteBlock}
                title="Excluir categoria da home"
                description="Deseja realmente excluir este bloco da home?"
                confirmText="Excluir categoria"
                loading={deleteLoading}
                onCancel={() => setDeleteBlock(null)}
                onConfirm={handleDeleteBlock}
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