import { AppSidebar } from '../components/app-sidebar'
import { AppHeader } from '../components/app-header'
import { AssinaturaAviso } from './assinatura-aviso'

interface PageContainerProps {
    title: string
    description?: string
    children: React.ReactNode
    action?: React.ReactNode
}

export function PageContainer({
    title,
    description,
    children,
    action,
}: PageContainerProps) {
    return (
        <div className="flex bg-zinc-100">
            <AppSidebar />

            <div className="min-h-screen min-w-0 flex-1">
                <AppHeader title={title} description={description} />
                <AssinaturaAviso />

                <main className="p-4 md:p-8">
                    {action && (
                        <div className="mb-4 flex justify-end md:mb-8">
                            {action}
                        </div>
                    )}

                    <div className="fade-in">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    )
}