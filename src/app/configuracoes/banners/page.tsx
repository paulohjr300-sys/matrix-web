/* eslint-disable react-hooks/set-state-in-effect */
'use client'

import { useEffect, useMemo, useState } from 'react'
import { ImageIcon, Pencil, Trash2, Upload } from 'lucide-react'
import { PageContainer } from '../../components/page-container'
import { Toast } from '../../components/ui/toast'
import { ConfirmDialog } from '../../components/ui/confirm-dialog'
import { supabase } from '../../../lib/supabase'
import { tenantFilePath } from '../../../lib/tenant'

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
    overlay_enabled: boolean | null
    overlay_from: number | null
    overlay_middle: number | null
    overlay_to: number | null
}

function createFilePath(file: File) {
    const safeName = file.name
        .toLowerCase()
        .replace(/\s/g, '-')
        .replace(/[^a-z0-9.-]/g, '')

    return tenantFilePath(`${Date.now()}-${safeName}`)
}

function clampOverlayValue(value: string) {
    const number = Number(value || 0)

    if (Number.isNaN(number)) return '0'
    if (number < 0) return '0'
    if (number > 100) return '100'

    return String(number)
}

function getOverlayStyle(
    overlayEnabled: boolean,
    overlayFrom: string | number,
    overlayMiddle: string | number,
    overlayTo: string | number
) {
    if (!overlayEnabled) return undefined

    const from = Number(overlayFrom || 0) / 100
    const middle = Number(overlayMiddle || 0) / 100
    const to = Number(overlayTo || 0) / 100

    return {
        background: `linear-gradient(to right, rgba(0,0,0,${from}), rgba(0,0,0,${middle}), rgba(0,0,0,${to}))`,
    }
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

    const [overlayEnabled, setOverlayEnabled] = useState(true)
    const [overlayFrom, setOverlayFrom] = useState('10')
    const [overlayMiddle, setOverlayMiddle] = useState('10')
    const [overlayTo, setOverlayTo] = useState('5')

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

    const desktopPreviewUrl = useMemo(() => {
        if (desktopFile) return URL.createObjectURL(desktopFile)
        return desktopImageUrl
    }, [desktopFile, desktopImageUrl])

    const mobilePreviewUrl = useMemo(() => {
        if (mobileFile) return URL.createObjectURL(mobileFile)
        if (mobileImageUrl) return mobileImageUrl
        if (desktopFile) return URL.createObjectURL(desktopFile)
        return desktopImageUrl
    }, [mobileFile, mobileImageUrl, desktopFile, desktopImageUrl])

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
        setOverlayEnabled(true)
        setOverlayFrom('10')
        setOverlayMiddle('10')
        setOverlayTo('5')
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
        void loadBanners()
    }, [])

    async function uploadImage(file: File) {
        const compressedFile = await compressImage(file)
        const filePath = await createFilePath(compressedFile)

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
                overlay_enabled: overlayEnabled,
                overlay_from: Number(overlayFrom || 0),
                overlay_middle: Number(overlayMiddle || 0),
                overlay_to: Number(overlayTo || 0),
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
        setOverlayEnabled(banner.overlay_enabled ?? true)
        setOverlayFrom(String(banner.overlay_from ?? 10))
        setOverlayMiddle(String(banner.overlay_middle ?? 10))
        setOverlayTo(String(banner.overlay_to ?? 5))
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
                        className="rounded-2xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-600/20 transition-all hover:-translate-y-0.5 hover:bg-brand-700"
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
                                    className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
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
                                    className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
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
                                    className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
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
                                    className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
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
                                    className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
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
                                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                                    <div>
                                        <label className="text-sm font-bold text-zinc-800">
                                            Sombreamento do banner
                                        </label>
                                        <p className="mt-1 text-xs text-zinc-500">
                                            Controla a sombra sobre a imagem para melhorar a leitura do texto no site.
                                        </p>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => setOverlayEnabled((current) => !current)}
                                        className={`rounded-xl px-4 py-3 text-sm font-bold transition ${overlayEnabled
                                            ? 'bg-zinc-950 text-white hover:bg-zinc-800'
                                            : 'bg-zinc-200 text-zinc-700 hover:bg-zinc-300'
                                            }`}
                                    >
                                        {overlayEnabled ? 'Sombra ativada' : 'Sombra desativada'}
                                    </button>
                                </div>

                                <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
                                    <OverlayControl
                                        label="Esquerda"
                                        value={overlayFrom}
                                        disabled={!overlayEnabled}
                                        onChange={setOverlayFrom}
                                    />

                                    <OverlayControl
                                        label="Meio"
                                        value={overlayMiddle}
                                        disabled={!overlayEnabled}
                                        onChange={setOverlayMiddle}
                                    />

                                    <OverlayControl
                                        label="Direita"
                                        value={overlayTo}
                                        disabled={!overlayEnabled}
                                        onChange={setOverlayTo}
                                    />
                                </div>
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
                                            src={desktopFile ? URL.createObjectURL(desktopFile) : desktopImageUrl}
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
                                            src={mobileFile ? URL.createObjectURL(mobileFile) : mobileImageUrl}
                                            alt="Prévia mobile"
                                            className="h-40 w-full object-cover"
                                        />
                                    </div>
                                )}
                            </div>

                            <BannerPreview
                                title={title}
                                subtitle={subtitle}
                                buttonText={buttonText}
                                desktopPreviewUrl={desktopPreviewUrl}
                                mobilePreviewUrl={mobilePreviewUrl}
                                overlayEnabled={overlayEnabled}
                                overlayFrom={overlayFrom}
                                overlayMiddle={overlayMiddle}
                                overlayTo={overlayTo}
                            />
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

                                {banner.overlay_enabled !== false && (
                                    <div
                                        className="absolute inset-0"
                                        style={getOverlayStyle(
                                            banner.overlay_enabled ?? true,
                                            banner.overlay_from ?? 10,
                                            banner.overlay_middle ?? 10,
                                            banner.overlay_to ?? 5
                                        )}
                                    />
                                )}

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
                                            <p className="mt-3 text-sm font-semibold text-brand-600">
                                                {banner.button_text || 'Botão'} → {banner.button_link || '-'}
                                            </p>
                                        )}

                                        <p className="mt-3 text-xs font-semibold text-zinc-500">
                                            Sombra: {banner.overlay_enabled === false
                                                ? 'desativada'
                                                : `${banner.overlay_from ?? 10}% / ${banner.overlay_middle ?? 10}% / ${banner.overlay_to ?? 5}%`}
                                        </p>
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

