const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

// Largest unit first; each entry is [unit, milliseconds].
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 3600_000],
  ['month', 30 * 24 * 3600_000],
  ['week', 7 * 24 * 3600_000],
  ['day', 24 * 3600_000],
  ['hour', 3600_000],
  ['minute', 60_000],
]

export function timeAgo(timestamp: number): string {
  const diff = timestamp - Date.now()
  for (const [unit, ms] of UNITS) {
    if (Math.abs(diff) >= ms) {
      return relative.format(Math.round(diff / ms), unit)
    }
  }
  return 'just now'
}

export function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`
}
