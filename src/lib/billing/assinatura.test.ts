import { describe, expect, it } from 'vitest'
import {
    calcularSituacao,
    decidirPlano,
    diferencaProporcional,
    documentoValido,
    somarMes,
    statusPelasCobrancas,
} from './assinatura'

const SUB = 'sub_atual'
const LOJA = '11111111-1111-1111-1111-111111111111'

type Status = 'trial' | 'ativa' | 'inadimplente' | 'cancelada'

function empresa(status: Status, extra: { plano?: 'basico' | 'pro'; trial?: string | null } = {}) {
    return {
        id: LOJA,
        nome: 'Loja Teste',
        email: null,
        whatsapp: null,
        ativo: true,
        plano: extra.plano ?? 'basico',
        assinatura_status: status,
        trial_termina_em: extra.trial === undefined ? null : extra.trial,
        site_suspenso: false,
    }
}

function assinatura(extra: Partial<{ plano: 'basico' | 'pro'; valor: number; upgrade: string | null; sub: string | null }> = {}) {
    return {
        empresa_id: LOJA,
        asaas_customer_id: 'cus_1',
        asaas_subscription_id: extra.sub === undefined ? SUB : extra.sub,
        cpf_cnpj: '52998224725',
        plano: extra.plano ?? 'basico',
        valor: extra.valor ?? 99.9,
        forma_pagamento: 'UNDEFINED',
        proximo_vencimento: null,
        upgrade_pagamento_id: extra.upgrade ?? null,
    }
}

function pagamento(id: string, status: string, vencimento: string, extra: { valor?: number; sub?: string | null } = {}) {
    return {
        id,
        asaas_subscription_id: extra.sub === undefined ? SUB : extra.sub,
        valor: extra.valor ?? 99.9,
        status,
        forma_pagamento: 'UNDEFINED',
        vencimento,
        pago_em: null,
        fatura_url: `https://asaas/${id}`,
    }
}

describe('documentoValido', () => {
    it('aceita CPF e CNPJ válidos, com ou sem máscara', () => {
        expect(documentoValido('529.982.247-25')).toBe(true)
        expect(documentoValido('52998224725')).toBe(true)
        expect(documentoValido('11.222.333/0001-81')).toBe(true)
    })

    it('recusa dígito errado, dígitos repetidos e tamanho errado', () => {
        expect(documentoValido('529.982.247-26')).toBe(false)
        expect(documentoValido('111.111.111-11')).toBe(false)
        expect(documentoValido('11.222.333/0001-82')).toBe(false)
        expect(documentoValido('123')).toBe(false)
    })
})

describe('somarMes', () => {
    it('soma um mês, inclusive na virada do ano', () => {
        expect(somarMes('2026-01-15')).toBe('2026-02-15')
        expect(somarMes('2026-12-10')).toBe('2027-01-10')
    })
})

describe('diferencaProporcional (upgrade no meio do mês)', () => {
    it('cobra só os dias que faltam do mês pago', () => {
        // Pagou o Básico com vencimento em 01/10; sobe para o Pro em 16/10:
        // faltam 16 dos 31 dias -> (149,90 - 99,90) x 16/31.
        const pagos = [pagamento('p1', 'RECEIVED', '2026-10-01')]
        expect(diferencaProporcional(pagos, SUB, 149.9, '2026-10-16')).toBe(25.81)
    })

    it('mês pago adiantado (vence no futuro): diferença cheia', () => {
        const pagos = [pagamento('p1', 'CONFIRMED', '2026-10-24')]
        expect(diferencaProporcional(pagos, SUB, 149.9, '2026-10-12')).toBe(50)
    })

    it('ignora mês já encerrado, fatura não paga e outra assinatura', () => {
        const pagos = [
            pagamento('velho', 'RECEIVED', '2026-08-01'),
            pagamento('aberta', 'PENDING', '2026-10-01'),
            pagamento('outra', 'RECEIVED', '2026-10-01', { sub: 'sub_antiga' }),
        ]
        expect(diferencaProporcional(pagos, SUB, 149.9, '2026-10-16')).toBe(0)
    })

    it('descer de plano não gera cobrança', () => {
        const pagos = [pagamento('p1', 'RECEIVED', '2026-10-01', { valor: 149.9 })]
        expect(diferencaProporcional(pagos, SUB, 99.9, '2026-10-16')).toBe(0)
    })
})

describe('statusPelasCobrancas', () => {
    it('fatura vencida deixa inadimplente', () => {
        expect(statusPelasCobrancas('ativa', ['RECEIVED', 'OVERDUE'])).toBe('inadimplente')
    })

    it('paga e sem vencidas fica ativa (inclusive saindo do teste)', () => {
        expect(statusPelasCobrancas('trial', ['CONFIRMED'])).toBe('ativa')
        expect(statusPelasCobrancas('inadimplente', ['RECEIVED', 'PENDING'])).toBe('ativa')
    })

    it('teste com a primeira fatura só em aberto continua em teste', () => {
        expect(statusPelasCobrancas('trial', ['PENDING'])).toBe('trial')
    })

    it('cancelada não muda por cobrança', () => {
        expect(statusPelasCobrancas('cancelada', ['RECEIVED'])).toBe('cancelada')
    })
})

