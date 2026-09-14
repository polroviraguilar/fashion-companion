import type { ColorProfile, Palette, Slot, WardrobeItem } from '../types'

export const SLOT_LABELS: Record<Slot, string> = {
  shoes: 'Shoes',
  socks: 'Socks',
  bottom: 'Pants',
  base: 'Base top',
  mid: 'Mid layer',
  outer: 'Outer layer',
  headwear: 'Headwear'
}

export const SLOT_ORDER: Slot[] = ['shoes', 'socks', 'bottom', 'base', 'mid', 'outer', 'headwear']

export const STYLE_COLORS: ColorProfile[] = [
  { name: 'Navy', hex: '#27364A', role: 'neutral', preferred: true },
  { name: 'Olive', hex: '#66705A', role: 'earth', preferred: true },
  { name: 'Dark Khaki', hex: '#81755F', role: 'earth', preferred: true },
  { name: 'Beige', hex: '#C8B99D', role: 'neutral', preferred: true },
  { name: 'Stone', hex: '#AAA18E', role: 'neutral', preferred: true },
  { name: 'Charcoal', hex: '#464744', role: 'neutral', preferred: true },
  { name: 'Washed Black', hex: '#2E302E', role: 'neutral', preferred: true },
  { name: 'Off White', hex: '#E8E1D2', role: 'neutral', preferred: true },
  { name: 'Cream', hex: '#DCCFB4', role: 'neutral', preferred: true },
  { name: 'Tobacco', hex: '#8A5D3B', role: 'earth', preferred: true },
  { name: 'Camel', hex: '#B88D5F', role: 'earth', preferred: true },
  { name: 'Light Denim', hex: '#8EA9BE', role: 'denim', preferred: true },
  { name: 'Burgundy', hex: '#6D3C45', role: 'accent', preferred: true },
  { name: 'Muted Mustard', hex: '#A58A4C', role: 'accent', preferred: true },
  { name: 'Rust', hex: '#9A5D43', role: 'accent', preferred: true }
]

export const CURATED_PALETTES: Palette[] = [
  {
    id: 'quiet-utility',
    name: 'Quiet Utility',
    mood: 'calm / rugged / clean',
    colors: [
      { name: 'Navy', hex: '#27364A' },
      { name: 'Off White', hex: '#E8E1D2' },
      { name: 'Olive', hex: '#66705A' },
      { name: 'Tobacco', hex: '#8A5D3B' }
    ]
  },
  {
    id: 'field-study',
    name: 'Field Study',
    mood: 'natural / soft / functional',
    colors: [
      { name: 'Cream', hex: '#DCCFB4' },
      { name: 'Olive', hex: '#66705A' },
      { name: 'Stone', hex: '#AAA18E' },
      { name: 'Washed Black', hex: '#2E302E' }
    ]
  },
  {
    id: 'blue-hour',
    name: 'Blue Hour',
    mood: 'urban / relaxed / timeless',
    colors: [
      { name: 'Light Denim', hex: '#8EA9BE' },
      { name: 'Navy', hex: '#27364A' },
      { name: 'Off White', hex: '#E8E1D2' },
      { name: 'Charcoal', hex: '#464744' }
    ]
  },
  {
    id: 'tobacco-paper',
    name: 'Tobacco Paper',
    mood: 'warm / vintage / understated',
    colors: [
      { name: 'Tobacco', hex: '#8A5D3B' },
      { name: 'Beige', hex: '#C8B99D' },
      { name: 'Cream', hex: '#DCCFB4' },
      { name: 'Navy', hex: '#27364A' }
    ]
  },
  {
    id: 'late-autumn',
    name: 'Late Autumn',
    mood: 'muted / earthy / confident',
    colors: [
      { name: 'Rust', hex: '#9A5D43' },
      { name: 'Dark Khaki', hex: '#81755F' },
      { name: 'Washed Black', hex: '#2E302E' },
      { name: 'Off White', hex: '#E8E1D2' }
    ]
  }
]

const createdAt = new Date().toISOString()

