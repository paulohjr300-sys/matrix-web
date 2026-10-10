'use client'

import { useState } from 'react'
import { Loader2, Package } from 'lucide-react'

type Plano = {
    plano: string
    usados: number | null
    disponiveis: number | null
    total: number | null
    renovaEm: string | null
}

// Plano profissional da conta OLX conectada e o saldo de anúncios.
export function PlanoOlx() {
    const [aberto, setAberto] = useState(false)
    const [carregando, setCarregando] = useState(false)
    const [erro, setErro] = useState<string | null>(null)
    const [plano, setPlano] = useState<Plano | null>(null)

    async function carregar() {
        setAberto(true)
        setCarregando(true)
        setErro(null)

        const response = await fetch('/api/integracoes/olx/plano')
        const result = await response.json().catch(() => ({}))

        setCarregando(false)

        if (!response.ok) {
            setErro(result.message || 'Não foi possível consultar o plano da OLX.')
            return
        }

        setPlano(result)
    }

    if (!aberto) {
        return (
            <button
                type="button"
                onClick={() => void carregar()}
                className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-brand-600 hover:underline"
            >
                <Package size={16} />
                Ver plano da OLX
            </button>
        )
    }

    return (
        <div className="mt-4 rounded-xl bg-zinc-50 p-4 text-sm ring-1 ring-zinc-200">
            {carregando && (
                <p className="flex items-center gap-2 text-zinc-500">
                    <Loader2 size={16} className="animate-spin" />
                    Consultando a OLX...
                </p>
            )}

            {erro && <p className="text-red-700">{erro}</p>}

            {plano && (
                <div className="space-y-1 text-zinc-700">
                    <p className="font-semibold text-zinc-900">{plano.plano}</p>
                    {plano.total !== null && (
                        <p>
                            {plano.disponiveis ?? 0} anúncio(s) disponível(is) de {plano.total} · {plano.usados ?? 0} usado(s)
                        </p>
                    )}
                    {plano.renovaEm && <p>Renova em {new Date(plano.renovaEm).toLocaleDateString('pt-BR')}</p>}
                </div>
            )}
        </div>
    )
}
