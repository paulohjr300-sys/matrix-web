'use client'

import { CheckCircle, XCircle, X } from 'lucide-react'

interface ToastProps {
    open: boolean
    type: 'success' | 'error'
    title: string
    description?: string
    onClose: () => void
}

export function Toast({
    open,
    type,
    title,
    description,
    onClose,
}: ToastProps) {
    if (!open) return null

    const isSuccess = type === 'success'

    return (
        <div className="fixed right-6 top-6 z-50 slide-up">
            <div className="flex w-[360px] items-start gap-4 rounded-3xl border border-zinc-200 bg-white p-5 shadow-2xl shadow-zinc-300/70">
                <div
                    className={`rounded-2xl p-2 ${isSuccess
                            ? 'bg-emerald-50 text-emerald-600'
                            : 'bg-red-50 text-red-600'
                        }`}
                >
                    {isSuccess ? <CheckCircle size={22} /> : <XCircle size={22} />}
                </div>

                <div className="flex-1">
                    <h3 className="font-bold text-zinc-950">{title}</h3>

                    {description && (
                        <p className="mt-1 text-sm text-zinc-500">{description}</p>
                    )}
                </div>

                <button
                    onClick={onClose}
                    className="rounded-xl p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                >
                    <X size={18} />
                </button>
            </div>
        </div>
    )
}