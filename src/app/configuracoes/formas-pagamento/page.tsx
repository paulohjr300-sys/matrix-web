import { SimpleSettingsPage } from '../../components/settings/simple-settings-page'

export default function FormasPagamentoPage() {
  return (
    <SimpleSettingsPage
      title="Formas de pagamento"
      description="Cadastre as formas de pagamento usadas nas vendas."
      table="payment_methods"
      placeholder="Ex: Financiamento"
    />
  )
}