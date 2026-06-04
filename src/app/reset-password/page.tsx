'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'

export default function ResetPasswordPage() {
    const router = useRouter()

    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [message, setMessage] = useState('')
    const [loading, setLoading] = useState(false)

    async function handleUpdatePassword() {
        setMessage('')

        if (!password || !confirmPassword) {
            setMessage('Informe e confirme a nova senha.')
            return
        }

        if (password !== confirmPassword) {
            setMessage('As senhas não conferem.')
            return
        }

        setLoading(true)

        const { error } = await supabase.auth.updateUser({
            password,
        })

        setLoading(false)

        if (error) {
            setMessage('Não foi possível alterar a senha.')
            return
        }

        router.push('/login')
    }

    return (
        <main className="flex min-h-screen items-center justify-center bg-zinc-950 p-6">
            <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl">
                <h1 className="text-3xl font-black text-zinc-950">Nova senha</h1>
                <p className="mt-2 text-sm text-zinc-500">
                    Digite sua nova senha de acesso.
                </p>

                {message && (
                    <div className="mt-5 rounded-2xl bg-red-50 p-4 text-sm font-medium text-red-700">
                        {message}
                    </div>
                )}

                <div className="mt-6 space-y-5">
                    <input
                        type="password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="Nova senha"
                        className="w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none focus:border-red-500 focus:ring-4 focus:ring-red-500/10"
                    />

                    <input
                        type="password"
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        placeholder="Confirmar senha"
                        className="w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none focus:border-red-500 focus:ring-4 focus:ring-red-500/10"
                    />

                    <button
                        onClick={handleUpdatePassword}
                        disabled={loading}
                        className="w-full rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                    >
                        {loading ? 'Salvando...' : 'Salvar nova senha'}
                    </button>
                </div>
            </div>
        </main>
    )
}