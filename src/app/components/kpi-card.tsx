import { ReactNode } from 'react'

interface KpiCardProps {
    title: string
    value: string
    icon: ReactNode
}

export function KpiCard({
    title,
    value,
    icon,
}: KpiCardProps) {
    return (
        <div className="bg-white rounded-2xl shadow-sm border p-5">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm text-zinc-500">
                        {title}
                    </p>

                    <h2 className="text-3xl font-bold mt-2">
                        {value}
                    </h2>
                </div>

                <div className="bg-red-50 p-3 rounded-xl">
                    {icon}
                </div>
            </div>
        </div>
    )
}