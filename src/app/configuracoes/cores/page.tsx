import { SimpleSettingsPage } from '../../components/settings/simple-settings-page'

export default function CoresPage() {
    return (
        <SimpleSettingsPage
            title="Cores"
            description="Cadastre as cores dos veículos."
            table="colors"
            placeholder="Ex: Branco Pérola"
        />
    )
}