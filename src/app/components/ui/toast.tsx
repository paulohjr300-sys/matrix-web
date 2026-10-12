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
        <div className="fixed left-4 right-4 top-20 z-[9999] slide-up md:left-auto md:right-8 md:top-30">
            <div className="flex w-full items-start gap-4 rounded-3xl md:w-[360px] border border-zinc-200 bg-white p-5 shadow-2xl shadow-zinc-300/70">
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