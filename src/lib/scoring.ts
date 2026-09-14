import { CURATED_PALETTES, SLOT_ORDER } from '../data/styleProfile'
import type {
  GenerationMood,
  OutfitContext,
  OutfitResult,
  Palette,
  Slot,
  WardrobeItem
} from '../types'
import { colorPairScore, nearestStyleColor, perceptualDistance } from './color'

const SLOT_VISUAL_WEIGHT: Record<Slot, number> = {
  outer: 1,
  bottom: 1,
  mid: 0.86,
  base: 0.78,
  shoes: 0.58,
  headwear: 0.30,
  socks: 0.15
}

const OPTIONAL_SLOTS = new Set<Slot>(['socks', 'mid', 'outer', 'headwear'])
const REQUIRED_SLOTS = new Set<Slot>(['shoes', 'bottom', 'base'])

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value))
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
}

function weightedAverage(entries: { value: number; weight: number }[]) {
  const totalWeight = entries.reduce((sum, entry) => sum + entry.weight, 0)
  if (!totalWeight) return 0
  return entries.reduce((sum, entry) => sum + entry.value * entry.weight, 0) / totalWeight
}

function fitVolume(item: WardrobeItem) {
  const map: Record<WardrobeItem['fit'], number> = {
    slim: 0,
    regular: 1,
    straight: 1.35,
    relaxed: 2,
    wide: 2.75,
    oversized: 3
  }
  return map[item.fit]
}

function structureValue(item: WardrobeItem) {
  return item.structure === 'soft' ? 0 : item.structure === 'medium' ? 1 : 2
}

function weightValue(item: WardrobeItem) {
  if (item.visualWeight === 'light') return 0
  if (item.visualWeight === 'heavy') return 2
  if (item.visualWeight === 'medium') return 1

  const haystack = `${item.material} ${item.subtype}`.toLowerCase()
  if (/wool|canvas|leather|heavy|moleskin|corduroy|boot/.test(haystack)) return 2
  if (/linen|light|jersey|tee|shirt/.test(haystack)) return 0
  return 1
}

function lengthValue(item: WardrobeItem) {
  if (item.length === 'short') return 0
  if (item.length === 'long') return 2
  return 1
}

function seasonForContext(context: OutfitContext) {
  if (context.climate === 'hot') return new Set(['summer'])
  if (context.climate === 'cold') return new Set(['winter', 'autumn'])
  return new Set(['spring', 'summer', 'autumn'])
}

export function isStyleCompatible(item: WardrobeItem) {
  const haystack = `${item.name} ${item.subtype} ${item.material} ${item.notes ?? ''}`.toLowerCase()
  const banned = ['tactical', 'molle', 'biker', 'motorcycle', 'neon', 'fluorescent', 'muscle fit', 'skinny']
  if (banned.some((word) => haystack.includes(word))) return false
  if (item.fit === 'slim') return false
  return true
}

export function isContextCompatible(item: WardrobeItem, context: OutfitContext) {
  if (!item.active) return false
  const seasons = seasonForContext(context)
  if (item.seasons.length && !item.seasons.some((season) => seasons.has(season))) return false

  if (context.climate === 'hot' && weightValue(item) === 2 && ['mid', 'outer', 'headwear'].includes(item.slot)) return false
  if (context.formality === 'smart-casual' && /sweat|hoodie|running/.test(`${item.subtype} ${item.name}`.toLowerCase())) return false
  return true
}

function silhouettePairScore(a: WardrobeItem, b: WardrobeItem) {
  let score = 86
  const av = fitVolume(a)
  const bv = fitVolume(b)
  const difference = Math.abs(av - bv)

  if (a.fit === 'slim' || b.fit === 'slim') score -= 16
  if (av >= 2.7 && bv >= 2.7) score -= 12
  if (difference <= 1.15) score += 5
  if ((a.fit === 'relaxed' && ['straight', 'regular'].includes(b.fit)) || (b.fit === 'relaxed' && ['straight', 'regular'].includes(a.fit))) score += 5
  if ((a.slot === 'bottom' || b.slot === 'bottom') && (a.fit === 'straight' || b.fit === 'straight')) score += 3
  if (structureValue(a) + structureValue(b) >= 2) score += 2

  return clamp(score, 48, 98)
}

