'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'

type Situacao = {
    incluido: boolean
    publicadoNoSite: boolean
    emEstoque: boolean
    faltando: string[]
}

// Linha do Facebook/Instagram no bloco de anúncios do veículo. O catálogo é
// automático: todo carro publicado no site entra, a menos que o lojista o
// remova aqui.
export function CatalogoMetaVeiculo({
    vehicleId,
    leituraMeta,
    onMessage,
}: {
    vehicleId: string
    leituraMeta: { lidoEm: string | null; itens: number | null } | null
    onMessage: (type: 'success' | 'error', title: string, description?: string) => void
}) {
    const [situacao, setSituacao] = useState<Situacao | null>(null)
    const [salvando, setSalvando] = useState(false)

    const load = useCallback(async () => {
        const [{ data: veiculo }, { count: fotos }] = await Promise.all([
            supabase
                .from('vehicles')
                .select('is_published, status, advertised_price, model_year, brand_id, model_id, catalogo_meta')
                .eq('id', vehicleId)
                .single(),
            supabase
                .from('vehicle_files')
                .select('id', { count: 'exact', head: true })
                .eq('vehicle_id', vehicleId)
                .eq('file_type', 'IMAGE'),
        ])

        if (!veiculo) return

        const faltando: string[] = []
        if (!fotos) faltando.push('foto')
        if (!veiculo.advertised_price) faltando.push('valor anunciado')
        if (!veiculo.brand_id || !veiculo.model_id) faltando.push('marca e modelo')
        if (!veiculo.model_year) faltando.push('ano modelo')

        setSituacao({
            incluido: veiculo.catalogo_meta !== false,
            publicadoNoSite: veiculo.is_published === true,
            emEstoque: veiculo.status === 'EM_ESTOQUE',
            faltando,
        })
    }, [vehicleId])

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- carga ao abrir o veículo
        void load()
    }, [load])

    async function alternar(incluir: boolean) {
        setSalvando(true)

        const { error } = await supabase.from('vehicles').update({ catalogo_meta: incluir }).eq('id', vehicleId)

        setSalvando(false)

        if (error) {
            onMessage('error', 'Não foi possível alterar', error.message)
            return
        }

        onMessage(
            'success',
            incluir ? 'Incluído no catálogo' : 'Removido do catálogo',
            'A mudança chega ao Facebook e ao Instagram na próxima leitura da Meta.'
        )
        await load()
    }

    if (!situacao) return null

    let status: { texto: string; estilo: string }
    let motivo: string | null = null

    if (!situacao.incluido) {
        status = { texto: 'Removido do catálogo', estilo: 'bg-zinc-100 text-zinc-600' }
    } else if (!situacao.emEstoque) {
        status = { texto: 'Fora do catálogo', estilo: 'bg-zinc-100 text-zinc-600' }
        motivo = 'Só entram veículos em estoque (vendido e reservado ficam de fora).'
    } else if (!situacao.publicadoNoSite) {
        status = { texto: 'Fora do catálogo', estilo: 'bg-amber-50 text-amber-700' }
        motivo = 'O veículo não está publicado no site. Marque "Publicado no site" para ele entrar no catálogo.'
    } else if (situacao.faltando.length) {
        status = { texto: 'Fora do catálogo', estilo: 'bg-amber-50 text-amber-700' }
        motivo = `Falta: ${situacao.faltando.join(', ')}.`
    } else {
        status = { texto: 'No catálogo', estilo: 'bg-emerald-50 text-emerald-700' }
    }

    return (
        <div className="rounded-2xl bg-zinc-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <span className="font-semibold text-zinc-900">Facebook e Instagram</span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${status.estilo}`}>{status.texto}</span>
                </div>

                <button
                    type="button"
                    disabled={salvando}
                    onClick={() => void alternar(!situacao.incluido)}
                    className={`rounded-xl px-3 py-2 text-xs font-bold transition disabled:opacity-50 ${situacao.incluido
                        ? 'bg-red-50 text-red-700 hover:bg-red-100'
                        : 'bg-brand-600 text-white hover:bg-brand-700'
                        }`}
                >
                    {salvando ? (
                        <Loader2 size={14} className="animate-spin" />
                    ) : situacao.incluido ? (
                        'Remover do catálogo'
                    ) : (
                        'Incluir no catálogo'
                    )}
                </button>
            </div>

            {motivo && situacao.incluido && <p className="mt-2 text-sm text-zinc-600">{motivo}</p>}

            <p className="mt-2 text-xs text-zinc-500">
                {leituraMeta?.lidoEm ? (
                    <>
                        Integração funcionando: a Meta leu o catálogo em{' '}
                        {new Date(leituraMeta.lidoEm).toLocaleString('pt-BR')}
                        {leituraMeta.itens !== null && ` (${leituraMeta.itens} veículo(s))`}.
                    </>
                ) : (
                    <>
                        A Meta ainda não leu o catálogo da loja.{' '}
                        <Link href="/configuracoes/integracoes" className="font-semibold text-brand-600 hover:underline">
                            Configurar em Integrações
                        </Link>
                    </>
                )}
            </p>
        </div>
    )
}
