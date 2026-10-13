import { describe, expect, it } from 'vitest'
import { calcularResultado } from './resultado-veiculo'

describe('calcularResultado', () => {
    it('carro sem venda não tem lucro (não vira prejuízo)', () => {
        const r = calcularResultado({ purchase_price: 50000, vehicle_costs: [{ amount: 1500 }], vehicle_sales: [] })
        expect(r.investment).toBe(51500)
        expect(r.vendido).toBe(false)
        expect(r.profit).toBeNull()
        expect(r.margin).toBeNull()
    })

    it('carro vendido: lucro e margem reais', () => {
        const r = calcularResultado({
            purchase_price: 98000,
            vehicle_costs: [{ amount: 3200 }, { amount: 1650 }],
            vehicle_sales: [{ sale_price: 118500 }],
        })
        expect(r.profit).toBe(15650)
        expect(r.margin).toBeCloseTo(13.21, 2)
    })

    it('vendido com prejuízo continua negativo', () => {
        const r = calcularResultado({ purchase_price: 60000, vehicle_costs: null, vehicle_sales: [{ sale_price: 55000 }] })
        expect(r.profit).toBe(-5000)
    })
})
