'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowLeft, CheckCircle2, Link2, Lock, Unplug } from 'lucide-react'

import { PageContainer } from '../../components/page-container'
import { RouteGuard } from '../../components/auth/route-guard'
import { Toast } from '../../components/ui/toast'
import { ConfirmDialog } from '../../components/ui/confirm-dialog'
import { PacotesMercadoLivre } from './pacotes-ml'
import { PlanoOlx } from './plano-olx'
import { CatalogoMeta } from './catalogo-meta'
import { PostagemMeta } from './postagem-meta'

type Conexao = {
    status: 'conectado' | 'erro' | 'desconectado'
    conta_nome: string | null
    ultimo_erro: string | null
    conectado_em: string
}

type PortalInfo = {
    portal: 'mercadolivre' | 'webmotors' | 'olx'
    nome: string
    disponivel: boolean
    pendencia?: string | null
    conexao: Conexao | null
}

const DESCRICOES: Record<PortalInfo['portal'], string> = {
    mercadolivre:
        'Publique o estoque no Mercado Livre Veículos. Preço, fotos e situação são atualizados quando você salva o veículo, e o anúncio é encerrado quando ele é vendido. É preciso ter um pacote de anúncios contratado com o Mercado Livre.',
    webmotors: 'Em breve. A integração depende de homologação com a Webmotors.',
    olx: 'Publique o estoque na OLX Autos e receba os leads da OLX direto no funil de vendas. Vendido sai da OLX sozinho. A conta precisa de um plano OLX para empresas (Essencial, Plus ou Premium Empresa).',
}

export default function IntegracoesPage() {
    return (
        <Suspense>
            <Integracoes />
        </Suspense>
    )
}

