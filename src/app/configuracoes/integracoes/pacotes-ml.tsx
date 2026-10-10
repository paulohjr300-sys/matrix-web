'use client'

import { useState } from 'react'
import { Loader2, Package } from 'lucide-react'

type Pacote = {
    id: string
    descricao: string
    preco: number | null
    duracaoDias: number | null
    tipo: string
    gratuito: boolean
    status: string | null
    expiraEm: string | null
    restantes: number | null
}

function formatMoney(value: number) {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// Mostra, direto do Mercado Livre, os pacotes de anúncio de veículos que a
// conta conectada tem e os que ela pode contratar.
export function PacotesMercadoLivre() {
    const [aberto, setAberto] = useState(false)
    const [carregando, setCarregando] = useState(false)
    const [erro, setErro] = useState<string | null>(null)
    const [dados, setDados] = useState<{
        disponiveis: Pacote[]
        contratados: Pacote[]
        tiposDisponiveis: { id: string; name: string; remaining: number | null }[]
    } | null>(null)

    async function carregar() {
        setAberto(true)
        setCarregando(true)
        setErro(null)

        const response = await fetch('/api/integracoes/mercadolivre/pacotes')
        const result = await response.json().catch(() => ({}))

        setCarregando(false)

        if (!response.ok) {
            setErro(result.message || 'Não foi possível consultar os pacotes.')
            return
        }

        setDados(result)
    }

    if (!aberto) {
        return (
            <button
                type="button"
                onClick={() => void carregar()}
                className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-brand-600 hover:underline"
            >
                <Package size={16} />
                Ver pacotes de anúncio da conta
            </button>
        )
    }

    const ativos = dados?.contratados.filter((p) => p.status === 'active' && p.tipo === 'publicação') || []

    return (
        <div className="mt-4 rounded-xl bg-zinc-50 p-4 text-sm ring-1 ring-zinc-200">
            {carregando && (
                <p className="flex items-center gap-2 text-zinc-500">
                    <Loader2 size={16} className="animate-spin" />
                    Consultando o Mercado Livre...
                </p>
            )}

            {erro && <p className="text-red-700">{erro}</p>}

            {dados && (
                <div className="space-y-4">
                    <div>
                        <p className="font-semibold text-zinc-900">Tipos de anúncio que a conta pode usar em carros</p>
                        {dados.tiposDisponiveis.length === 0 ? (
                            <p className="mt-1 text-red-700">
                                Nenhum. A conta não consegue publicar carros pelo sistema agora.
                            </p>
                        ) : (
                            <ul className="mt-1 space-y-1 text-zinc-700">
                                {dados.tiposDisponiveis.map((tipo) => (
                                    <li key={tipo.id}>
                                        <strong>{tipo.name}</strong> ({tipo.id})
                                        {tipo.remaining !== null && ` · ${tipo.remaining} restante(s)`}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    <div>
                        <p className="font-semibold text-zinc-900">Pacotes da conta</p>
                        {ativos.length === 0 ? (
                            dados.tiposDisponiveis.length > 0 ? (
                                <p className="mt-1 text-zinc-600">
                                    Nenhum pacote contratado. A conta publica com os tipos de anúncio acima.
                                </p>
                            ) : (
                                <p className="mt-1 text-red-700">
                                    Nenhum pacote de publicação ativo. Sem ele, o Mercado Livre não aceita anúncios de veículos.
                                </p>
                            )
                        ) : (
                            <ul className="mt-1 space-y-1 text-zinc-700">
                                {ativos.map((p) => (
                                    <li key={p.id + p.expiraEm}>
                                        <strong>{p.descricao}</strong>
                                        {p.restantes !== null && ` · ${p.restantes} anúncio(s) restante(s)`}
                                        {p.expiraEm && ` · vence em ${new Date(p.expiraEm).toLocaleDateString('pt-BR')}`}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    <div>
                        <p className="font-semibold text-zinc-900">Pacotes que o Mercado Livre oferece para carros</p>
                        {dados.disponiveis.length === 0 ? (
                            <p className="mt-1 text-zinc-500">
                                O Mercado Livre não listou pacotes para esta conta. Fale com o comercial deles.
                            </p>
                        ) : (
                            <ul className="mt-1 space-y-1 text-zinc-700">
                                {dados.disponiveis.map((p) => (
                                    <li key={p.id}>
                                        <strong>{p.descricao}</strong> ({p.tipo})
                                        {' · '}
                                        {p.gratuito ? 'grátis' : p.preco !== null ? formatMoney(p.preco) : 'preço sob consulta'}
                                        {p.duracaoDias ? ` · ${p.duracaoDias} dias` : ''}
                                    </li>
                                ))}
                            </ul>
                        )}
                        <p className="mt-2 text-xs text-zinc-500">
                            A contratação é feita no próprio Mercado Livre, pela conta da loja.
                        </p>
                    </div>
                </div>
            )}
        </div>
    )
}
