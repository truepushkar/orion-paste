// Small, dependency-free utilities used across the app.

const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['second', 60],
  ['minute', 60],
  ['hour', 24],
  ['day', 7],
  ['week', 4.348],
  ['month', 12],
  ['year', Infinity],
]

const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

/** "3 minutes ago", "in 2 days". Falls back to a date for anything unparsable. */
export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const then = new Date(iso)
  if (Number.isNaN(then.getTime())) return ''

  let delta = (then.getTime() - Date.now()) / 1000
  for (const [unit, span] of UNITS) {
    if (Math.abs(delta) < span) {
      return relative.format(Math.round(delta), unit)
    }
    delta /= span
  }
  return then.toLocaleDateString()
}

/** A stable, unambiguous stamp for metadata lines: 21 Oct 2026, 14:04 UTC. */
export function absoluteTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return ''
  const date = at.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
  const time = at.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  })
  return `${date}, ${time} UTC`
}

export function expiryLabel(iso: string | null | undefined): string {
  if (!iso) return 'never expires'
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return 'never expires'
  if (at.getTime() < Date.now()) return 'expired'
  return `${relativeTime(iso)}`
}

export function countWords(text: string): number {
  const words = text.trim().match(/\S+/g)
  return words ? words.length : 0
}

export function lineCount(text: string): number {
  if (!text) return 0
  return text.split('\n').length
}

/** Copy with the async clipboard, falling back to a selection hack. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Permission or insecure context; fall through to the legacy path.
  }

  try {
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.top = '-1000px'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    const copied = document.execCommand('copy')
    document.body.removeChild(area)
    return copied
  } catch {
    return false
  }
}

export function classNames(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ')
}

export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function isMac(): boolean {
  return /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
}

/** The command key glyph for this platform, for shortcut hints. */
export function modKey(): string {
  return isMac() ? '\u2318' : 'Ctrl'
}
