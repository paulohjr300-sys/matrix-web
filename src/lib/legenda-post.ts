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
