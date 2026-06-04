'use client'

import { AlertTriangle, X } from 'lucide-react'

interface ConfirmDialogProps {
    open: boolean
    title: string
    description: string
    confirmText?: string
    cancelText?: string
    loading?: boolean
    onConfirm: () => void
    onCancel: () => void
}

export function ConfirmDialog({
    open,
    title,
    description,
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    loading = false,
    onConfirm,
    onCancel,
}: ConfirmDialogProps) {
    if (!open) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/50 p-4 backdrop-blur-sm">
            <div className="slide-up w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xl">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600">
                        <AlertTriangle size={24} />
                    </div>

                    <button
                        onClick={onCancel}
                        disabled={loading}
                        className="rounded-xl p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-50"
                    >
                        <X size={18} />
                    </button>
                </div>

                <h2 className="mt-5 text-xl font-bold text-zinc-950">{title}</h2>

                <p className="mt-2 text-sm leading-6 text-zinc-500">
                    {description}
                </p>

                <div className="mt-6 flex justify-end gap-3">
                    <button
                        onClick={onCancel}
                        disabled={loading}
                        className="rounded-xl border border-zinc-200 px-5 py-3 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                    >
                        {cancelText}
                    </button>

                    <button
                        onClick={onConfirm}
                        disabled={loading}
                        className="rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                    >
                        {loading ? 'Excluindo...' : confirmText}
                    </button>
                </div>
            </div>
        </div>
    )
}