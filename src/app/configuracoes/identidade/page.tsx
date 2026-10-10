'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check, ImageIcon, MessageCircle, Phone, Trash2, Upload } from 'lucide-react'

import { PageContainer } from '../../components/page-container'
import { RouteGuard } from '../../components/auth/route-guard'
import { Toast } from '../../components/ui/toast'
import { supabase } from '../../../lib/supabase'
import { getEmpresaId, tenantFilePath } from '../../../lib/tenant'

type Identidade = {
    nome: string
    logo_url: string
    favicon_url: string
    cor_primaria: string
    cor_escura: string
    slogan: string
    telefone: string
    whatsapp: string
    email: string
    endereco: string
    cep: string
    horario_atendimento: string
    instagram: string
    facebook: string
    site_titulo: string
    site_descricao: string
}

const EMPTY: Identidade = {
    nome: '',
    logo_url: '',
    favicon_url: '',
    cor_primaria: '#185FA5',
    cor_escura: '#042C53',
    slogan: '',
    telefone: '',
    whatsapp: '',
    email: '',
    endereco: '',
    cep: '',
    horario_atendimento: '',
    instagram: '',
    facebook: '',
    site_titulo: '',
    site_descricao: '',
}

const PALETAS = [
    { nome: 'Azul painel', primaria: '#185FA5', escura: '#042C53' },
    { nome: 'Vermelho', primaria: '#DC2626', escura: '#18181B' },
    { nome: 'Verde', primaria: '#15803D', escura: '#0F2A1D' },
    { nome: 'Laranja', primaria: '#EA580C', escura: '#1C1917' },
    { nome: 'Roxo', primaria: '#7C3AED', escura: '#1E1338' },
    { nome: 'Grafite', primaria: '#3F3F46', escura: '#09090B' },
    { nome: 'Dourado', primaria: '#B7892F', escura: '#1A1A1A' },
    { nome: 'Azul-petróleo', primaria: '#0E7490', escura: '#082F3A' },
]

const HEX_COLOR = /^#[0-9a-f]{6}$/i
type ImageField = 'logo_url' | 'favicon_url'

const IMAGE_RULES: Record<
    ImageField,
    { label: string; prefix: string; types: string[]; formats: string; maxSize: number; maxSizeLabel: string }
> = {
    logo_url: {
        label: 'logo',
        prefix: 'logo',
        types: ['image/png', 'image/jpeg', 'image/webp'],
        formats: 'PNG, JPG ou WEBP',
        maxSize: 2 * 1024 * 1024,
        maxSizeLabel: '2 MB',
    },
    favicon_url: {
        label: 'ícone',
        prefix: 'favicon',
        types: ['image/png', 'image/x-icon', 'image/vnd.microsoft.icon', 'image/webp'],
        formats: 'PNG, ICO ou WEBP',
        maxSize: 512 * 1024,
        maxSizeLabel: '512 KB',
    },
}

const inputClass =
    'mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none transition-all focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10'

function toForm(data: Partial<Record<keyof Identidade, string | null>>): Identidade {
    const form = { ...EMPTY }

    for (const key of Object.keys(EMPTY) as (keyof Identidade)[]) {
        form[key] = data[key] ?? EMPTY[key]
    }

    return form
}

