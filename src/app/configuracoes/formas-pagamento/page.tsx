import { SimpleSettingsPage } from '../../components/settings/simple-settings-page'
import { RouteGuard } from '../../components/auth/route-guard'

export default function FormasPagamentoPage() {
  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <SimpleSettingsPage
        title="Formas de pagamento"
        description="Cadastre as formas de pagamento usadas nas vendas."
        table="payment_methods"
        placeholder="Ex: Financiamento"
      />
    </RouteGuard>
  )
}