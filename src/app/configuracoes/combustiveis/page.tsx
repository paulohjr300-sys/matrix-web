import { SimpleSettingsPage } from '../../components/settings/simple-settings-page'
import { RouteGuard } from '../../components/auth/route-guard'

export default function CombustiveisPage() {
    return (
        <RouteGuard allowedRoles={['ADMIN']}>

            <SimpleSettingsPage
                title="Combustíveis"
                description="Cadastre os tipos de combustível."
                table="fuels"
                placeholder="Ex: Flex"
            />
        </RouteGuard>
    )
}