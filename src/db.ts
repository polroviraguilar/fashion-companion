import Dexie, { type Table } from 'dexie'
import type { SavedOutfit, WardrobeItem } from './types'
import { DEMO_WARDROBE } from './data/styleProfile'

class FashionDB extends Dexie {
  wardrobe!: Table<WardrobeItem, number>
  outfits!: Table<SavedOutfit, number>

  constructor() {
    super('field-notes-fashion-db')
    this.version(1).stores({
      wardrobe: '++id, slot, colorName, active, createdAt',
      outfits: '++id, createdAt, score'
    })
  }
}

export const db = new FashionDB()

let seedPromise: Promise<void> | null = null

export function seedDatabase() {
  if (seedPromise) return seedPromise
  seedPromise = (async () => {
    if (localStorage.getItem('field-notes-seeded') === '1') return
    if ((await db.wardrobe.count()) === 0) await db.wardrobe.bulkAdd(DEMO_WARDROBE)
    localStorage.setItem('field-notes-seeded', '1')
  })()
  return seedPromise
}

export async function exportBackup() {
  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    wardrobe: await db.wardrobe.toArray(),
    outfits: await db.outfits.toArray()
  }
}

export async function importBackup(data: unknown) {
  const backup = data as { wardrobe?: WardrobeItem[]; outfits?: SavedOutfit[] }
  const wardrobe = backup.wardrobe
  const outfits = backup.outfits
  if (!Array.isArray(wardrobe) || !Array.isArray(outfits)) throw new Error('Invalid backup format')

  await db.transaction('rw', db.wardrobe, db.outfits, async () => {
    await db.wardrobe.clear()
    await db.outfits.clear()
    await db.wardrobe.bulkAdd(wardrobe.map(({ id: _id, ...item }) => item))
    await db.outfits.bulkAdd(outfits.map(({ id: _id, ...item }) => item))
  })
}
