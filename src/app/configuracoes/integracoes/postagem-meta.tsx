'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'

type Pagina = { id: string; nome: string; instagram: { id: string; username: string | null } | null }

type Situacao = {
    liberado: boolean
    pendencia: string | null
    conexao: { status: string; paginas: Pagina[]; pagina: Pagina | null; ultimoErro: string | null } | null
}

// Conexão da página do Facebook e do Instagram da loja para publicar os
// posts dos veículos direto pelo painel.
export function PostagemMeta({
    onMessage,
}: {
    onMessage: (type: 'success' | 'error', title: string, description?: string) => void
}) {
    const [situacao, setSituacao] = useState<Situacao | null>(null)
    const [salvando, setSalvando] = useState(false)

    const load = useCallback(async () => {
        const response = await fetch('/api/integracoes/meta', { cache: 'no-store' })
        if (response.ok) setSituacao(await response.json())
    }, [])

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial
        void load()
    }, [load])

    async function escolher(paginaId: string) {
        setSalvando(true)
        const response = await fetch('/api/integracoes/meta', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ paginaId }),
        })
        const result = await response.json().catch(() => ({}))
        setSalvando(false)

        if (!response.ok) {
            onMessage('error', 'Não foi possível escolher a página', result.message)
            return
        }

        onMessage('success', 'Página escolhida')
        await load()
    }

    async function desconectar() {
        setSalvando(true)
        const response = await fetch('/api/integracoes/meta', { method: 'DELETE' })
        setSalvando(false)

        if (!response.ok) {
            onMessage('error', 'Não foi possível desconectar')
            return
        }

        onMessage('success', 'Facebook desconectado', 'Os posts já publicados continuam nas redes.')
        await load()
    }

    if (!situacao) return null

    const conexao = situacao.conexao
    const pagina = conexao?.pagina

    return (
        <div className="mt-6 rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl shadow-zinc-200/50">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-bold text-zinc-950">Postagem no Instagram e no Facebook</h2>
                {conexao && (
                    <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${conexao.status === 'conectado' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}
                    >
                        {conexao.status === 'conectado' ? 'Conectado' : 'Reconectar'}
                    </span>
                )}
            </div>

            <p className="mt-3 text-sm leading-6 text-zinc-500">
                Publique o post do veículo (fotos e legenda) direto no feed do Instagram e na página do Facebook da
                loja, pelo botão &quot;Criar post&quot; no cadastro do veículo. O Instagram precisa ser uma conta
                profissional ligada à página do Facebook.
            </p>

            {!situacao.liberado ? (
                <p className="mt-4 text-sm text-zinc-600">
                    Faz parte do plano Pro.{' '}
                    <Link href="/configuracoes/assinatura" className="font-semibold text-brand-600 hover:underline">
                        Ver planos
                    </Link>
                </p>
            ) : situacao.pendencia ? (
                <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800 ring-1 ring-amber-200">
                    {situacao.pendencia}
                </p>
            ) : (
                <div className="mt-4 space-y-4">
                    <details
                        open={!conexao}
                        className="rounded-2xl bg-zinc-50 p-4 text-sm text-zinc-700 ring-1 ring-zinc-200"
                    >
                        <summary className="cursor-pointer font-semibold text-zinc-900">
                            Antes de conectar: confira 3 coisas
                        </summary>
                        <ol className="mt-3 list-decimal space-y-2 pl-5 leading-6">
                            <li>
                                <strong>A loja tem uma página no Facebook</strong> e você é administrador dela. Confira em{' '}
                                <a
                                    href="https://www.facebook.com/pages/?category=your_pages"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-semibold text-brand-600 hover:underline"
                                >
                                    suas páginas
                                </a>
                                .
                            </li>
                            <li>
                                <strong>O Instagram da loja é uma conta profissional</strong>: no app do Instagram, Perfil →
                                ☰ → Tipo de conta e ferramentas → Mudar para conta profissional (Empresa).
                            </li>
                            <li>
                                <strong>O Instagram está ligado à página</strong>: no Instagram, Editar perfil → Página →
                                Conectar; ou na página do Facebook, Configurações → Contas vinculadas → Instagram.
                            </li>
                        </ol>
                        <p className="mt-3 leading-6">
                            Ao conectar, entre com o seu Facebook pessoal (o que administra a página) e{' '}
                            <strong>marque a página e o Instagram da loja</strong> na lista que a Meta mostrar. Se a
                            página não aparecer, remova o app em{' '}
                            <a
                                href="https://www.facebook.com/settings/?tab=business_tools"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-semibold text-brand-600 hover:underline"
                            >
                                Integrações comerciais
                            </a>{' '}
                            e conecte de novo.
                        </p>
                    </details>

                    {conexao?.ultimoErro && conexao.status !== 'conectado' && (
                        <p className="text-sm text-red-700">{conexao.ultimoErro}</p>
                    )}

                    {conexao && conexao.paginas.length > 0 && (
                        <div>
                            <label className="text-sm font-medium text-zinc-700">Página da loja</label>
                            <select
                                value={pagina?.id || ''}
                                disabled={salvando}
                                onChange={(event) => void escolher(event.target.value)}
                                className="mt-2 w-full max-w-md rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none focus:border-brand-500"
                            >
                                {!pagina && <option value="">Escolha a página</option>}
                                {conexao.paginas.map((item) => (
                                    <option key={item.id} value={item.id}>
                                        {item.nome}
                                        {item.instagram ? ` · Instagram @${item.instagram.username || item.instagram.id}` : ' · sem Instagram'}
                                    </option>
                                ))}
                            </select>

                            {pagina && !pagina.instagram && (
                                <p className="mt-2 text-sm text-amber-700">
                                    Esta página não tem Instagram profissional ligado: só o Facebook vai receber os posts.
                                </p>
                            )}
                        </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                        <a
                            href="/api/integracoes/meta/conectar"
                            className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
                        >
                            {conexao ? 'Reconectar Facebook' : 'Conectar Facebook e Instagram'}
                        </a>

                        {conexao && (
                            <button
                                type="button"
                                onClick={() => void desconectar()}
                                disabled={salvando}
                                className="inline-flex items-center gap-2 rounded-xl bg-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-200 disabled:opacity-50"
                            >
                                {salvando && <Loader2 size={16} className="animate-spin" />}
                                Desconectar
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
