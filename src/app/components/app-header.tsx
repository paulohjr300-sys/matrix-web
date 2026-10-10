'use client'

import Link from 'next/link'
import { Bell, Car, ImageIcon, User, UserRound } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'

interface AppHeaderProps {
    title: string
    description?: string
}

type NotificationItem = {
    id: string
    title: string
    description: string
    count: number
    href: string
    icon: 'lead' | 'vehicle' | 'banner'
}

export function AppHeader({ title, description }: AppHeaderProps) {
    const [dropdownOpen, setDropdownOpen] = useState(false)

    const [userProfile] = useState(() => {
        if (typeof window === 'undefined') {
            return {
                name: 'Usuário',
                role: '',
            }
        }

        const name = window.localStorage.getItem('painel_name') || 'Usuário'
        const role = window.localStorage.getItem('painel_role') || ''

        return { name, role }
    })

    const [notifications, setNotifications] = useState<NotificationItem[]>([])
    const [bellAttention, setBellAttention] = useState(false)

    async function loadNotifications() {
        const [
            newLeadsRes,
            publishedWithoutMainPhotoRes,
            publishedWithoutCategoryRes,
            activeBannersWithoutMobileRes,
        ] = await Promise.all([
            supabase
                .from('leads')
                .select('id', { count: 'exact', head: true })
                .eq('status', 'NOVO'),

            supabase
                .from('vehicles')
                .select('id', { count: 'exact', head: true })
                .eq('is_published', true)
                .neq('status', 'VENDIDO')
                .is('main_photo_file_id', null),

            supabase
                .from('vehicles')
                .select('id', { count: 'exact', head: true })
                .eq('is_published', true)
                .neq('status', 'VENDIDO')
                .is('category_id', null),

            supabase
                .from('site_banners')
                .select('id', { count: 'exact', head: true })
                .eq('is_active', true)
                .is('mobile_image_url', null),
        ])

        const items: NotificationItem[] = []

        if ((newLeadsRes.count || 0) > 0) {
            const count = newLeadsRes.count || 0

            items.push({
                id: 'new-leads',
                title: count === 1 ? '1 lead novo' : `${count} leads novos`,
                description: 'Existem contatos novos aguardando atendimento.',
                count,
                href: '/crm',
                icon: 'lead',
            })
        }

        if ((publishedWithoutMainPhotoRes.count || 0) > 0) {
            const count = publishedWithoutMainPhotoRes.count || 0

            items.push({
                id: 'vehicles-without-main-photo',
                title:
                    count === 1
                        ? '1 veículo publicado sem foto principal'
                        : `${count} veículos publicados sem foto principal`,
                description: 'Esses veículos podem aparecer sem capa no site.',
                count,
                href: '/veiculos?alert=missing-main-photo',
                icon: 'vehicle',
            })
        }

        if ((publishedWithoutCategoryRes.count || 0) > 0) {
            const count = publishedWithoutCategoryRes.count || 0

            items.push({
                id: 'vehicles-without-category',
                title:
                    count === 1
                        ? '1 veículo publicado sem categoria'
                        : `${count} veículos publicados sem categoria`,
                description: 'Adicione categoria para melhorar filtros e cards do site.',
                count,
                href: '/veiculos?alert=missing-category',
                icon: 'vehicle',
            })
        }

        if ((activeBannersWithoutMobileRes.count || 0) > 0) {
            const count = activeBannersWithoutMobileRes.count || 0

            items.push({
                id: 'banners-without-mobile',
                title:
                    count === 1
                        ? '1 banner ativo sem imagem mobile'
                        : `${count} banners ativos sem imagem mobile`,
                description: 'Adicione imagem mobile para melhorar a home no celular.',
                count,
                href: '/configuracoes/banners?alert=missing-mobile',
                icon: 'banner',
            })
        }

        setNotifications(items)
    }

    useEffect(() => {
        const loadNotificationsAsync = async () => {
            await loadNotifications()
        }


        void loadNotificationsAsync()

        const interval = window.setInterval(() => {
            void loadNotificationsAsync()
        }, 30000)

        return () => window.clearInterval(interval)
    }, [])
    useEffect(() => {
        const channel = supabase
            .channel('realtime-leads-notifications')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'leads',
                },
                () => {
                    void loadNotifications()

                    setBellAttention(true)

                    setTimeout(() => {
                        setBellAttention(false)
                    }, 8000)
                }
            )
            .subscribe()

        return () => {
            void supabase.removeChannel(channel)
        }
    }, [])

    const totalNotifications = useMemo(() => {
        return notifications.reduce((sum, item) => sum + item.count, 0)
    }, [notifications])

    function getNotificationIcon(type: NotificationItem['icon']) {
        if (type === 'lead') return <UserRound size={18} />
        if (type === 'banner') return <ImageIcon size={18} />

        return <Car size={18} />
    }

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
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => setDropdownOpen((current) => !current)}
                            className={`relative rounded-2xl border p-3 shadow-sm transition-all duration-300 hover:-translate-y-0.5 ${bellAttention
                                    ? 'border-brand-200 bg-brand-50 text-brand-600 ring-4 ring-brand-500/20'
                                    : 'border-zinc-200 bg-white hover:bg-zinc-50'
                                }`} 
                        >
                            <Bell
                                size={20}
                                className={bellAttention ? 'text-red-600' : ''}
                            />

                            {totalNotifications > 0 && (
                                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                                    {totalNotifications > 99 ? '99+' : totalNotifications}
                                </span>
                            )}
                        </button>

                        {dropdownOpen && (
                            <div className="absolute right-0 top-14 z-[9999] w-96 overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-2xl shadow-zinc-300/70">
                                <div className="border-b border-zinc-200 p-5">
                                    <h3 className="text-lg font-black text-zinc-950">
                                        Notificações
                                    </h3>

                                    <p className="mt-1 text-sm text-zinc-500">
                                        Alertas que precisam de atenção.
                                    </p>
                                </div>

                                <div className="max-h-[420px] overflow-auto p-3">
                                    {notifications.map((item) => (
                                        <Link
                                            key={item.id}
                                            href={item.href}
                                            onClick={() => setDropdownOpen(false)}
                                            className="flex gap-3 rounded-2xl p-4 transition hover:bg-zinc-50"
                                        >
                                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                                                {getNotificationIcon(item.icon)}
                                            </div>

                                            <div>
                                                <p className="text-sm font-black text-zinc-950">
                                                    {item.title}
                                                </p>

                                                <p className="mt-1 text-xs leading-5 text-zinc-500">
                                                    {item.description}
                                                </p>

                                                <p className="mt-2 text-xs font-bold text-brand-600">
                                                    Corrigir agora
                                                </p>
                                            </div>
                                        </Link>
                                    ))}

                                    {notifications.length === 0 && (
                                        <div className="p-8 text-center">
                                            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                                                <Bell size={22} />
                                            </div>

                                            <p className="mt-4 text-sm font-bold text-zinc-950">
                                                Nenhuma pendência
                                            </p>

                                            <p className="mt-1 text-xs text-zinc-500">
                                                Tudo certo por enquanto.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

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