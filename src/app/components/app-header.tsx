'use client'

import { Bell, User } from 'lucide-react'
import { useState } from 'react'

interface AppHeaderProps {
    title: string
    description?: string
}

export function AppHeader({ title, description }: AppHeaderProps) {
    const [userProfile, setUserProfile] = useState(() => {
        if (typeof window === 'undefined') {
            return {
                name: 'Usuário',
                role: '',
            }
        }

        const name = window.localStorage.getItem('matrix_name') || 'Usuário'
        const role = window.localStorage.getItem('matrix_role') || ''

        return { name, role }
    })

    return (
        <header className="sticky top-0 z-20 border-b border-zinc-200 bg-zinc-100/80 px-8 py-5 backdrop-blur">
            <div className="flex items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-zinc-950">
                        {title}
                    </h1>

                    {description && (
                        <p className="mt-1 text-sm text-zinc-500">{description}</p>
                    )}
                </div>

                <div className="flex items-center gap-4">
                    <button className="relative rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:bg-zinc-50">
                        <Bell size={20} />

                        <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white">
                            3
                        </span>
                    </button>

                    <div className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-2 shadow-sm">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-950 text-white">
                            <User size={18} />
                        </div>

                        <div className="hidden md:block">
                            <p className="text-sm font-bold text-zinc-950">
                                {userProfile.name}
                            </p>

                            <p className="text-xs font-medium text-zinc-500">
                                {userProfile.role || 'Carregando...'}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </header>
    )
}