interface TextInputProps {
  label: string
  placeholder?: string
  type?: string
}

export function TextInput({
  label,
  placeholder,
  type = 'text',
}: TextInputProps) {
  return (
    <div>
      <label className="text-sm font-medium text-zinc-700">
        {label}
      </label>

      <input
        type={type}
        placeholder={placeholder}
        className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 outline-none transition-all duration-200 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
      />
    </div>
  )
}