export default function IdentidadePage() {
    const [form, setForm] = useState<Identidade>(EMPTY)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [uploading, setUploading] = useState<ImageField | null>(null)

    const [toast, setToast] = useState({
        open: false,
        type: 'success' as 'success' | 'error',
        title: '',
        description: '',
    })

    function showToast(type: 'success' | 'error', title: string, description?: string) {
        setToast({ open: true, type, title, description: description || '' })

        setTimeout(() => {
            setToast((current) => ({ ...current, open: false }))
        }, 3000)
    }

    function setField(field: keyof Identidade, value: string) {
        setForm((current) => ({ ...current, [field]: value }))
    }

    useEffect(() => {
        async function loadIdentidade() {
            try {
                const empresaId = await getEmpresaId()

                const { data, error } = await supabase
                    .from('empresas')
                    .select(Object.keys(EMPTY).join(', '))
                    .eq('id', empresaId)
                    .single()

                if (error || !data) throw error

                setForm(toForm(data as unknown as Record<keyof Identidade, string | null>))
            } catch {
                showToast('error', 'Erro', 'Não foi possível carregar a identidade da loja.')
            } finally {
                setLoading(false)
            }
        }

        void loadIdentidade()
    }, [])

    async function handleImageUpload(field: ImageField, file: File) {
        const rules = IMAGE_RULES[field]

        if (!rules.types.includes(file.type)) {
            showToast('error', 'Formato inválido', `Envie o ${rules.label} em ${rules.formats}.`)
            return
        }

        if (file.size > rules.maxSize) {
            showToast('error', 'Arquivo grande', `O ${rules.label} deve ter no máximo ${rules.maxSizeLabel}.`)
            return
        }

        setUploading(field)

        try {
            const extension = file.name.split('.').pop()?.toLowerCase() || 'png'
            const filePath = await tenantFilePath(`${rules.prefix}-${Date.now()}.${extension}`)

            const { error } = await supabase.storage
                .from('site-banners')
                .upload(filePath, file, { cacheControl: '3600', upsert: false, contentType: file.type })

            if (error) throw error

            const { data } = supabase.storage.from('site-banners').getPublicUrl(filePath)

            setField(field, data.publicUrl)
            showToast('success', 'Imagem enviada', 'Clique em "Salvar" para publicar no site.')
        } catch {
            showToast('error', 'Erro', `Não foi possível enviar o ${rules.label}.`)
        } finally {
            setUploading(null)
        }
    }

    async function handleSave() {
        if (!form.nome.trim()) {
            showToast('error', 'Campo obrigatório', 'Informe o nome da loja.')
            return
        }

        if (!HEX_COLOR.test(form.cor_primaria) || !HEX_COLOR.test(form.cor_escura)) {
            showToast('error', 'Cor inválida', 'Use o formato #RRGGBB, por exemplo #185FA5.')
            return
        }

        setSaving(true)

        try {
            const empresaId = await getEmpresaId()

            const payload = Object.fromEntries(
                Object.entries(form).map(([key, value]) => [key, value.trim() || null])
            )

            const { error } = await supabase
                .from('empresas')
                .update({
                    ...payload,
                    nome: form.nome.trim(),
                    cor_primaria: form.cor_primaria.toUpperCase(),
                    cor_escura: form.cor_escura.toUpperCase(),
                    whatsapp: form.whatsapp.replace(/\D/g, '') || null,
                })
                .eq('id', empresaId)

            if (error) throw error

            showToast('success', 'Salvo', 'O site já está usando a nova identidade.')
        } catch {
            showToast('error', 'Erro', 'Não foi possível salvar. Tente novamente.')
        } finally {
            setSaving(false)
        }
    }

    return (
        <RouteGuard allowedRoles={['ADMIN']}>
            <Toast
                open={toast.open}
                type={toast.type}
                title={toast.title}
                description={toast.description}
                onClose={() => setToast((current) => ({ ...current, open: false }))}
            />

            <PageContainer
                title="Identidade do site"
                description="Nome, logo, cores, contatos e textos do site da loja."
                action={
                    <button
                        type="button"
                        onClick={() => void handleSave()}
                        disabled={saving || loading || uploading !== null}
                        className="rounded-2xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-600/20 transition-all hover:-translate-y-0.5 hover:bg-brand-700 disabled:opacity-50"
                    >
                        {saving ? 'Salvando...' : 'Salvar'}
                    </button>
                }
            >
                <Link
                    href="/configuracoes"
                    className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-zinc-500 transition hover:text-brand-600"
                >
                    <ArrowLeft size={16} />
                    Voltar para configurações
                </Link>

                {loading ? (
                    <p className="text-sm text-zinc-500">Carregando...</p>
                ) : (
                    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_420px]">
                        <div className="space-y-6">
                            <Section title="Marca">
                                <Field label="Nome da loja *">
                                    <input
                                        value={form.nome}
                                        onChange={(e) => setField('nome', e.target.value)}
                                        placeholder="Ex: Auto Center Silva"
                                        className={inputClass}
                                    />
                                </Field>

                                <Field label="Slogan (aparece no rodapé)">
                                    <input
                                        value={form.slogan}
                                        onChange={(e) => setField('slogan', e.target.value)}
                                        placeholder="Ex: Seminovos com procedência desde 2005."
                                        className={inputClass}
                                    />
                                </Field>

                                <ImageUpload
                                    label="Logo"
                                    field="logo_url"
                                    value={form.logo_url}
                                    uploading={uploading}
                                    previewClassName="h-20 w-48"
                                    hint="PNG, JPG ou WEBP até 2 MB. Prefira fundo transparente e versão clara, porque o cabeçalho do site usa a cor escura. Sem logo, o site mostra o nome da loja."
                                    onUpload={handleImageUpload}
                                    onRemove={() => setField('logo_url', '')}
                                />

                                <ImageUpload
                                    label="Ícone da aba do navegador (favicon)"
                                    field="favicon_url"
                                    value={form.favicon_url}
                                    uploading={uploading}
                                    previewClassName="h-20 w-20"
                                    hint="Imagem quadrada, de preferência PNG 512×512 px, até 512 KB. Aparece na aba do navegador e nos favoritos. Sem ícone, o site usa o logo."
                                    onUpload={handleImageUpload}
                                    onRemove={() => setField('favicon_url', '')}
                                />
                            </Section>

                            <Section title="Cores">
                                <div>
                                    <span className="text-sm font-medium text-zinc-700">Paletas prontas</span>

                                    <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
                                        {PALETAS.map((paleta) => {
                                            const selected =
                                                paleta.primaria.toLowerCase() === form.cor_primaria.toLowerCase() &&
                                                paleta.escura.toLowerCase() === form.cor_escura.toLowerCase()

                                            return (
                                                <button
                                                    key={paleta.nome}
                                                    type="button"
                                                    onClick={() =>
                                                        setForm((current) => ({
                                                            ...current,
                                                            cor_primaria: paleta.primaria,
                                                            cor_escura: paleta.escura,
                                                        }))
                                                    }
                                                    className={`flex items-center gap-3 rounded-2xl border p-3 text-left text-sm font-semibold transition ${selected
                                                        ? 'border-brand-500 ring-4 ring-brand-500/10'
                                                        : 'border-zinc-200 hover:border-zinc-300'
                                                        }`}
                                                >
                                                    <span className="flex overflow-hidden rounded-lg">
                                                        <span className="h-8 w-5" style={{ background: paleta.escura }} />
                                                        <span className="h-8 w-5" style={{ background: paleta.primaria }} />
                                                    </span>
                                                    <span className="flex-1">{paleta.nome}</span>
                                                    {selected && <Check size={16} className="text-brand-600" />}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <ColorField
                                        label="Cor principal (botões e destaques)"
                                        value={form.cor_primaria}
                                        onChange={(value) => setField('cor_primaria', value)}
                                    />
                                    <ColorField
                                        label="Cor escura (cabeçalho e rodapé)"
                                        value={form.cor_escura}
                                        onChange={(value) => setField('cor_escura', value)}
                                    />
                                </div>
                            </Section>

                            <Section title="Contato">
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <Field label="WhatsApp (com DDD)">
                                        <input
                                            value={form.whatsapp}
                                            onChange={(e) => setField('whatsapp', e.target.value)}
                                            placeholder="Ex: 5527999999999"
                                            className={inputClass}
                                        />
                                    </Field>
                                    <Field label="Telefone">
                                        <input
                                            value={form.telefone}
                                            onChange={(e) => setField('telefone', e.target.value)}
                                            placeholder="Ex: (27) 3333-4444"
                                            className={inputClass}
                                        />
                                    </Field>
                                    <Field label="E-mail">
                                        <input
                                            type="email"
                                            value={form.email}
                                            onChange={(e) => setField('email', e.target.value)}
                                            placeholder="contato@sualoja.com.br"
                                            className={inputClass}
                                        />
                                    </Field>
                                    <Field label="Horário de atendimento">
                                        <input
                                            value={form.horario_atendimento}
                                            onChange={(e) => setField('horario_atendimento', e.target.value)}
                                            placeholder="Ex: Segunda a sábado, das 8h às 18h"
                                            className={inputClass}
                                        />
                                    </Field>
                                </div>

                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_180px]">
                                    <Field label="Endereço">
                                        <input
                                            value={form.endereco}
                                            onChange={(e) => setField('endereco', e.target.value)}
                                            placeholder="Rua, número, bairro - Cidade/UF"
                                            className={inputClass}
                                        />
                                    </Field>
                                    <Field label="CEP">
                                        <input
                                            value={form.cep}
                                            onChange={(e) =>
                                                setField(
                                                    'cep',
                                                    e.target.value.replace(/\D/g, '').slice(0, 8).replace(/^(\d{5})(\d)/, '$1-$2')
                                                )
                                            }
                                            placeholder="00000-000"
                                            inputMode="numeric"
                                            className={inputClass}
                                        />
                                    </Field>
                                </div>

                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <Field label="Instagram">
                                        <input
                                            value={form.instagram}
                                            onChange={(e) => setField('instagram', e.target.value)}
                                            placeholder="@sualoja"
                                            className={inputClass}
                                        />
                                    </Field>
                                    <Field label="Facebook">
                                        <input
                                            value={form.facebook}
                                            onChange={(e) => setField('facebook', e.target.value)}
                                            placeholder="sualoja ou link da página"
                                            className={inputClass}
                                        />
                                    </Field>
                                </div>
                            </Section>

                            <Section title="Aba do navegador e Google">
                                <Field label="Título do site (aparece na aba do navegador e no Google)">
                                    <input
                                        value={form.site_titulo}
                                        onChange={(e) => setField('site_titulo', e.target.value)}
                                        placeholder={form.nome || 'Nome da loja'}
                                        maxLength={70}
                                        className={inputClass}
                                    />
                                </Field>

                                <BrowserTabPreview
                                    title={form.site_titulo.trim() || form.nome.trim() || 'Sua loja'}
                                    icon={form.favicon_url || form.logo_url}
                                />

                                <Field label="Descrição (aparece abaixo do título no Google e ao compartilhar no WhatsApp)">
                                    <textarea
                                        value={form.site_descricao}
                                        onChange={(e) => setField('site_descricao', e.target.value)}
                                        rows={3}
                                        placeholder="Ex: Seminovos revisados em Vitória/ES, com financiamento facilitado."
                                        className={`${inputClass} resize-none`}
                                    />
                                </Field>
                            </Section>
                        </div>

                        <div className="xl:sticky xl:top-8 xl:self-start">
                            <SitePreview form={form} />
                        </div>
                    </div>
                )}
            </PageContainer>
        </RouteGuard>
    )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="space-y-5 rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl shadow-zinc-200/50">
            <h2 className="text-lg font-bold text-zinc-950">{title}</h2>
            {children}
        </section>
    )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="block">
            <span className="text-sm font-medium text-zinc-700">{label}</span>
            {children}
        </label>
    )
}