function scoreLayering(items: WardrobeItem[]) {
  const base = items.find((item) => item.slot === 'base')
  const mid = items.find((item) => item.slot === 'mid')
  const outer = items.find((item) => item.slot === 'outer')
  const layers = [base, mid, outer].filter(Boolean) as WardrobeItem[]
  if (layers.length < 2) return 90

  let score = 92
  for (let index = 0; index < layers.length - 1; index += 1) {
    const inner = layers[index]
    const outerLayer = layers[index + 1]
    if (fitVolume(outerLayer) + 0.2 < fitVolume(inner)) score -= 17
    if (weightValue(outerLayer) < weightValue(inner)) score -= 10
    if (lengthValue(outerLayer) === 0 && lengthValue(inner) === 2) score -= 9
    if (structureValue(outerLayer) >= structureValue(inner)) score += 2
  }
  return clamp(score, 45, 99)
}

function scoreBalance(items: WardrobeItem[]) {
  const bottom = items.find((item) => item.slot === 'bottom')
  const top = items.find((item) => ['base', 'mid', 'outer'].includes(item.slot) && item.slot !== 'base')
    ?? items.find((item) => item.slot === 'base')
  const shoes = items.find((item) => item.slot === 'shoes')
  if (!bottom || !top) return 86

  let score = 88
  const combinedVolume = fitVolume(bottom) + fitVolume(top)
  if (combinedVolume >= 5) score -= 13
  if (bottom.fit === 'straight' && ['regular', 'relaxed'].includes(top.fit)) score += 6
  if (bottom.fit === 'wide' && top.fit === 'oversized') score -= 8
  if (shoes && fitVolume(bottom) >= 2 && shoes.structure === 'structured') score += 4
  return clamp(score, 48, 99)
}

function scoreColor(items: WardrobeItem[]) {
  if (items.length < 2) return 85
  const pairs: { value: number; weight: number }[] = []
  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) {
      const weight = Math.sqrt(SLOT_VISUAL_WEIGHT[items[i].slot] * SLOT_VISUAL_WEIGHT[items[j].slot])
      pairs.push({ value: colorPairScore(items[i].hex, items[j].hex), weight })
    }
  }

  let score = weightedAverage(pairs)
  const families = items.map((item) => ({ item, family: nearestStyleColor(item.hex) }))
  const accentWeight = families
    .filter(({ family }) => family.role === 'accent')
    .reduce((sum, { item }) => sum + SLOT_VISUAL_WEIGHT[item.slot], 0)
  const highImpactAccents = families.filter(({ item, family }) => family.role === 'accent' && SLOT_VISUAL_WEIGHT[item.slot] >= 0.55).length
  const uniqueHighImpact = new Set(families.filter(({ item }) => SLOT_VISUAL_WEIGHT[item.slot] >= 0.55).map(({ family }) => family.name)).size

  if (accentWeight > 0.9) score -= (accentWeight - 0.9) * 13
  if (highImpactAccents > 1) score -= (highImpactAccents - 1) * 9
  if (uniqueHighImpact > 4) score -= (uniqueHighImpact - 4) * 4

  const neutralSupport = families.filter(({ family }) => ['neutral', 'denim'].includes(family.role)).length
  if (neutralSupport >= 2) score += 3

  return clamp(score, 35, 100)
}

function scoreSilhouette(items: WardrobeItem[]) {
  const ordered = [...items].sort((a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot))
  const pairEntries: { value: number; weight: number }[] = []
  for (let i = 0; i < ordered.length - 1; i += 1) {
    pairEntries.push({ value: silhouettePairScore(ordered[i], ordered[i + 1]), weight: 1 })
  }
  const base = weightedAverage(pairEntries) || 86
  return clamp(base * 0.45 + scoreLayering(items) * 0.32 + scoreBalance(items) * 0.23, 35, 100)
}

