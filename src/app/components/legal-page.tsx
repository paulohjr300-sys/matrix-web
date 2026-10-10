import Link from 'next/link'
import { PainelLogo } from './brand/painel-logo'
import { PLATFORM, PLATFORM_DRAFT } from '../../lib/platform'

export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <main className="min-h-screen bg-zinc-100 px-4 py-10 sm:px-6">
            <div className="mx-auto max-w-3xl">
                <Link href="/login" className="inline-block">
                    <PainelLogo />
                </Link>

                <article className="mt-8 rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl shadow-zinc-200/50 sm:p-10">
                    <h1 className="text-3xl font-black text-zinc-950">{title}</h1>
                    <p className="mt-2 text-sm text-zinc-500">Última atualização: {PLATFORM.atualizadoEm}</p>

                    {PLATFORM_DRAFT && (
                        <p className="mt-6 rounded-2xl bg-amber-50 p-4 text-sm font-medium text-amber-800">
                            Rascunho: os dados da empresa responsável (razão social, CNPJ e e-mail) ainda
                            não foram preenchidos.
                        </p>
                    )}

                    <div className="legal-content mt-8 space-y-4 text-[15px] leading-7 text-zinc-700">
                        {children}
                    </div>
                </article>

                <p className="mt-6 text-center text-sm text-zinc-500">
                    <Link href="/termos" className="hover:text-brand-600">Termos de Uso</Link>
                    {' · '}
                    <Link href="/privacidade" className="hover:text-brand-600">Política de Privacidade</Link>
                </p>
            </div>
        </main>
    )
}

export function H2({ children }: { children: React.ReactNode }) {
    return <h2 className="pt-4 text-xl font-bold text-zinc-950">{children}</h2>
}

export function List({ items }: { items: React.ReactNode[] }) {
    return (
        <ul className="list-disc space-y-1 pl-6">
            {items.map((item, index) => (
                <li key={index}>{item}</li>
            ))}
        </ul>
    )
}
