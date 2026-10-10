import type { Metadata } from 'next'
import { LegalPage, H2, List } from '../components/legal-page'
import { PLATFORM, platformValue } from '../../lib/platform'

export const metadata: Metadata = {
    title: 'Termos de Uso | painel',
}

export default function TermosPage() {
    const empresa = platformValue(PLATFORM.razaoSocial, 'razão social')
    const cnpj = platformValue(PLATFORM.cnpj, 'CNPJ')
    const email = platformValue(PLATFORM.email, 'e-mail de contato')
    const cidade = platformValue(PLATFORM.cidade, 'cidade/UF')

    return (
        <LegalPage title="Termos de Uso">
            <p>
                Estes Termos regulam o uso do <strong>painel</strong>, sistema de gestão e site de estoque
                para lojas de veículos, oferecido por <strong>{empresa}</strong>, CNPJ {cnpj} (&quot;nós&quot;).
                Ao criar uma conta, a loja (&quot;você&quot;) declara que leu e aceita estes Termos e a
                Política de Privacidade.
            </p>

            <H2>1. O serviço</H2>
            <p>O painel oferece, conforme o plano contratado:</p>
            <List
                items={[
                    'gestão de veículos, custos, vendas, leads e relatórios (incluindo DRE);',
                    'um site público com o estoque da loja, acessível por um endereço da plataforma ou por domínio próprio;',
                    'usuários com perfis de acesso (administrador, gerente e vendedor);',
                    'recursos adicionais que venham a ser incluídos em planos pagos, como integrações com portais de anúncio.',
                ]}
            />

            <H2>2. Conta e responsabilidades</H2>
            <List
                items={[
                    'Você deve informar dados verdadeiros no cadastro e mantê-los atualizados.',
                    'Você é responsável pelos usuários que cria, pela guarda das senhas e por tudo o que for feito com elas.',
                    'O conteúdo publicado no site (fotos, descrições, preços, logo e textos) é de sua responsabilidade, inclusive quanto a direitos autorais, marcas e à exatidão das ofertas perante o Código de Defesa do Consumidor.',
                    'É proibido usar o serviço para fins ilegais, para enviar spam, para tentar acessar dados de outras lojas ou para sobrecarregar a plataforma.',
                ]}
            />

            <H2>3. Período de teste, planos e pagamento</H2>
            <p>
                Lojas novas têm um período de teste gratuito, informado no cadastro. Ao final, a continuidade
                depende da contratação de um plano. Os valores, a forma de cobrança e os recursos de cada plano
                são apresentados no momento da contratação. Em caso de atraso no pagamento, o acesso pode ser
                limitado ou suspenso até a regularização.
            </p>

            <H2>4. Dados pessoais</H2>
            <p>
                Para os dados de clientes e interessados que a loja cadastra ou recebe pelo site (leads), a loja
                é a <strong>controladora</strong> e nós somos <strong>operadores</strong>, nos termos da Lei
                13.709/2018 (LGPD): tratamos esses dados apenas para prestar o serviço, conforme as instruções
                da loja. Os detalhes estão na Política de Privacidade.
            </p>

            <H2>5. Disponibilidade e suporte</H2>
            <p>
                Trabalhamos para manter o serviço disponível e seguro, mas podem ocorrer interrupções para
                manutenção ou por falhas de terceiros (hospedagem, banco de dados, internet). Não garantimos
                funcionamento ininterrupto.
            </p>

            <H2>6. Limitação de responsabilidade</H2>
            <p>
                Não respondemos por negócios fechados entre a loja e seus clientes, por informações publicadas
                pela loja, nem por lucros cessantes. Nossa responsabilidade total fica limitada ao valor pago
                pela loja nos 12 meses anteriores ao fato.
            </p>

            <H2>7. Cancelamento e exclusão</H2>
            <p>
                Você pode cancelar a qualquer momento. Podemos suspender ou encerrar contas que violem estes
                Termos. Após o cancelamento, você pode solicitar a exportação dos seus dados em até 30 dias;
                depois disso, os dados podem ser excluídos, exceto o que a lei obrigar a guardar.
            </p>

            <H2>8. Alterações</H2>
            <p>
                Podemos atualizar estes Termos. Mudanças relevantes serão avisadas no painel ou por e-mail com
                antecedência razoável.
            </p>

            <H2>9. Contato e foro</H2>
            <p>
                Dúvidas: {email}. Fica eleito o foro da comarca de {cidade} para resolver questões relacionadas
                a estes Termos, salvo disposição legal em contrário.
            </p>
        </LegalPage>
    )
}
