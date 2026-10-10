'use client'

interface CurrencyInputProps {
    value: string
    onChange: (value: string) => void
    placeholder?: string
}

export function CurrencyInput({
    value,
    onChange,
    placeholder = 'R$ 0,00',
}: CurrencyInputProps) {
    function formatCurrency(rawValue: string) {
        const onlyNumbers = rawValue.replace(/\D/g, '')

        const numberValue = Number(onlyNumbers) / 100

        return numberValue.toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL',
        })
    }

    return (
        <input
            value={value}
            placeholder={placeholder}
            onChange={(event) => onChange(formatCurrency(event.target.value))}
            className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 outline-none transition-all duration-200 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
        />
    )
}