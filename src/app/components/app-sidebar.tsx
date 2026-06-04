'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  BarChart3,
  Car,
  CircleDollarSign,
  FileText,
  LayoutDashboard,
  Settings,
  Calculator,
  LogOut,
} from 'lucide-react'
import { supabase } from '../lib/supabase'

type Role = 'ADMIN' | 'GERENTE' | 'VENDEDOR'

const menus = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    roles: ['ADMIN', 'GERENTE', 'VENDEDOR'],
  },
  {
    label: 'Veículos',
    href: '/veiculos',
    icon: Car,
    roles: ['ADMIN', 'GERENTE', 'VENDEDOR'],
  },
  {
    label: 'Vendas',
    href: '/vendas',
    icon: BarChart3,
    roles: ['ADMIN', 'GERENTE', 'VENDEDOR'],
  },
  {
    label: 'Custos',
    href: '/custos',
    icon: CircleDollarSign,
    roles: ['ADMIN', 'GERENTE'],
  },
  {
    label: 'DRE',
    href: '/dre',
    icon: Calculator,
    roles: ['ADMIN', 'GERENTE'],
  },
  {
    label: 'Relatórios',
    href: '/relatorios',
    icon: FileText,
    roles: ['ADMIN', 'GERENTE'],
  },
  {
    label: 'Configurações',
    href: '/configuracoes',
    icon: Settings,
    roles: ['ADMIN'],
  },
]

export function AppSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [role, setRole] = useState<Role | null>(() => {
    if (typeof window === 'undefined') return null
    return localStorage.getItem('matrix_role') as Role | null
  })

  useEffect(() => {
    async function loadProfile() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return

      const { data } = await supabase
        .from('profiles')
        .select('name, role')
        .eq('id', user.id)
        .single()

      setRole(data?.role || null)
      if (data?.role) {
        setRole(data.role)
        localStorage.setItem('matrix_role', data.role)
        localStorage.setItem('matrix_name', data.name)
      }
    }


    loadProfile()
  }, [])

  async function handleLogout() {
    localStorage.removeItem('matrix_role')
    await supabase.auth.signOut()
    router.push('/login')

  }

  const visibleMenus = menus.filter((menu) =>
    role ? menu.roles.includes(role) : false
  )

  return (
    <aside className="hidden min-h-screen w-64 bg-zinc-950 p-6 text-white md:block">
      <div className="mb-10">
        <h1 className="text-3xl font-black tracking-widest">MATRIX</h1>
        <p className="mt-1 text-xs text-zinc-400">Gestão de Veículos</p>

        {role && (
          <span className="mt-4 inline-block rounded-full bg-red-600 px-3 py-1 text-xs font-bold">
            {role}
          </span>
        )}
      </div>

      <nav className="space-y-2">
        {visibleMenus.map((menu) => {
          const Icon = menu.icon
          const active = pathname === menu.href

          return (
            <Link
              key={menu.href}
              href={menu.href}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition ${active
                ? 'bg-red-600 text-white'
                : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
                }`}
            >
              <Icon size={20} />
              {menu.label}
            </Link>
          )
        })}
      </nav>

      <button
        onClick={handleLogout}
        className="mt-10 flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800 hover:text-white"
      >
        <LogOut size={20} />
        Sair
      </button>
    </aside>
  )
}