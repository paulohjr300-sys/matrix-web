import type { Metadata } from 'next'
import { LegalPage, H2, List } from '../components/legal-page'
import { PLATFORM, platformValue } from '../../lib/platform'

export const metadata: Metadata = {
    title: 'Política de Privacidade | painel',
}

export default function PrivacidadePage() {
    const empresa = platformValue(PLATFORM.razaoSocial, 'razão social')
    const cnpj = platformValue(PLATFORM.cnpj, 'CNPJ')
    const email = platformValue(PLATFORM.email, 'e-mail de contato')

    return (
        <LegalPage title="Política de Privacidade">
            <p>
                Esta Política explica como <strong>{empresa}</strong>, CNPJ {cnpj}, trata dados pessoais no
                <strong> painel</strong>, em conformidade com a Lei Geral de Proteção de Dados (Lei 13.709/2018).
            </p>

            <H2>1. Quem é responsável por quais dados</H2>
            <List
                items={[
                    <>
                        <strong>Dados das lojas e dos usuários do painel</strong> (nome, e-mail, telefone, dados da
                        loja): nós somos os <strong>controladores</strong>.
                    </>,
                    <>
                        <strong>Dados de clientes e interessados das lojas</strong> (leads enviados pelo site,
                        compradores, vendas): cada loja é a <strong>controladora</strong> e nós somos{' '}
                        <strong>operadores</strong>. Pedidos sobre esses dados devem ser feitos à própria loja.
                    </>,
                ]}
            />

            <H2>2. Dados que coletamos</H2>
            <List
                items={[
                    'Cadastro: nome do responsável, e-mail, senha (guardada de forma criptografada), WhatsApp e dados da loja.',
                    'Uso do painel: registros técnicos como data e hora de acesso, necessários para segurança.',
                    'Site das lojas: nome, telefone, e-mail e mensagem que o visitante envia nos formulários, com a data do consentimento.',
                ]}
            />

            <H2>3. Para que usamos e com qual base legal</H2>
            <List
                items={[
                    'Prestar o serviço contratado e dar suporte (execução de contrato).',
                    'Cobrança e obrigações fiscais (cumprimento de obrigação legal).',
                    'Segurança, prevenção a fraudes e melhoria do serviço (legítimo interesse).',
                    'Encaminhar à loja o contato enviado pelo visitante no site (consentimento do visitante).',
                ]}
            />

            <H2>4. Compartilhamento</H2>
            <p>
                Não vendemos dados pessoais. Compartilhamos apenas com fornecedores necessários para o serviço
                funcionar, que tratam os dados conforme nossas instruções: hospedagem do sistema (Vercel),
                banco de dados e armazenamento de arquivos (Supabase) e, quando houver cobrança, a empresa de
                pagamentos. Alguns desses fornecedores podem armazenar dados fora do Brasil, com as garantias
                previstas na LGPD.
            </p>

            <H2>5. Por quanto tempo guardamos</H2>
            <p>
                Enquanto a conta estiver ativa e, depois do cancelamento, pelo prazo necessário para cumprir
                obrigações legais ou exercer direitos em processos. Dados de leads seguem as regras definidas
                pela loja.
            </p>

            <H2>6. Seus direitos</H2>
            <p>
                Você pode pedir confirmação de tratamento, acesso, correção, anonimização, portabilidade,
                exclusão e informações sobre compartilhamento, além de revogar consentimentos (art. 18 da LGPD).
                Para dados de leads, fale com a loja; para os demais, escreva para {email}.
            </p>

            <H2>7. Segurança</H2>
            <p>
                Usamos conexão criptografada (HTTPS), senhas protegidas, separação dos dados de cada loja no
                banco e controle de acesso por perfil. Nenhum sistema é totalmente imune a incidentes; se
                ocorrer algum que gere risco relevante, avisaremos os afetados e a ANPD.
            </p>

            <H2>8. Cookies</H2>
            <p>
                O painel usa apenas cookies necessários para manter você conectado. O site das lojas guarda os
                veículos favoritos no próprio navegador do visitante.
            </p>

            <H2>9. Contato do encarregado (DPO)</H2>
            <p>{email}</p>
        </LegalPage>
    )
}
