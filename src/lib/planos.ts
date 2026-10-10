// Planos da plataforma. Os preços mensais vêm das variáveis
// NEXT_PUBLIC_PLANO_BASICO_PRECO e NEXT_PUBLIC_PLANO_PRO_PRECO, se definidas;
// senão valem os padrões abaixo (R$ 99,90 e R$ 149,90).
// Sem preço, o plano não pode ser contratado pelo painel e a landing page
// mostra "Fale com a gente".

export type PlanoId = 'basico' | 'pro'

function preco(valor: string | undefined) {
    const numero = Number(String(valor || '').replace(',', '.'))
    return numero > 0 ? Math.round(numero * 100) / 100 : null
}

export const PLANOS: Record<PlanoId, { nome: string; preco: number | null }> = {
    basico: { nome: 'Básico', preco: preco(process.env.NEXT_PUBLIC_PLANO_BASICO_PRECO || "99.90") },
    pro: { nome: 'Pro', preco: preco(process.env.NEXT_PUBLIC_PLANO_PRO_PRECO || "149.90") },
}

export function formatarPreco(valor: number) {
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// Dias de tolerância depois do vencimento antes de bloquear o painel.
export const DIAS_TOLERANCIA = 7
