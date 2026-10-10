'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Loader2, Search } from 'lucide-react'

export type FipeTipo = 'cars' | 'motorcycles' | 'trucks'

export type FipeSelection = {
    tipo: FipeTipo
    marcaCodigo: string
    modeloCodigo: string
    anoCodigo: string
    marcaNome: string
    modeloNome: string
    versao: string
    codigoFipe: string
    preco: number
    referencia: string
    anoModelo: number | null
    combustivel: string
}

type Option = { code: string; name: string }

type FipeDetail = {
    price: string
    brand: string
    model: string
    modelYear: number
    fuel: string
    codeFipe: string
    referenceMonth: string
}

const TIPOS: { value: FipeTipo; label: string }[] = [
    { value: 'cars', label: 'Carro' },
    { value: 'motorcycles', label: 'Moto' },
    { value: 'trucks', label: 'Caminhão' },
]

// Nomes da FIPE que diferem do jeito usual de escrever a marca.
const BRAND_ALIASES: Record<string, string> = {
    'vw - volkswagen': 'Volkswagen',
    'gm - chevrolet': 'Chevrolet',
    'mercedes-benz': 'Mercedes-Benz',
    'citroen': 'Citroën',
}

// Ano "32000" na FIPE significa veículo zero km.
const ZERO_KM_YEAR = 32000

const selectClass =
    'mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 outline-none transition-all focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 disabled:bg-zinc-100 disabled:text-zinc-400'

function titleCase(value: string) {
    return value.toLowerCase().replace(/(^|[\s-])([a-zà-ú])/g, (_, sep: string, char: string) => sep + char.toUpperCase())
}

export function normalizeBrandName(fipeName: string) {
    const alias = BRAND_ALIASES[fipeName.trim().toLowerCase()]
    if (alias) return alias

    const name = fipeName.includes(' - ') ? fipeName.split(' - ').pop()!.trim() : fipeName.trim()

    return name === name.toUpperCase() && name.length > 3 ? titleCase(name) : name
}

// "T-Cross 1.0 TSI Flex 12V 5p Aut." -> "T-Cross". Sugestão: o usuário pode
// corrigir antes de aplicar (ex: "Grand Siena", "Range Rover").
export function guessModelName(fipeModel: string) {
    const first = fipeModel.trim().split(/\s+/)[0] || fipeModel

    return first === first.toUpperCase() && /[A-Z]/.test(first) && first.length > 3 ? titleCase(first) : first
}

function parsePrice(value: string) {
    return Number(value.replace(/[^\d,]/g, '').replace(',', '.')) || 0
}