describe('calcularSituacao (bloqueio do painel e do site)', () => {
    const dia = '2026-10-20'

    it('teste em andamento: libera e conta os dias', () => {
        const s = calcularSituacao(
            { empresa: empresa('trial', { trial: '2026-10-25T15:00:00Z' }), assinatura: null, pagamentos: [] },
            dia
        )
        expect(s.bloqueado).toBe(false)
        expect(s.diasDeTeste).toBe(5)
    })

    it('teste acabou sem plano: bloqueia', () => {
        const s = calcularSituacao(
            { empresa: empresa('trial', { trial: '2026-10-19T15:00:00Z' }), assinatura: null, pagamentos: [] },
            dia
        )
        expect(s.bloqueado).toBe(true)
    })

    it('assinou no teste: tolerância de 7 dias para a primeira fatura', () => {
        const dados = {
            empresa: empresa('trial', { trial: '2026-10-15T15:00:00Z' }),
            assinatura: assinatura(),
            pagamentos: [pagamento('p1', 'PENDING', '2026-10-15')],
        }
        expect(calcularSituacao(dados, '2026-10-22').bloqueado).toBe(false)
        expect(calcularSituacao(dados, '2026-10-23').bloqueado).toBe(true)
    })

    it('em atraso: libera até 7 dias depois do vencimento', () => {
        const dados = {
            empresa: empresa('inadimplente'),
            assinatura: assinatura(),
            pagamentos: [pagamento('p1', 'OVERDUE', '2026-10-10')],
        }
        expect(calcularSituacao(dados, '2026-10-17').bloqueado).toBe(false)
        expect(calcularSituacao(dados, '2026-10-18').bloqueado).toBe(true)
    })

    it('fatura vencida de assinatura antiga não conta para a tolerância', () => {
        const s = calcularSituacao(
            {
                empresa: empresa('inadimplente'),
                assinatura: assinatura(),
                pagamentos: [
                    pagamento('velha', 'OVERDUE', '2026-01-01', { sub: 'sub_antiga' }),
                    pagamento('nova', 'PENDING', '2026-10-18'),
                ],
            },
            dia
        )
        expect(s.bloqueado).toBe(false)
        expect(s.faturaEmAberto?.id).toBe('nova')
    })

    it('cancelada bloqueia; ativa libera', () => {
        expect(calcularSituacao({ empresa: empresa('cancelada'), assinatura: null, pagamentos: [] }, dia).bloqueado).toBe(true)
        expect(calcularSituacao({ empresa: empresa('ativa'), assinatura: assinatura(), pagamentos: [] }, dia).bloqueado).toBe(false)
    })

    it('mostra a diferença do upgrade pendente e não agenda troca', () => {
        const s = calcularSituacao(
            {
                empresa: empresa('ativa', { plano: 'basico' }),
                assinatura: assinatura({ plano: 'pro', valor: 149.9, upgrade: 'dif' }),
                pagamentos: [pagamento('dif', 'PENDING', dia, { valor: 50, sub: null })],
            },
            dia
        )
        expect(s.upgradePendente?.valor).toBe(50)
        expect(s.trocaAgendada).toBeNull()
    })

    it('redução de plano fica agendada para a próxima mensalidade', () => {
        const s = calcularSituacao(
            {
                empresa: empresa('ativa', { plano: 'pro' }),
                assinatura: assinatura({ plano: 'basico', valor: 99.9 }),
                pagamentos: [pagamento('prox', 'PENDING', '2026-11-01')],
            },
            dia
        )
        expect(s.trocaAgendada).toEqual({ plano: 'basico', aPartirDe: '2026-11-01' })
    })
})

describe('decidirPlano (o que um pagamento muda no plano)', () => {
    const contratoPro = { plano: 'pro' as const, valor: 149.9, asaas_subscription_id: SUB, upgrade_pagamento_id: 'dif' }

    it('diferença paga (pelo id guardado) libera o plano novo', () => {
        expect(decidirPlano(LOJA, { id: 'dif', value: 50 }, contratoPro)).toEqual({ tipo: 'diferenca', plano: 'pro' })
    })

    it('diferença reconhecida pela referência, mesmo sem o id guardado', () => {
        const semId = { ...contratoPro, plano: 'basico' as const, upgrade_pagamento_id: null }
        expect(decidirPlano(LOJA, { id: 'x', value: 50, externalReference: `upgrade:${LOJA}:pro` }, semId)).toEqual({
            tipo: 'diferenca',
            plano: 'pro',
        })
        // Referência antiga, sem o plano: só pode ser upgrade para o Pro.
        expect(decidirPlano(LOJA, { id: 'x', value: 50, externalReference: `upgrade:${LOJA}` }, semId)?.plano).toBe('pro')
    })

    it('referência de outra loja não muda nada', () => {
        const semId = { ...contratoPro, upgrade_pagamento_id: null }
        expect(decidirPlano(LOJA, { id: 'x', value: 50, externalReference: 'upgrade:outra-loja:pro' }, semId)).toBeNull()
    })

    it('mensalidade já no valor novo aplica o plano contratado', () => {
        expect(decidirPlano(LOJA, { id: 'm2', subscription: SUB, value: 149.9 }, contratoPro)).toEqual({
            tipo: 'mensalidade',
            plano: 'pro',
        })
    })

    it('aviso repetido da mensalidade antiga (valor antigo) não aplica a troca antes da hora', () => {
        expect(decidirPlano(LOJA, { id: 'm1', subscription: SUB, value: 99.9 }, contratoPro)).toBeNull()
    })

    it('mensalidade de outra assinatura não muda nada', () => {
        expect(decidirPlano(LOJA, { id: 'm', subscription: 'sub_antiga', value: 149.9 }, contratoPro)).toBeNull()
    })
})
