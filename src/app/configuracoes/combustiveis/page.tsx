import { SimpleSettingsPage } from '../../components/settings/simple-settings-page'

export default function CombustiveisPage() {
    return (
        <SimpleSettingsPage
            title="Combustíveis"
            description="Cadastre os tipos de combustível."
            table="fuels"
            placeholder="Ex: Flex"
        />
    )
}