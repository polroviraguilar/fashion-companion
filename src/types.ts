export type Slot = 'shoes' | 'socks' | 'bottom' | 'base' | 'mid' | 'outer' | 'headwear'
export type Fit = 'slim' | 'regular' | 'relaxed' | 'oversized' | 'straight' | 'wide'
export type Structure = 'soft' | 'medium' | 'structured'
export type Formality = 'casual' | 'smart-casual'
export type Season = 'spring' | 'summer' | 'autumn' | 'winter'
export type GarmentLength = 'short' | 'regular' | 'long'
export type VisualWeight = 'light' | 'medium' | 'heavy'
export type Rise = 'low' | 'mid' | 'high'
export type LegShape = 'tapered' | 'straight' | 'relaxed' | 'wide'
export type Climate = 'hot' | 'mild' | 'cold'
export type Weather = 'dry' | 'rain'
export type ContextFormality = Formality | 'either'
export type GenerationMood = 'safe' | 'rugged' | 'clean' | 'interesting'

export interface OutfitContext {
  climate: Climate
  weather: Weather
  formality: ContextFormality
}

export interface WardrobeItem {
  id?: number
  name: string
  slot: Slot
  subtype: string
  colorName: string
  hex: string
  fit: Fit
  structure: Structure
  material: string
  formality: Formality
  seasons: Season[]
  length?: GarmentLength
  visualWeight?: VisualWeight
  rise?: Rise
  legShape?: LegShape
  image?: string
  notes?: string
  active: boolean
  createdAt: string
}

export interface OutfitBreakdown {
  color: number
  silhouette: number
  context: number
}

export interface OutfitResult {
  items: WardrobeItem[]
  score: number
  breakdown: OutfitBreakdown
  verdict: string
  notes: string[]
  paletteName: string
}

export interface SavedOutfit {
  id?: number
  name: string
  createdAt: string
  score: number
  paletteName: string
  items: WardrobeItem[]
}

export interface Palette {
  id: string
  name: string
  mood: string
  colors: { name: string; hex: string }[]
}

export interface ColorProfile {
  name: string
  hex: string
  role: 'neutral' | 'earth' | 'accent' | 'denim'
  preferred: boolean
}
