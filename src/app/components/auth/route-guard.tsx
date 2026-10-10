'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'

type Role = 'ADMIN' | 'GERENTE' | 'VENDEDOR'

type RouteGuardProps = {
    allowedRoles: Role[]
    children: React.ReactNode
}

export function RouteGuard({ allowedRoles, children }: RouteGuardProps) {
    const router = useRouter()
    const [authorized, setAuthorized] = useState(false)
    const [checking, setChecking] = useState(true)

    useEffect(() => {
        async function checkPermission() {
            const {
                data: { user },
            } = await supabase.auth.getUser()

            if (!user) {
                router.push('/login')
                return
            }

            const { data: profile } = await supabase
                .from('profiles')
                .select('role, is_active')
                .eq('id', user.id)
                .single()

            if (!profile || profile.is_active === false) {
                await supabase.auth.signOut()
                router.push('/login')
                return
            }

            if (!allowedRoles.includes(profile.role)) {
                localStorage.setItem(
                    'painel_permission_error',
                    'Você não possui permissão para acessar esta página.'
                )

                router.push('/dashboard')
                return
            }

            setAuthorized(true)
            setChecking(false)
        }

        void checkPermission()
    }, [allowedRoles, router])

    if (checking || !authorized) {
        return null
    }

    return <>{children}</>
}