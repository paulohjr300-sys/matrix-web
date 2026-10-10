'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'

export type OlxCatalogo = { marcaId: string; modeloId: string; versaoId: string; versaoNome?: string }

type Opcao = { id: string; nome: string }

const selectClass =
    'mt-1 w-full rounded-lg border border-zinc-200 bg-white px-2.5 py-2 text-xs outline-none focus:border-brand-500 disabled:bg-zinc-100'

async function buscar(query: string): Promise<{ opcoes?: Opcao[]; marca?: Opcao | null; modelo?: Opcao | null; versao?: Opcao | null }> {
    const response = await fetch(`/api/integracoes/olx/catalogo?${query}`)
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data.message || 'Não foi possível consultar a OLX.')
    return data
}

// A OLX exige marca/modelo/versão do catálogo dela (diferente da FIPE).
// O painel sugere a combinação mais parecida e o lojista confirma.
export function OlxCatalogPicker({
    vehicleId,
    inicial,
    onChange,
}: {
    vehicleId: string
    inicial?: OlxCatalogo | null
    onChange: (value: OlxCatalogo | null) => void
}) {
    const [marcas, setMarcas] = useState<Opcao[]>([])
    const [modelos, setModelos] = useState<Opcao[]>([])
    const [versoes, setVersoes] = useState<Opcao[]>([])
    const [marca, setMarca] = useState(inicial?.marcaId || '')
    const [modelo, setModelo] = useState(inicial?.modeloId || '')
    const [versao, setVersao] = useState(inicial?.versaoId || '')
    const [carregando, setCarregando] = useState(true)
    const [erro, setErro] = useState<string | null>(null)

    useEffect(() => {
        let cancelado = false

        async function iniciar() {
            try {
                const lista = await buscar('')
                if (cancelado) return
                setMarcas(lista.opcoes || [])

                let m = inicial?.marcaId || ''
                let mo = inicial?.modeloId || ''
                let v = inicial?.versaoId || ''

                if (!m) {
                    const sugestao = await buscar(`sugerir=${vehicleId}`)
                    m = sugestao.marca?.id || ''
                    mo = sugestao.modelo?.id || ''
                    v = sugestao.versao?.id || ''
                }

                if (m) setModelos((await buscar(`marca=${m}`)).opcoes || [])
                if (m && mo) setVersoes((await buscar(`marca=${m}&modelo=${mo}`)).opcoes || [])
                if (cancelado) return

                setMarca(m)
                setModelo(mo)
                setVersao(v)
            } catch (error) {
                if (!cancelado) setErro((error as Error).message)
            } finally {
                if (!cancelado) setCarregando(false)
            }
        }

        void iniciar()

        return () => {
            cancelado = true
        }
        // Carrega uma vez ao abrir o veículo.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [vehicleId])

    // Avisa o pai sempre que a combinação muda.
    useEffect(() => {
        if (marca && modelo && versao) {
            onChange({ marcaId: marca, modeloId: modelo, versaoId: versao, versaoNome: versoes.find((x) => x.id === versao)?.nome })
        } else {
            onChange(null)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [marca, modelo, versao, versoes])

    async function escolherMarca(id: string) {
        setMarca(id)
        setModelo('')
        setVersao('')
        setVersoes([])
        setModelos(id ? (await buscar(`marca=${id}`).catch(() => ({ opcoes: [] }))).opcoes || [] : [])
    }

    async function escolherModelo(id: string) {
        setModelo(id)
        setVersao('')
        setVersoes(id ? (await buscar(`marca=${marca}&modelo=${id}`).catch(() => ({ opcoes: [] }))).opcoes || [] : [])
    }

    if (erro) return <p className="mt-3 text-xs text-red-700">{erro}</p>

    return (
        <div className="mt-3 rounded-xl bg-white p-3 ring-1 ring-zinc-200">
            <p className="flex items-center gap-2 text-xs font-semibold text-zinc-700">
                Veículo no catálogo da OLX
                {carregando && <Loader2 size={12} className="animate-spin" />}
            </p>
            <p className="mt-0.5 text-[11px] text-zinc-500">Sugestão automática pelo nome. Confira antes de publicar.</p>

            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                <label className="text-[11px] text-zinc-600">
                    Marca
                    <select value={marca} disabled={carregando} onChange={(e) => void escolherMarca(e.target.value)} className={selectClass}>
                        <option value="">Selecione</option>
                        {marcas.map((o) => (
                            <option key={o.id} value={o.id}>{o.nome}</option>
                        ))}
                    </select>
                </label>
                <label className="text-[11px] text-zinc-600">
                    Modelo
                    <select value={modelo} disabled={carregando || !marca} onChange={(e) => void escolherModelo(e.target.value)} className={selectClass}>
                        <option value="">Selecione</option>
                        {modelos.map((o) => (
                            <option key={o.id} value={o.id}>{o.nome}</option>
                        ))}
                    </select>
                </label>
                <label className="text-[11px] text-zinc-600">
                    Versão
                    <select value={versao} disabled={carregando || !modelo} onChange={(e) => setVersao(e.target.value)} className={selectClass}>
                        <option value="">Selecione</option>
                        {versoes.map((o) => (
                            <option key={o.id} value={o.id}>{o.nome}</option>
                        ))}
                    </select>
                </label>
            </div>
        </div>
    )
}
