import type { Metadata } from 'next'
import Link from 'next/link'
import {
    BadgeCheck,
    BarChart3,
    Calculator,
    Car,
    Check,
    ChevronDown,
    Globe,
    KanbanSquare,
    Lock,
    Megaphone,
    Menu,
    MessageCircle,
    Palette,
    Receipt,
    RefreshCw,
    Search,
    Share2,
    ShieldCheck,
    Tag,
    Users,
    Zap,
} from 'lucide-react'

import { PainelLogo } from './components/brand/painel-logo'
import { DashboardMockup, FunilMockup, SiteMockup } from './components/landing/mockups'
import { PLATFORM } from '../lib/platform'
import { formatarPreco, PLANOS as PRECOS } from '../lib/planos'

export const metadata: Metadata = {
    title: 'painel · Sistema para lojas de carros com CRM, site, portais e redes sociais',
    description:
        'Cadastre o carro uma vez: ele vai para o site da loja, o Mercado Livre e o catálogo do Facebook e Instagram. Vendeu, sai de tudo sozinho. Funil de vendas, tabela FIPE e lucro real por veículo. Teste grátis por 14 dias.',
}

// Post automático no Instagram/Facebook depende da aprovação do app pela
// Meta. Enquanto false, a página diz "em liberação" em vez de prometer.
const POSTS_LIBERADOS = false
const statusPosts = POSTS_LIBERADOS ? '' : ' (em liberação pela Meta)'

// Preços em NEXT_PUBLIC_PLANO_BASICO_PRECO / NEXT_PUBLIC_PLANO_PRO_PRECO
// (src/lib/planos.ts). Sem valor, o card mostra "Fale com a gente".
const PLANOS = [
    {
        nome: 'Básico',
        preco: PRECOS.basico.preco ? formatarPreco(PRECOS.basico.preco) : null,
        descricao: 'Para organizar a loja e vender pelo próprio site.',
        recursos: [
            'Estoque com tabela FIPE',
            'Funil de vendas (CRM)',
            'Site da loja com sua marca',
            'Custos, vendas, lucro e DRE por veículo',
            'Legenda pronta para postar o carro',
            'Usuários com perfis de acesso',
            'Suporte por WhatsApp',
        ],
        destaque: false,
    },
    {
        nome: 'Pro',
        preco: PRECOS.pro.preco ? formatarPreco(PRECOS.pro.preco) : null,
        descricao: 'Cadastre uma vez e anuncie em todo lugar, sem retrabalho.',
        recursos: [
            'Tudo do Básico',
            'Mercado Livre automático: publica e encerra sozinho',
            'Catálogo do Facebook e Instagram',
            `Post automático no Instagram e Facebook${statusPosts}`,
            '"VENDIDO" no post quando o carro sai',
            'OLX, Webmotors e iCarros (em breve)',
            'Domínio próprio no site',
        ],
        destaque: true,
    },
]

const RECURSOS = [
    {
        icon: Car,
        titulo: 'Estoque com tabela FIPE',
        texto: 'Escolha marca, modelo e versão e o preço FIPE do mês vem junto. Fotos, documentos e status em um só lugar.',
    },
    {
        icon: Calculator,
        titulo: 'Lucro real por veículo',
        texto: 'Lance vários custos de uma vez (oficina, documentação, lavagem, comissão). Na venda, o painel já mostra compra, custos e lucro estimado.',
    },
    {
        icon: Megaphone,
        titulo: 'Instagram e Facebook',
        texto: 'Catálogo do estoque para anúncios na Meta e post do carro com legenda pronta, no modelo da sua loja.',
    },
    {
        icon: Share2,
        titulo: 'Link que vende no WhatsApp',
        texto: 'Mandou o link do carro? Aparece a foto, o preço e o modelo. E cada carro tem título e descrição próprios para o Google.',
    },
    {
        icon: BarChart3,
        titulo: 'DRE e relatórios',
        texto: 'Faturamento, custos e resultado do mês prontos, sem planilha. Saiba quais carros giram mais rápido.',
    },
    {
        icon: Users,
        titulo: 'Equipe com permissões',
        texto: 'Administrador, gerente e vendedor: cada um vê só o que precisa. O vendedor não acessa o seu financeiro.',
    },
    {
        icon: Palette,
        titulo: 'Sua marca no site',
        texto: 'Logo, cores, ícone, textos e contatos editáveis pelo painel. O site fica com a cara da sua loja.',
    },
    {
        icon: ShieldCheck,
        titulo: 'Seguro e na nuvem',
        texto: 'Conexão criptografada, dados de cada loja separados, proteção contra robôs e acesso de qualquer lugar.',
    },
    {
        icon: Receipt,
        titulo: 'Assinatura sem burocracia',
        texto: 'Pague por Pix, boleto ou cartão. Troque de plano quando quiser: subindo, paga só a diferença dos dias que faltam.',
    },
]

