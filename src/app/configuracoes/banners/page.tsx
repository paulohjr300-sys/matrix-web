'use client'

import { useEffect, useState } from 'react'
import { ImageIcon, Pencil, Trash2, Upload } from 'lucide-react'
import { PageContainer } from '../../components/page-container'
import { Toast } from '../../components/ui/toast'
import { ConfirmDialog } from '../../components/ui/confirm-dialog'
import { supabase } from '../../../lib/supabase'

type Banner = {
    id: string
    title: string | null
    subtitle: string | null
    button_text: string | null
    button_link: string | null
    desktop_image_url: string
    mobile_image_url: string | null
    is_active: boolean
    sort_order: number
    created_at: string
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
            const maxWidth = 1920
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

export default function BannersPage() {
    const [banners, setBanners] = useState<Banner[]>([])
    const [showForm, setShowForm] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)

    const [title, setTitle] = useState('')
    const [subtitle, setSubtitle] = useState('')
    const [buttonText, setButtonText] = useState('')
    const [buttonLink, setButtonLink] = useState('')
    const [sortOrder, setSortOrder] = useState('0')
    const [isActive, setIsActive] = useState(true)

    const [desktopImageUrl, setDesktopImageUrl] = useState('')
    const [mobileImageUrl, setMobileImageUrl] = useState('')

    const [desktopFile, setDesktopFile] = useState<File | null>(null)
    const [mobileFile, setMobileFile] = useState<File | null>(null)

    const [loading, setLoading] = useState(false)
    const [deleteBanner, setDeleteBanner] = useState<Banner | null>(null)
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
        setTitle('')
        setSubtitle('')
        setButtonText('')
        setButtonLink('')
        setSortOrder('0')
        setIsActive(true)
        setDesktopImageUrl('')
        setMobileImageUrl('')
        setDesktopFile(null)
        setMobileFile(null)
    }

    async function loadBanners() {
        const { data, error } = await supabase
            .from('site_banners')
            .select('*')
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: false })

        if (error) {
            showToast('error', 'Erro', 'Não foi possível carregar os banners.')
            return
        }

        setBanners((data || []) as Banner[])
    }

    useEffect(() => {
        const fetchBanners = async () => {
            try {
                await loadBanners()
            } catch (e) {
                // handled inside loadBanners
            }
        }

        void fetchBanners()
    }, [])

    async function uploadImage(file: File) {
        const compressedFile = await compressImage(file)
        const filePath = createFilePath(compressedFile)

        const { error } = await supabase.storage
            .from('site-banners')
            .upload(filePath, compressedFile, {
                cacheControl: '3600',
                upsert: false,
            })

        if (error) {
            throw new Error(error.message)
        }

        const { data } = supabase.storage
            .from('site-banners')
            .getPublicUrl(filePath)

        return data.publicUrl
    }

    async function handleSaveBanner() {
        if (!desktopImageUrl && !desktopFile) {
            showToast('error', 'Imagem obrigatória', 'Envie a imagem desktop do banner.')
            return
        }

        setLoading(true)

        try {
            let finalDesktopImageUrl = desktopImageUrl
            let finalMobileImageUrl = mobileImageUrl

            if (desktopFile) {
                finalDesktopImageUrl = await uploadImage(desktopFile)
            }

            if (mobileFile) {
                finalMobileImageUrl = await uploadImage(mobileFile)
            }

            const bannerData = {
                title: title.trim() || null,
                subtitle: subtitle.trim() || null,
                button_text: buttonText.trim() || null,
                button_link: buttonLink.trim() || null,
                desktop_image_url: finalDesktopImageUrl,
                mobile_image_url: finalMobileImageUrl || null,
                is_active: isActive,
                sort_order: sortOrder ? Number(sortOrder) : 0,
            }

            if (editingId) {
                const { error } = await supabase
                    .from('site_banners')
                    .update(bannerData)
                    .eq('id', editingId)

                if (error) {
                    showToast('error', 'Erro ao editar banner', error.message)
                    return
                }

                showToast('success', 'Banner atualizado', 'O banner foi atualizado com sucesso.')
            } else {
                const { error } = await supabase
                    .from('site_banners')
                    .insert(bannerData)

                if (error) {
                    showToast('error', 'Erro ao cadastrar banner', error.message)
                    return
                }

                showToast('success', 'Banner cadastrado', 'O banner foi cadastrado com sucesso.')
            }

            resetForm()
            setShowForm(false)
            await loadBanners()
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

    function handleEditBanner(banner: Banner) {
        setEditingId(banner.id)
        setTitle(banner.title || '')
        setSubtitle(banner.subtitle || '')
        setButtonText(banner.button_text || '')
        setButtonLink(banner.button_link || '')
        setSortOrder(String(banner.sort_order || 0))
        setIsActive(banner.is_active)
        setDesktopImageUrl(banner.desktop_image_url)
        setMobileImageUrl(banner.mobile_image_url || '')
        setDesktopFile(null)
        setMobileFile(null)
        setShowForm(true)
    }

    async function handleDeleteBanner() {
        if (!deleteBanner) return

        setDeleteLoading(true)

        const { error } = await supabase
            .from('site_banners')
            .delete()
            .eq('id', deleteBanner.id)

        setDeleteLoading(false)

        if (error) {
            showToast('error', 'Erro', 'Não foi possível excluir o banner.')
            return
        }

        setDeleteBanner(null)
        showToast('success', 'Banner excluído', 'O banner foi removido com sucesso.')
        await loadBanners()
    }

    return (
        <>
            <PageContainer
                title="Banners do site"
                description="Gerencie os banners que aparecem na home do site público."
                action={
                    <button
                        onClick={() => {
                            setShowForm(!showForm)
                            resetForm()
                        }}
                        className="rounded-2xl bg-red-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-red-600/20 transition-all hover:-translate-y-0.5 hover:bg-red-700"
                    >
                        {showForm ? 'Fechar formulário' : '+ Novo banner'}
                    </button>
                }
            >
                {showForm && (
                    <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl shadow-zinc-200/60">
                        <h2 className="text-xl font-bold">
                            {editingId ? 'Editar banner' : 'Cadastrar novo banner'}
                        </h2>

                        <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
                            <div>
                                <label className="text-sm font-medium text-zinc-700">
                                    Título
                                </label>
                                <input
                                    value={title}
                                    onChange={(event) => setTitle(event.target.value)}
                                    placeholder="Ex: Encontre seu próximo carro"
                                    className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none focus:border-red-500 focus:ring-4 focus:ring-red-500/10"
                                />
                            </div>

                            <div>
                                <label className="text-sm font-medium text-zinc-700">
                                    Subtítulo
                                </label>
                                <input
                                    value={subtitle}
                                    onChange={(event) => setSubtitle(event.target.value)}
                                    placeholder="Ex: Veículos selecionados para você"
                                    className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none focus:border-red-500 focus:ring-4 focus:ring-red-500/10"
                                />
                            </div>

                            <div>
                                <label className="text-sm font-medium text-zinc-700">
                                    Texto do botão
                                </label>
                                <input
                                    value={buttonText}
                                    onChange={(event) => setButtonText(event.target.value)}
                                    placeholder="Ex: Ver estoque"
                                    className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none focus:border-red-500 focus:ring-4 focus:ring-red-500/10"
                                />
                            </div>

                            <div>
                                <label className="text-sm font-medium text-zinc-700">
                                    Link do botão
                                </label>
                                <input
                                    value={buttonLink}
                                    onChange={(event) => setButtonLink(event.target.value)}
                                    placeholder="Ex: /estoque"
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

                            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
                                <label className="text-sm font-bold text-zinc-800">
                                    Imagem desktop
                                </label>

                                <p className="mt-1 text-xs text-zinc-500">
                                    Recomendado: 1920x700 ou similar.
                                </p>

                                <label className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-zinc-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800">
                                    <Upload size={18} />
                                    Enviar imagem desktop
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(event) => {
                                            const file = event.target.files?.[0]
                                            event.target.value = ''

                                            if (file) setDesktopFile(file)
                                        }}
                                    />
                                </label>

                                {(desktopFile || desktopImageUrl) && (
                                    <div className="mt-4 overflow-hidden rounded-xl border border-zinc-200 bg-white">
                                        <img
                                            src={
                                                desktopFile
                                                    ? URL.createObjectURL(desktopFile)
                                                    : desktopImageUrl
                                            }
                                            alt="Prévia desktop"
                                            className="h-40 w-full object-cover"
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
                                <label className="text-sm font-bold text-zinc-800">
                                    Imagem mobile
                                </label>

                                <p className="mt-1 text-xs text-zinc-500">
                                    Opcional. Recomendado: 800x1000 ou similar.
                                </p>

                                <label className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-zinc-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800">
                                    <Upload size={18} />
                                    Enviar imagem mobile
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(event) => {
                                            const file = event.target.files?.[0]
                                            event.target.value = ''

                                            if (file) setMobileFile(file)
                                        }}
                                    />
                                </label>

                                {(mobileFile || mobileImageUrl) && (
                                    <div className="mt-4 overflow-hidden rounded-xl border border-zinc-200 bg-white">
                                        <img
                                            src={
                                                mobileFile
                                                    ? URL.createObjectURL(mobileFile)
                                                    : mobileImageUrl
                                            }
                                            alt="Prévia mobile"
                                            className="h-40 w-full object-cover"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        <button
                            onClick={handleSaveBanner}
                            disabled={loading}
                            className="mt-6 rounded-xl bg-zinc-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50"
                        >
                            {loading ? 'Salvando...' : editingId ? 'Salvar edição' : 'Salvar banner'}
                        </button>
                    </div>
                )}

                <div className="mt-8 grid grid-cols-1 gap-5 xl:grid-cols-2">
                    {banners.map((banner) => (
                        <div
                            key={banner.id}
                            className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-xl shadow-zinc-200/50"
                        >
                            <div className="relative h-64 bg-zinc-100">
                                <img
                                    src={banner.desktop_image_url}
                                    alt={banner.title || 'Banner'}
                                    className="h-full w-full object-cover"
                                />

                                <span
                                    className={`absolute left-4 top-4 rounded-full px-3 py-1 text-xs font-bold ${banner.is_active
                                            ? 'bg-emerald-50 text-emerald-700'
                                            : 'bg-zinc-100 text-zinc-700'
                                        }`}
                                >
                                    {banner.is_active ? 'Ativo' : 'Inativo'}
                                </span>

                                <span className="absolute right-4 top-4 rounded-full bg-white px-3 py-1 text-xs font-bold text-zinc-700">
                                    Ordem {banner.sort_order}
                                </span>
                            </div>

                            <div className="p-5">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <h3 className="text-xl font-black text-zinc-950">
                                            {banner.title || 'Sem título'}
                                        </h3>

                                        <p className="mt-2 text-sm text-zinc-500">
                                            {banner.subtitle || 'Sem subtítulo'}
                                        </p>

                                        {(banner.button_text || banner.button_link) && (
                                            <p className="mt-3 text-sm font-semibold text-red-600">
                                                {banner.button_text || 'Botão'} → {banner.button_link || '-'}
                                            </p>
                                        )}
                                    </div>

                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleEditBanner(banner)}
                                            className="rounded-xl bg-zinc-100 p-2 text-zinc-700 transition hover:bg-zinc-200"
                                            title="Editar"
                                        >
                                            <Pencil size={18} />
                                        </button>

                                        <button
                                            onClick={() => setDeleteBanner(banner)}
                                            className="rounded-xl bg-red-50 p-2 text-red-600 transition hover:bg-red-100"
                                            title="Excluir"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>

                                {banner.mobile_image_url && (
                                    <div className="mt-4 flex items-center gap-2 rounded-xl bg-zinc-50 px-3 py-2 text-xs font-semibold text-zinc-500">
                                        <ImageIcon size={16} />
                                        Possui imagem mobile
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}

                    {banners.length === 0 && (
                        <div className="rounded-3xl border border-zinc-200 bg-white p-10 text-center text-zinc-500 shadow-xl shadow-zinc-200/40 xl:col-span-2">
                            Nenhum banner cadastrado.
                        </div>
                    )}
                </div>
            </PageContainer>

            <ConfirmDialog
                open={!!deleteBanner}
                title="Excluir banner"
                description="Deseja realmente excluir este banner?"
                confirmText="Excluir banner"
                loading={deleteLoading}
                onCancel={() => setDeleteBanner(null)}
                onConfirm={handleDeleteBanner}
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