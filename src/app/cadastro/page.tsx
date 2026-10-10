'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { PainelLogo } from '../components/brand/painel-logo'

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://matrix-site-peach.vercel.app').replace(/\/$/, '')

const inputClass =
    'mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none transition-all focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10'

const errorInputClass = 'border-red-300 focus:border-red-500 focus:ring-red-500/10'

// "Auto Center São José" -> "auto-center-sao-jose"
function slugify(value: string) {
    return value
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40)
        .replace(/-+$/g, '')
}

function formatPhone(value: string) {
    return value
        .replace(/\D/g, '')
        .slice(0, 11)
        .replace(/^(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{5})(\d)/, '$1-$2')
}

type Field = 'storeName' | 'slug' | 'name' | 'email' | 'password' | 'whatsapp' | 'acceptedTerms'

export default function CadastroPage() {
    const router = useRouter()

    const [storeName, setStoreName] = useState('')
    const [slug, setSlug] = useState('')
    const [slugEdited, setSlugEdited] = useState(false)
    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [whatsapp, setWhatsapp] = useState('')
    const [acceptedTerms, setAcceptedTerms] = useState(false)
    const [website, setWebsite] = useState('')

    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<{ message: string; field?: Field } | null>(null)

    function handleStoreNameChange(value: string) {
        setStoreName(value)
        if (!slugEdited) setSlug(slugify(value))
    }

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setError(null)
        setLoading(true)

        try {
            const response = await fetch('/api/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    storeName,
                    slug,
                    name,
                    email,
                    password,
                    whatsapp,
                    acceptedTerms,
                    website,
                }),
            })

            const result = await response.json().catch(() => ({}))

            if (!response.ok) {
                setError({
                    message: result.message || 'Não foi possível concluir o cadastro.',
                    field: result.field,
                })
                return
            }

            const { error: loginError } = await supabase.auth.signInWithPassword({ email, password })

            if (loginError) {
                router.push('/login')
                return
            }

            localStorage.setItem('painel_role', 'ADMIN')
            router.push('/configuracoes/identidade')
        } catch {
            setError({ message: 'Não foi possível concluir o cadastro. Tente novamente.' })
        } finally {
            setLoading(false)
        }
    }

    const fieldClass = (field: Field) =>
        `${inputClass} ${error?.field === field ? errorInputClass : ''}`

    return (
        <main className="flex min-h-screen items-center justify-center bg-brand-900 p-6">
            <div className="w-full max-w-lg rounded-3xl border border-brand-800 bg-white p-8 shadow-2xl">
                <div className="mb-8 text-center">
                    <h1 className="flex justify-center">
                        <PainelLogo size="lg" />
                    </h1>
                    <p className="mt-3 text-lg font-bold text-zinc-950">Cadastre sua loja</p>
                    <p className="mt-1 text-sm text-zinc-500">
                        Painel de gestão e site de estoque prontos em um minuto. 14 dias grátis.
                    </p>
                </div>

                {error && (
                    <div className="mb-5 rounded-2xl bg-red-50 p-4 text-sm font-medium text-red-700">
                        {error.message}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                    <fieldset className="space-y-4">
                        <legend className="text-xs font-black uppercase tracking-[0.2em] text-brand-600">
                            Sua loja
                        </legend>

                        <label className="block">
                            <span className="text-sm font-medium text-zinc-700">Nome da loja</span>
                            <input
                                value={storeName}
                                onChange={(e) => handleStoreNameChange(e.target.value)}
                                placeholder="Ex: Auto Center Silva"
                                required
                                className={fieldClass('storeName')}
                            />
                        </label>

                        <label className="block">
                            <span className="text-sm font-medium text-zinc-700">Endereço do site</span>
                            <input
                                value={slug}
                                onChange={(e) => {
                                    setSlugEdited(true)
                                    setSlug(slugify(e.target.value))
                                }}
                                placeholder="auto-center-silva"
                                required
                                className={fieldClass('slug')}
                            />
                            <span className="mt-2 block break-all text-xs text-zinc-500">
                                Seu site: <strong className="text-zinc-700">{SITE_URL}/loja/{slug || 'sua-loja'}</strong>
                                <br />
                                Depois você pode ligar um domínio próprio.
                            </span>
                        </label>

                        <label className="block">
                            <span className="text-sm font-medium text-zinc-700">WhatsApp da loja</span>
                            <input
                                value={whatsapp}
                                onChange={(e) => setWhatsapp(formatPhone(e.target.value))}
                                placeholder="(27) 99999-9999"
                                inputMode="tel"
                                className={fieldClass('whatsapp')}
                            />
                        </label>
                    </fieldset>

                    <fieldset className="space-y-4">
                        <legend className="text-xs font-black uppercase tracking-[0.2em] text-brand-600">
                            Seu acesso
                        </legend>

                        <label className="block">
                            <span className="text-sm font-medium text-zinc-700">Seu nome</span>
                            <input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                autoComplete="name"
                                required
                                className={fieldClass('name')}
                            />
                        </label>

                        <label className="block">
                            <span className="text-sm font-medium text-zinc-700">E-mail</span>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                autoComplete="email"
                                required
                                className={fieldClass('email')}
                            />
                        </label>

                        <label className="block">
                            <span className="text-sm font-medium text-zinc-700">Senha</span>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                autoComplete="new-password"
                                minLength={8}
                                required
                                className={fieldClass('password')}
                            />
                            <span className="mt-1 block text-xs text-zinc-500">Mínimo de 8 caracteres.</span>
                        </label>
                    </fieldset>

                    {/* Armadilha para robôs: invisível para pessoas. */}
                    <input
                        type="text"
                        name="website"
                        value={website}
                        onChange={(e) => setWebsite(e.target.value)}
                        tabIndex={-1}
                        autoComplete="off"
                        aria-hidden="true"
                        className="hidden"
                    />

                    <label className="flex items-start gap-3 text-sm text-zinc-600">
                        <input
                            type="checkbox"
                            checked={acceptedTerms}
                            onChange={(e) => setAcceptedTerms(e.target.checked)}
                            className="mt-0.5 h-4 w-4 accent-brand-600"
                        />
                        <span>
                            Li e aceito os termos de uso e a política de privacidade, e autorizo o
                            tratamento dos dados informados para a criação da conta.
                        </span>
                    </label>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
                    >
                        {loading ? 'Criando sua loja...' : 'Criar minha loja'}
                    </button>

                    <p className="text-center text-sm text-zinc-500">
                        Já tem conta?{' '}
                        <Link href="/login" className="font-semibold text-brand-600 hover:text-brand-700">
                            Entrar
                        </Link>
                    </p>
                </form>
            </div>
        </main>
    )
}