function ColorField({
    label,
    value,
    onChange,
}: {
    label: string
    value: string
    onChange: (value: string) => void
}) {
    const valid = HEX_COLOR.test(value)

    return (
        <div>
            <span className="text-sm font-medium text-zinc-700">{label}</span>

            <div className="mt-2 flex items-center gap-3">
                <input
                    type="color"
                    value={valid ? value : '#000000'}
                    onChange={(e) => onChange(e.target.value.toUpperCase())}
                    className="h-12 w-14 cursor-pointer rounded-xl border border-zinc-200 bg-white p-1"
                    aria-label={label}
                />
                <input
                    value={value}
                    onChange={(e) => onChange(e.target.value.trim())}
                    maxLength={7}
                    className={`w-full rounded-xl border px-4 py-3 font-mono uppercase outline-none transition-all focus:ring-4 ${valid
                        ? 'border-zinc-200 focus:border-brand-500 focus:ring-brand-500/10'
                        : 'border-red-300 focus:border-red-500 focus:ring-red-500/10'
                        }`}
                />
            </div>
        </div>
    )
}

// Miniatura do site com as cores e o logo escolhidos, antes de salvar.
function SitePreview({ form }: { form: Identidade }) {
    const primaria = HEX_COLOR.test(form.cor_primaria) ? form.cor_primaria : EMPTY.cor_primaria
    const escura = HEX_COLOR.test(form.cor_escura) ? form.cor_escura : EMPTY.cor_escura
    const nome = form.nome.trim() || 'Sua loja'

    return (
        <div className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-xl shadow-zinc-200/50">
            <p className="border-b border-zinc-100 px-5 py-3 text-xs font-bold uppercase tracking-wide text-zinc-500">
                Prévia do site
            </p>

            <div className="flex items-center justify-between px-5 py-4" style={{ background: escura }}>
                {form.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={form.logo_url} alt="" className="h-8 max-w-[140px] object-contain" />
                ) : (
                    <span className="truncate text-lg font-black uppercase text-white">
                        {nome}
                        <span style={{ color: primaria }}>.</span>
                    </span>
                )}

                <span
                    className="flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-black text-white"
                    style={{ background: primaria }}
                >
                    <Phone size={12} />
                    Falar agora
                </span>
            </div>

            <div className="space-y-3 bg-zinc-100 p-5">
                <p className="text-xs font-black uppercase tracking-[0.2em]" style={{ color: primaria }}>
                    Destaques
                </p>

                <div className="rounded-2xl bg-white p-4 shadow-sm">
                    <div className="h-20 rounded-xl bg-zinc-200" />
                    <p className="mt-3 text-sm font-bold text-zinc-950">Volkswagen T-Cross</p>
                    <p className="text-xs text-zinc-500">2022 · 35.000 km</p>
                    <p className="mt-2 text-lg font-black" style={{ color: primaria }}>
                        R$ 119.900
                    </p>
                    <span
                        className="mt-3 flex items-center justify-center gap-1 rounded-xl py-2 text-xs font-black text-white"
                        style={{ background: primaria }}
                    >
                        <MessageCircle size={13} />
                        Tenho interesse
                    </span>
                </div>
            </div>

            <div className="px-5 py-4 text-xs text-zinc-400" style={{ background: escura }}>
                <p className="font-bold text-white">{nome}</p>
                {form.slogan && <p className="mt-1">{form.slogan}</p>}
                {form.telefone && <p className="mt-1">{form.telefone}</p>}
            </div>
        </div>
    )
}

