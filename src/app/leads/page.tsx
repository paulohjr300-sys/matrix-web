import { redirect } from 'next/navigation'

// A gestão de leads passou para o Funil de vendas (/crm). Mantém o endereço
// antigo funcionando para links e favoritos.
export default function LeadsPage() {
    redirect('/crm')
}
