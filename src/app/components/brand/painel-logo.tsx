// Identidade "painel". Símbolo redesenhado em SVG a partir do manual da marca;
// trocar pelos arquivos originais quando estiverem disponíveis.

type Variant = 'default' | 'dark' | 'mono'

const COLORS: Record<Variant, { arc: string; ticks: string; accent: string; dot: string; text: string }> = {
    default: { arc: '#185FA5', ticks: '#185FA5', accent: '#EF9F27', dot: '#042C53', text: '#042C53' },
    dark: { arc: '#85B7EB', ticks: '#FFFFFF', accent: '#EF9F27', dot: '#FFFFFF', text: '#FFFFFF' },
    mono: { arc: '#042C53', ticks: '#042C53', accent: '#042C53', dot: '#042C53', text: '#042C53' },
}

export function PainelSymbol({
    variant = 'default',
    className = 'h-10 w-auto',
}: {
    variant?: Variant
    className?: string
}) {
    const c = COLORS[variant]

    return (
        <svg viewBox="8 8 84 112" className={className} aria-hidden="true">
            <g fill="none" strokeLinecap="round">
                <path d="M20 112 V50 A30 30 0 0 1 74.57 32.79" stroke={c.arc} strokeWidth="10" />
                <path d="M78.19 39.74 A30 30 0 0 1 65 75.98" stroke={c.accent} strokeWidth="10" />
                <g stroke={c.ticks} strokeWidth="4.5">
                    <line x1="38.22" y1="44.5" x2="32.79" y2="41.97" />
                    <line x1="42.54" y1="39.35" x2="39.1" y2="34.44" />
                    <line x1="48.42" y1="37.09" x2="47.68" y2="31.14" />
                    <line x1="54.45" y1="37.78" x2="56.5" y2="32.14" />
                </g>
                <line x1="50" y1="50" x2="66.09" y2="36.5" stroke={c.accent} strokeWidth="5" />
            </g>
            <circle cx="50" cy="50" r="6.5" fill={c.dot} />
        </svg>
    )
}

export function PainelLogo({
    variant = 'default',
    size = 'md',
}: {
    variant?: Variant
    size?: 'md' | 'lg'
}) {
    const symbolClass = size === 'lg' ? 'h-16 w-auto' : 'h-11 w-auto'
    const textClass = size === 'lg' ? 'text-5xl' : 'text-4xl'

    return (
        <span className="inline-flex items-center gap-2" aria-label="painel">
            <PainelSymbol variant={variant} className={symbolClass} />
            <span
                className={`${textClass} font-logo font-semibold leading-none tracking-tight`}
                style={{ color: COLORS[variant].text }}
            >
                painel
            </span>
        </span>
    )
}
