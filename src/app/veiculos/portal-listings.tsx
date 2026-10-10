'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ExternalLink, Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'

type Anuncio = {
    portal: string
    status: 'pendente' | 'publicado' | 'pausado' | 'encerrado' | 'erro'
    external_url: string | null
    ultimo_erro: string | null
    sincronizado_em: string | null
}

type PortalInfo = {
    portal: string
    nome: string
    disponivel: boolean
    conexao: { status: string } | null
}

type Action = 'publicar' | 'atualizar' | 'pausar' | 'reativar' | 'encerrar'

const STATUS_LABEL: Record<Anuncio['status'], string> = {
    pendente: 'Pendente',
    publicado: 'Publicado',
    pausado: 'Pausado',
    encerrado: 'Encerrado',
    erro: 'Não publicado',
}

const STATUS_STYLE: Record<Anuncio['status'], string> = {
    pendente: 'bg-zinc-100 text-zinc-600',
    publicado: 'bg-emerald-50 text-emerald-700',
    pausado: 'bg-amber-50 text-amber-700',
    encerrado: 'bg-zinc-100 text-zinc-600',
    erro: 'bg-red-50 text-red-700',
}

const buttonClass =
    'rounded-xl px-3 py-2 text-xs font-bold transition disabled:opacity-50'

// Anúncios do veículo nos portais conectados, com as ações de cada um.
export function PortalListings({
    vehicleId,
    onMessage,
}: {
    vehicleId: string
    onMessage: (type: 'success' | 'error', title: string, description?: string) => void
}) {
    const [portais, setPortais] = useState<PortalInfo[]>([])
    const [liberado, setLiberado] = useState(true)
    const [anuncios, setAnuncios] = useState<Anuncio[]>([])
    const [running, setRunning] = useState<string | null>(null)

    const load = useCallback(async () => {
        const [integracoesResponse, anunciosResult] = await Promise.all([
            fetch('/api/integracoes').then((response) => response.json()).catch(() => null),
            supabase
                .from('anuncios_portal')
                .select('portal, status, external_url, ultimo_erro, sincronizado_em')
                .eq('vehicle_id', vehicleId),
        ])

        setPortais(integracoesResponse?.portais || [])
        setLiberado(integracoesResponse?.liberado !== false)
        setAnuncios((anunciosResult.data || []) as Anuncio[])
    }, [vehicleId])

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- carga ao abrir o veículo
        void load()
    }, [load])

    async function run(portal: string, action: Action) {
        setRunning(`${portal}:${action}`)

        try {
            const response = await fetch('/api/integracoes/anuncios', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ vehicleId, portal, action }),
            })

            const result = await response.json().catch(() => ({}))

            if (!response.ok) {
                onMessage('error', 'Não foi possível concluir', result.message)
            } else {
                const labels: Record<Action, string> = {
                    publicar: 'Anúncio publicado',
                    atualizar: 'Anúncio atualizado',
                    pausar: 'Anúncio pausado',
                    reativar: 'Anúncio reativado',
                    encerrar: 'Anúncio encerrado',
                }
                onMessage('success', labels[action])
            }
        } finally {
            setRunning(null)
            await load()
        }
    }

    const conectados = portais.filter((item) => item.disponivel && item.conexao?.status === 'conectado')

    return (
        <div className="mt-8 rounded-3xl border border-zinc-200 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-lg font-bold text-zinc-950">Anúncios nos portais</h3>
                <Link href="/configuracoes/integracoes" className="text-xs font-semibold text-brand-600 hover:underline">
                    Gerenciar integrações
                </Link>
            </div>

            {!liberado && (
                <p className="mt-3 text-sm text-zinc-500">
                    Publicar nos portais faz parte do plano Pro.
                </p>
            )}

            {liberado && conectados.length === 0 && (
                <p className="mt-3 text-sm text-zinc-500">
                    Nenhum portal conectado. Conecte a conta do Mercado Livre em Configurações &gt; Integrações.
                </p>
            )}

            <div className="mt-4 space-y-3">
                {conectados.map((item) => {
                    const anuncio = anuncios.find((a) => a.portal === item.portal)
                    const status = anuncio?.status
                    const busy = (action: Action) => running === `${item.portal}:${action}`
                    const disabled = running !== null

                    const button = (action: Action, label: string, style: string) => (
                        <button
                            type="button"
                            disabled={disabled}
                            onClick={() => void run(item.portal, action)}
                            className={`${buttonClass} ${style}`}
                        >
                            {busy(action) ? <Loader2 size={14} className="animate-spin" /> : label}
                        </button>
                    )

                    return (
                        <div key={item.portal} className="rounded-2xl bg-zinc-50 p-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="flex items-center gap-3">
                                    <span className="font-semibold text-zinc-900">{item.nome}</span>
                                    {status && (
                                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS_STYLE[status]}`}>
                                            {STATUS_LABEL[status]}
                                        </span>
                                    )}
                                    {anuncio?.external_url && status !== 'encerrado' && (
                                        <a
                                            href={anuncio.external_url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline"
                                        >
                                            Ver anúncio
                                            <ExternalLink size={12} />
                                        </a>
                                    )}
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    {(!status || status === 'erro' || status === 'encerrado' || status === 'pendente') &&
                                        button('publicar', 'Publicar', 'bg-brand-600 text-white hover:bg-brand-700')}
                                    {status === 'publicado' && (
                                        <>
                                            {button('atualizar', 'Atualizar', 'bg-white text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-100')}
                                            {button('pausar', 'Pausar', 'bg-white text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-100')}
                                        </>
                                    )}
                                    {status === 'pausado' &&
                                        button('reativar', 'Reativar', 'bg-brand-600 text-white hover:bg-brand-700')}
                                    {(status === 'publicado' || status === 'pausado') &&
                                        button('encerrar', 'Encerrar', 'bg-red-50 text-red-700 hover:bg-red-100')}
                                </div>
                            </div>

                            {anuncio?.ultimo_erro && (
                                <p className="mt-3 text-sm text-red-700">{anuncio.ultimo_erro}</p>
                            )}

                            {anuncio?.sincronizado_em && !anuncio.ultimo_erro && (
                                <p className="mt-2 text-xs text-zinc-500">
                                    Última sincronização: {new Date(anuncio.sincronizado_em).toLocaleString('pt-BR')}
                                </p>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
