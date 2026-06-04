import { SimpleSettingsPage } from '../../components/settings/simple-settings-page'

export default function MotoresPage() {
    return (
        <SimpleSettingsPage
            title="Motores"
            description="Cadastre os motores usados nos veículos."
            table="engines"
            placeholder="Ex: 1.0 Turbo"
        />
    )
}