function scoreContext(items: WardrobeItem[], context: OutfitContext) {
  if (!items.length) return 80
  let score = 96
  const acceptedSeasons = seasonForContext(context)

  for (const item of items) {
    if (item.seasons.length && !item.seasons.some((season) => acceptedSeasons.has(season))) score -= 13
    if (context.climate === 'hot' && weightValue(item) === 2 && ['mid', 'outer', 'headwear'].includes(item.slot)) score -= 10
    if (context.climate === 'cold' && item.slot === 'base' && weightValue(item) === 0 && !items.some((x) => x.slot === 'mid')) score -= 6
    if (context.formality === 'smart-casual' && item.formality === 'casual') score -= 3
    if (context.formality === 'casual' && item.formality === 'smart-casual') score -= 1
  }

  if (context.climate === 'cold' && !items.some((item) => item.slot === 'outer')) score -= 10
  if (context.climate === 'hot' && items.some((item) => item.slot === 'outer')) score -= 8
  if (context.weather === 'rain') {
    const shoes = items.find((item) => item.slot === 'shoes')
    if (shoes && /canvas|suede/.test(`${shoes.material} ${shoes.subtype}`.toLowerCase())) score -= 5
  }

  return clamp(score, 35, 100)
}

function closestPalette(items: WardrobeItem[]) {
  if (!items.length) return CURATED_PALETTES[0]
  const itemColors = items.map((x) => x.hex)
  return [...CURATED_PALETTES]
    .map((palette) => {
      const distance = itemColors.reduce((sum, hex) => {
        return sum + Math.min(...palette.colors.map((color) => perceptualDistance(hex, color.hex)))
      }, 0)
      return { palette, distance }
    })
    .sort((a, b) => a.distance - b.distance)[0].palette
}

function dominantColorSummary(items: WardrobeItem[]) {
  const entries = items
    .map((item) => ({ family: nearestStyleColor(item.hex), weight: SLOT_VISUAL_WEIGHT[item.slot] }))
    .sort((a, b) => b.weight - a.weight)
  const protagonist = entries.find(({ family }) => family.role === 'earth' || family.role === 'accent' || family.role === 'denim') ?? entries[0]
  return protagonist?.family.name
}

export function scoreOutfit(items: WardrobeItem[], context: OutfitContext): OutfitResult {
  const uniqueItems = SLOT_ORDER
    .map((slot) => items.find((item) => item.slot === slot))
    .filter(Boolean) as WardrobeItem[]
  const color = Math.round(scoreColor(uniqueItems))
  const silhouette = Math.round(scoreSilhouette(uniqueItems))
  const contextScore = Math.round(scoreContext(uniqueItems, context))
  const score = Math.round(color * 0.55 + silhouette * 0.35 + contextScore * 0.10)
  const palette = closestPalette(uniqueItems)
  const notes: string[] = []

  const families = uniqueItems.map((item) => ({ item, family: nearestStyleColor(item.hex) }))
  const highImpactAccents = families.filter(({ item, family }) => family.role === 'accent' && SLOT_VISUAL_WEIGHT[item.slot] >= 0.55)
  const dominant = dominantColorSummary(uniqueItems)

  if (highImpactAccents.length > 1) notes.push('More than one high-impact accent is competing for attention. Keep one protagonist and calm the rest.')
  else if (dominant) notes.push(`${dominant} leads the outfit while the lower-impact pieces support it instead of competing with it.`)

  if (silhouette >= 90) notes.push('Layer volume, structure and proportions stay relaxed without losing shape.')
  else if (silhouette >= 80) notes.push('The silhouette is sound, although one layer could be cleaner or better balanced.')
  else notes.push('Silhouette is the weak point. Reduce volume in one major layer or give the outfit more structure.')

  if (contextScore < 82) notes.push(`The outfit is less convincing for a ${context.climate}, ${context.weather} ${context.formality === 'either' ? 'day' : context.formality + ' setting'}.`)
  else if (color >= 90) notes.push('The palette is muted, modular and strongly aligned with your capsule wardrobe.')
  else if (color < 80) notes.push('Color harmony is the weak point; navy, cream, stone or washed black would usually calm the combination.')

  return {
    items: uniqueItems,
    score,
    breakdown: { color, silhouette, context: contextScore },
    verdict: score >= 91 ? 'Excellent' : score >= 83 ? 'Solid outfit' : score >= 74 ? 'Good with tension' : 'Needs editing',
    notes: notes.slice(0, 3),
    paletteName: palette.name
  }
}

