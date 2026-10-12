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
  KanbanSquare,
  Settings,
  Calculator,
  LogOut,
  ExternalLink,
  Menu,
  X,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { PainelLogo } from './brand/painel-logo'
import { getSiteUrl } from '../../lib/tenant'

type Role = 'ADMIN' | 'GERENTE' | 'VENDEDOR'

const menus = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    roles: ['ADMIN', 'GERENTE', 'VENDEDOR'],
  },
  {
    label: 'Funil de vendas',
    href: '/crm',
    icon: KanbanSquare,
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

// Menu lateral fixo (tablet, notebook e desktop). No celular ele fica
// escondido e abre como gaveta pelo botão do cabeçalho (MenuCelular).
export function AppSidebar() {
  return (
    <aside className="hidden min-h-screen w-64 bg-brand-900 p-6 text-white md:block">
      <ConteudoMenu />
    </aside>
  )
}

// Botão ☰ (só no celular) que abre o mesmo menu como gaveta.
export function MenuCelular() {
  const [aberto, setAberto] = useState(false)
  const pathname = usePathname()

  // Trocou de página: fecha a gaveta.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fecha ao navegar
    setAberto(false)
  }, [pathname])

  // Gaveta aberta: a página de trás não rola.
  useEffect(() => {
    document.body.style.overflow = aberto ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [aberto])

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        aria-label="Abrir menu"
        className="shrink-0 rounded-xl border border-zinc-200 bg-white p-2.5 text-zinc-800 shadow-sm md:hidden"
      >
        <Menu size={20} />
      </button>

      {aberto && (
        <div className="fixed inset-0 z-[70] md:hidden">
          <div className="absolute inset-0 bg-zinc-950/50" onClick={() => setAberto(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] overflow-y-auto bg-brand-900 p-6 text-white shadow-2xl">
            <button
              type="button"
              onClick={() => setAberto(false)}
              aria-label="Fechar menu"
              className="absolute right-4 top-4 rounded-xl p-2 text-brand-100 hover:bg-white/10"
            >
              <X size={20} />
            </button>
            <ConteudoMenu />
          </aside>
        </div>
      )}
    </>
  )
}

function ConteudoMenu() {
  const pathname = usePathname()
  const router = useRouter()
  const [role, setRole] = useState<Role | null>(() => {
    if (typeof window === 'undefined') return null
    return localStorage.getItem('painel_role') as Role | null
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
        localStorage.setItem('painel_role', data.role)
        localStorage.setItem('painel_name', data.name)
      }
    }

    loadProfile()
  }, [])

  const [siteUrl, setSiteUrl] = useState<string | null>(null)

  useEffect(() => {
    getSiteUrl().then(setSiteUrl).catch(() => setSiteUrl(null))
  }, [])

  async function handleLogout() {
    localStorage.removeItem('painel_role')
    await supabase.auth.signOut()
    router.push('/login')
  }

  const visibleMenus = menus.filter((menu) =>
    role ? menu.roles.includes(role) : false
  )

  return (
    <>
      <div className="mb-10">
        <h1>
          <PainelLogo variant="dark" />
        </h1>
        <p className="mt-2 text-xs text-brand-300">Gestão de Veículos</p>

        {role && (
          <span className="mt-4 inline-block rounded-full bg-brand-600 px-3 py-1 text-xs font-bold">
            {role}
          </span>
        )}
      </div>

      <nav className="space-y-2">
        {visibleMenus.map((menu) => {
          const Icon = menu.icon
          const active =
            pathname === menu.href || pathname.startsWith(`${menu.href}/`)

          return (
            <Link
              key={menu.href}
              href={menu.href}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition ${active
                  ? 'bg-brand-600 text-white'
                  : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'
                }`}
            >
              <Icon size={20} />
              {menu.label}
            </Link>
          )
        })}
      </nav>

      {siteUrl && (
        <a
          href={siteUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-10 flex items-center gap-3 rounded-xl border border-brand-700 px-4 py-3 text-sm font-medium text-brand-100 transition hover:bg-brand-800 hover:text-white"
        >
          <ExternalLink size={20} />
          Ver meu site
        </a>
      )}

      <button
        onClick={handleLogout}
        className="mt-2 flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800 hover:text-white"
      >
        <LogOut size={20} />
        Sair
      </button>
    </>
  )
}