function Integracoes() {
    const searchParams = useSearchParams()
    const [portais, setPortais] = useState<PortalInfo[]>([])
    const [liberado, setLiberado] = useState(true)
    const [usuarioTeste, setUsuarioTeste] = useState(false)
    const [catalogo, setCatalogo] = useState<{ slug: string; temCep: boolean; lidoEm: string | null; itens: number | null; formato: string | null } | null>(null)
    const [criandoTeste, setCriandoTeste] = useState(false)
    const [contaTeste, setContaTeste] = useState<{ nickname: string; password: string; email: string | null } | null>(null)
    const [loading, setLoading] = useState(true)
    const [disconnectTarget, setDisconnectTarget] = useState<PortalInfo | null>(null)
    const [disconnecting, setDisconnecting] = useState(false)

    const [toast, setToast] = useState({
        open: false,
        type: 'success' as 'success' | 'error',
        title: '',
        description: '',
    })

    function showToast(type: 'success' | 'error', title: string, description?: string) {
        setToast({ open: true, type, title, description: description || '' })
        setTimeout(() => setToast((current) => ({ ...current, open: false })), 4000)
    }

    async function loadIntegracoes() {
        const response = await fetch('/api/integracoes')
        const result = await response.json().catch(() => ({}))

        if (response.ok) {
            setPortais(result.portais || [])
            setLiberado(result.liberado !== false)
            setUsuarioTeste(result.usuarioTeste === true)
            setCatalogo(result.catalogo || null)
        } else {
            showToast('error', 'Erro', result.message || 'Não foi possível carregar as integrações.')
        }

        setLoading(false)
    }

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial
        void loadIntegracoes()
    }, [])

    // Retorno do Mercado Livre (?conectado=... ou ?erro=...).
    useEffect(() => {
        const erro = searchParams.get('erro')
        const conectado = searchParams.get('conectado')

        if (erro) {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- mensagem de retorno do OAuth
            showToast('error', 'Não foi possível conectar', erro)
        } else if (conectado) {
            showToast('success', 'Conta conectada', 'Agora você já pode publicar veículos.')
        }

        if (erro || conectado) {
            window.history.replaceState(null, '', '/configuracoes/integracoes')
        }
    }, [searchParams])

    async function criarUsuarioTeste() {
        setCriandoTeste(true)

        const response = await fetch('/api/integracoes/mercadolivre/usuario-teste', { method: 'POST' })
        const result = await response.json().catch(() => ({}))

        setCriandoTeste(false)

        if (!response.ok) {
            showToast('error', 'Não foi possível criar', result.message)
            return
        }

        setContaTeste(result)
    }

    async function handleDisconnect() {
        if (!disconnectTarget) return

        setDisconnecting(true)

        const response = await fetch(`/api/integracoes/${disconnectTarget.portal}/desconectar`, {
            method: 'POST',
        })

        setDisconnecting(false)
        setDisconnectTarget(null)

        if (!response.ok) {
            showToast('error', 'Erro', 'Não foi possível desconectar.')
            return
        }

        showToast('success', 'Conta desconectada')
        await loadIntegracoes()
    }

    return (
        <RouteGuard allowedRoles={['ADMIN']}>
            <Toast
                open={toast.open}
                type={toast.type}
                title={toast.title}
                description={toast.description}
                onClose={() => setToast((current) => ({ ...current, open: false }))}
            />

            <ConfirmDialog
                open={disconnectTarget !== null}
                title={`Desconectar ${disconnectTarget?.nome || ''}`}
                description="O painel deixa de publicar e atualizar anúncios nesse portal. Os anúncios já publicados continuam lá e podem ser gerenciados direto no portal."
                confirmText="Desconectar"
                loading={disconnecting}
                onCancel={() => setDisconnectTarget(null)}
                onConfirm={() => void handleDisconnect()}
            />

            <PageContainer
                title="Integrações"
                description="Conecte as contas da loja nos portais de anúncio."
            >
                <Link
                    href="/configuracoes"
                    className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-zinc-500 transition hover:text-brand-600"
                >
                    <ArrowLeft size={16} />
                    Voltar para configurações
                </Link>

                {!liberado && (
                    <div className="mb-6 flex items-start gap-3 rounded-2xl bg-amber-50 p-4 text-sm text-amber-800 ring-1 ring-amber-200">
                        <Lock size={18} className="mt-0.5 shrink-0" />
                        <p>
                            As integrações com portais e o catálogo do Facebook e Instagram fazem parte do{' '}
                            <strong>plano Pro</strong>.{' '}
                            <Link href="/configuracoes/assinatura" className="font-bold underline">
                                Trocar de plano
                            </Link>
                        </p>
                    </div>
                )}

                {loading ? (
                    <p className="text-sm text-zinc-500">Carregando...</p>
                ) : (
                    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                        {portais.map((item) => {
                            const conectado = item.conexao?.status === 'conectado'
                            const comErro = item.conexao?.status === 'erro'

                            return (
                                <div
                                    key={item.portal}
                                    className="flex flex-col rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl shadow-zinc-200/50"
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <h2 className="text-xl font-bold text-zinc-950">{item.nome}</h2>

                                        {conectado && (
                                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                                                <CheckCircle2 size={14} />
                                                Conectado
                                            </span>
                                        )}
                                        {comErro && (
                                            <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-700">
                                                Reconectar
                                            </span>
                                        )}
                                        {!item.disponivel && (
                                            <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-bold text-zinc-500">
                                                Em breve
                                            </span>
                                        )}
                                    </div>

                                    <p className="mt-3 flex-1 text-sm leading-6 text-zinc-500">{DESCRICOES[item.portal]}</p>

                                    {conectado && item.conexao?.conta_nome && (
                                        <p className="mt-4 text-sm text-zinc-700">
                                            Conta: <strong>{item.conexao.conta_nome}</strong>
                                        </p>
                                    )}

                                    {comErro && item.conexao?.ultimo_erro && (
                                        <p className="mt-4 text-sm text-red-700">{item.conexao.ultimo_erro}</p>
                                    )}

                                    {item.portal === 'mercadolivre' && conectado && <PacotesMercadoLivre />}
                                    {item.portal === 'olx' && conectado && <PlanoOlx />}

                                    {item.portal === 'mercadolivre' && usuarioTeste && item.conexao?.status === 'conectado' && (
                                        <div className="mt-4 rounded-xl bg-zinc-50 p-3 text-sm ring-1 ring-zinc-200">
                                            <p className="font-semibold text-zinc-800">Ferramenta de teste</p>
                                            {contaTeste ? (
                                                <div className="mt-2 space-y-1 text-zinc-700">
                                                    <p>Usuário: <strong className="select-all">{contaTeste.nickname}</strong></p>
                                                    <p>Senha: <strong className="select-all">{contaTeste.password}</strong></p>
                                                    {contaTeste.email && <p>E-mail: <strong className="select-all">{contaTeste.email}</strong></p>}
                                                    <p className="pt-1 text-xs text-zinc-500">
                                                        Anote agora: a senha não aparece de novo.
                                                    </p>
                                                </div>
                                            ) : (
                                                <button
                                                    type="button"
                                                    disabled={criandoTeste}
                                                    onClick={() => void criarUsuarioTeste()}
                                                    className="mt-2 rounded-lg bg-zinc-900 px-3 py-2 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
                                                >
                                                    {criandoTeste ? 'Criando...' : 'Criar usuário de teste do Mercado Livre'}
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    {item.pendencia && (
                                        <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800 ring-1 ring-amber-200">
                                            {item.pendencia}
                                        </p>
                                    )}

                                    {item.disponivel && !item.pendencia && (
                                        <div className="mt-5 flex flex-wrap gap-3">
                                            {(!conectado || comErro) && (
                                                <a
                                                    href={liberado ? `/api/integracoes/${item.portal}/conectar` : undefined}
                                                    aria-disabled={!liberado}
                                                    className={`inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white transition ${liberado
                                                        ? 'bg-brand-600 hover:bg-brand-700'
                                                        : 'pointer-events-none bg-zinc-300'
                                                        }`}
                                                >
                                                    <Link2 size={16} />
                                                    {comErro ? 'Conectar novamente' : 'Conectar conta'}
                                                </a>
                                            )}

                                            {item.conexao && item.conexao.status !== 'desconectado' && (
                                                <button
                                                    type="button"
                                                    onClick={() => setDisconnectTarget(item)}
                                                    className="inline-flex items-center gap-2 rounded-xl bg-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-200"
                                                >
                                                    <Unplug size={16} />
                                                    Desconectar
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}

                {!loading && catalogo && <CatalogoMeta slug={catalogo.slug} temCep={catalogo.temCep} leitura={catalogo} liberado={liberado} />}

                {!loading && <PostagemMeta onMessage={showToast} />}
            </PageContainer>
        </RouteGuard>
    )
}