function moodBonus(items: WardrobeItem[], mood: GenerationMood) {
  let bonus = 0
  for (const item of items) {
    const family = nearestStyleColor(item.hex)
    const haystack = `${item.name} ${item.subtype} ${item.material}`.toLowerCase()
    if (mood === 'rugged') {
      if (family.role === 'earth' || /canvas|denim|leather|work|chore|fatigue|boot/.test(haystack)) bonus += 1.7
    }
    if (mood === 'clean') {
      if (family.role === 'neutral' || item.formality === 'smart-casual' || item.structure === 'structured') bonus += 1.3
    }
    if (mood === 'interesting') {
      if (family.role === 'accent' || family.role === 'denim') bonus += 1.1
    }
  }
  if (mood === 'safe') bonus += scoreColor(items) >= 88 ? 3 : 0
  return bonus
}

function paletteBonus(items: WardrobeItem[], palette?: Palette) {
  if (!palette) return 0
  return items.reduce((sum, item) => {
    const distance = Math.min(...palette.colors.map((color) => perceptualDistance(item.hex, color.hex)))
    return sum + Math.max(0, 2.8 - distance * 15)
  }, 0)
}

export function outfitSignature(items: WardrobeItem[]) {
  return SLOT_ORDER
    .map((slot) => items.find((item) => item.slot === slot))
    .map((item) => item ? `${item.id ?? item.name}:${item.hex}` : '-')
    .join('|')
}

interface GenerateOptions {
  context: OutfitContext
  lockedItems?: WardrobeItem[]
  mood?: GenerationMood
  excludeSignatures?: Set<string>
  palette?: Palette
}

function shouldOfferEmpty(slot: Slot, context: OutfitContext) {
  if (!OPTIONAL_SLOTS.has(slot)) return false
  if (slot === 'mid' || slot === 'outer') return context.climate !== 'cold'
  return true
}

function poolForSlot(slot: Slot, wardrobe: WardrobeItem[], context: OutfitContext) {
  return wardrobe
    .filter((item) => item.slot === slot && isStyleCompatible(item) && isContextCompatible(item, context))
    .slice(0, 12)
}