function ImageUpload({
    label,
    field,
    value,
    uploading,
    previewClassName,
    hint,
    onUpload,
    onRemove,
}: {
    label: string
    field: ImageField
    value: string
    uploading: ImageField | null
    previewClassName: string
    hint: string
    onUpload: (field: ImageField, file: File) => Promise<void>
    onRemove: () => void
}) {
    const isUploading = uploading === field

    return (
        <div>
            <span className="text-sm font-medium text-zinc-700">{label}</span>

            <div className="mt-2 flex flex-wrap items-center gap-4">
                <div className={`flex items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-3 ${previewClassName}`}>
                    {value ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={value} alt={label} className="max-h-full max-w-full object-contain" />
                    ) : (
                        <ImageIcon className="text-zinc-400" />
                    )}
                </div>

                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-700">
                    <Upload size={16} />
                    {isUploading ? 'Enviando...' : 'Enviar imagem'}
                    <input
                        type="file"
                        accept={IMAGE_RULES[field].types.join(',')}
                        className="hidden"
                        disabled={uploading !== null}
                        onChange={(e) => {
                            const file = e.target.files?.[0]
                            e.target.value = ''
                            if (file) void onUpload(field, file)
                        }}
                    />
                </label>

                {value && (
                    <button
                        type="button"
                        onClick={onRemove}
                        className="rounded-xl bg-red-50 p-3 text-red-600 transition hover:bg-red-100"
                        aria-label={`Remover ${label.toLowerCase()}`}
                    >
                        <Trash2 size={16} />
                    </button>
                )}
            </div>

            <p className="mt-2 text-xs text-zinc-500">{hint}</p>
        </div>
    )
}

// Como a aba do navegador vai aparecer com o título e o ícone escolhidos.
function BrowserTabPreview({ title, icon }: { title: string; icon: string }) {
    return (
        <div className="rounded-2xl bg-zinc-200 px-3 pt-2">
            <div className="flex w-full max-w-xs items-center gap-2 rounded-t-xl bg-white px-3 py-2 text-xs text-zinc-700 shadow-sm">
                {icon ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={icon} alt="" className="h-4 w-4 shrink-0 object-contain" />
                ) : (
                    <span className="h-4 w-4 shrink-0 rounded-full bg-zinc-300" />
                )}
                <span className="truncate">{title}</span>
                <span className="ml-auto text-zinc-400">×</span>
            </div>
        </div>
    )
}
