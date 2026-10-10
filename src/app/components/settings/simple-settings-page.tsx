'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react'

import { PageContainer } from '../../components/page-container'
import { supabase } from '../../../lib/supabase'
import { Toast } from '../../components/ui/toast'
import { ConfirmDialog } from '../../components/ui/confirm-dialog'

type Item = {
    id: string
    name: string
}

interface SimpleSettingsPageProps {
    title: string
    description: string
    table: string
    placeholder: string
}

export function SimpleSettingsPage({
    title,
    description,
    table,
    placeholder,
}: SimpleSettingsPageProps) {
    const [items, setItems] = useState<Item[]>([])
    const [showForm, setShowForm] = useState(false)
    const [name, setName] = useState('')
    const [editingId, setEditingId] = useState<string | null>(null)
    const [deleteId, setDeleteId] = useState<string | null>(null)
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
            setToast((current) => ({
                ...current,
                open: false,
            }))
        }, 3000)
    }

    async function loadItems() {
        const { data, error } = await supabase
            .from(table)
            .select('id, name')
            .order('name')

        if (error) {
            showToast(
                'error',
                'Erro',
                `Não foi possível carregar ${title.toLowerCase()}.`
            )
            return
        }

        setItems(data || [])
    }

    useEffect(() => {
        async function fetchItems() {
            await loadItems()
        }

        fetchItems()
    }, [])

    async function handleSave() {
        if (!name.trim()) {
            showToast('error', 'Campo obrigatório', 'Informe um nome.')
            return
        }

        setLoading(true)

        if (editingId) {
            const { error } = await supabase
                .from(table)
                .update({
                    name: name.trim(),
                })
                .eq('id', editingId)

            if (error) {
                showToast('error', 'Erro', error.message)
                setLoading(false)
                return
            }

            showToast(
                'success',
                'Atualizado',
                'Registro atualizado com sucesso.'
            )
        } else {
            const { error } = await supabase
                .from(table)
                .insert({
                    name: name.trim(),
                })

            if (error) {
                showToast('error', 'Erro', error.message)
                setLoading(false)
                return
            }

            showToast(
                'success',
                'Cadastrado',
                'Registro cadastrado com sucesso.'
            )
        }

        setName('')
        setEditingId(null)
        setShowForm(false)
        setLoading(false)

        await loadItems()
    }

    function handleEdit(item: Item) {
        setEditingId(item.id)
        setName(item.name)
        setShowForm(true)
    }

    async function handleDelete() {
        if (!deleteId) return

        setLoading(true)

        const { error } = await supabase
            .from(table)
            .delete()
            .eq('id', deleteId)

        if (error) {
            if (error.code === '23503') {
                showToast(
                    'error',
                    'Não foi possível excluir',
                    'Este item está vinculado a um ou mais veículos. Remova ou altere os veículos antes de excluir.'
                )
            } else {
                showToast('error', 'Erro', error.message)
            }

            setLoading(false)
            return
        }
        showToast(
            'success',
            'Excluído',
            'Registro removido com sucesso.'
        )

        setDeleteId(null)
        setLoading(false)

        await loadItems()
    }

    return (
        <>
            <PageContainer
                title={title}
                description={description}
                action={
                    <button
                        onClick={() => {
                            setShowForm(!showForm)
                            setEditingId(null)
                            setName('')
                        }}
                        className="rounded-2xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-600/20 transition-all duration-300 hover:-translate-y-0.5 hover:bg-brand-700"
                    >
                        {showForm ? 'Fechar' : '+ Novo cadastro'}
                    </button>
                }
            >
                <Link
                    href="/configuracoes"
                    className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-zinc-500 transition hover:text-brand-600"
                >
                    <ArrowLeft size={18} />
                    Voltar para configurações
                </Link>

                {showForm && (
                    <div className="slide-up mb-8 rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl shadow-zinc-200/60">
                        <h2 className="text-xl font-bold">
                            {editingId
                                ? 'Editar cadastro'
                                : 'Novo cadastro'}
                        </h2>

                        <div className="mt-5 flex flex-col gap-4 md:flex-row">
                            <input
                                value={name}
                                onChange={(event) =>
                                    setName(event.target.value)
                                }
                                placeholder={placeholder}
                                className="w-full rounded-xl border border-zinc-200 px-4 py-3 outline-none transition-all focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
                            />

                            <button
                                onClick={handleSave}
                                disabled={loading}
                                className="rounded-xl bg-zinc-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50"
                            >
                                {loading
                                    ? 'Salvando...'
                                    : editingId
                                        ? 'Salvar edição'
                                        : 'Salvar'}
                            </button>
                        </div>
                    </div>
                )}

                <div className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-xl shadow-zinc-200/50">
                    <table className="w-full text-sm">
                        <thead className="bg-zinc-950 text-white">
                            <tr>
                                <th className="px-5 py-4 text-left">
                                    Nome
                                </th>

                                <th className="px-5 py-4 text-right">
                                    Ações
                                </th>
                            </tr>
                        </thead>

                        <tbody>
                            {items.map((item) => (
                                <tr
                                    key={item.id}
                                    className="border-t transition-colors duration-200 hover:bg-zinc-50"
                                >
                                    <td className="px-5 py-4 font-semibold">
                                        {item.name}
                                    </td>

                                    <td className="px-5 py-4">
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() =>
                                                    handleEdit(item)
                                                }
                                                className="rounded-xl bg-zinc-100 p-2 text-zinc-700 transition hover:bg-zinc-200"
                                            >
                                                <Pencil size={18} />
                                            </button>

                                            <button
                                                onClick={() =>
                                                    setDeleteId(item.id)
                                                }
                                                className="rounded-xl bg-red-50 p-2 text-red-600 transition hover:bg-red-100"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}

                            {items.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={2}
                                        className="px-5 py-10 text-center text-zinc-500"
                                    >
                                        Nenhum cadastro encontrado.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </PageContainer>

            <ConfirmDialog
                open={!!deleteId}
                title="Excluir cadastro"
                description="Deseja realmente excluir este item?"
                confirmText="Excluir"
                loading={loading}
                onCancel={() => setDeleteId(null)}
                onConfirm={handleDelete}
            />

            <Toast
                open={toast.open}
                type={toast.type}
                title={toast.title}
                description={toast.description}
                onClose={() =>
                    setToast((current) => ({
                        ...current,
                        open: false,
                    }))
                }
            />
        </>
    )
}