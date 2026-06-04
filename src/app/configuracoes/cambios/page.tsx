import { SimpleSettingsPage } from '../../components/settings/simple-settings-page'

export default function CambiosPage() {
  return (
    <SimpleSettingsPage
      title="Câmbios"
      description="Cadastre os tipos de câmbio."
      table="transmissions"
      placeholder="Ex: Automático"
    />
  )
}