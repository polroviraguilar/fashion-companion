import { STYLE_COLORS } from '../data/styleProfile'

export interface Oklch {
  l: number
  c: number
  h: number
}

function hexToRgb(hex: string) {
  const clean = hex.replace('#', '')
  const value = clean.length === 3
    ? clean.split('').map((c) => c + c).join('')
    : clean
  const n = Number.parseInt(value, 16)
  return {
    r: ((n >> 16) & 255) / 255,
    g: ((n >> 8) & 255) / 255,
    b: (n & 255) / 255
  }
}

function srgbToLinear(value: number) {
  return value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4)
}

export function hexToOklch(hex: string): Oklch {
  const rgb = hexToRgb(hex)
  const r = srgbToLinear(rgb.r)
  const g = srgbToLinear(rgb.g)
  const b = srgbToLinear(rgb.b)

  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b

  const l_ = Math.cbrt(l)
  const m_ = Math.cbrt(m)
  const s_ = Math.cbrt(s)

  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_
  const a = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_
  const bb = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_
  const c = Math.sqrt(a * a + bb * bb)
  const h = ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360

  return { l: L, c, h }
}

function hueDistance(a: number, b: number) {
  const d = Math.abs(a - b)
  return Math.min(d, 360 - d)
}

export function perceptualDistance(hexA: string, hexB: string) {
  const a = hexToOklch(hexA)
  const b = hexToOklch(hexB)
  const dl = Math.abs(a.l - b.l)
  const dc = Math.abs(a.c - b.c)
  const dh = hueDistance(a.h, b.h) / 180
  return dl * 1.35 + dc * 1.7 + dh * Math.min(a.c, b.c) * 1.2
}

export function nearestStyleColor(hex: string) {
  return [...STYLE_COLORS]
    .map((color) => ({ color, distance: perceptualDistance(hex, color.hex) }))
    .sort((a, b) => a.distance - b.distance)[0].color
}

const preferredPairs = new Set([
  'Navy|Off White','Navy|Cream','Navy|Olive','Navy|Dark Khaki','Navy|Beige','Navy|Stone','Navy|Charcoal','Navy|Tobacco','Navy|Camel','Navy|Light Denim','Navy|Burgundy',
  'Olive|Off White','Olive|Cream','Olive|Tobacco','Olive|Washed Black','Olive|Stone','Olive|Beige','Olive|Light Denim','Olive|Charcoal',
  'Dark Khaki|Off White','Dark Khaki|Cream','Dark Khaki|Navy','Dark Khaki|Washed Black','Dark Khaki|Tobacco',
  'Beige|Off White','Beige|Cream','Beige|Tobacco','Beige|Olive','Beige|Washed Black','Beige|Charcoal','Beige|Light Denim',
  'Stone|Off White','Stone|Cream','Stone|Tobacco','Stone|Washed Black','Stone|Light Denim','Stone|Burgundy',
  'Charcoal|Off White','Charcoal|Cream','Charcoal|Olive','Charcoal|Tobacco','Charcoal|Light Denim','Charcoal|Burgundy',
  'Washed Black|Off White','Washed Black|Cream','Washed Black|Olive','Washed Black|Tobacco','Washed Black|Light Denim','Washed Black|Rust',
  'Off White|Tobacco','Off White|Camel','Off White|Light Denim','Off White|Burgundy','Off White|Rust','Off White|Muted Mustard',
  'Cream|Tobacco','Cream|Camel','Cream|Light Denim','Cream|Burgundy','Cream|Rust','Cream|Muted Mustard',
  'Tobacco|Light Denim','Tobacco|Washed Black','Tobacco|Burgundy',
  'Light Denim|Washed Black','Light Denim|Burgundy','Light Denim|Rust'
])

function pairKey(a: string, b: string) {
  return [a, b].sort((x, y) => x.localeCompare(y)).join('|')
}

const normalizedPairs = new Set(Array.from(preferredPairs).map((pair) => {
  const [a, b] = pair.split('|')
  return pairKey(a, b)
}))

export function colorPairScore(hexA: string, hexB: string) {
  const a = nearestStyleColor(hexA)
  const b = nearestStyleColor(hexB)

  if (a.name === b.name) return 82
  if (normalizedPairs.has(pairKey(a.name, b.name))) return 94

  const oa = hexToOklch(hexA)
  const ob = hexToOklch(hexB)
  const lightnessContrast = Math.abs(oa.l - ob.l)
  const hue = hueDistance(oa.h, ob.h)

  let score = 72
  if (lightnessContrast > 0.28) score += 8
  if (hue > 25 && hue < 130) score += 4
  if (a.role === 'accent' && b.role === 'accent') score -= 20
  if (a.role === 'neutral' || b.role === 'neutral') score += 6
  return Math.max(35, Math.min(92, score))
}

export function paletteComplexityPenalty(hexes: string[]) {
  const families = hexes.map((hex) => nearestStyleColor(hex))
  const accents = families.filter((x) => x.role === 'accent').length
  const unique = new Set(families.map((x) => x.name)).size
  let penalty = 0
  if (accents > 1) penalty += (accents - 1) * 10
  if (unique > 4) penalty += (unique - 4) * 4
  return penalty
}

export function readableTextColor(hex: string) {
  const { l } = hexToOklch(hex)
  return l > 0.64 ? '#202019' : '#F7F1E5'
}

export function normalizeHex(value: string) {
  const raw = value.trim().replace('#', '')
  if (/^[0-9a-fA-F]{3}$/.test(raw)) {
    return `#${raw.split('').map((x) => x + x).join('').toUpperCase()}`
  }
  if (/^[0-9a-fA-F]{6}$/.test(raw)) return `#${raw.toUpperCase()}`
  return null
}
