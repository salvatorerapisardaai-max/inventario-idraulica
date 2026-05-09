/**
 * Placeholder SVG per categoria articolo.
 *
 * Quando un articolo non ha foto_url popolata, mostriamo un'icona vettoriale
 * monocromatica coerente con la categoria. Tutte le icone usano `currentColor`
 * così ereditano il colore dal componente che le contiene (compatibilità dark/light).
 *
 * Le icone sono stilisticamente uniformi: stroke 1.5px, viewBox 24x24,
 * niente fill colorati — restano sobrie e leggibili a qualsiasi dimensione.
 */

import type { Categoria } from './supabase'

type IconProps = {
  size?: number
  className?: string
  style?: React.CSSProperties
}

const iconBase = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
})

// ─── Icone per categoria ─────────────────────────────────────────────

export function IconRaccordi({ size = 64, ...rest }: IconProps) {
  return (
    <svg {...iconBase(size)} {...rest}>
      <path d="M4 12h6m4 0h6" />
      <rect x="9" y="8" width="6" height="8" rx="1" />
      <path d="M9 10h-2v4h2M15 10h2v4h-2" />
    </svg>
  )
}

export function IconValvole({ size = 64, ...rest }: IconProps) {
  return (
    <svg {...iconBase(size)} {...rest}>
      <path d="M3 12h6m6 0h6" />
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 4v3M12 17v3" />
      <path d="M9 4h6" />
    </svg>
  )
}

export function IconTubi({ size = 64, ...rest }: IconProps) {
  return (
    <svg {...iconBase(size)} {...rest}>
      <path d="M3 9c4 0 4 6 8 6s4-6 8-6" />
      <path d="M3 13c4 0 4 6 8 6" opacity="0.4" />
    </svg>
  )
}

export function IconGuarnizioni({ size = 64, ...rest }: IconProps) {
  return (
    <svg {...iconBase(size)} {...rest}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
    </svg>
  )
}

export function IconPompe({ size = 64, ...rest }: IconProps) {
  return (
    <svg {...iconBase(size)} {...rest}>
      <circle cx="12" cy="13" r="5" />
      <path d="M12 8V4M9 4h6" />
      <path d="M3 13h4M17 13h4" />
      <path d="M12 11l2 2-2 2-2-2z" />
    </svg>
  )
}

export function IconFiltri({ size = 64, ...rest }: IconProps) {
  return (
    <svg {...iconBase(size)} {...rest}>
      <path d="M5 4h14l-5 7v7l-4 2v-9z" />
    </svg>
  )
}

export function IconStrumenti({ size = 64, ...rest }: IconProps) {
  return (
    <svg {...iconBase(size)} {...rest}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7l3 5-3 1z" />
      <circle cx="12" cy="12" r="0.8" fill="currentColor" />
    </svg>
  )
}

export function IconRubinetteria({ size = 64, ...rest }: IconProps) {
  return (
    <svg {...iconBase(size)} {...rest}>
      <path d="M8 4h8M12 4v4" />
      <rect x="6" y="8" width="12" height="3" rx="0.5" />
      <path d="M12 11v3M9 14h6v2H9z" />
      <path d="M11 16v3" />
    </svg>
  )
}

export function IconGiunti({ size = 64, ...rest }: IconProps) {
  return (
    <svg {...iconBase(size)} {...rest}>
      <path d="M3 12h7M14 12h7" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  )
}

export function IconAccessori({ size = 64, ...rest }: IconProps) {
  return (
    <svg {...iconBase(size)} {...rest}>
      <path d="M5 8h14l-1 12H6z" />
      <path d="M9 8V5a3 3 0 016 0v3" />
    </svg>
  )
}

export function IconAltro({ size = 64, ...rest }: IconProps) {
  return (
    <svg {...iconBase(size)} {...rest}>
      <rect x="4" y="6" width="16" height="13" rx="1.5" />
      <path d="M8 6V4h8v2" />
    </svg>
  )
}

// ─── Mappa categoria → componente icona ─────────────────────────────

const ICONS: Record<Categoria, React.FC<IconProps>> = {
  'Raccordi': IconRaccordi,
  'Valvole': IconValvole,
  'Tubi e Tubazioni': IconTubi,
  'Guarnizioni e O-ring': IconGuarnizioni,
  'Pompe': IconPompe,
  'Filtri': IconFiltri,
  'Manometri e Strumenti': IconStrumenti,
  'Rubinetteria': IconRubinetteria,
  'Giunti': IconGiunti,
  'Accessori': IconAccessori,
  'Altro': IconAltro,
}

/**
 * Icona-placeholder per una categoria.
 * Se la categoria è nulla o sconosciuta, usa "Altro".
 */
export function IconaCategoria({
  categoria,
  size = 64,
  ...rest
}: IconProps & { categoria?: string | null }) {
  const Comp = (categoria && ICONS[categoria as Categoria]) || IconAltro
  return <Comp size={size} {...rest} />
}

/**
 * Componente "placeholder card" da usare al posto di <img> quando
 * l'articolo non ha ancora foto. Mostra l'icona della categoria su
 * sfondo neutro, con il nome categoria sotto.
 *
 * Usage:
 *   {articolo.foto_url
 *     ? <img src={articolo.foto_url} alt={articolo.nome} />
 *     : <PlaceholderArticolo categoria={articolo.categoria} />}
 */
export function PlaceholderArticolo({
  categoria,
  size = 120,
}: {
  categoria?: string | null
  size?: number
}) {
  return (
    <div
      style={{
        width: size,
        height: size,
        background: 'var(--surface, #f5f5f7)',
        border: '1px solid var(--border, #e0e0e0)',
        borderRadius: 8,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        color: 'var(--muted, #888)',
      }}
    >
      <IconaCategoria categoria={categoria} size={size * 0.4} />
      {categoria && (
        <span
          style={{
            fontSize: Math.max(9, size * 0.08),
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            opacity: 0.7,
          }}
        >
          {categoria}
        </span>
      )}
    </div>
  )
}
