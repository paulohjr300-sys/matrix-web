import { defineConfig } from 'vitest/config'

// Testes das regras sem banco (cobrança, portais, legendas). As variáveis
// abaixo só existem para os módulos carregarem: nenhum teste acessa a rede.
export default defineConfig({
    test: {
        include: ['src/**/*.test.ts'],
        environment: 'node',
        env: {
            NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321',
            SUPABASE_SERVICE_ROLE_KEY: 'teste',
            INTEGRATIONS_SECRET: 'teste-teste-teste-teste-teste-teste-1234',
            NEXT_PUBLIC_PLANO_BASICO_PRECO: '99.90',
            NEXT_PUBLIC_PLANO_PRO_PRECO: '149.90',
        },
    },
})
