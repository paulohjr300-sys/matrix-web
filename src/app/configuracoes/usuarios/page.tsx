'use client'

import { useEffect, useState } from 'react'
import { PageContainer } from '../../components/page-container'
import { Toast } from '../../components/ui/toast'
import { supabase } from '../../../lib/supabase'
import { UserPlus } from 'lucide-react'
import { ConfirmDialog } from '../../components/ui/confirm-dialog'
import { RouteGuard } from '../../components/auth/route-guard'

type Profile = {
    id: string
    name: string
    email: string
    role: 'ADMIN' | 'GERENTE' | 'VENDEDOR'
    must_change_password?: boolean
    is_active?: boolean
}

export default function UsuariosPage() {
    const [users, setUsers] = useState<Profile[]>([])
    const [showForm, setShowForm] = useState(false)

    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [role, setRole] = useState<'ADMIN' | 'GERENTE' | 'VENDEDOR'>('VENDEDOR')

    const [resetUser, setResetUser] = useState<Profile | null>(null)
    const [resetLoading, setResetLoading] = useState(false)

    const [statusUser, setStatusUser] = useState<Profile | null>(null)
    const [statusLoading, setStatusLoading] = useState(false)

    const [loading, setLoading] = useState(false)

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

    async function loadUsers() {
        const { data, error } = await supabase
            .from('profiles')
            .select('id, name, email, role, must_change_password, is_active')
            .order('name')

        if (error) {
            showToast('error', 'Erro', 'Não foi possível carregar os usuários.')
            return
        }

        setUsers((data || []) as Profile[])
    }

    useEffect(() => {
        queueMicrotask(() => {
            void loadUsers()
        })
    }, [])

    function resetForm() {
        setName('')
        setEmail('')
        setPassword('')
        setRole('VENDEDOR')
    }

    async function handleCreateUser() {
        if (!name || !email || !password || !role) {
            showToast('error', 'Campo obrigatório', 'Preencha todos os campos.')
            return
        }

        setLoading(true)

        const response = await fetch('/api/users/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name,
                email,
                password,
                role,
            }),
        })

        const contentType = response.headers.get('content-type')
        const result = contentType?.includes('application/json')
            ? await response.json()
            : { message: 'Rota não encontrada ou retornou HTML.' }

        setLoading(false)

        if (!response.ok) {
            showToast('error', 'Erro ao criar usuário', result.message)
            return
        }

        showToast('success', 'Usuário criado', 'Usuário criado com sucesso.')

        resetForm()
        setShowForm(false)
        await loadUsers()
    }

    async function handleResetPassword() {
        if (!resetUser) return

        setResetLoading(true)

        try {
            const response = await fetch('/api/users/reset-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: resetUser.email,
                }),
            })

            const contentType = response.headers.get('content-type')
            const result = contentType?.includes('application/json')
                ? await response.json()
                : { message: 'Rota de reset não encontrada ou retornou HTML.' }

            if (!response.ok) {
                showToast('error', 'Erro ao redefinir senha', result.message)
                return
            }

            showToast(
                'success',
                'E-mail enviado',
                'O usuário recebeu um link para criar uma nova senha.'
            )

            setResetUser(null)
            await loadUsers()
        } catch (error) {
            console.error('Erro no reset de senha:', error)

            showToast(
                'error',
                'Erro ao redefinir senha',
                error instanceof Error
                    ? error.message
                    : 'Não foi possível concluir a redefinição.'
            )
        } finally {
            setResetLoading(false)
        }
    }

    async function handleToggleStatus() {
        if (!statusUser) return

        setStatusLoading(true)

        try {
            const response = await fetch('/api/users/toggle-status', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId: statusUser.id,
                    isActive: statusUser.is_active !== false,
                }),
            })

            const contentType = response.headers.get('content-type')
            const result = contentType?.includes('application/json')
                ? await response.json()
                : { message: 'Rota não encontrada ou retornou HTML.' }

            if (!response.ok) {
                showToast('error', 'Erro', result.message)
                return
            }

            showToast(
                'success',
                'Sucesso',
                statusUser.is_active !== false
                    ? 'Usuário desativado com sucesso.'
                    : 'Usuário ativado com sucesso.'
            )

            setStatusUser(null)
            await loadUsers()
        } catch (error) {
            console.error('Erro ao alterar status:', error)

            showToast(
                'error',
                'Erro',
                'Não foi possível alterar o status do usuário.'
            )
        } finally {
            setStatusLoading(false)
        }
    }

    return (
        <RouteGuard allowedRoles={['ADMIN']}>
            <PageContainer
                title="Usuários"
                description="Gerencie usuários e perfis de acesso do sistema."
                action={
                    <button
                        onClick={() => {
                            setShowForm(!showForm)
                            resetForm()
                        }}
                        className="inline-flex items-center gap-2 rounded-2xl bg-red-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-red-600/20 transition-all hover:-translate-y-0.5 hover:bg-red-700"
                    >
                        <UserPlus size={18} />
                        {showForm ? 'Fechar' : '+ Novo usuário'}
                    </button>
                }
            >
                {showForm && (
                    <div className="slide-up mb-8 rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl shadow-zinc-200/60">
                        <h2 className="text-xl font-bold">Criar novo usuário</h2>

                        <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
                            <div>
                                <label className="text-sm font-medium text-zinc-700">
                                    Nome
                                </label>
                                <input
                                    value={name}
                                    onChange={(event) => setName(event.target.value)}
                                    placeholder="Ex: João Silva"
                                    className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none focus:border-red-500 focus:ring-4 focus:ring-red-500/10"
                                />
                            </div>

                            <div>
                                <label className="text-sm font-medium text-zinc-700">
                                    E-mail
                                </label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(event) => setEmail(event.target.value)}
                                    placeholder="joao@matrix.com"
                                    className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none focus:border-red-500 focus:ring-4 focus:ring-red-500/10"
                                />
                            </div>

                            <div>
                                <label className="text-sm font-medium text-zinc-700">
                                    Senha inicial
                                </label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(event) => setPassword(event.target.value)}
                                    placeholder="Mínimo 6 caracteres"
                                    className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none focus:border-red-500 focus:ring-4 focus:ring-red-500/10"
                                />
                            </div>

                            <div>
                                <label className="text-sm font-medium text-zinc-700">
                                    Perfil
                                </label>
                                <select
                                    value={role}
                                    onChange={(event) =>
                                        setRole(event.target.value as Profile['role'])
                                    }
                                    className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none focus:border-red-500 focus:ring-4 focus:ring-red-500/10"
                                >
                                    <option value="VENDEDOR">Vendedor</option>
                                    <option value="GERENTE">Gerente</option>
                                    <option value="ADMIN">Administrador</option>
                                </select>
                            </div>
                        </div>

                        <button
                            onClick={handleCreateUser}
                            disabled={loading}
                            className="mt-6 rounded-xl bg-zinc-950 px-6 py-3 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
                        >
                            {loading ? 'Criando...' : 'Criar usuário'}
                        </button>
                    </div>
                )}

                <div className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-xl shadow-zinc-200/50">
                    <table className="w-full text-sm">
                        <thead className="bg-zinc-950 text-white">
                            <tr>
                                <th className="px-5 py-4 text-left">Nome</th>
                                <th className="px-5 py-4 text-left">E-mail</th>
                                <th className="px-5 py-4 text-left">Perfil</th>
                                <th className="px-5 py-4 text-right">Ações</th>
                            </tr>
                        </thead>

                        <tbody>
                            {users.map((user) => (
                                <tr
                                    key={user.id}
                                    className={`border-t hover:bg-zinc-50 ${user.is_active === false ? 'bg-zinc-50 opacity-70' : ''
                                        }`}
                                >
                                    <td className="px-5 py-4 font-semibold">{user.name}</td>

                                    <td className="px-5 py-4">{user.email}</td>

                                    <td className="px-5 py-4">
                                        <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-600">
                                            {user.role}
                                        </span>

                                        {user.must_change_password && (
                                            <span className="ml-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
                                                Troca pendente
                                            </span>
                                        )}

                                        {user.is_active === false && (
                                            <span className="ml-2 rounded-full bg-zinc-200 px-3 py-1 text-xs font-bold text-zinc-700">
                                                Inativo
                                            </span>
                                        )}
                                    </td>

                                    <td className="px-5 py-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => setResetUser(user)}
                                                disabled={user.is_active === false}
                                                className="rounded-xl bg-zinc-950 px-4 py-2 text-xs font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
                                            >
                                                Redefinir senha
                                            </button>

                                            <button
                                                onClick={() => setStatusUser(user)}
                                                className={`rounded-xl px-4 py-2 text-xs font-semibold text-white ${user.is_active === false
                                                    ? 'bg-green-600 hover:bg-green-700'
                                                    : 'bg-amber-600 hover:bg-amber-700'
                                                    }`}
                                            >
                                                {user.is_active === false ? 'Ativar' : 'Desativar'}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}

                            {users.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={4}
                                        className="px-5 py-10 text-center text-zinc-500"
                                    >
                                        Nenhum usuário cadastrado.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </PageContainer>

            <ConfirmDialog
                open={!!resetUser}
                title="Redefinir senha"
                description={
                    resetUser
                        ? `Deseja realmente enviar um e-mail de redefinição de senha para ${resetUser.name}? O link será enviado para ${resetUser.email}.`
                        : ''
                }
                confirmText="Enviar e-mail"
                loadingText="Enviando"
                loading={resetLoading}
                onCancel={() => setResetUser(null)}
                onConfirm={handleResetPassword}
            />

            <ConfirmDialog
                open={!!statusUser}
                title={
                    statusUser?.is_active === false
                        ? 'Ativar usuário'
                        : 'Desativar usuário'
                }
                description={
                    statusUser
                        ? statusUser.is_active === false
                            ? `Deseja realmente ativar ${statusUser.name}? Ele poderá acessar o sistema novamente.`
                            : `Deseja realmente desativar ${statusUser.name}? Ele não poderá mais acessar o sistema.`
                        : ''
                }
                confirmText={statusUser?.is_active === false ? 'Ativar' : 'Desativar'}
                loadingText="Processando"
                loading={statusLoading}
                onCancel={() => setStatusUser(null)}
                onConfirm={handleToggleStatus}
            />

            <Toast
                open={toast.open}
                type={toast.type}
                title={toast.title}
                description={toast.description}
                onClose={() => setToast((current) => ({ ...current, open: false }))}
            />
        </RouteGuard >
    )
}