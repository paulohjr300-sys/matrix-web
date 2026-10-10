// Dados da empresa dona da plataforma, usados nos Termos de Uso e na
// Política de Privacidade. Preencha antes de vender: enquanto houver
// campos vazios, as páginas mostram um aviso de rascunho.
export const PLATFORM = {
    nome: 'painel',
    razaoSocial: process.env.NEXT_PUBLIC_PLATFORM_RAZAO_SOCIAL || '',
    cnpj: process.env.NEXT_PUBLIC_PLATFORM_CNPJ || '',
    email: process.env.NEXT_PUBLIC_PLATFORM_EMAIL || '',
    cidade: process.env.NEXT_PUBLIC_PLATFORM_CIDADE || '',
    atualizadoEm: '10 de outubro de 2026',
}

export const PLATFORM_DRAFT = !PLATFORM.razaoSocial || !PLATFORM.cnpj || !PLATFORM.email

export function platformValue(value: string, placeholder: string) {
    return value || `[${placeholder}]`
}
