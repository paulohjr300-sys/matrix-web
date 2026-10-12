'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Camera, Check, Copy, Download, Loader2, Share2, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { getEmpresaId, getSiteUrl } from '../../lib/tenant'
import { hashtag, LEGENDA_PADRAO, montarLegenda, VARIAVEIS_LEGENDA } from '../../lib/legenda-post'

// Post do veículo para Instagram/Facebook: monta a legenda a partir de um
// modelo (o da loja ou o padrão) e separa as fotos. O lojista copia a
// legenda e baixa/compartilha as fotos para postar pelo app.

const MAX_FOTOS = 10

type Foto = { id: string; url: string; nome: string }
type Rede = 'instagram' | 'facebook'

function telefone(valor: string | null) {
    const d = (valor || '').replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '')
    if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
    if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
    return valor || ''
}

export function CriarPost({
    vehicleId,
    onMessage,
}: {
    vehicleId: string
    onMessage: (type: 'success' | 'error', title: string, description?: string) => void
}) {
    const [aberto, setAberto] = useState(false)
    const [posts, setPosts] = useState<PostPublicado[]>([])

    const carregarPosts = useCallback(async () => {
        const response = await fetch(`/api/integracoes/meta/posts?vehicleId=${vehicleId}`, { cache: 'no-store' })
        if (response.ok) setPosts((await response.json()).posts || [])
    }, [vehicleId])

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- carga ao abrir o veículo
        void carregarPosts()
    }, [carregarPosts])

    async function marcarEditado(id: string) {
        const response = await fetch('/api/integracoes/meta/posts', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id }),
        })

        if (!response.ok) {
            onMessage('error', 'Não foi possível atualizar')
            return
        }

        await carregarPosts()
    }

    return (
        <>
            <div className="mt-6 rounded-3xl border border-zinc-200 bg-white p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h3 className="text-lg font-bold text-zinc-950">Post para Instagram e Facebook</h3>
                        <p className="text-sm text-zinc-500">Legenda pronta e fotos do veículo para postar pelo app.</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setAberto(true)}
                        className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-700"
                    >
                        <Camera size={16} /> Criar post
                    </button>
                </div>

                {posts.length > 0 && (
                    <div className="mt-4 space-y-2">
                        <p className="text-xs font-semibold uppercase text-zinc-500">Publicados pelo painel</p>
                        {posts.map((post) => {
                            const rede = post.rede === 'instagram' ? 'Instagram' : 'Facebook'
                            const quando = new Date(post.created_at).toLocaleDateString('pt-BR')

                            return (
                                <div
                                    key={post.id}
                                    className={`flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm ${post.vendido_erro && !post.vendido_em ? 'bg-amber-50 text-amber-900' : 'bg-zinc-50 text-zinc-700'}`}
                                >
                                    <span>
                                        <strong>{rede}</strong> · {quando}
                                        {post.vendido_em && ' · marcado VENDIDO'}
                                        {post.vendido_erro && !post.vendido_em && ' · carro vendido: edite o post pelo app e escreva "VENDIDO"'}
                                    </span>
                                    <span className="flex items-center gap-3">
                                        {post.url && (
                                            <a
                                                href={post.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="font-semibold text-brand-600 hover:underline"
                                            >
                                                Ver post
                                            </a>
                                        )}
                                        {post.vendido_erro && !post.vendido_em && (
                                            <button
                                                type="button"
                                                onClick={() => void marcarEditado(post.id)}
                                                className="font-semibold text-zinc-700 hover:underline"
                                            >
                                                Já editei
                                            </button>
                                        )}
                                    </span>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {aberto && (
                <JanelaPost
                    vehicleId={vehicleId}
                    onClose={() => {
                        setAberto(false)
                        void carregarPosts()
                    }}
                    onMessage={onMessage}
                />
            )}
        </>
    )
}

type PostPublicado = {
    id: string
    rede: 'instagram' | 'facebook'
    url: string | null
    created_at: string
    vendido_em: string | null
    vendido_erro: string | null
}

function JanelaPost({
    vehicleId,
    onClose,
    onMessage,
}: {
    vehicleId: string
    onClose: () => void
    onMessage: (type: 'success' | 'error', title: string, description?: string) => void
}) {
    const [carregando, setCarregando] = useState(true)
    const [valores, setValores] = useState<Record<string, string>>({})
    const [modeloLoja, setModeloLoja] = useState('')
    const [modelo, setModelo] = useState(LEGENDA_PADRAO)
    const [legenda, setLegenda] = useState('')
    const [editada, setEditada] = useState(false)
    const [editandoModelo, setEditandoModelo] = useState(false)
    const [fotos, setFotos] = useState<Foto[]>([])
    const [selecionadas, setSelecionadas] = useState<string[]>([])
    const [ocupado, setOcupado] = useState<string | null>(null)
    const [copiado, setCopiado] = useState(false)
    const [meta, setMeta] = useState<{
        pagina: { id: string; nome: string; instagram: { id: string; username: string | null } | null }
    } | null>(null)
    const [redes, setRedes] = useState<Rede[]>([])
    const [publicados, setPublicados] = useState<{ rede: Rede; url: string | null; erro?: string }[]>([])

    // Postagem automática: só com o plano liberado e a página conectada.
    useEffect(() => {
        fetch('/api/integracoes/meta', { cache: 'no-store' })
            .then((response) => (response.ok ? response.json() : null))
            .then((result) => {
                const pagina = result?.liberado && result.conexao?.status === 'conectado' ? result.conexao.pagina : null
                if (!pagina) return
                setMeta({ pagina })
                setRedes(pagina.instagram ? ['instagram', 'facebook'] : ['facebook'])
            })
            .catch(() => undefined)
    }, [])

    function alternarRede(rede: Rede) {
        setRedes((atual) => (atual.includes(rede) ? atual.filter((item) => item !== rede) : [...atual, rede]))
    }

    async function publicar() {
        setOcupado('publicar')
        setPublicados([])

        try {
            const response = await fetch('/api/integracoes/meta/postar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ vehicleId, legenda, fotoIds: selecionadas, redes }),
            })
            const result = await response.json().catch(() => ({}))

            if (!response.ok) {
                onMessage('error', 'Não foi possível publicar', result.message)
                return
            }

            setPublicados(result.resultados || [])
            const falhas = (result.resultados || []).filter((item: { erro?: string }) => item.erro).length

            if (!falhas) onMessage('success', 'Post publicado')
            else onMessage('error', 'Nem tudo foi publicado', 'Veja o motivo abaixo do botão Publicar.')
        } finally {
            setOcupado(null)
        }
    }

    const admin = typeof window !== 'undefined' && window.localStorage.getItem('painel_role') === 'ADMIN'

    useEffect(() => {
        async function carregar() {
            const empresaId = await getEmpresaId()

            const [{ data: veiculo }, { data: arquivos }, { data: empresa }, siteUrl] = await Promise.all([
                supabase
                    .from('vehicles')
                    .select(
                        'km, model_year, manufacture_year, advertised_price, versao, slug, is_published, main_photo_file_id, brands(name), vehicle_models(name), colors(name), fuels(name), transmissions(name)'
                    )
                    .eq('id', vehicleId)
                    .single(),
                supabase
                    .from('vehicle_files')
                    .select('id, file_name, file_path')
                    .eq('vehicle_id', vehicleId)
                    .eq('file_type', 'IMAGE')
                    .order('created_at'),
                supabase.from('empresas').select('nome, whatsapp, telefone, legenda_post').eq('id', empresaId).single(),
                getSiteUrl().catch(() => ''),
            ])

            if (!veiculo) {
                onMessage('error', 'Criar post', 'Não foi possível carregar o veículo.')
                onClose()
                return
            }

            const nome = (rel: unknown) => {
                const item = Array.isArray(rel) ? rel[0] : rel
                return (item as { name?: string } | null)?.name || ''
            }

            const marca = nome(veiculo.brands)
            const modeloNome = nome(veiculo.vehicle_models)
            const ano =
                veiculo.manufacture_year && veiculo.model_year && veiculo.manufacture_year !== veiculo.model_year
                    ? `${veiculo.manufacture_year}/${veiculo.model_year}`
                    : String(veiculo.model_year || veiculo.manufacture_year || '')

            setValores({
                marca,
                modelo: modeloNome,
                versao: veiculo.versao || '',
                ano,
                km: veiculo.km !== null && veiculo.km !== undefined ? Number(veiculo.km).toLocaleString('pt-BR') : '',
                preco: veiculo.advertised_price
                    ? Number(veiculo.advertised_price).toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                        maximumFractionDigits: 0,
                    })
                    : '',
                cor: nome(veiculo.colors),
                combustivel: nome(veiculo.fuels),
                cambio: nome(veiculo.transmissions),
                whatsapp: telefone(empresa?.whatsapp || empresa?.telefone || null),
                // Só com o veículo publicado: senão o link do site não abre.
                link: siteUrl && veiculo.is_published ? `${siteUrl}/estoque/${veiculo.slug || vehicleId}` : '',
                loja: empresa?.nome || '',
                marca_tag: hashtag(marca),
                modelo_tag: hashtag(modeloNome),
            })

            const daLoja = empresa?.legenda_post || ''
            setModeloLoja(daLoja)
            setModelo(daLoja || LEGENDA_PADRAO)

            // Foto principal primeiro.
            const lista = (arquivos || [])
                .map((arquivo) => ({
                    id: arquivo.id,
                    nome: arquivo.file_name,
                    url: supabase.storage.from('vehicle-images').getPublicUrl(arquivo.file_path).data.publicUrl,
                }))
                .sort((a, b) =>
                    a.id === veiculo.main_photo_file_id ? -1 : b.id === veiculo.main_photo_file_id ? 1 : 0
                )

            setFotos(lista)
            setSelecionadas(lista.slice(0, MAX_FOTOS).map((foto) => foto.id))
            setCarregando(false)
        }

        void carregar()
        // eslint-disable-next-line react-hooks/exhaustive-deps -- carrega uma vez por veículo
    }, [vehicleId])

    const legendaGerada = useMemo(() => montarLegenda(modelo, valores), [modelo, valores])

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- legenda acompanha o modelo até ser editada à mão
        if (!editada) setLegenda(legendaGerada)
    }, [legendaGerada, editada])

    const fotosSelecionadas = fotos.filter((foto) => selecionadas.includes(foto.id))
    const podeCompartilhar =
        typeof navigator !== 'undefined' && typeof navigator.share === 'function' && typeof navigator.canShare === 'function'

    function alternarFoto(id: string) {
        setSelecionadas((atual) => {
            if (atual.includes(id)) return atual.filter((item) => item !== id)
            if (atual.length >= MAX_FOTOS) {
                onMessage('error', 'Limite de fotos', `O Instagram aceita até ${MAX_FOTOS} fotos por post.`)
                return atual
            }
            return [...atual, id]
        })
    }

    async function copiar() {
        try {
            await navigator.clipboard.writeText(legenda)
            setCopiado(true)
            setTimeout(() => setCopiado(false), 2000)
        } catch {
            onMessage('error', 'Não foi possível copiar', 'Selecione o texto da legenda e copie manualmente.')
        }
    }

    async function arquivosDasFotos() {
        return Promise.all(
            fotosSelecionadas.map(async (foto, indice) => {
                const resposta = await fetch(foto.url)
                if (!resposta.ok) throw new Error('Falha ao baixar a foto.')
                const blob = await resposta.blob()
                const extensao = (blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg')
                return new File([blob], `foto-${String(indice + 1).padStart(2, '0')}.${extensao}`, { type: blob.type })
            })
        )
    }

    async function baixar() {
        if (!fotosSelecionadas.length) return
        setOcupado('baixar')

        try {
            const arquivos = await arquivosDasFotos()

            for (const arquivo of arquivos) {
                const url = URL.createObjectURL(arquivo)
                const link = document.createElement('a')
                link.href = url
                link.download = arquivo.name
                document.body.appendChild(link)
                link.click()
                link.remove()
                URL.revokeObjectURL(url)
                await new Promise((resolve) => setTimeout(resolve, 300))
            }

            onMessage('success', 'Fotos baixadas', 'Se o navegador perguntar, permita baixar vários arquivos.')
        } catch {
            onMessage('error', 'Não foi possível baixar as fotos')
        } finally {
            setOcupado(null)
        }
    }

    // No celular abre a folha de compartilhamento com as fotos (Instagram,
    // Facebook, WhatsApp...). A legenda é copiada antes: o Instagram não
    // aceita texto vindo do compartilhamento, é só colar.
    async function compartilhar() {
        if (!fotosSelecionadas.length) return
        setOcupado('compartilhar')

        try {
            await navigator.clipboard.writeText(legenda).catch(() => undefined)
            const arquivos = await arquivosDasFotos()

            if (!navigator.canShare({ files: arquivos })) {
                onMessage('error', 'Compartilhar', 'Este navegador não compartilha fotos. Use "Baixar fotos".')
                return
            }

            await navigator.share({ files: arquivos, text: legenda })
        } catch (error) {
            if ((error as Error)?.name !== 'AbortError') {
                onMessage('error', 'Não foi possível compartilhar', 'Use "Baixar fotos" e poste pelo app.')
            }
        } finally {
            setOcupado(null)
        }
    }

    async function salvarModelo() {
        setOcupado('modelo')

        const empresaId = await getEmpresaId()
        const valor = modelo.trim() === LEGENDA_PADRAO.trim() ? null : modelo.trim()
        const { error } = await supabase.from('empresas').update({ legenda_post: valor }).eq('id', empresaId)

        setOcupado(null)

        if (error) {
            onMessage('error', 'Não foi possível salvar o modelo', error.message)
            return
        }

        setModeloLoja(valor || '')
        setEditandoModelo(false)
        onMessage('success', 'Modelo salvo', 'Os próximos posts da loja usam este modelo.')
    }

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/60 p-0 sm:items-center sm:p-4">
            <div className="flex max-h-[95vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
                <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
                    <h2 className="text-lg font-black text-zinc-950">Criar post</h2>
                    <button type="button" onClick={onClose} className="rounded-xl p-2 text-zinc-500 hover:bg-zinc-100">
                        <X size={20} />
                    </button>
                </div>

                {carregando ? (
                    <div className="flex items-center gap-2 p-8 text-zinc-500">
                        <Loader2 size={18} className="animate-spin" /> Carregando...
                    </div>
                ) : (
                    <div className="overflow-y-auto px-6 py-5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <label className="text-sm font-semibold text-zinc-800">Legenda</label>
                            <div className="flex gap-3 text-xs font-semibold">
                                {editada && (
                                    <button
                                        type="button"
                                        onClick={() => setEditada(false)}
                                        className="text-zinc-500 hover:underline"
                                    >
                                        Refazer pelo modelo
                                    </button>
                                )}
                                {admin && (
                                    <button
                                        type="button"
                                        onClick={() => setEditandoModelo((atual) => !atual)}
                                        className="text-brand-600 hover:underline"
                                    >
                                        {editandoModelo ? 'Fechar modelo' : 'Editar modelo da loja'}
                                    </button>
                                )}
                            </div>
                        </div>

                        {editandoModelo && (
                            <div className="mt-2 rounded-2xl bg-zinc-50 p-4 ring-1 ring-zinc-200">
                                <p className="text-xs text-zinc-600">
                                    O modelo vale para todos os veículos. Use as variáveis:{' '}
                                    {VARIAVEIS_LEGENDA.map((v) => `{${v}}`).join(' ')}. Linhas com variáveis vazias somem.
                                </p>
                                <textarea
                                    value={modelo}
                                    onChange={(event) => {
                                        setModelo(event.target.value)
                                        setEditada(false)
                                    }}
                                    rows={9}
                                    maxLength={2200}
                                    className="mt-2 w-full rounded-xl border border-zinc-200 bg-white p-3 font-mono text-xs outline-none focus:border-brand-500"
                                />
                                <div className="mt-2 flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        onClick={() => void salvarModelo()}
                                        disabled={ocupado === 'modelo'}
                                        className="rounded-xl bg-brand-600 px-4 py-2 text-xs font-bold text-white hover:bg-brand-700 disabled:opacity-50"
                                    >
                                        Salvar como modelo da loja
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setModelo(LEGENDA_PADRAO)}
                                        className="rounded-xl bg-white px-4 py-2 text-xs font-bold text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-100"
                                    >
                                        Usar o modelo padrão
                                    </button>
                                    {modeloLoja && (
                                        <span className="self-center text-xs text-zinc-500">A loja tem um modelo próprio.</span>
                                    )}
                                </div>
                            </div>
                        )}

                        <textarea
                            value={legenda}
                            onChange={(event) => {
                                setLegenda(event.target.value)
                                setEditada(true)
                            }}
                            rows={12}
                            maxLength={2200}
                            className="mt-2 w-full rounded-2xl border border-zinc-200 p-4 text-sm leading-6 outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
                        />
                        <p className="mt-1 text-right text-xs text-zinc-400">{legenda.length}/2200</p>

                        <div className="mt-4">
                            <p className="text-sm font-semibold text-zinc-800">
                                Fotos ({fotosSelecionadas.length}/{Math.min(fotos.length, MAX_FOTOS)})
                            </p>

                            {fotos.length === 0 ? (
                                <p className="mt-2 text-sm text-zinc-500">Este veículo não tem fotos.</p>
                            ) : (
                                <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-6">
                                    {fotos.map((foto) => {
                                        const marcada = selecionadas.includes(foto.id)
                                        const posicao = selecionadas.indexOf(foto.id) + 1

                                        return (
                                            <button
                                                key={foto.id}
                                                type="button"
                                                onClick={() => alternarFoto(foto.id)}
                                                className={`relative aspect-square overflow-hidden rounded-xl ring-2 transition ${marcada ? 'ring-brand-500' : 'opacity-50 ring-transparent'}`}
                                            >
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img src={foto.url} alt={foto.nome} className="h-full w-full object-cover" />
                                                {marcada && (
                                                    <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-[10px] font-bold text-white">
                                                        {posicao}
                                                    </span>
                                                )}
                                            </button>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {!carregando && meta?.pagina && (
                    <div className="border-t border-zinc-100 bg-brand-50/50 px-6 py-4">
                        <p className="text-sm font-semibold text-zinc-800">Publicar agora pelo painel</p>
                        <div className="mt-2 flex flex-wrap items-center gap-4">
                            <label className={`flex items-center gap-2 text-sm ${meta.pagina.instagram ? '' : 'opacity-50'}`}>
                                <input
                                    type="checkbox"
                                    disabled={!meta.pagina.instagram}
                                    checked={redes.includes('instagram')}
                                    onChange={() => alternarRede('instagram')}
                                />
                                Instagram
                                {meta.pagina.instagram?.username && (
                                    <span className="text-zinc-500">@{meta.pagina.instagram.username}</span>
                                )}
                            </label>
                            <label className="flex items-center gap-2 text-sm">
                                <input
                                    type="checkbox"
                                    checked={redes.includes('facebook')}
                                    onChange={() => alternarRede('facebook')}
                                />
                                Facebook <span className="text-zinc-500">{meta.pagina.nome}</span>
                            </label>
                            <button
                                type="button"
                                onClick={() => void publicar()}
                                disabled={!redes.length || !fotosSelecionadas.length || ocupado !== null}
                                className="ml-auto inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-50"
                            >
                                {ocupado === 'publicar' && <Loader2 size={16} className="animate-spin" />}
                                {ocupado === 'publicar' ? 'Publicando...' : 'Publicar'}
                            </button>
                        </div>
                        {publicados.length > 0 && (
                            <div className="mt-2 space-y-1 text-sm">
                                {publicados.map((item) => (
                                    <p key={item.rede} className={item.erro ? 'text-red-700' : 'text-emerald-700'}>
                                        {item.rede === 'instagram' ? 'Instagram' : 'Facebook'}:{' '}
                                        {item.erro ? (
                                            item.erro
                                        ) : item.url ? (
                                            <a href={item.url} target="_blank" rel="noopener noreferrer" className="font-semibold underline">
                                                publicado, ver post
                                            </a>
                                        ) : (
                                            'publicado'
                                        )}
                                    </p>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {!carregando && (
                    <div className="flex flex-wrap gap-2 border-t border-zinc-100 px-6 py-4">
                        <button
                            type="button"
                            onClick={() => void copiar()}
                            className="inline-flex items-center gap-2 rounded-xl bg-zinc-950 px-4 py-2.5 text-sm font-bold text-white hover:bg-zinc-800"
                        >
                            {copiado ? <Check size={16} /> : <Copy size={16} />}
                            {copiado ? 'Copiada' : 'Copiar legenda'}
                        </button>

                        <button
                            type="button"
                            onClick={() => void baixar()}
                            disabled={!fotosSelecionadas.length || ocupado !== null}
                            className="inline-flex items-center gap-2 rounded-xl bg-zinc-100 px-4 py-2.5 text-sm font-bold text-zinc-800 hover:bg-zinc-200 disabled:opacity-50"
                        >
                            {ocupado === 'baixar' ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                            Baixar fotos
                        </button>

                        {podeCompartilhar && (
                            <button
                                type="button"
                                onClick={() => void compartilhar()}
                                disabled={!fotosSelecionadas.length || ocupado !== null}
                                className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-50"
                            >
                                {ocupado === 'compartilhar' ? (
                                    <Loader2 size={16} className="animate-spin" />
                                ) : (
                                    <Share2 size={16} />
                                )}
                                Compartilhar
                            </button>
                        )}

                        <p className="w-full text-xs text-zinc-500">
                            {podeCompartilhar
                                ? 'No celular, "Compartilhar" copia a legenda e abre o Instagram/Facebook com as fotos: é só colar a legenda.'
                                : 'Baixe as fotos, abra o Instagram ou o Facebook, escolha as fotos e cole a legenda.'}
                        </p>
                    </div>
                )}
            </div>
        </div>
    )
}