function formatMoney(value: number) {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

async function fipeGet<T>(path: string): Promise<T> {
    const response = await fetch(`/api/fipe/${path}`)
    const data = await response.json().catch(() => null)

    if (!response.ok) {
        throw new Error(data?.message || 'Não foi possível consultar a FIPE.')
    }

    return data as T
}

export function FipeLookup({
    onApply,
    onError,
}: {
    onApply: (selection: FipeSelection) => Promise<void>
    onError: (message: string) => void
}) {
    const [open, setOpen] = useState(false)
    const [tipo, setTipo] = useState<FipeTipo>('cars')

    const [brands, setBrands] = useState<Option[]>([])
    const [models, setModels] = useState<Option[]>([])
    const [years, setYears] = useState<Option[]>([])

    const [brandCode, setBrandCode] = useState('')
    const [modelCode, setModelCode] = useState('')
    const [yearCode, setYearCode] = useState('')
    const [modelFilter, setModelFilter] = useState('')

    const [detail, setDetail] = useState<FipeDetail | null>(null)
    const [brandName, setBrandName] = useState('')
    const [modelName, setModelName] = useState('')

    const [loading, setLoading] = useState<'brands' | 'models' | 'years' | 'detail' | 'apply' | null>(null)

    // A página passa uma função nova a cada render; a ref evita recarregar
    // as marcas por causa disso.
    const onErrorRef = useRef(onError)

    useEffect(() => {
        onErrorRef.current = onError
    })

    useEffect(() => {
        if (!open) return

        let cancelled = false

        async function loadBrands() {
            setLoading('brands')
            setBrands([])
            setBrandCode('')

            try {
                const data = await fipeGet<Option[]>(`${tipo}/brands`)
                if (!cancelled) setBrands(data)
            } catch (error) {
                if (!cancelled) onErrorRef.current((error as Error).message)
            } finally {
                if (!cancelled) setLoading(null)
            }
        }

        void loadBrands()

        return () => {
            cancelled = true
        }
    }, [open, tipo])

    async function handleBrand(code: string) {
        setBrandCode(code)
        setModelCode('')
        setYearCode('')
        setModels([])
        setYears([])
        setDetail(null)
        setModelFilter('')

        if (!code) return

        setLoading('models')

        try {
            setModels(await fipeGet<Option[]>(`${tipo}/brands/${code}/models`))
        } catch (error) {
            onError((error as Error).message)
        } finally {
            setLoading(null)
        }
    }

    async function handleModel(code: string) {
        setModelCode(code)
        setYearCode('')
        setYears([])
        setDetail(null)

        if (!code) return

        setLoading('years')

        try {
            setYears(await fipeGet<Option[]>(`${tipo}/brands/${brandCode}/models/${code}/years`))
        } catch (error) {
            onError((error as Error).message)
        } finally {
            setLoading(null)
        }
    }

    async function handleYear(code: string) {
        setYearCode(code)
        setDetail(null)

        if (!code) return

        setLoading('detail')

        try {
            const data = await fipeGet<FipeDetail>(`${tipo}/brands/${brandCode}/models/${modelCode}/years/${code}`)
            setDetail(data)
            setBrandName(normalizeBrandName(data.brand))
            setModelName(guessModelName(data.model))
        } catch (error) {
            onError((error as Error).message)
        } finally {
            setLoading(null)
        }
    }

    async function handleApply() {
        if (!detail || !brandName.trim() || !modelName.trim()) return

        // A versão é o nome da FIPE sem o nome do modelo no começo.
        const fipeModel = detail.model.trim()
        const versao = fipeModel.toLowerCase().startsWith(modelName.trim().toLowerCase())
            ? fipeModel.slice(modelName.trim().length).trim()
            : fipeModel

        setLoading('apply')

        try {
            await onApply({
                tipo,
                marcaCodigo: brandCode,
                modeloCodigo: modelCode,
                anoCodigo: yearCode,
                marcaNome: brandName.trim(),
                modeloNome: modelName.trim(),
                versao: versao || fipeModel,
                codigoFipe: detail.codeFipe,
                preco: parsePrice(detail.price),
                referencia: detail.referenceMonth.trim(),
                anoModelo: detail.modelYear >= ZERO_KM_YEAR ? null : detail.modelYear,
                combustivel: detail.fuel,
            })

            setOpen(false)
        } finally {
            setLoading(null)
        }
    }

    const filteredModels = useMemo(() => {
        const term = modelFilter.trim().toLowerCase()
        const list = term ? models.filter((model) => model.name.toLowerCase().includes(term)) : models

        return list.slice(0, 300)
    }, [models, modelFilter])

    if (!open) {
        return (
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="mb-6 inline-flex items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-700 transition hover:bg-brand-100"
            >
                <Search size={16} />
                Buscar na tabela FIPE
            </button>
        )
    }

    return (
        <div className="mb-6 rounded-2xl border border-brand-200 bg-brand-50/40 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-bold text-zinc-950">Buscar na tabela FIPE</p>

                <div className="flex gap-1 rounded-xl bg-white p-1 ring-1 ring-zinc-200">
                    {TIPOS.map((item) => (
                        <button
                            key={item.value}
                            type="button"
                            onClick={() => {
                                setTipo(item.value)
                                setModels([])
                                setYears([])
                                setModelCode('')
                                setYearCode('')
                                setDetail(null)
                            }}
                            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${tipo === item.value ? 'bg-brand-600 text-white' : 'text-zinc-600 hover:bg-zinc-100'
                                }`}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                    <label className="text-sm font-medium text-zinc-700">Marca</label>
                    <select
                        value={brandCode}
                        onChange={(event) => void handleBrand(event.target.value)}
                        disabled={loading === 'brands'}
                        className={selectClass}
                    >
                        <option value="">{loading === 'brands' ? 'Carregando...' : 'Selecione'}</option>
                        {brands.map((brand) => (
                            <option key={brand.code} value={brand.code}>
                                {brand.name}
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="text-sm font-medium text-zinc-700">Modelo e versão</label>
                    <input
                        value={modelFilter}
                        onChange={(event) => setModelFilter(event.target.value)}
                        disabled={!brandCode || loading === 'models'}
                        placeholder="Filtrar (ex: T-Cross 1.0)"
                        className={selectClass}
                    />
                    <select
                        value={modelCode}
                        onChange={(event) => void handleModel(event.target.value)}
                        disabled={!brandCode || loading === 'models'}
                        className={selectClass}
                    >
                        <option value="">
                            {loading === 'models'
                                ? 'Carregando...'
                                : brandCode
                                    ? `Selecione (${filteredModels.length}${models.length > filteredModels.length ? ` de ${models.length}` : ''})`
                                    : 'Selecione a marca'}
                        </option>
                        {filteredModels.map((model) => (
                            <option key={model.code} value={model.code}>
                                {model.name}
                            </option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="text-sm font-medium text-zinc-700">Ano e combustível</label>
                    <select
                        value={yearCode}
                        onChange={(event) => void handleYear(event.target.value)}
                        disabled={!modelCode || loading === 'years'}
                        className={selectClass}
                    >
                        <option value="">{loading === 'years' ? 'Carregando...' : 'Selecione'}</option>
                        {years.map((year) => (
                            <option key={year.code} value={year.code}>
                                {year.name.replace(/^32000/, 'Zero km')}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {loading === 'detail' && (
                <p className="mt-4 flex items-center gap-2 text-sm text-zinc-500">
                    <Loader2 size={16} className="animate-spin" />
                    Consultando preço...
                </p>
            )}

            {detail && (
                <div className="mt-5 rounded-2xl bg-white p-4 ring-1 ring-zinc-200">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="text-sm text-zinc-600">
                            {detail.model} · {detail.modelYear >= ZERO_KM_YEAR ? 'Zero km' : detail.modelYear} · {detail.fuel}
                        </p>
                        <p className="text-sm text-zinc-500">
                            FIPE {detail.codeFipe} · {detail.referenceMonth}
                        </p>
                    </div>

                    <p className="mt-1 text-2xl font-black text-zinc-950">{formatMoney(parsePrice(detail.price))}</p>

                    <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div>
                            <label className="text-sm font-medium text-zinc-700">Marca no seu cadastro</label>
                            <input value={brandName} onChange={(e) => setBrandName(e.target.value)} className={selectClass} />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-zinc-700">Modelo no seu cadastro</label>
                            <input value={modelName} onChange={(e) => setModelName(e.target.value)} className={selectClass} />
                            <p className="mt-1 text-xs text-zinc-500">
                                É o nome que aparece no site. O restante vira a versão.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            <div className="mt-5 flex flex-wrap justify-end gap-3">
                <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-xl px-4 py-3 text-sm font-semibold text-zinc-600 hover:bg-white"
                >
                    Cancelar
                </button>
                <button
                    type="button"
                    onClick={() => void handleApply()}
                    disabled={!detail || loading !== null || !brandName.trim() || !modelName.trim()}
                    className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
                >
                    {loading === 'apply' ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                    Usar estes dados
                </button>
            </div>
        </div>
    )
}

export function FipePriceInfo({
    precoFipe,
    referencia,
    codigo,
    anuncio,
}: {
    precoFipe: number | null
    referencia: string
    codigo: string
    anuncio: number
}) {
    if (!precoFipe) return null

    const diff = anuncio > 0 ? ((anuncio - precoFipe) / precoFipe) * 100 : null

    return (
        <div className="mt-2 rounded-xl bg-zinc-50 px-3 py-2 text-xs text-zinc-600 ring-1 ring-zinc-200">
            <span className="font-semibold text-zinc-800">FIPE: {formatMoney(precoFipe)}</span>
            {referencia && <> · {referencia}</>}
            {codigo && <> · cód. {codigo}</>}
            {diff !== null && Number.isFinite(diff) && (
                <span className={`ml-1 font-semibold ${diff > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                    · anúncio {Math.abs(diff).toFixed(1).replace('.', ',')}% {diff > 0 ? 'acima' : 'abaixo'} da FIPE
                </span>
            )}
        </div>
    )
}
