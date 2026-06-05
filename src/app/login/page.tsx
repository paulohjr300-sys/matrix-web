'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

export default function LoginPage() {
    const router = useRouter()

    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState('')

    async function handleLogin() {
        setMessage('')

        if (!email || !password) {
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
            setMessage('E-mail ou senha inválidos.')
            return
        }

        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('role, must_change_password')
            .eq('id', loginData.user.id)
            .single()

        setLoading(false)

        if (profileError || !profile) {
            setMessage('Não foi possível carregar seu perfil.')
            return
        }

        localStorage.setItem('matrix_role', profile.role)

        if (profile.must_change_password) {
            router.push('/alterar-senha')
            return
        }

        router.push('/dashboard')
    }

    async function handleForgotPassword() {
        setMessage('')

        if (!email) {
            setMessage('Informe seu e-mail para recuperar a senha.')
            return
        }

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/reset-password`,
        })

        if (error) {
            setMessage('Não foi possível enviar o e-mail de recuperação.')
            return
        }

        setMessage('Enviamos um link de recuperação para seu e-mail.')
    }

    return (
        <main className="flex min-h-screen items-center justify-center bg-zinc-950 p-6">
            <div className="w-full max-w-md rounded-3xl border border-zinc-800 bg-white p-8 shadow-2xl">
                <div className="mb-8 text-center">
                    <h1 className="text-4xl font-black tracking-widest text-zinc-950">
                        MATRIX
                    </h1>
                    <p className="mt-2 text-sm text-zinc-500">
                        Acesse sua conta para continuar.
                    </p>
                </div>

                {message && (
                    <div className="mb-5 rounded-2xl bg-red-50 p-4 text-sm font-medium text-red-700">
                        {message}
                    </div>
                )}

                <div className="space-y-5">
                    <div>
                        <label className="text-sm font-medium text-zinc-700">E-mail</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            placeholder="usuario@email.com"
                            className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none transition-all focus:border-red-500 focus:ring-4 focus:ring-red-500/10"
                        />
                    </div>

                    <div>
                        <label className="text-sm font-medium text-zinc-700">Senha</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            placeholder="Sua senha"
                            className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none transition-all focus:border-red-500 focus:ring-4 focus:ring-red-500/10"
                        />
                    </div>

                    <button
                        onClick={handleLogin}
                        disabled={loading}
                        className="w-full rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
                    >
                        {loading ? 'Entrando...' : 'Entrar'}
                    </button>

                    <button
                        onClick={handleForgotPassword}
                        className="w-full text-sm font-semibold text-red-600 hover:text-red-700"
                    >
                        Esqueci minha senha
                    </button>
                </div>
            </div>
        </main>
    )
}