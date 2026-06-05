import { SimpleSettingsPage } from '../../components/settings/simple-settings-page'
import { RouteGuard } from '../../components/auth/route-guard'

export default function MotoresPage() {
    return (
        <RouteGuard allowedRoles={['ADMIN']}>
        <SimpleSettingsPage
            title="Motores"
            description="Cadastre os motores usados nos veículos."
            table="engines"
            placeholder="Ex: 1.0 Turbo"
        />
        </RouteGuard>
    )
}