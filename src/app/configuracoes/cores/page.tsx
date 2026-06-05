import { SimpleSettingsPage } from '../../components/settings/simple-settings-page'
import { RouteGuard } from '../../components/auth/route-guard'


export default function CoresPage() {
    return (
        <RouteGuard allowedRoles={['ADMIN']}>
            <SimpleSettingsPage
                title="Cores"
                description="Cadastre as cores dos veículos."
                table="colors"
                placeholder="Ex: Branco Pérola"
            />
        </RouteGuard>

    )
}