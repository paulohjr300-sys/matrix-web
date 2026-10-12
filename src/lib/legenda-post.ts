// Legenda dos posts de veículo (Instagram/Facebook), montada a partir de um
// modelo com {variáveis}. O modelo é o da loja (empresas.legenda_post) ou o
// padrão abaixo.

export const LEGENDA_PADRAO = `🚗 {marca} {modelo} {versao}
📅 {ano} · {km} km
🎨 {cor} · ⛽ {combustivel} · ⚙️ {cambio}

💰 {preco}

📲 Chama no WhatsApp: {whatsapp}
🔗 Mais fotos e detalhes: {link}

{loja}
#{marca_tag} #{modelo_tag} #seminovos #carros`

export const VARIAVEIS_LEGENDA = [
    'marca',
    'modelo',
    'versao',
    'ano',
    'km',
    'preco',
    'cor',
    'combustivel',
    'cambio',
    'whatsapp',
    'link',
    'loja',
    'marca_tag',
    'modelo_tag',
]

const VARIAVEL = /\{(\w+)\}/g

export function hashtag(valor: string) {
    return valor
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-zA-Z0-9]/g, '')
        .toLowerCase()
}

// Trecho com variáveis que ficaram todas vazias some: a linha inteira, ou
// só o pedaço entre " · " (ex.: "🎨 {cor}" sem cor cadastrada).
function vazio(trecho: string, valores: Record<string, string>) {
    const nomes = [...trecho.matchAll(VARIAVEL)].map((m) => m[1]).filter((n) => VARIAVEIS_LEGENDA.includes(n))
    return nomes.length > 0 && nomes.every((nome) => !valores[nome])
}

function preencher(trecho: string, valores: Record<string, string>) {
    return trecho.replace(VARIAVEL, (todo, nome) => (VARIAVEIS_LEGENDA.includes(nome) ? valores[nome] || '' : todo))
}

export function montarLegenda(modelo: string, valores: Record<string, string>) {
    return modelo
        .split('\n')
        .flatMap((linha) => {
            if (vazio(linha, valores)) return []

            const trechos = linha
                .split(' · ')
                .filter((trecho) => !vazio(trecho, valores))
                .map((trecho) => preencher(trecho, valores))

            return [
                trechos
                    .join(' · ')
                    .replace(/(^|\s)#(?=\s|$)/g, '$1')
                    .replace(/ {2,}/g, ' ')
                    .trimEnd(),
            ]
        })
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
}

// Campos do veículo que a legenda usa (select do Supabase, com os nomes
// de marca, modelo, cor etc.).
export const VEICULO_LEGENDA_SELECT =
    'km, model_year, manufacture_year, advertised_price, versao, slug, is_published, main_photo_file_id, brands(name), vehicle_models(name), colors(name), fuels(name), transmissions(name)'

type Relacao = { name?: string } | { name?: string }[] | null | undefined

export type VeiculoLegenda = {
    km: number | null
    model_year: number | null
    manufacture_year: number | null
    advertised_price: number | null
    versao: string | null
    slug: string | null
    is_published: boolean | null
    brands?: Relacao
    vehicle_models?: Relacao
    colors?: Relacao
    fuels?: Relacao
    transmissions?: Relacao
}

function nome(rel: Relacao) {
    const item = Array.isArray(rel) ? rel[0] : rel
    return item?.name || ''
}

// (27) 99999-8888, a partir do número salvo (com ou sem o 55).
export function telefoneLegivel(valor: string | null) {
    const d = (valor || '').replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '')
    if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
    if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
    return valor || ''
}

// Valores das {variáveis} da legenda para um veículo.
export function valoresDaLegenda(
    veiculo: VeiculoLegenda,
    vehicleId: string,
    empresa: { nome?: string | null; whatsapp?: string | null; telefone?: string | null } | null,
    siteUrl: string
) {
    const marca = nome(veiculo.brands)
    const modelo = nome(veiculo.vehicle_models)
    const ano =
        veiculo.manufacture_year && veiculo.model_year && veiculo.manufacture_year !== veiculo.model_year
            ? `${veiculo.manufacture_year}/${veiculo.model_year}`
            : String(veiculo.model_year || veiculo.manufacture_year || '')

    return {
        marca,
        modelo,
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
        whatsapp: telefoneLegivel(empresa?.whatsapp || empresa?.telefone || null),
        // Só com o veículo publicado: senão o link do site não abre.
        link: siteUrl && veiculo.is_published ? `${siteUrl}/estoque/${veiculo.slug || vehicleId}` : '',
        loja: empresa?.nome || '',
        marca_tag: hashtag(marca),
        modelo_tag: hashtag(modelo),
    }
}
