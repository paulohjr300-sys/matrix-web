interface SelectInputProps {
    label: string
    options: string[]
    value?: string
    onChange?: (value: string) => void
}

export function SelectInput({
    label,
    options,
    value,
    onChange,
}: SelectInputProps) {
    return (
        <div>
            <label className="text-sm font-medium text-zinc-700">
                {label}
            </label>

            <select
                value={value}
                onChange={(event) => onChange?.(event.target.value)}
                className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 outline-none transition-all duration-200 focus:border-red-500 focus:ring-4 focus:ring-red-500/10"
            >
                <option value="">Selecione</option>

                {options.map((item) => (
                    <option key={item} value={item}>
                        {item}
                    </option>
                ))}
            </select>
        </div>
    )
}