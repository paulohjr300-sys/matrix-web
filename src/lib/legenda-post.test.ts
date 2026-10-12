import { describe, expect, it } from 'vitest'
import { hashtag, LEGENDA_PADRAO, montarLegenda } from './legenda-post'
import { comCodigoDoPais } from './telefone'

const valores = {
    marca: 'Chevrolet',
    modelo: 'Onix',
    versao: 'LT 1.0',
    ano: '2020/2021',
    km: '45.000',
    preco: 'R$ 69.900',
    cor: 'Prata',
    combustivel: 'Flex',
    cambio: 'Manual',
    whatsapp: '(27) 99999-8888',
    link: 'https://loja/estoque/onix',
    loja: 'Loja Teste',
    marca_tag: 'chevrolet',
    modelo_tag: 'onix',
}

describe('montarLegenda', () => {
    it('preenche o modelo padrão', () => {
        const legenda = montarLegenda(LEGENDA_PADRAO, valores)
        expect(legenda).toContain('🚗 Chevrolet Onix LT 1.0')
        expect(legenda).toContain('🎨 Prata · ⛽ Flex · ⚙️ Manual')
        expect(legenda).toContain('#chevrolet #onix #seminovos #carros')
    })

    it('some com a linha ou o trecho de campo vazio', () => {
        const legenda = montarLegenda(LEGENDA_PADRAO, { ...valores, preco: '', cor: '', cambio: '', whatsapp: '' })
        expect(legenda).not.toContain('💰')
        expect(legenda).not.toContain('WhatsApp')
        expect(legenda).toContain('⛽ Flex')
        expect(legenda).not.toContain('🎨')
        expect(legenda).not.toMatch(/\n{3,}/)
    })

    it('hashtag sem marca não deixa "#" solto', () => {
        const legenda = montarLegenda(LEGENDA_PADRAO, { ...valores, marca_tag: '' })
        expect(legenda).toContain('#onix #seminovos')
        expect(legenda).not.toMatch(/#\s/)
    })

    it('variável desconhecida fica como está', () => {
        expect(montarLegenda('Oferta {qualquer} {marca}', valores)).toBe('Oferta {qualquer} Chevrolet')
    })
})

describe('hashtag', () => {
    it('tira acento, espaço e símbolos', () => {
        expect(hashtag('Citroën C4 Cactus')).toBe('citroenc4cactus')
    })
})

describe('comCodigoDoPais', () => {
    it('completa o 55 quando falta e mantém quando já tem', () => {
        expect(comCodigoDoPais('(27) 99999-8888')).toBe('5527999998888')
        expect(comCodigoDoPais('2733334444')).toBe('552733334444')
        expect(comCodigoDoPais('5527999998888')).toBe('5527999998888')
        expect(comCodigoDoPais(null)).toBe('')
    })
})
