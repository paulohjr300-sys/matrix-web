import { Car, MessageCircle, TrendingUp } from 'lucide-react'
import { PainelSymbol } from '../brand/painel-logo'

// Ilustrações do produto feitas em HTML/CSS (sem prints): ficam nítidas em
// qualquer tela e acompanham a paleta. Os dados são de exemplo.

function Janela({ children, className = '' }: { children: React.ReactNode; className?: string }) {
    return (
        <div className={`overflow-hidden rounded-2xl bg-white shadow-2xl shadow-brand-950/30 ring-1 ring-black/5 ${className}`}>
            <div className="flex items-center gap-1.5 border-b border-zinc-100 bg-zinc-50 px-4 py-2.5">
                <span className="h-2.5 w-2.5 rounded-full bg-red-300" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
            </div>
            {children}
        </div>
    )
}

export function DashboardMockup() {
    const barras = [38, 52, 45, 63, 58, 74, 69, 88]

    return (
        <Janela>
            <div className="flex">
                <div className="hidden w-36 shrink-0 bg-brand-900 p-4 sm:block">
                    <PainelSymbol variant="dark" className="h-7 w-auto" />
                    <div className="mt-6 space-y-2">
                        {['Dashboard', 'Funil', 'Veículos', 'Vendas', 'DRE'].map((item, index) => (
                            <div
                                key={item}
                                className={`rounded-lg px-2.5 py-1.5 text-[10px] font-semibold ${index === 0 ? 'bg-brand-600 text-white' : 'text-brand-200'}`}
                            >
                                {item}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex-1 bg-zinc-50 p-4">
                    <div className="grid grid-cols-3 gap-2">
                        {[
                            ['Em estoque', '42'],
                            ['Vendas no mês', '17'],
                            ['Lucro no mês', 'R$ 186 mil'],
                        ].map(([label, valor]) => (
                            <div key={label} className="rounded-xl bg-white p-2.5 ring-1 ring-zinc-200">
                                <p className="text-[9px] text-zinc-500">{label}</p>
                                <p className="mt-1 text-sm font-black text-zinc-900">{valor}</p>
                            </div>
                        ))}
                    </div>

                    <div className="mt-3 rounded-xl bg-white p-3 ring-1 ring-zinc-200">
                        <div className="flex items-center justify-between">
                            <p className="text-[10px] font-bold text-zinc-800">Lucro por mês</p>
                            <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-600">
                                <TrendingUp size={10} /> +18%
                            </span>
                        </div>
                        <div className="mt-3 flex h-24 items-end gap-1.5">
                            {barras.map((altura, index) => (
                                <div
                                    key={index}
                                    className={`flex-1 rounded-t-md ${index === barras.length - 1 ? 'bg-ponteiro' : 'bg-brand-500'}`}
                                    style={{ height: `${altura}%` }}
                                />
                            ))}
                        </div>
                    </div>

                    <div className="mt-3 space-y-1.5 rounded-xl bg-white p-3 ring-1 ring-zinc-200">
                        {[
                            ['Toyota Corolla XEi 2021', 'R$ 14.200'],
                            ['Jeep Compass Longitude 2020', 'R$ 11.850'],
                            ['VW T-Cross 1.0 TSI 2022', 'R$ 9.400'],
                        ].map(([carro, lucro]) => (
                            <div key={carro} className="flex items-center justify-between text-[10px]">
                                <span className="truncate text-zinc-600">{carro}</span>
                                <span className="shrink-0 font-bold text-emerald-600">{lucro}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </Janela>
    )
}

const FUNIL = [
    {
        etapa: 'Novo',
        cor: 'bg-sky-500',
        cards: [
            { nome: 'Mariana Souza', carro: 'Onix Plus 2023', origem: 'Site', alerta: 'SLA · 42 min sem contato' },
            { nome: 'Carlos Lima', carro: 'HB20 Comfort 2022', origem: 'Mercado Livre' },
        ],
    },
    {
        etapa: 'Proposta',
        cor: 'bg-violet-500',
        cards: [{ nome: 'Ana Ribeiro', carro: 'Compass 2021', origem: 'Indicação', acao: 'Ligar · hoje 15:00', quente: true }],
    },
    {
        etapa: 'Negociação',
        cor: 'bg-brand-500',
        cards: [{ nome: 'Pedro Alves', carro: 'Corolla XEi 2021', origem: 'Loja física', acao: 'Test drive · amanhã' }],
    },
]

export function FunilMockup() {
    return (
        <Janela>
            <div className="grid grid-cols-3 gap-3 bg-zinc-100 p-4">
                {FUNIL.map((coluna) => (
                    <div key={coluna.etapa} className="rounded-xl bg-zinc-200/60 p-2">
                        <p className="flex items-center gap-1.5 px-1 pb-2 text-[10px] font-bold text-zinc-800">
                            <span className={`h-2 w-2 rounded-full ${coluna.cor}`} />
                            {coluna.etapa}
                        </p>
                        <div className="space-y-2">
                            {coluna.cards.map((card) => (
                                <div
                                    key={card.nome}
                                    className={`rounded-lg bg-white p-2 shadow-sm ring-1 ${'alerta' in card && card.alerta ? 'ring-red-300' : 'ring-zinc-200'}`}
                                >
                                    <div className="flex items-start justify-between gap-1">
                                        <p className="truncate text-[10px] font-bold text-zinc-900">{card.nome}</p>
                                        {'quente' in card && card.quente && (
                                            <span className="rounded-full bg-red-50 px-1.5 text-[8px] font-bold text-red-600">Quente</span>
                                        )}
                                    </div>
                                    <p className="mt-0.5 flex items-center gap-1 truncate text-[9px] text-zinc-500">
                                        <Car size={9} /> {card.carro}
                                    </p>
                                    <p className="mt-1.5 inline-block rounded-full bg-zinc-100 px-1.5 text-[8px] font-semibold text-zinc-600">
                                        {card.origem}
                                    </p>
                                    {'alerta' in card && card.alerta && (
                                        <p className="mt-1 text-[8px] font-bold text-red-600">{card.alerta}</p>
                                    )}
                                    {'acao' in card && card.acao && (
                                        <p className="mt-1 text-[8px] font-semibold text-amber-700">{card.acao}</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </Janela>
    )
}

export function SiteMockup() {
    return (
        <Janela>
            <div className="flex items-center justify-between bg-emerald-950 px-4 py-3">
                <span className="text-sm font-black uppercase tracking-tight text-white">
                    Auto Prime<span className="text-emerald-400">.</span>
                </span>
                <span className="flex items-center gap-1 rounded-full bg-emerald-500 px-2.5 py-1 text-[9px] font-bold text-white">
                    <MessageCircle size={10} /> WhatsApp
                </span>
            </div>
            <div className="bg-gradient-to-br from-emerald-900 to-emerald-700 px-4 py-6 text-white">
                <p className="text-[9px] font-bold uppercase tracking-widest text-emerald-300">Seminovos com procedência</p>
                <p className="mt-1 text-lg font-black leading-tight">Encontre seu próximo carro</p>
            </div>
            <div className="grid grid-cols-3 gap-2 bg-zinc-50 p-3">
                {[
                    ['Compass', 'R$ 129.900'],
                    ['Corolla', 'R$ 118.500'],
                    ['T-Cross', 'R$ 109.900'],
                ].map(([modelo, preco]) => (
                    <div key={modelo} className="overflow-hidden rounded-lg bg-white ring-1 ring-zinc-200">
                        <div className="h-12 bg-gradient-to-br from-zinc-200 to-zinc-300" />
                        <div className="p-1.5">
                            <p className="text-[9px] font-bold text-zinc-900">{modelo}</p>
                            <p className="text-[9px] font-black text-emerald-700">{preco}</p>
                        </div>
                    </div>
                ))}
            </div>
        </Janela>
    )
}