function OverlayControl({
    label,
    value,
    disabled,
    onChange,
}: {
    label: string
    value: string
    disabled: boolean
    onChange: (value: string) => void
}) {
    return (
        <div>
            <label className="text-xs font-bold uppercase tracking-wide text-zinc-500">
                {label}
            </label>

            <div className="mt-2 flex items-center gap-3">
                <input
                    type="range"
                    min="0"
                    max="100"
                    value={value}
                    onChange={(event) => onChange(clampOverlayValue(event.target.value))}
                    disabled={disabled}
                    className="w-full"
                />

                <input
                    type="number"
                    min="0"
                    max="100"
                    value={value}
                    onChange={(event) => onChange(clampOverlayValue(event.target.value))}
                    disabled={disabled}
                    className="w-20 rounded-xl border border-zinc-200 px-3 py-2 text-sm outline-none disabled:bg-zinc-100"
                />
            </div>
        </div>
    )
}

function BannerPreview({
    title,
    subtitle,
    buttonText,
    desktopPreviewUrl,
    mobilePreviewUrl,
    overlayEnabled,
    overlayFrom,
    overlayMiddle,
    overlayTo,
}: {
    title: string
    subtitle: string
    buttonText: string
    desktopPreviewUrl: string
    mobilePreviewUrl: string
    overlayEnabled: boolean
    overlayFrom: string
    overlayMiddle: string
    overlayTo: string
}) {
    const overlayStyle = getOverlayStyle(
        overlayEnabled,
        overlayFrom,
        overlayMiddle,
        overlayTo
    )

    return (
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 md:col-span-2">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                <div>
                    <h3 className="text-lg font-black text-zinc-950">Prévia do banner</h3>
                    <p className="mt-1 text-sm text-zinc-500">
                        Veja como o texto ficará sobre a imagem no desktop e no celular.
                    </p>
                </div>

                <span className="rounded-full bg-zinc-950 px-3 py-1 text-xs font-bold text-white">
                    Sombra {overlayEnabled ? `${overlayFrom}% / ${overlayMiddle}% / ${overlayTo}%` : 'desativada'}
                </span>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[1fr_320px]">
                <div>
                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-zinc-500">
                        Desktop
                    </p>

                    <div className="relative h-72 overflow-hidden rounded-3xl bg-zinc-950">
                        {desktopPreviewUrl ? (
                            <img
                                src={desktopPreviewUrl}
                                alt="Prévia desktop do banner"
                                className="h-full w-full object-cover"
                            />
                        ) : (
                            <div className="flex h-full w-full items-center justify-center bg-zinc-800 text-sm font-bold text-zinc-400">
                                Envie uma imagem desktop para visualizar
                            </div>
                        )}

                        {overlayEnabled && (
                            <div className="absolute inset-0" style={overlayStyle} />
                        )}

                        <div className="absolute inset-0 flex items-center p-8">
                            <div className="max-w-xl text-white">
                                <h2 className="text-4xl font-black leading-tight">
                                    {title || 'Título do banner'}
                                </h2>

                                <p className="mt-4 max-w-lg text-sm leading-6 text-zinc-200">
                                    {subtitle || 'Prévia da descrição do banner no site público.'}
                                </p>

                                {buttonText && (
                                    <span className="mt-5 inline-flex h-11 items-center rounded-xl bg-brand-600 px-5 text-xs font-black uppercase tracking-wide text-white">
                                        {buttonText}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div>
                    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-zinc-500">
                        Mobile
                    </p>

                    <div className="relative mx-auto h-[420px] max-w-[260px] overflow-hidden rounded-[2rem] bg-zinc-950 shadow-xl">
                        {mobilePreviewUrl ? (
                            <img
                                src={mobilePreviewUrl}
                                alt="Prévia mobile do banner"
                                className="h-full w-full object-cover"
                            />
                        ) : (
                            <div className="flex h-full w-full items-center justify-center px-6 text-center text-sm font-bold text-zinc-400">
                                Envie uma imagem para visualizar
                            </div>
                        )}

                        {overlayEnabled && (
                            <div className="absolute inset-0" style={overlayStyle} />
                        )}

                        <div className="absolute inset-0 flex items-center p-6">
                            <div className="text-white">
                                <h2 className="text-3xl font-black leading-tight">
                                    {title || 'Título do banner'}
                                </h2>

                                <p className="mt-4 text-sm leading-6 text-zinc-200">
                                    {subtitle || 'Prévia da descrição no celular.'}
                                </p>

                                {buttonText && (
                                    <span className="mt-5 inline-flex h-11 items-center rounded-xl bg-brand-600 px-5 text-xs font-black uppercase tracking-wide text-white">
                                        {buttonText}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
