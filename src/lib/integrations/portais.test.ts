import { describe, expect, it } from 'vitest'
import type { VehicleForListing } from './core'
import {
    acaoSincronizacaoMercadoLivre,
    buildSellerContact,
    buildTitle,
    missingForMercadoLivre,
} from './mercadolivre'
import { acaoSincronizacaoOlx, buildAd, missingForOlx } from './olx'

const veiculo: VehicleForListing = {
    id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    empresa_id: 'loja',
    plate: 'ABC1D23',
    status: 'EM_ESTOQUE',
    km: 45000,
    doors: 4,
    model_year: 2021,
    manufacture_year: 2020,
    advertised_price: 69900.4,
    description: null,
    versao: 'LT 1.0 Turbo',
    brand: 'Chevrolet',
    model: 'Onix',
    fuel: 'Flex',
    transmission: 'Automático',
    color: 'Prata',
    pictures: ['https://f/1.jpg', 'https://f/1.jpg', 'https://f/2.jpg'],
}

const loja = {
    nome: 'Loja Teste',
    whatsapp: '5527999998888',
    telefone: '2733334444',
    email: 'contato@loja.com',
    endereco: 'Rua A, 1',
    cep: '29100-000',
}

describe('sincronização: carro vendido sai dos portais', () => {
    it('Mercado Livre', () => {
        expect(acaoSincronizacaoMercadoLivre('publicado', 'VENDIDO')).toBe('encerrar')
        expect(acaoSincronizacaoMercadoLivre('pausado', 'VENDIDO')).toBe('encerrar')
        expect(acaoSincronizacaoMercadoLivre('publicado', 'RESERVADO')).toBe('pausar')
        expect(acaoSincronizacaoMercadoLivre('publicado', 'EM_ESTOQUE')).toBe('atualizar')
        // Pausado à mão continua pausado (só atualiza os dados).
        expect(acaoSincronizacaoMercadoLivre('pausado', 'EM_ESTOQUE')).toBe('atualizar')
    })

    it('Mercado Livre: anúncio inexistente, encerrado ou com erro não é mexido', () => {
        expect(acaoSincronizacaoMercadoLivre(null, 'VENDIDO')).toBeNull()
        expect(acaoSincronizacaoMercadoLivre('encerrado', 'VENDIDO')).toBeNull()
        expect(acaoSincronizacaoMercadoLivre('erro', 'EM_ESTOQUE')).toBeNull()
    })

    it('OLX (inclusive anúncio ainda na fila)', () => {
        expect(acaoSincronizacaoOlx('publicado', 'VENDIDO')).toBe('encerrar')
        expect(acaoSincronizacaoOlx('pendente', 'VENDIDO')).toBe('encerrar')
        expect(acaoSincronizacaoOlx('pendente', 'EM_ESTOQUE')).toBe('verificar')
        expect(acaoSincronizacaoOlx('publicado', 'EM_ESTOQUE')).toBe('atualizar')
        expect(acaoSincronizacaoOlx('encerrado', 'VENDIDO')).toBeNull()
    })
})

describe('Mercado Livre: anúncio', () => {
    it('título com marca, modelo, versão e ano, até 60 caracteres', () => {
        expect(buildTitle(veiculo)).toBe('Chevrolet Onix LT 1.0 Turbo 2021')
        expect(buildTitle({ ...veiculo, versao: 'x'.repeat(80) }).length).toBeLessThanOrEqual(60)
    })

    it('veículo completo não tem pendências', () => {
        expect(missingForMercadoLivre(veiculo, loja)).toEqual([])
    })

    it('WhatsApp salvo sem o 55 é aceito e enviado com o código do país', () => {
        const semPais = { ...loja, whatsapp: '27999998888' }
        expect(missingForMercadoLivre(veiculo, semPais)).toEqual([])
        expect(buildSellerContact(semPais)).toMatchObject({ country_code2: '55', phone2: '27999998888' })
    })

    it('aponta o que falta em linguagem do lojista', () => {
        const faltando = missingForMercadoLivre(
            { ...veiculo, advertised_price: null, pictures: [], fuel: 'Querosene' },
            { ...loja, cep: '123', whatsapp: null }
        )
        expect(faltando).toEqual(
            expect.arrayContaining(['valor anunciado', 'ao menos uma foto', 'combustível'])
        )
        expect(faltando.some((item) => item.startsWith('CEP da loja'))).toBe(true)
        expect(faltando.some((item) => item.startsWith('WhatsApp da loja'))).toBe(true)
    })
})

describe('OLX: anúncio', () => {
    const dados = { adId: 'p123', marcaId: '1', modeloId: '2', versaoId: '3' }

    it('monta o anúncio com preço inteiro, CEP, telefone e fotos sem repetir', () => {
        const ad = buildAd(veiculo, loja, dados)
        expect(ad.price).toBe(69900)
        expect(ad.zipcode).toBe('29100000')
        expect(ad.phone).toBe(27999998888)
        expect(ad.images).toEqual(['https://f/1.jpg', 'https://f/2.jpg'])
        expect(ad.params).toMatchObject({ regdate: '2021', mileage: 45000, vehicle_tag: 'ABC1D23' })
    })

    it('exige o catálogo da OLX e telefone com DDD', () => {
        const faltando = missingForOlx(veiculo, { ...loja, whatsapp: null, telefone: '9999' }, {})
        expect(faltando).toContain('marca, modelo e versão do catálogo da OLX')
        expect(faltando).toContain('telefone ou WhatsApp da loja com DDD')
    })
})