const FAQ = [
    {
        pergunta: 'Preciso instalar alguma coisa?',
        resposta: 'Não. O painel funciona no navegador, no computador ou no celular. É só criar a conta e começar.',
    },
    {
        pergunta: 'Como funciona o teste grátis?',
        resposta: 'Você tem 14 dias com todos os recursos liberados, sem cartão de crédito. No fim do teste, escolhe o plano se quiser continuar.',
    },
    {
        pergunta: 'Tem fidelidade?',
        resposta: 'Não. Você pode cancelar quando quiser e pedir a exportação dos seus dados.',
    },
    {
        pergunta: 'Minha loja ganha um site?',
        resposta: 'Sim. Assim que você se cadastra, a loja ganha um site com o estoque publicado, botão de WhatsApp e formulário de contato que cai direto no funil de vendas. Você pode usar o endereço da plataforma ou ligar um domínio próprio.',
    },
    {
        pergunta: 'Em quais portais consigo publicar?',
        resposta: 'Hoje no Mercado Livre, com publicação automática quando o carro entra no site, atualização de preço e fotos e encerramento quando ele é vendido. OLX, Webmotors e iCarros estão em andamento. Em todos os portais, o plano de anúncios de cada site é contratado pela loja.',
    },
    {
        pergunta: 'O painel posta o carro no Instagram e no Facebook?',
        resposta: `Sim. Com a página da loja conectada, todo carro publicado no site ganha um post com fotos e a legenda no modelo da sua loja${POSTS_LIBERADOS ? '' : ' (recurso em liberação pela Meta)'}. Quando o carro é vendido, o post do Facebook recebe "VENDIDO" sozinho; no Instagram, o painel avisa para você editar pelo app. Também dá para gerar a legenda e baixar as fotos para postar à mão.`,
    },
    {
        pergunta: 'E o catálogo do Facebook e Instagram?',
        resposta: 'O painel gera o catálogo do seu estoque para os anúncios de catálogo da Meta. Carro novo entra e carro vendido sai sozinho, sem você mexer no Gerenciador de Comércio.',
    },
    {
        pergunta: 'Como funciona o pagamento?',
        resposta: 'Mensal, por Pix, boleto ou cartão de crédito. Dá para trocar de plano a qualquer momento: ao subir para o Pro você paga só a diferença proporcional aos dias que faltam do mês.',
    },
    {
        pergunta: 'Consigo ver o lucro de cada carro?',
        resposta: 'Sim. Cada veículo tem o valor de compra, os custos lançados e o valor de venda. O painel calcula a margem por carro e monta o DRE da loja.',
    },
    {
        pergunta: 'Serve para motos e caminhões?',
        resposta: 'Sim. A busca na tabela FIPE já traz carros, motos e caminhões.',
    },
    {
        pergunta: 'Meus dados ficam seguros?',
        resposta: 'Os dados de cada loja ficam separados no banco, o acesso é por usuário e perfil, e toda a comunicação é criptografada. Tratamos os dados conforme a LGPD.',
    },
]

const NAV = [
    ['Automático', '#automatico'],
    ['CRM', '#crm'],
    ['Site', '#site'],
    ['Portais', '#portais'],
    ['Planos', '#planos'],
    ['Dúvidas', '#faq'],
]

