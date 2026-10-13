// Resultado financeiro de um veículo (Relatórios e DRE).
// Sem venda lançada o carro está no estoque: não há lucro ainda (null), e
// ele não entra como prejuízo nos totais.

export type DadosResultado = {
    purchase_price?: number | string | null
    vehicle_costs?: { amount: number | string | null }[] | null
    vehicle_sales?: { sale_price: number | string | null }[] | null
}

export function calcularResultado(veiculo: DadosResultado) {
    const purchase = Number(veiculo.purchase_price || 0)
    const costs = (veiculo.vehicle_costs || []).reduce((soma, custo) => soma + Number(custo.amount || 0), 0)
    const investment = purchase + costs

    const vendas = veiculo.vehicle_sales || []
    const vendido = vendas.length > 0
    const sale = vendas.reduce((soma, venda) => soma + Number(venda.sale_price || 0), 0)

    const profit = vendido ? sale - investment : null
    const margin = vendido && sale > 0 ? ((sale - investment) / sale) * 100 : null

    return { purchase, costs, investment, sale, vendido, profit, margin }
}
