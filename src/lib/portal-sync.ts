// Leva a situação do veículo (preço, fotos, vendido/reservado) para os
// anúncios nos portais. Chame depois de qualquer mudança no veículo:
// cadastro, venda no funil, venda na tela de Vendas.
export async function sincronizarAnuncios(vehicleId: string): Promise<string[]> {
    try {
        const response = await fetch('/api/integracoes/sincronizar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ vehicleId }),
        })

        const result = await response.json().catch(() => null)

        return Array.isArray(result?.erros) ? result.erros : []
    } catch {
        return ['Não foi possível atualizar os anúncios nos portais.']
    }
}
