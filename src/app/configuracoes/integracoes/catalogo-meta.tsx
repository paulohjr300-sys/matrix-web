'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check, Copy, ExternalLink } from 'lucide-react'

// Catálogo de veículos para Facebook e Instagram: a loja cola este
// endereço no Gerenciador de Comércio da Meta, que lê o estoque todo dia.
export function CatalogoMeta({ slug, temCep }: { slug: string; temCep: boolean }) {
    const [copiado, setCopiado] = useState(false)
    const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/api/catalogo/${slug}`

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
        <div className="mt-6 rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl shadow-zinc-200/50">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-bold text-zinc-950">Facebook e Instagram</h2>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                    Catálogo de veículos
                </span>
            </div>

            <p className="mt-3 text-sm leading-6 text-zinc-500">
                Anuncie o estoque no Facebook e no Instagram com os anúncios de catálogo da Meta. O catálogo é
                atualizado sozinho com os veículos publicados no site; vendido sai do catálogo na próxima leitura.
            </p>

            {!temCep ? (
                <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800 ring-1 ring-amber-200">
                    Cadastre o CEP da loja em{' '}
                    <Link href="/configuracoes/identidade" className="font-semibold underline">
                        Identidade do site
                    </Link>
                    : a Meta exige a localização da loja.
                </p>
            ) : (
                <>
                    <label className="mt-4 block text-sm font-medium text-zinc-700">Endereço do catálogo</label>
                    <div className="mt-2 flex flex-wrap gap-2">
                        <input
                            readOnly
                            value={url}
                            onFocus={(e) => e.target.select()}
                            className="min-w-0 flex-1 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 font-mono text-xs text-zinc-700 outline-none"
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
                            className="inline-flex items-center gap-2 rounded-xl bg-zinc-100 px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-200"
                        >
                            <ExternalLink size={16} />
                            Ver arquivo
                        </a>
                    </div>

                    <ol className="mt-5 list-decimal space-y-1.5 pl-5 text-sm text-zinc-600">
                        <li>
                            Acesse o <strong>Gerenciador de Comércio</strong> da Meta (business.facebook.com/commerce) com a
                            conta da empresa.
                        </li>
                        <li>
                            Crie um catálogo do tipo <strong>Veículos</strong> (ou &quot;Automotivo&quot;).
                        </li>
                        <li>
                            Em <strong>Fontes de dados</strong>, adicione itens por <strong>feed de dados</strong> e escolha
                            &quot;URL&quot;.
                        </li>
                        <li>
                            Cole o endereço acima, escolha <strong>atualização diária</strong> e a moeda <strong>BRL</strong>.
                        </li>
                        <li>Depois do primeiro carregamento, os veículos aparecem no catálogo para usar nos anúncios.</li>
                    </ol>

                    <p className="mt-3 text-xs text-zinc-500">
                        Entram no catálogo os veículos publicados no site, com foto, marca, modelo, ano e preço.
                    </p>
                </>
            )}
        </div>
    )
}
