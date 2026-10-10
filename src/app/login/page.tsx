'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { PainelLogo } from '../components/brand/painel-logo'

export default function LoginPage() {
    const router = useRouter()

    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState('')
    const [messageType, setMessageType] = useState<'success' | 'error'>('error')

    async function handleLogin() {
        setMessage('')

        if (!email || !password) {
            setMessageType('error')
            setMessage('Informe e-mail e senha.')
            return
        }

        setLoading(true)


        const { data: loginData, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        })

        if (error || !loginData.user) {
            setLoading(false)
            setMessageType('error')
            setMessage('E-mail ou senha inválidos.')
            return
        }

        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('role, must_change_password, is_active')
            .eq('id', loginData.user.id)
            .single()


        setLoading(false)



        if (profileError || !profile) {
            setMessageType('error')
            setMessage('Não foi possível carregar seu perfil.')
            return
        }

        if (profile.is_active === false) {
            await supabase.auth.signOut()
            setMessageType('error')
            setMessage('Usuário desativado. Procure o administrador.')
            return
        }

        localStorage.setItem('painel_role', profile.role)

        if (profile.must_change_password) {
            router.push('/alterar-senha')
            return
        }

        router.push('/dashboard')
    }

    async function handleForgotPassword() {
        setMessage('')

        if (!email) {
            setMessageType('error')
            setMessage('Informe seu e-mail para recuperar a senha.')
            return
        }

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/reset-password`,
        })

        if (error) {
            setMessageType('error')
            setMessage('Não foi possível enviar o e-mail de recuperação.')
            return
        }

        setMessageType('success')
        setMessage('Enviamos um link de recuperação para seu e-mail.')
    }

    return (
        <main className="flex min-h-screen items-center justify-center bg-brand-900 p-6">
            <div className="w-full max-w-md rounded-3xl border border-brand-800 bg-white p-8 shadow-2xl">
                <div className="mb-8 text-center">
                    <h1 className="flex justify-center">
                        <PainelLogo size="lg" />
                    </h1>
                    <p className="mt-2 text-sm text-zinc-500">
                        Acesse sua conta para continuar.
                    </p>
                </div>

                {message && (
                    <div
                        className={`mb-5 rounded-2xl p-4 text-sm font-medium ${messageType === 'success'
                                ? 'bg-green-50 text-green-700 border border-green-200'
                                : 'bg-red-50 text-red-700 border border-red-200'
                            }`}
                    >
                        {message}
                    </div>
                )}

                <form
                    className="space-y-5"
                    onSubmit={(event) => {
                        event.preventDefault()
                        void handleLogin()
                    }}
                >
                    <div>
                        <label className="text-sm font-medium text-zinc-700">E-mail</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            placeholder="usuario@email.com"
                            className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none transition-all focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
                        />
                    </div>

                    <div>
                        <label className="text-sm font-medium text-zinc-700">Senha</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            placeholder="Sua senha"
                            className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none transition-all focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
                    >
                        {loading ? 'Entrando...' : 'Entrar'}
                    </button>

                    <button
                        type="button"
                        onClick={handleForgotPassword}
                        className="w-full text-sm font-semibold text-brand-600 hover:text-brand-700"
                    >
                        Esqueci minha senha
                    </button>
                </form>
            </div>
        </main>
    )
}