import { SimpleSettingsPage } from '../../components/settings/simple-settings-page'

export default function CategoriasCustosPage() {
    return (
        <SimpleSettingsPage
            title="Categorias de custos"
            description="Cadastre as categorias usadas nos custos dos veículos."
            table="cost_categories"
            placeholder="Ex: Polimento"
        />
    )
}