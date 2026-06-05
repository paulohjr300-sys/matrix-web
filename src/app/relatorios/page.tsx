import { AppSidebar } from '../components/app-sidebar'
import { RouteGuard } from '../components/auth/route-guard'

export default function RelatoriosPage() {
    return (
        <RouteGuard allowedRoles={['ADMIN', 'GERENTE']}>
            <div className="flex">
                <AppSidebar />

                <main className="flex-1 min-h-screen bg-zinc-100 p-8">
                    <h1 className="text-3xl font-bold">Relatórios</h1>
                    <p className="mt-2 text-zinc-500">
                        Em breve: relatórios de estoque, vendas, custos e lucro por veículo.
                    </p>
                </main>
            </div>

        </RouteGuard>

    )
}