export function generateOutfit(anchor: WardrobeItem, wardrobe: WardrobeItem[], options: GenerateOptions) {
  const { context, mood = 'safe', palette, excludeSignatures = new Set() } = options
  const lockedBySlot = new Map<Slot, WardrobeItem>()
  for (const item of options.lockedItems ?? []) lockedBySlot.set(item.slot, item)
  lockedBySlot.set(anchor.slot, anchor)

  type Beam = { items: WardrobeItem[]; value: number }
  let beams: Beam[] = [{ items: Array.from(lockedBySlot.values()), value: 0 }]

  for (const slot of SLOT_ORDER) {
    if (lockedBySlot.has(slot)) continue
    const candidates = poolForSlot(slot, wardrobe, context)
    const choices: (WardrobeItem | null)[] = candidates.slice(0, 7)
    if (shouldOfferEmpty(slot, context)) choices.push(null)
    if (!choices.length && REQUIRED_SLOTS.has(slot)) continue

    const next: Beam[] = []
    for (const beam of beams) {
      for (const choice of choices) {
        const items = choice ? [...beam.items.filter((item) => item.slot !== slot), choice] : beam.items.filter((item) => item.slot !== slot)
        const requiredPresent = !REQUIRED_SLOTS.has(slot) || !!choice
        if (!requiredPresent) continue
        const scored = scoreOutfit(items, context)
        const value = scored.score + moodBonus(items, mood) + paletteBonus(items, palette)
        next.push({ items, value })
      }
    }
    beams = next.sort((a, b) => b.value - a.value).slice(0, 30)
  }

  const ranked = beams
    .map((beam) => ({ result: scoreOutfit(beam.items, context), signature: outfitSignature(beam.items), value: beam.value }))
    .filter((entry) => !excludeSignatures.has(entry.signature))
    .sort((a, b) => b.value - a.value)

  return ranked[0]?.result ?? scoreOutfit(Array.from(lockedBySlot.values()), context)
}

export function generateAlternatives(anchor: WardrobeItem, wardrobe: WardrobeItem[], context: OutfitContext, count = 4) {
  const moods: GenerationMood[] = ['safe', 'rugged', 'clean', 'interesting']
  const excluded = new Set<string>()
  const results: OutfitResult[] = []

  for (const mood of moods) {
    if (results.length >= count) break
    const result = generateOutfit(anchor, wardrobe, { context, mood, excludeSignatures: excluded })
    const signature = outfitSignature(result.items)
    if (!excluded.has(signature)) {
      excluded.add(signature)
      results.push(result)
    }
  }

  return results
}

export function rebuildOutfit(current: OutfitResult, anchor: WardrobeItem, wardrobe: WardrobeItem[], context: OutfitContext, lockedSlots: Set<Slot>, mood: GenerationMood = 'safe') {
  const lockedItems = current.items.filter((item) => lockedSlots.has(item.slot))
  const exclude = new Set([outfitSignature(current.items)])
  return generateOutfit(anchor, wardrobe, { context, lockedItems, mood, excludeSignatures: exclude })
}

export function swapOutfitSlot(current: OutfitResult, slot: Slot, wardrobe: WardrobeItem[], context: OutfitContext) {
  const currentItem = current.items.find((item) => item.slot === slot)
  const candidates = poolForSlot(slot, wardrobe, context).filter((item) => item.id !== currentItem?.id)
  const variants: OutfitResult[] = candidates.map((candidate) => {
    const items = [...current.items.filter((item) => item.slot !== slot), candidate]
    return scoreOutfit(items, context)
  })

  if (OPTIONAL_SLOTS.has(slot) && currentItem) {
    variants.push(scoreOutfit(current.items.filter((item) => item.slot !== slot), context))
  }

  return variants.sort((a, b) => b.score - a.score)[0] ?? current
}

export function replaceOutfitSlot(current: OutfitResult | null, item: WardrobeItem, context: OutfitContext) {
  const items = current ? [...current.items.filter((existing) => existing.slot !== item.slot), item] : [item]
  return scoreOutfit(items, context)
}

export function generateFromPalette(palette: Palette, wardrobe: WardrobeItem[], context: OutfitContext) {
  const eligible = wardrobe.filter((item) => isStyleCompatible(item) && isContextCompatible(item, context))
  const anchorCandidates = eligible.filter((item) => item.slot === 'bottom')
  const fallback = eligible.filter((item) => item.slot === 'base')
  const anchors = anchorCandidates.length ? anchorCandidates : fallback

  const results = anchors.map((anchor) => generateOutfit(anchor, eligible, { context, mood: 'safe', palette }))
  return results.sort((a, b) => {
    const aBonus = paletteBonus(a.items, palette)
    const bBonus = paletteBonus(b.items, palette)
    return (b.score + bBonus) - (a.score + aBonus)
  })[0] ?? null
}
