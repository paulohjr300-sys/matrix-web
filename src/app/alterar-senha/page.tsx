'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

export default function AlterarSenhaPage() {
    const router = useRouter()

    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [message, setMessage] = useState('')

    async function handleChangePassword() {
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

        const { data: userData, error: userError } = await supabase.auth.getUser()

        if (userError || !userData.user) {
            setLoading(false)
            setMessage('Sessão inválida. Faça login novamente.')
            router.push('/')
            return
        }

        const { error: updateError } = await supabase.auth.updateUser({
            password,
        })

        if (updateError) {
            setLoading(false)
            setMessage('Não foi possível alterar a senha.')
            return
        }

        const { error: profileError } = await supabase
            .from('profiles')
            .update({
                must_change_password: false,
            })
            .eq('id', userData.user.id)

        setLoading(false)

        if (profileError) {
            setMessage('Senha alterada, mas não foi possível atualizar o perfil.')
            return
        }

        router.push('/dashboard')
    }

    return (
        <main className="flex min-h-screen items-center justify-center bg-brand-900 p-6">
            <div className="w-full max-w-md rounded-3xl border border-zinc-800 bg-white p-8 shadow-2xl">
                <div className="mb-8 text-center">
                    <h1 className="text-3xl font-black tracking-widest text-zinc-950">
                        ALTERAR SENHA
                    </h1>
                    <p className="mt-2 text-sm text-zinc-500">
                        Para continuar usando o sistema, crie uma nova senha.
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
                            className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none transition-all focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
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
                            className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none transition-all focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
                        />
                    </div>

                    <button
                        onClick={handleChangePassword}
                        disabled={loading}
                        className="w-full rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
                    >
                        {loading ? 'Salvando...' : 'Salvar nova senha'}
                    </button>
                </div>
            </div>
        </main>
    )
}