export const DEMO_WARDROBE: WardrobeItem[] = [
  { name: 'Heavyweight tee', slot: 'base', subtype: 'T-shirt', colorName: 'Off White', hex: '#E8E1D2', fit: 'relaxed', structure: 'medium', material: 'Heavy cotton', formality: 'casual', seasons: ['spring','summer','autumn'], length: 'regular', visualWeight: 'medium', active: true, createdAt },
  { name: 'Washed tee', slot: 'base', subtype: 'T-shirt', colorName: 'Washed Black', hex: '#2E302E', fit: 'relaxed', structure: 'soft', material: 'Washed cotton', formality: 'casual', seasons: ['spring','summer','autumn'], length: 'regular', visualWeight: 'light', active: true, createdAt },
  { name: 'Oxford shirt', slot: 'mid', subtype: 'Shirt', colorName: 'Cream', hex: '#DCCFB4', fit: 'regular', structure: 'medium', material: 'Cotton', formality: 'smart-casual', seasons: ['spring','autumn','winter'], length: 'regular', visualWeight: 'light', active: true, createdAt },
  { name: 'Denim overshirt', slot: 'mid', subtype: 'Overshirt', colorName: 'Light Denim', hex: '#8EA9BE', fit: 'relaxed', structure: 'medium', material: 'Denim', formality: 'casual', seasons: ['spring','autumn'], length: 'regular', visualWeight: 'medium', active: true, createdAt },
  { name: 'Navy chore coat', slot: 'outer', subtype: 'Chore coat', colorName: 'Navy', hex: '#27364A', fit: 'relaxed', structure: 'structured', material: 'Canvas', formality: 'smart-casual', seasons: ['spring','autumn','winter'], length: 'regular', visualWeight: 'heavy', active: true, createdAt },
  { name: 'Olive work jacket', slot: 'outer', subtype: 'Work jacket', colorName: 'Olive', hex: '#66705A', fit: 'regular', structure: 'structured', material: 'Canvas', formality: 'casual', seasons: ['spring','autumn'], length: 'short', visualWeight: 'heavy', active: true, createdAt },
  { name: 'Fatigue pants', slot: 'bottom', subtype: 'Fatigue pants', colorName: 'Olive', hex: '#66705A', fit: 'straight', structure: 'medium', material: 'Cotton twill', formality: 'casual', seasons: ['spring','summer','autumn','winter'], visualWeight: 'medium', rise: 'mid', legShape: 'straight', active: true, createdAt },
  { name: 'Stone chinos', slot: 'bottom', subtype: 'Chino', colorName: 'Stone', hex: '#AAA18E', fit: 'straight', structure: 'medium', material: 'Cotton twill', formality: 'smart-casual', seasons: ['spring','summer','autumn'], visualWeight: 'medium', rise: 'mid', legShape: 'straight', active: true, createdAt },
  { name: 'Straight denim', slot: 'bottom', subtype: 'Jeans', colorName: 'Light Denim', hex: '#8EA9BE', fit: 'straight', structure: 'medium', material: 'Denim', formality: 'casual', seasons: ['spring','summer','autumn','winter'], visualWeight: 'medium', rise: 'mid', legShape: 'straight', active: true, createdAt },
  { name: 'Leather Chelsea boots', slot: 'shoes', subtype: 'Chelsea boots', colorName: 'Tobacco', hex: '#8A5D3B', fit: 'regular', structure: 'structured', material: 'Leather', formality: 'smart-casual', seasons: ['spring','autumn','winter'], visualWeight: 'heavy', active: true, createdAt },
  { name: 'Black canvas sneakers', slot: 'shoes', subtype: 'Sneakers', colorName: 'Washed Black', hex: '#2E302E', fit: 'regular', structure: 'medium', material: 'Canvas', formality: 'casual', seasons: ['spring','summer','autumn'], visualWeight: 'medium', active: true, createdAt },
  { name: 'Cream socks', slot: 'socks', subtype: 'Crew socks', colorName: 'Cream', hex: '#DCCFB4', fit: 'regular', structure: 'soft', material: 'Cotton', formality: 'casual', seasons: ['spring','autumn','winter'], visualWeight: 'light', active: true, createdAt },
  { name: 'Navy washed cap', slot: 'headwear', subtype: '6-panel cap', colorName: 'Navy', hex: '#27364A', fit: 'regular', structure: 'soft', material: 'Washed cotton', formality: 'casual', seasons: ['spring','summer','autumn'], visualWeight: 'light', active: true, createdAt },
  { name: 'Grey wool beanie', slot: 'headwear', subtype: 'Beanie', colorName: 'Charcoal', hex: '#464744', fit: 'regular', structure: 'soft', material: 'Wool', formality: 'casual', seasons: ['autumn','winter'], visualWeight: 'heavy', active: true, createdAt }
]
