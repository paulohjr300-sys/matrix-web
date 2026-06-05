import Link from 'next/link'
import { PageContainer } from '../components/page-container'
import {
    Car,
    Fuel,
    Palette,
    Settings,
    Wrench,
    CreditCard,
    Tags,
    Gauge,
    Users,
} from 'lucide-react'
import { RouteGuard } from '../components/auth/route-guard'

const items = [
    {
        title: 'Marcas',
        description: 'Cadastre marcas como Hyundai, Chevrolet, Toyota.',
        href: '/configuracoes/marcas',
        icon: Tags,
    },
    {
        title: 'Modelos',
        description: 'Vincule modelos às marcas cadastradas.',
        href: '/configuracoes/modelos',
        icon: Car,
    },
    {
        title: 'Motores',
        description: 'Cadastre motores como 1.0, 1.6, 2.0.',
        href: '/configuracoes/motores',
        icon: Gauge,
    },
    {
        title: 'Câmbios',
        description: 'Manual, automático, CVT e outros.',
        href: '/configuracoes/cambios',
        icon: Settings,
    },
    {
        title: 'Combustíveis',
        description: 'Flex, gasolina, diesel, elétrico e híbrido.',
        href: '/configuracoes/combustiveis',
        icon: Fuel,
    },
    {
        title: 'Cores',
        description: 'Preto, branco, prata, vermelho e outras.',
        href: '/configuracoes/cores',
        icon: Palette,
    },
    {
        title: 'Formas de pagamento',
        description: 'Pix, dinheiro, financiamento, cartão e troca.',
        href: '/configuracoes/formas-pagamento',
        icon: CreditCard,
    },
    {
        title: 'Categorias de custos',
        description: 'Manutenção, documentação, lavagem e outros.',
        href: '/configuracoes/categorias-custos',
        icon: Wrench,
    },
    {
        title: 'Usuários',
        description: 'Gerencie usuários, perfis e permissões do sistema.',
        href: '/configuracoes/usuarios',
        icon: Users,
    },
]

export default function ConfiguracoesPage() {
    return (
        <RouteGuard allowedRoles={['ADMIN']}>
            <PageContainer
                title="Configurações"
                description="Cadastros base usados em todo o sistema Matrix."
            >
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
                    {items.map((item) => {
                        const Icon = item.icon

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className="group rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl shadow-zinc-200/50 transition-all duration-300 hover:-translate-y-1 hover:border-red-200 hover:shadow-red-100"
                            >
                                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600 transition-all group-hover:bg-red-600 group-hover:text-white">
                                    <Icon size={22} />
                                </div>

                                <h2 className="mt-5 text-xl font-bold text-zinc-950">
                                    {item.title}
                                </h2>

                                <p className="mt-2 text-sm leading-6 text-zinc-500">
                                    {item.description}
                                </p>

                                <span className="mt-5 inline-block text-sm font-semibold text-red-600">
                                    Gerenciar →
                                </span>
                            </Link>
                        )
                    })}
                </div>
            </PageContainer>
        </RouteGuard>
    )
}