function CtaPrimario({ children = 'Testar grátis por 14 dias', className = '' }: { children?: React.ReactNode; className?: string }) {
    return (
        <Link
            href="/cadastro"
            className={`inline-flex items-center justify-center rounded-2xl bg-ponteiro px-6 py-3.5 text-sm font-black text-brand-950 shadow-lg shadow-ponteiro/30 transition hover:-translate-y-0.5 hover:brightness-105 ${className}`}
        >
            {children}
        </Link>
    )
}

function Secao({
    id,
    eyebrow,
    titulo,
    texto,
    children,
    className = '',
}: {
    id?: string
    eyebrow: string
    titulo: string
    texto?: string
    children: React.ReactNode
    className?: string
}) {
    return (
        <section id={id} className={`scroll-mt-20 px-4 py-20 sm:px-6 lg:py-28 ${className}`}>
            <div className="mx-auto max-w-6xl">
                <div className="mx-auto max-w-2xl text-center">
                    <p className="text-xs font-black uppercase tracking-[0.25em] text-brand-600">{eyebrow}</p>
                    <h2 className="mt-3 text-3xl font-black tracking-tight text-zinc-950 sm:text-4xl">{titulo}</h2>
                    {texto && <p className="mt-4 text-lg leading-8 text-zinc-600">{texto}</p>}
                </div>
                <div className="mt-14">{children}</div>
            </div>
        </section>
    )
}

function Ponto({ children }: { children: React.ReactNode }) {
    return (
        <li className="flex gap-3">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700">
                <Check size={13} strokeWidth={3} />
            </span>
            <span className="text-zinc-700">{children}</span>
        </li>
    )
}

