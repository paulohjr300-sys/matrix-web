'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

export default function ResetPasswordPage() {
    const router = useRouter()

    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState('')

    async function handleResetPassword() {
        setMessage('')

        if (!password || !confirmPassword) {
            setMessage('Preencha a nova senha e a confirmação.')
            return
        }

        if (password.length < 6) {
            setMessage('A senha precisa ter no mínimo 6 caracteres.')
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
            setMessage('Não foi possível alterar a senha. Abra novamente o link recebido por e-mail.')
            return
        }

        setMessage('Senha alterada com sucesso.')

        setTimeout(() => {
            router.push('/login')
        }, 1200)
    }

    return (
        <main className="flex min-h-screen items-center justify-center bg-zinc-950 p-6">
            <div className="w-full max-w-md rounded-3xl border border-zinc-800 bg-white p-8 shadow-2xl">
                <div className="mb-8 text-center">
                    <h1 className="text-3xl font-black tracking-widest text-zinc-950">
                        NOVA SENHA
                    </h1>
                    <p className="mt-2 text-sm text-zinc-500">
                        Informe sua nova senha para acessar o sistema.
                    </p>
                </div>

                {message && (
                    <div className="mb-5 rounded-2xl bg-red-50 p-4 text-sm font-medium text-red-700">
                        {message}
                    </div>
                )}

                <div className="space-y-5">
                    <div>
                        <label className="text-sm font-medium text-zinc-700">
                            Nova senha
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            placeholder="Mínimo 6 caracteres"
                            className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none transition-all focus:border-red-500 focus:ring-4 focus:ring-red-500/10"
                        />
                    </div>

                    <div>
                        <label className="text-sm font-medium text-zinc-700">
                            Confirmar nova senha
                        </label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(event) => setConfirmPassword(event.target.value)}
                            placeholder="Digite novamente"
                            className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none transition-all focus:border-red-500 focus:ring-4 focus:ring-red-500/10"
                        />
                    </div>

                    <button
                        onClick={handleResetPassword}
                        disabled={loading}
                        className="w-full rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
                    >
                        {loading ? 'Salvando...' : 'Salvar nova senha'}
                    </button>
                </div>
            </div>
        </main>
    )
}