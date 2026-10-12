'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AlertTriangle, Lock } from 'lucide-react'

type Situacao = {
    status: 'trial' | 'ativa' | 'inadimplente' | 'cancelada'
    diasDeTeste: number | null
    bloqueado: boolean
    motivo: string | null
    admin: boolean
    temAssinatura?: boolean
}

const PAGINA_ASSINATURA = '/configuracoes/assinatura'

// Consultada no máximo a cada 2 minutos durante a navegação.
let cache: { em: number; situacao: Situacao } | null = null

// Faixa de aviso (fim do teste, pagamento em atraso) e bloqueio do painel
// quando o teste acabou ou a mensalidade está em atraso além da tolerância.
export function AssinaturaAviso() {
    const pathname = usePathname()
    const [situacao, setSituacao] = useState<Situacao | null>(cache?.situacao ?? null)

    useEffect(() => {
        // Na própria página de assinatura sempre busca de novo.
        if (cache && Date.now() - cache.em < 120_000 && pathname !== PAGINA_ASSINATURA) return

        let ativo = true

        fetch('/api/assinatura', { cache: 'no-store' })
            .then((response) => (response.ok ? response.json() : null))
            .then((result: Situacao | null) => {
                if (!result || !ativo) return
                cache = { em: Date.now(), situacao: result }
                setSituacao(result)
            })
            .catch(() => undefined)

        return () => {
            ativo = false
        }
    }, [pathname])

    if (!situacao) return null

    if (situacao.bloqueado && pathname !== PAGINA_ASSINATURA) {
        return (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-brand-950/70 p-4 backdrop-blur-sm">
                <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-2xl">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                        <Lock size={26} />
                    </div>
                    <h2 className="mt-4 text-xl font-black text-zinc-900">Painel bloqueado</h2>
                    <p className="mt-2 text-sm text-zinc-600">{situacao.motivo}</p>

                    {situacao.admin ? (
                        <Link
                            href={PAGINA_ASSINATURA}
                            className="mt-6 inline-flex rounded-xl bg-brand-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-brand-700"
                        >
                            Ver assinatura
                        </Link>
                    ) : (
                        <p className="mt-6 text-sm font-semibold text-zinc-800">
                            Peça ao administrador da loja para regularizar a assinatura.
                        </p>
                    )}
                </div>
            </div>
        )
    }

    let aviso: string | null = null

    if (situacao.status === 'inadimplente' && !situacao.bloqueado) {
        aviso = 'Há uma mensalidade em atraso. Pague a fatura para evitar o bloqueio do painel.'
    } else if (
        situacao.admin &&
        situacao.status === 'trial' &&
        !situacao.temAssinatura &&
        situacao.diasDeTeste !== null &&
        situacao.diasDeTeste >= 0 &&
        situacao.diasDeTeste <= 5
    ) {
        aviso =
            situacao.diasDeTeste === 0
                ? 'Seu teste grátis termina hoje. Escolha um plano para continuar usando o painel.'
                : `Seu teste grátis termina em ${situacao.diasDeTeste} dia(s). Escolha um plano para não perder o acesso.`
    }

    if (!aviso || pathname === PAGINA_ASSINATURA) return null

    return (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-amber-50 px-4 py-3 text-sm md:px-8 text-amber-900 ring-1 ring-amber-200">
            <span className="flex items-center gap-2 font-semibold">
                <AlertTriangle size={16} /> {aviso}
            </span>
            {situacao.admin && (
                <Link href={PAGINA_ASSINATURA} className="font-bold underline">
                    Ver assinatura
                </Link>
            )}
        </div>
    )
}
