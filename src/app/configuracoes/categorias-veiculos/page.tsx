import type { ComponentType } from 'react'
import { SimpleSettingsPage } from '../../components/settings/simple-settings-page'

type SimpleSettingsPageProps = {
    title: string
    description: string
    table: string
    placeholder: string
}

const SimpleSettingsPageTyped =
    SimpleSettingsPage as ComponentType<SimpleSettingsPageProps>

export default function CategoriasVeiculosPage() {
    return (
        <SimpleSettingsPageTyped
            title="Categorias de veículos"
            description="Cadastre categorias como Hatch, Sedan, SUV, Picape e Utilitário."
            table="vehicle_categories"
            placeholder="Ex: SUV"
        />
    )
}
