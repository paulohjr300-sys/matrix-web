'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check, Copy, ExternalLink } from 'lucide-react'

function EnderecoCatalogo({ titulo, descricao, url }: { titulo: string; descricao: string; url: string }) {
    const [copiado, setCopiado] = useState(false)

    async function copiar() {
        try {
            await navigator.clipboard.writeText(url)
            setCopiado(true)
            setTimeout(() => setCopiado(false), 2000)
        } catch {
            // Sem permissão de área de transferência: o campo continua selecionável.
        }
    }

    return (
        <div className="rounded-2xl bg-zinc-50 p-4 ring-1 ring-zinc-200">
            <p className="text-sm font-semibold text-zinc-900">{titulo}</p>
            <p className="mt-0.5 text-xs text-zinc-500">{descricao}</p>
            <div className="mt-2 flex flex-wrap gap-2">
                <input
                    readOnly
                    value={url}
                    onFocus={(e) => e.target.select()}
                    className="min-w-0 flex-1 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 font-mono text-xs text-zinc-700 outline-none"
                />
                <button
                    type="button"
                    onClick={() => void copiar()}
                    className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
                >
                    {copiado ? <Check size={16} /> : <Copy size={16} />}
                    {copiado ? 'Copiado' : 'Copiar'}
                </button>
                <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-100"
                >
                    <ExternalLink size={16} />
                    Ver arquivo
                </a>
            </div>
        </div>
    )
}

// Catálogo para Facebook e Instagram: a loja cola um destes endereços no
// Gerenciador de Comércio da Meta, que lê o estoque todo dia.
export function CatalogoMeta({
    slug,
    temCep,
    leitura,
    liberado = true,
}: {
    slug: string
    temCep: boolean
    liberado?: boolean
    leitura?: { lidoEm: string | null; itens: number | null; formato: string | null }
}) {
    if (!liberado) {
        return (
            <div className="mt-6 rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl shadow-zinc-200/50">
                <h2 className="text-xl font-bold text-zinc-950">Facebook e Instagram</h2>
                <p className="mt-3 text-sm leading-6 text-zinc-500">
                    O catálogo do estoque para anúncios no Facebook e no Instagram faz parte do plano Pro.{' '}
                    <Link href="/configuracoes/assinatura" className="font-semibold text-brand-600 hover:underline">
                        Ver planos
                    </Link>
                </p>
            </div>
        )
    }

    const base = `${typeof window !== 'undefined' ? window.location.origin : ''}/api/catalogo/${slug}`

    return (
        <div className="mt-6 rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl shadow-zinc-200/50">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-bold text-zinc-950">Facebook e Instagram</h2>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                    Catálogo do estoque
                </span>
            </div>

            <p className="mt-3 text-sm leading-6 text-zinc-500">
                Anuncie o estoque no Facebook e no Instagram com os anúncios de catálogo da Meta. O arquivo é
                atualizado sozinho com os veículos publicados no site; vendido sai na próxima leitura da Meta.
            </p>

            {leitura?.lidoEm ? (
                <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 ring-1 ring-emerald-200">
                    <strong>Integrado:</strong> a Meta leu o catálogo em {new Date(leitura.lidoEm).toLocaleString('pt-BR')}
                    {leitura.itens !== null && <> · {leitura.itens} veículo(s) enviado(s)</>}
                    {leitura.formato && <> · formato {leitura.formato === 'produtos' ? 'Produtos' : 'Veículos'}</>}.
                </p>
            ) : (
                <p className="mt-4 rounded-xl bg-zinc-50 p-3 text-sm text-zinc-600 ring-1 ring-zinc-200">
                    A Meta ainda não leu o catálogo desta loja. Depois de colar o endereço no Gerenciador de Comércio, a
                    primeira leitura costuma acontecer em alguns minutos; atualize esta página para conferir.
                </p>
            )}

            <div className="mt-5 space-y-3">
                <EnderecoCatalogo
                    titulo="Endereço para catálogo de Produtos (funciona em qualquer conta)"
                    descricao="Use este se, ao criar o catálogo, não aparecer a opção Veículos/Automotivo."
                    url={`${base}?formato=produtos`}
                />

                {temCep ? (
                    <EnderecoCatalogo
                        titulo="Endereço para catálogo de Veículos"
                        descricao="Use este se a sua conta mostrar a opção Veículos (ou Automotivo)."
                        url={base}
                    />
                ) : (
                    <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800 ring-1 ring-amber-200">
                        O catálogo de Veículos exige a localização da loja: cadastre o CEP em{' '}
                        <Link href="/configuracoes/identidade" className="font-semibold underline">
                            Identidade do site
                        </Link>
                        . O de Produtos já funciona sem o CEP.
                    </p>
                )}
            </div>

            <div className="mt-6">
                <p className="text-sm font-bold text-zinc-900">Antes de começar</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-600">
                    <li>A loja precisa de uma <strong>Página no Facebook</strong> (e, para anunciar no Instagram, a conta do Instagram ligada a ela).</li>
                    <li>
                        Precisa também de um <strong>portfólio empresarial</strong> da Meta (o antigo Gerenciador de Negócios).
                        Se não tiver, crie em{' '}
                        <a href="https://business.facebook.com" target="_blank" rel="noreferrer" className="font-semibold text-brand-600 hover:underline">
                            business.facebook.com
                        </a>{' '}
                        e adicione a Página da loja.
                    </li>
                </ul>

                <p className="mt-5 text-sm font-bold text-zinc-900">Passo a passo</p>
                <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-zinc-600">
                    <li>
                        Abra o{' '}
                        <a href="https://business.facebook.com/commerce" target="_blank" rel="noreferrer" className="font-semibold text-brand-600 hover:underline">
                            Gerenciador de Comércio
                        </a>{' '}
                        e, se pedir, escolha o portfólio empresarial da loja.
                    </li>
                    <li>Clique em <strong>Adicionar catálogo</strong> (ou &quot;Criar catálogo&quot;).</li>
                    <li>
                        Escolha o tipo: <strong>Veículos/Automotivo</strong>, se aparecer; se não, <strong>E-commerce</strong>
                        (produtos vendidos online).
                    </li>
                    <li>Quando perguntar como adicionar os itens, escolha <strong>fazer upload das informações</strong> (não conectar plataforma parceira), dê um nome e crie.</li>
                    <li>
                        Dentro do catálogo, vá em <strong>Fontes de dados</strong> → <strong>Adicionar itens</strong> →{' '}
                        <strong>Feed de dados</strong> → <strong>usar URL</strong> (feed agendado).
                    </li>
                    <li>Cole o endereço certo (Veículos ou Produtos, conforme o tipo escolhido), frequência <strong>diária</strong> e moeda <strong>BRL</strong>.</li>
                    <li>Aguarde o primeiro carregamento (alguns minutos) e confira os carros em <strong>Itens</strong>.</li>
                </ol>

                <p className="mt-3 text-xs text-zinc-500">
                    Os nomes dos botões mudam de vez em quando na Meta, mas o caminho é este. Entram no catálogo os veículos
                    publicados no site com foto, marca, modelo, ano e preço.
                </p>
            </div>
        </div>
    )
}