export default function LandingPage() {
    const contato = PLATFORM.email ? `mailto:${PLATFORM.email}` : '/cadastro'

    return (
        <div className="bg-white text-zinc-900">
            {/* Cabeçalho */}
            <header className="sticky top-0 z-50 border-b border-white/10 bg-brand-900/95 backdrop-blur">
                <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
                    <Link href="/" aria-label="painel">
                        <PainelLogo variant="dark" />
                    </Link>

                    <nav className="hidden items-center gap-7 lg:flex">
                        {NAV.map(([label, href]) => (
                            <a key={href} href={href} className="text-sm font-semibold text-brand-100 transition hover:text-white">
                                {label}
                            </a>
                        ))}
                    </nav>

                    <div className="hidden items-center gap-3 lg:flex">
                        <Link href="/login" className="rounded-xl px-4 py-2 text-sm font-semibold text-white hover:bg-white/10">
                            Entrar
                        </Link>
                        <CtaPrimario className="px-4 py-2.5">Teste grátis</CtaPrimario>
                    </div>

                    <details className="group relative lg:hidden">
                        <summary className="flex cursor-pointer list-none items-center rounded-xl p-2 text-white hover:bg-white/10" aria-label="Menu">
                            <Menu size={24} />
                        </summary>
                        <div className="absolute right-0 top-12 w-64 rounded-2xl bg-white p-3 shadow-2xl ring-1 ring-black/5">
                            {NAV.map(([label, href]) => (
                                <a key={href} href={href} className="block rounded-xl px-3 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50">
                                    {label}
                                </a>
                            ))}
                            <div className="mt-2 grid gap-2 border-t border-zinc-100 pt-3">
                                <Link href="/login" className="rounded-xl px-3 py-2.5 text-center text-sm font-semibold text-zinc-700 ring-1 ring-zinc-200">
                                    Entrar
                                </Link>
                                <CtaPrimario className="py-2.5">Teste grátis</CtaPrimario>
                            </div>
                        </div>
                    </details>
                </div>
            </header>

            <main>
                {/* Hero */}
                <section className="relative overflow-hidden bg-brand-900 px-4 pb-24 pt-16 sm:px-6 lg:pb-32 lg:pt-24">
                    <div
                        aria-hidden
                        className="pointer-events-none absolute inset-0 opacity-60"
                        style={{
                            background:
                                'radial-gradient(60% 50% at 80% 10%, rgba(24,95,165,.55), transparent 70%), radial-gradient(40% 40% at 10% 90%, rgba(239,159,39,.18), transparent 70%)',
                        }}
                    />

                    <div className="relative mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[1.05fr_1fr]">
                        <div>
                            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-brand-100 ring-1 ring-white/15">
                                <Zap size={14} className="text-ponteiro" />
                                Para lojas de carros, motos e caminhões
                            </span>

                            <h1 className="mt-6 text-4xl font-black leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl">
                                Cadastre o carro uma vez. Ele aparece em todo lugar.
                            </h1>

                            <p className="mt-6 max-w-xl text-lg leading-8 text-brand-100">
                                Site da loja, Mercado Livre, catálogo do Facebook e Instagram e post pronto, tudo a
                                partir do mesmo cadastro. Vendeu? Sai de tudo sozinho. E você sabe o lucro real de cada carro.
                            </p>

                            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                                <CtaPrimario />
                                <a
                                    href="#planos"
                                    className="inline-flex items-center justify-center rounded-2xl px-6 py-3.5 text-sm font-bold text-white ring-1 ring-white/25 transition hover:bg-white/10"
                                >
                                    Ver planos
                                </a>
                            </div>

                            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold text-brand-100">
                                {['14 dias grátis', 'Sem cartão de crédito', 'Sem fidelidade'].map((item) => (
                                    <li key={item} className="flex items-center gap-2">
                                        <BadgeCheck size={16} className="text-ponteiro" />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className="relative">
                            <DashboardMockup />
                            <div className="absolute -bottom-24 -left-8 hidden w-56 rounded-2xl bg-white p-4 shadow-2xl ring-1 ring-black/5 sm:block">
                                <p className="text-[11px] font-semibold text-zinc-500">Corolla XEi 2021</p>
                                <p className="mt-1 text-xs text-zinc-500">Compra + custos</p>
                                <p className="text-sm font-bold text-zinc-800">R$ 104.300</p>
                                <p className="mt-1 text-xs text-zinc-500">Vendido por</p>
                                <p className="text-sm font-bold text-zinc-800">R$ 118.500</p>
                                <p className="mt-2 rounded-lg bg-emerald-50 px-2 py-1 text-xs font-black text-emerald-700">
                                    Lucro: R$ 14.200 (13,6%)
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Faixa de benefícios */}
                <section className="border-b border-zinc-100 bg-white px-4 py-10 sm:px-6">
                    <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 text-center lg:grid-cols-4">
                        {[
                            [Search, 'FIPE no cadastro'],
                            [KanbanSquare, 'Nenhum lead esquecido'],
                            [Globe, 'Site pronto no cadastro'],
                            [RefreshCw, 'Portais e redes no automático'],
                        ].map(([Icon, label]) => {
                            const I = Icon as typeof Search
                            return (
                                <div key={label as string} className="flex flex-col items-center gap-2">
                                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                                        <I size={20} />
                                    </span>
                                    <span className="text-sm font-bold text-zinc-800">{label as string}</span>
                                </div>
                            )
                        })}
                    </div>
                </section>

                {/* Publicação automática */}
                <Secao
                    id="automatico"
                    eyebrow="Publicação automática"
                    titulo="Do cadastro ao anúncio, sem retrabalho"
                    texto="Você cuida do carro. O painel cuida de levar ele para o site, os portais e as redes, e de tirar quando vender."
                >
                    <div className="grid gap-6 lg:grid-cols-2">
                        <div className="rounded-3xl bg-white p-7 shadow-xl shadow-zinc-200/60 ring-1 ring-zinc-200">
                            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-emerald-700">
                                <Zap size={14} /> Publicou no site
                            </span>
                            <ul className="mt-6 space-y-4">
                                <Ponto>
                                    <strong>Site da loja:</strong> o carro aparece com fotos, preço e botão de WhatsApp.
                                </Ponto>
                                <Ponto>
                                    <strong>Mercado Livre:</strong> o anúncio é criado sozinho, com fotos, ficha técnica e
                                    WhatsApp da loja.
                                </Ponto>
                                <Ponto>
                                    <strong>Catálogo do Facebook e Instagram:</strong> o carro entra no catálogo da Meta
                                    para os seus anúncios.
                                </Ponto>
                                <Ponto>
                                    <strong>Post no Instagram e Facebook{statusPosts}:</strong> fotos e legenda no modelo da
                                    sua loja, com preço, km e link do carro.
                                </Ponto>
                            </ul>
                        </div>

                        <div className="rounded-3xl bg-brand-900 p-7 text-white shadow-xl shadow-brand-900/30">
                            <span className="inline-flex items-center gap-2 rounded-full bg-ponteiro px-3 py-1 text-xs font-black uppercase tracking-wide text-brand-950">
                                <Tag size={14} /> Vendeu
                            </span>
                            <ul className="mt-6 space-y-4 text-brand-100">
                                {[
                                    ['Mercado Livre:', 'o anúncio é encerrado na hora. Nada de cliente ligando por carro vendido.'],
                                    ['Site e catálogo:', 'o carro sai do site e do catálogo do Facebook e Instagram.'],
                                    ['Post:', 'recebe "✅ VENDIDO" no Facebook; no Instagram, o painel lembra você de marcar.'],
                                    ['Financeiro:', 'a venda entra no DRE com o lucro real, já descontados compra e custos.'],
                                ].map(([titulo, texto]) => (
                                    <li key={titulo} className="flex gap-3">
                                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/15 text-ponteiro">
                                            <Check size={13} strokeWidth={3} />
                                        </span>
                                        <span>
                                            <strong className="text-white">{titulo}</strong> {texto}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </Secao>

                {/* CRM */}
                <Secao
                    id="crm"
                    eyebrow="Funil de vendas"
                    titulo="Nunca mais perca um lead"
                    texto="Os contatos do site e da loja caem num funil só, com o carro de interesse, a origem e o histórico de cada conversa."
                >
                    <div className="grid items-center gap-12 lg:grid-cols-2">
                        <FunilMockup />
                        <ul className="space-y-4 text-base">
                            <Ponto>
                                <strong>Etapas claras:</strong> novo, em atendimento, proposta, negociação, ganho ou perdido. É só arrastar o card.
                            </Ponto>
                            <Ponto>
                                <strong>Alerta de demora:</strong> o lead que passa de 30 minutos sem contato fica marcado em vermelho.
                            </Ponto>
                            <Ponto>
                                <strong>Próxima ação agendada:</strong> veja os follow-ups atrasados e os de hoje logo ao abrir o funil.
                            </Ponto>
                            <Ponto>
                                <strong>Histórico completo:</strong> ligações, WhatsApp, visitas e propostas registradas, com quem fez e quando.
                            </Ponto>
                            <Ponto>
                                <strong>Da conversa à venda:</strong> registre a venda no próprio lead. O carro sai do estoque, do site e dos portais.
                            </Ponto>
                        </ul>
                    </div>
                </Secao>

                {/* Site */}
                <Secao
                    id="site"
                    eyebrow="Site da loja"
                    titulo="Venda 24 horas por dia com um site profissional"
                    texto="Sua loja ganha um site com o estoque atualizado sozinho, assim que você cadastra o carro no painel."
                    className="bg-zinc-50"
                >
                    <div className="grid items-center gap-12 lg:grid-cols-2">
                        <ul className="order-2 space-y-4 text-base lg:order-1">
                            <Ponto>Logo, cores, ícone e textos da sua loja, editados pelo painel, sem programador.</Ponto>
                            <Ponto>Busca por marca, modelo, ano, câmbio e combustível, com favoritos.</Ponto>
                            <Ponto>Botão de WhatsApp em todo carro e formulário que cai direto no funil.</Ponto>
                            <Ponto>Link do carro no WhatsApp aparece com foto, modelo e preço.</Ponto>
                            <Ponto>Pronto para o Google: título e descrição por carro e mapa do site.</Ponto>
                            <Ponto>Funciona no endereço da plataforma ou no seu domínio próprio.</Ponto>
                            <Ponto>Política de privacidade e consentimento de contato conforme a LGPD.</Ponto>
                        </ul>
                        <div className="order-1 lg:order-2">
                            <SiteMockup />
                        </div>
                    </div>
                </Secao>

                {/* Portais */}
                <Secao
                    id="portais"
                    eyebrow="Portais de anúncio"
                    titulo="Cadastre uma vez, anuncie nos portais e nas redes"
                    texto="Preço, fotos e situação do carro sincronizados. Vendeu? O anúncio é encerrado sozinho."
                >
                    <div className="mx-auto grid max-w-5xl gap-4 sm:grid-cols-3 lg:grid-cols-5">
                        {[
                            ['Mercado Livre', 'Disponível', true],
                            ['Facebook e Instagram', 'Catálogo disponível', true],
                            ['OLX', 'Em breve', false],
                            ['Webmotors', 'Em breve', false],
                            ['iCarros', 'Em breve', false],
                        ].map(([nome, status, ativo]) => (
                            <div
                                key={nome as string}
                                className={`rounded-3xl p-6 text-center ring-1 ${ativo ? 'bg-white shadow-xl shadow-zinc-200/60 ring-zinc-200' : 'bg-zinc-50 ring-zinc-200'}`}
                            >
                                <p className="text-xl font-black text-zinc-900">{nome as string}</p>
                                <span
                                    className={`mt-3 inline-block rounded-full px-3 py-1 text-xs font-bold ${ativo ? 'bg-emerald-50 text-emerald-700' : 'bg-zinc-200 text-zinc-600'}`}
                                >
                                    {status as string}
                                </span>
                            </div>
                        ))}
                    </div>
                    <p className="mx-auto mt-6 max-w-2xl text-center text-sm text-zinc-500">
                        Integrações sujeitas às regras de cada portal. O plano de anúncios em cada site é contratado
                        pela própria loja.
                    </p>
                </Secao>

                {/* Recursos */}
                <Secao
                    id="recursos"
                    eyebrow="Tudo o que a loja precisa"
                    titulo="Do cadastro do carro ao resultado do mês"
                    className="bg-zinc-50"
                >
                    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                        {RECURSOS.map(({ icon: Icon, titulo, texto }) => (
                            <div key={titulo} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-zinc-200">
                                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-600 text-white">
                                    <Icon size={20} />
                                </span>
                                <h3 className="mt-5 text-lg font-bold text-zinc-950">{titulo}</h3>
                                <p className="mt-2 text-sm leading-6 text-zinc-600">{texto}</p>
                            </div>
                        ))}
                    </div>
                </Secao>

                {/* Diferencial: lucro */}
                <section className="bg-brand-900 px-4 py-20 sm:px-6">
                    <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-2">
                        <div>
                            <p className="text-xs font-black uppercase tracking-[0.25em] text-ponteiro">O diferencial</p>
                            <h2 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">
                                Pare de achar que lucrou. Saiba.
                            </h2>
                            <p className="mt-4 text-lg leading-8 text-brand-100">
                                O valor de venda menos o de compra não é o seu lucro. O painel soma cada custo do carro,
                                da oficina à comissão, e mostra a margem real de cada veículo e o DRE da loja no mês.
                            </p>
                            <CtaPrimario className="mt-8">Quero ver o meu lucro real</CtaPrimario>
                        </div>
                        <div className="rounded-3xl bg-white/5 p-6 ring-1 ring-white/10">
                            {[
                                ['Valor de venda', 'R$ 118.500', 'text-white'],
                                ['Valor de compra', '− R$ 98.000', 'text-brand-200'],
                                ['Funilaria e pintura', '− R$ 3.200', 'text-brand-200'],
                                ['Documentação e transferência', '− R$ 1.650', 'text-brand-200'],
                                ['Lavagem e estética', '− R$ 450', 'text-brand-200'],
                                ['Comissão do vendedor', '− R$ 1.000', 'text-brand-200'],
                            ].map(([label, valor, cor]) => (
                                <div key={label} className="flex justify-between border-b border-white/10 py-3 text-sm">
                                    <span className="text-brand-100">{label}</span>
                                    <span className={`font-semibold ${cor}`}>{valor}</span>
                                </div>
                            ))}
                            <div className="flex justify-between pt-4">
                                <span className="font-bold text-white">Lucro real</span>
                                <span className="text-xl font-black text-ponteiro">R$ 14.200</span>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Planos */}
                <Secao
                    id="planos"
                    eyebrow="Planos"
                    titulo="Comece grátis, escolha depois"
                    texto="14 dias com tudo liberado, sem cartão de crédito e sem fidelidade."
                >
                    <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
                        {PLANOS.map((plano) => (
                            <div
                                key={plano.nome}
                                className={`relative flex flex-col rounded-3xl p-8 ${plano.destaque ? 'bg-brand-900 text-white shadow-2xl shadow-brand-900/30' : 'bg-white ring-1 ring-zinc-200'}`}
                            >
                                {plano.destaque && (
                                    <span className="absolute -top-3 left-8 rounded-full bg-ponteiro px-3 py-1 text-xs font-black text-brand-950">
                                        Mais completo
                                    </span>
                                )}
                                <h3 className="text-2xl font-black">{plano.nome}</h3>
                                <p className={`mt-2 text-sm ${plano.destaque ? 'text-brand-100' : 'text-zinc-500'}`}>{plano.descricao}</p>
                                <p className="mt-6 text-3xl font-black">
                                    {plano.preco ?? 'Fale com a gente'}
                                    {plano.preco && <span className="text-base font-semibold opacity-70">/mês</span>}
                                </p>
                                <ul className="mt-6 flex-1 space-y-3 text-sm">
                                    {plano.recursos.map((recurso) => (
                                        <li key={recurso} className="flex gap-2">
                                            <Check size={18} className={plano.destaque ? 'text-ponteiro' : 'text-brand-600'} />
                                            {recurso}
                                        </li>
                                    ))}
                                </ul>
                                <Link
                                    href="/cadastro"
                                    className={`mt-8 rounded-2xl py-3.5 text-center text-sm font-black transition ${plano.destaque
                                        ? 'bg-ponteiro text-brand-950 hover:brightness-105'
                                        : 'bg-brand-600 text-white hover:bg-brand-700'
                                        }`}
                                >
                                    Começar teste grátis
                                </Link>
                            </div>
                        ))}
                    </div>
                </Secao>

                {/* FAQ */}
                <Secao id="faq" eyebrow="Dúvidas" titulo="Perguntas frequentes" className="bg-zinc-50">
                    <div className="mx-auto max-w-3xl space-y-3">
                        {FAQ.map((item) => (
                            <details key={item.pergunta} className="group rounded-2xl bg-white p-5 ring-1 ring-zinc-200">
                                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-bold text-zinc-900">
                                    {item.pergunta}
                                    <ChevronDown size={18} className="shrink-0 text-zinc-400 transition group-open:rotate-180" />
                                </summary>
                                <p className="mt-3 leading-7 text-zinc-600">{item.resposta}</p>
                            </details>
                        ))}
                    </div>
                </Secao>

                {/* CTA final */}
                <section className="px-4 py-20 sm:px-6">
                    <div className="mx-auto max-w-5xl rounded-[2rem] bg-gradient-to-br from-brand-700 to-brand-900 px-6 py-14 text-center sm:px-12">
                        <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">Pronto para organizar sua loja?</h2>
                        <p className="mx-auto mt-4 max-w-xl text-lg text-brand-100">
                            Crie a conta em um minuto. O site da sua loja já sai pronto no cadastro, e o primeiro carro
                            pode estar no ar ainda hoje.
                        </p>
                        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                            <CtaPrimario />
                            <a
                                href={contato}
                                className="inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-3.5 text-sm font-bold text-white ring-1 ring-white/25 hover:bg-white/10"
                            >
                                <MessageCircle size={16} />
                                Falar com a gente
                            </a>
                        </div>
                    </div>
                </section>
            </main>

            {/* Rodapé */}
            <footer className="border-t border-zinc-100 px-4 py-10 sm:px-6">
                <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 md:flex-row">
                    <PainelLogo />
                    <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-zinc-500">
                        <Link href="/login" className="hover:text-brand-600">Entrar</Link>
                        <Link href="/cadastro" className="hover:text-brand-600">Criar conta</Link>
                        <Link href="/termos" className="hover:text-brand-600">Termos de Uso</Link>
                        <Link href="/privacidade" className="hover:text-brand-600">Privacidade</Link>
                    </nav>
                    <p className="flex items-center gap-1.5 text-xs text-zinc-400">
                        <Lock size={12} />
                        © {new Date().getFullYear()} painel{PLATFORM.razaoSocial ? ` · ${PLATFORM.razaoSocial}` : ''}
                    </p>
                </div>
            </footer>
        </div>
    )
}

