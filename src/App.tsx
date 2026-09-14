import { useEffect, useMemo, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { CURATED_PALETTES, SLOT_LABELS, SLOT_ORDER, STYLE_COLORS } from './data/styleProfile'
import { db, exportBackup, importBackup, seedDatabase } from './db'
import { nearestStyleColor, normalizeHex, readableTextColor } from './lib/color'
import {
  generateFromPalette,
  generateOutfit,
  rebuildOutfit,
  replaceOutfitSlot,
  scoreOutfit,
  swapOutfitSlot
} from './lib/scoring'
import type {
  ContextFormality,
  Fit,
  GarmentLength,
  GenerationMood,
  LegShape,
  OutfitContext,
  OutfitResult,
  Rise,
  SavedOutfit,
  Season,
  Slot,
  Structure,
  VisualWeight,
  WardrobeItem
} from './types'

type Screen = 'today' | 'wardrobe' | 'palettes' | 'saved'
type IconName = 'home' | 'wardrobe' | 'palette' | 'saved' | 'camera' | 'plus' | 'close' | 'trash' | 'download' | 'upload' | 'shuffle' | 'edit' | 'lock' | 'unlock' | 'swap' | 'check'

const DEFAULT_CONTEXT: OutfitContext = { climate: 'mild', weather: 'dry', formality: 'either' }
const OPTIONAL_SLOTS = new Set<Slot>(['socks', 'mid', 'outer', 'headwear'])

const Icon = ({ name, size = 22 }: { name: IconName; size?: number }) => {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true }
  if (name === 'home') return <svg {...common}><path d="M4 10.5 12 4l8 6.5"/><path d="M6.5 9.5V20h11V9.5"/></svg>
  if (name === 'wardrobe') return <svg {...common}><rect x="4" y="3.5" width="16" height="17" rx="1.5"/><path d="M12 3.5v17M8.5 10h.01M15.5 10h.01"/></svg>
  if (name === 'palette') return <svg {...common}><path d="M12 3a9 9 0 1 0 0 18h1.5a2 2 0 0 0 0-4H12a2 2 0 0 1 0-4h3a6 6 0 0 0 0-12Z"/><circle cx="7.5" cy="9" r=".8"/><circle cx="10" cy="6.5" r=".8"/><circle cx="14" cy="6" r=".8"/></svg>
  if (name === 'saved') return <svg {...common}><path d="M6 4h12v16l-6-4-6 4Z"/></svg>
  if (name === 'camera') return <svg {...common}><path d="M4 8h3l1.5-2h7L17 8h3v11H4Z"/><circle cx="12" cy="13.5" r="3.2"/></svg>
  if (name === 'plus') return <svg {...common}><path d="M12 5v14M5 12h14"/></svg>
  if (name === 'close') return <svg {...common}><path d="m6 6 12 12M18 6 6 18"/></svg>
  if (name === 'trash') return <svg {...common}><path d="M5 7h14M9 7V4h6v3M8 10v7M12 10v7M16 10v7M7 7l1 13h8l1-13"/></svg>
  if (name === 'download') return <svg {...common}><path d="M12 3v12M7.5 10.5 12 15l4.5-4.5M5 20h14"/></svg>
  if (name === 'upload') return <svg {...common}><path d="M12 15V3M7.5 7.5 12 3l4.5 4.5M5 20h14"/></svg>
  if (name === 'edit') return <svg {...common}><path d="m4 20 4.5-1 9.7-9.7-3.5-3.5L5 15.5 4 20Z"/><path d="m13.8 6.7 2.9-2.9 3.5 3.5-2.9 2.9"/></svg>
  if (name === 'lock') return <svg {...common}><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>
  if (name === 'unlock') return <svg {...common}><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 7-2.6"/></svg>
  if (name === 'swap') return <svg {...common}><path d="M7 7h12l-3-3M17 17H5l3 3M19 7l-3 3M5 17l3-3"/></svg>
  if (name === 'check') return <svg {...common}><path d="m5 12 4 4L19 6"/></svg>
  return <svg {...common}><path d="M4 7h11l-2.5-2.5M20 17H9l2.5 2.5M15 4.5 18 7l-3 2.5M9 14.5 6 17l3 2.5"/></svg>
}

function App() {
  const [screen, setScreen] = useState<Screen>('today')
  const [showPieceForm, setShowPieceForm] = useState(false)
  const [editingItem, setEditingItem] = useState<WardrobeItem | null>(null)
  const [showCamera, setShowCamera] = useState(false)
  const [showWardrobePicker, setShowWardrobePicker] = useState(false)
  const [showManualBuilder, setShowManualBuilder] = useState(false)
  const [slotPicker, setSlotPicker] = useState<Slot | null>(null)
  const [result, setResult] = useState<OutfitResult | null>(null)
  const [anchor, setAnchor] = useState<WardrobeItem | null>(null)
  const [lockedSlots, setLockedSlots] = useState<Set<Slot>>(new Set())
  const [mood, setMood] = useState<GenerationMood>('safe')
  const [context, setContext] = useState<OutfitContext>(DEFAULT_CONTEXT)
  const [manualHex, setManualHex] = useState('#66705A')
  const [manualSlot, setManualSlot] = useState<Slot>('bottom')
  const [toast, setToast] = useState<string | null>(null)

  const wardrobe = useLiveQuery<WardrobeItem[]>(() => db.wardrobe.orderBy('createdAt').reverse().toArray(), []) ?? []
  const savedOutfits = useLiveQuery<SavedOutfit[]>(() => db.outfits.orderBy('createdAt').reverse().toArray(), []) ?? []

  useEffect(() => { seedDatabase() }, [])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 2600)
    return () => window.clearTimeout(timer)
  }, [toast])

  const todayPalette = CURATED_PALETTES[new Date().getDate() % CURATED_PALETTES.length]

  function scrollToResult() {
    window.setTimeout(() => document.getElementById('outfit-result')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
  }

  function buildFromItem(item: WardrobeItem) {
    setAnchor(item)
    setLockedSlots(new Set([item.slot]))
    setMood('safe')
    setResult(generateOutfit(item, wardrobe, { context, mood: 'safe' }))
    setShowWardrobePicker(false)
    setScreen('today')
    scrollToResult()
  }

  function buildManualColor() {
    const hex = normalizeHex(manualHex)
    if (!hex) {
      setToast('Enter a valid HEX color.')
      return
    }
    const family = nearestStyleColor(hex)
    const virtual: WardrobeItem = {
      name: `${family.name} anchor`, slot: manualSlot, subtype: SLOT_LABELS[manualSlot], colorName: family.name, hex,
      fit: manualSlot === 'bottom' ? 'straight' : 'regular', structure: 'medium', material: 'Unknown',
      formality: 'casual', seasons: ['spring', 'summer', 'autumn', 'winter'], visualWeight: 'medium', active: true,
      createdAt: new Date().toISOString()
    }
    buildFromItem(virtual)
  }

  function buildManualOutfit(items: WardrobeItem[]) {
    if (items.length < 3) {
      setToast('Choose at least three pieces to evaluate an outfit.')
      return
    }
    setAnchor(null)
    setLockedSlots(new Set())
    setResult(scoreOutfit(items, context))
    setShowManualBuilder(false)
    setScreen('today')
    scrollToResult()
  }

  function surpriseMe() {
    const anchors = wardrobe.filter((item) => item.active && ['bottom', 'base'].includes(item.slot))
    if (!anchors.length) {
      setToast('Add at least one pair of pants or base top first.')
      return
    }
    const candidates = anchors.map((item) => ({ anchor: item, result: generateOutfit(item, wardrobe, { context, mood: 'interesting' }) }))
      .sort((a, b) => b.result.score - a.result.score)
    const chosen = candidates[0]
    setAnchor(chosen.anchor)
    setLockedSlots(new Set([chosen.anchor.slot]))
    setMood('interesting')
    setResult(chosen.result)
    scrollToResult()
  }

  function changeContext(patch: Partial<OutfitContext>) {
    const next = { ...context, ...patch }
    setContext(next)
    if (result) setResult(scoreOutfit(result.items, next))
  }

  function rebuildCurrent(nextMood = mood) {
    if (!result || !anchor) return
    setMood(nextMood)
    setResult(rebuildOutfit(result, anchor, wardrobe, context, lockedSlots, nextMood))
  }

  function toggleLock(slot: Slot) {
    if (anchor?.slot === slot) return
    setLockedSlots((current) => {
      const next = new Set(current)
      if (next.has(slot)) next.delete(slot)
      else next.add(slot)
      return next
    })
  }

  function swapSlot(slot: Slot) {
    if (!result || lockedSlots.has(slot) || anchor?.slot === slot) return
    const next = swapOutfitSlot(result, slot, wardrobe, context)
    if (next.items.map((x) => x.id).join('|') === result.items.map((x) => x.id).join('|')) setToast(`No better alternative found for ${SLOT_LABELS[slot].toLowerCase()}.`)
    setResult(next)
  }

  function replaceSlot(item: WardrobeItem) {
    setResult((current) => replaceOutfitSlot(current, item, context))
    setSlotPicker(null)
  }

  function clearSlot(slot: Slot) {
    if (!result || !OPTIONAL_SLOTS.has(slot)) return
    setResult(scoreOutfit(result.items.filter((item) => item.slot !== slot), context))
    setLockedSlots((current) => {
      const next = new Set(current)
      next.delete(slot)
      return next
    })
    setSlotPicker(null)
  }

  function buildPalette(palette: (typeof CURATED_PALETTES)[number]) {
    const generated = generateFromPalette(palette, wardrobe, context)
    if (!generated) {
      setToast('Your wardrobe does not have enough compatible pieces for this palette yet.')
      return
    }
    setResult(generated)
    setAnchor(null)
    setLockedSlots(new Set())
    setScreen('today')
    scrollToResult()
  }

  function wearSaved(outfit: SavedOutfit) {
    setResult(scoreOutfit(outfit.items, context))
    setAnchor(null)
    setLockedSlots(new Set())
    setScreen('today')
    scrollToResult()
  }

  async function saveCurrentOutfit() {
    if (!result) return
    const outfit: SavedOutfit = {
      name: `${result.paletteName} / ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}`,
      createdAt: new Date().toISOString(), score: result.score, paletteName: result.paletteName, items: result.items
    }
    await db.outfits.add(outfit)
    setToast('Outfit saved.')
  }

  async function handleExport() {
    const data = await exportBackup()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `field-notes-backup-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
    setToast('Backup exported.')
  }

  async function handleImport(file: File) {
    try {
      const text = await file.text()
      await importBackup(JSON.parse(text))
      setToast('Backup imported.')
    } catch {
      setToast('This backup could not be imported.')
    }
  }

  return (
    <div className="app-shell">
      <main className="app-main">
        {screen === 'today' && (
          <TodayScreen
            palette={todayPalette}
            wardrobe={wardrobe}
            anchor={anchor}
            result={result}
            context={context}
            mood={mood}
            lockedSlots={lockedSlots}
            manualHex={manualHex}
            manualSlot={manualSlot}
            onContext={changeContext}
            onMood={(value) => rebuildCurrent(value)}
            onManualHex={setManualHex}
            onManualSlot={setManualSlot}
            onBuildManualColor={buildManualColor}
            onOpenCamera={() => setShowCamera(true)}
            onOpenWardrobe={() => setShowWardrobePicker(true)}
            onOpenManualBuilder={() => setShowManualBuilder(true)}
            onSurprise={surpriseMe}
            onSave={saveCurrentOutfit}
            onRebuild={() => rebuildCurrent()}
            onToggleLock={toggleLock}
            onSwap={swapSlot}
            onPickSlot={setSlotPicker}
          />
        )}
        {screen === 'wardrobe' && (
          <WardrobeScreen
            wardrobe={wardrobe}
            onAdd={() => { setEditingItem(null); setShowPieceForm(true) }}
            onEdit={(item) => { setEditingItem(item); setShowPieceForm(true) }}
            onUse={buildFromItem}
            onDelete={async (id) => {
              if (!id || !window.confirm('Remove this piece from your wardrobe?')) return
              await db.wardrobe.delete(id)
            }}
            onExport={handleExport}
            onImport={handleImport}
          />
        )}
        {screen === 'palettes' && <PaletteScreen wardrobe={wardrobe} onBuild={buildPalette} />}
        {screen === 'saved' && <SavedScreen outfits={savedOutfits} onWear={wearSaved} onDelete={async (id) => { if (id) await db.outfits.delete(id) }} />}
      </main>

      <nav className="bottom-nav" aria-label="Main navigation">
        <NavButton active={screen === 'today'} label="Today" icon="home" onClick={() => setScreen('today')} />
        <NavButton active={screen === 'wardrobe'} label="Wardrobe" icon="wardrobe" onClick={() => setScreen('wardrobe')} />
        <NavButton active={screen === 'palettes'} label="Palettes" icon="palette" onClick={() => setScreen('palettes')} />
        <NavButton active={screen === 'saved'} label="Saved" icon="saved" onClick={() => setScreen('saved')} />
      </nav>

      {showPieceForm && <PieceForm item={editingItem} onClose={() => setShowPieceForm(false)} onSaved={(edited) => { setShowPieceForm(false); setEditingItem(null); setToast(edited ? 'Piece updated.' : 'Piece added to wardrobe.') }} />}
      {showCamera && <CameraColorPicker onClose={() => setShowCamera(false)} onUse={(item) => { setShowCamera(false); buildFromItem(item) }} onSaved={() => setToast('Piece saved to wardrobe.')} />}
      {showWardrobePicker && <WardrobePicker wardrobe={wardrobe.filter((x) => x.active)} onClose={() => setShowWardrobePicker(false)} onPick={buildFromItem} />}
      {showManualBuilder && <ManualOutfitBuilder wardrobe={wardrobe.filter((x) => x.active)} onClose={() => setShowManualBuilder(false)} onBuild={buildManualOutfit} />}
      {slotPicker && <SlotPicker slot={slotPicker} wardrobe={wardrobe.filter((x) => x.active)} allowClear={OPTIONAL_SLOTS.has(slotPicker)} onClear={() => clearSlot(slotPicker)} onClose={() => setSlotPicker(null)} onPick={replaceSlot} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  )
}

function NavButton({ active, label, icon, onClick }: { active: boolean; label: string; icon: Extract<IconName, 'home' | 'wardrobe' | 'palette' | 'saved'>; onClick: () => void }) {
  return <button className={`nav-item ${active ? 'active' : ''}`} onClick={onClick}><Icon name={icon} /><span>{label}</span></button>
}

function Header({ eyebrow, title, action }: { eyebrow: string; title: string; action?: ReactNode }) {
  return <header className="page-header"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1></div>{action}</header>
}

function TodayScreen({ palette, wardrobe, anchor, result, context, mood, lockedSlots, manualHex, manualSlot, onContext, onMood, onManualHex, onManualSlot, onBuildManualColor, onOpenCamera, onOpenWardrobe, onOpenManualBuilder, onSurprise, onSave, onRebuild, onToggleLock, onSwap, onPickSlot }: {
  palette: (typeof CURATED_PALETTES)[number]
  wardrobe: WardrobeItem[]
  anchor: WardrobeItem | null
  result: OutfitResult | null
  context: OutfitContext
  mood: GenerationMood
  lockedSlots: Set<Slot>
  manualHex: string
  manualSlot: Slot
  onContext: (patch: Partial<OutfitContext>) => void
  onMood: (value: GenerationMood) => void
  onManualHex: (value: string) => void
  onManualSlot: (value: Slot) => void
  onBuildManualColor: () => void
  onOpenCamera: () => void
  onOpenWardrobe: () => void
  onOpenManualBuilder: () => void
  onSurprise: () => void
  onSave: () => void
  onRebuild: () => void
  onToggleLock: (slot: Slot) => void
  onSwap: (slot: Slot) => void
  onPickSlot: (slot: Slot) => void
}) {
  const date = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())
  return (
    <div className="screen today-screen">
      <header className="hero-header">
        <div className="eyebrow">FIELD NOTES / 02</div>
        <h1>Fashion<br />Companion</h1>
        <p>{date}</p>
      </header>

      <section className="daily-palette card-paper">
        <div className="section-index">TODAY'S PALETTE</div>
        <div className="palette-bars compact">{palette.colors.map((color) => <div key={color.name} style={{ background: color.hex }} title={color.name} />)}</div>
        <div className="palette-caption"><strong>{palette.name}</strong><span>{palette.mood}</span></div>
      </section>

      <ContextStrip context={context} onChange={onContext} />

      <section className="question-block">
        <div className="section-index">START HERE</div>
        <h2>What are you<br />wearing first?</h2>
        <p>Choose an anchor, build your own look, or let the companion search the wardrobe for you.</p>
        <div className="primary-actions">
          <button className="action-card dark" onClick={onOpenCamera}><Icon name="camera" size={25} /><span><small>FROM CAMERA</small>Capture a color</span></button>
          <button className="action-card light" onClick={onOpenWardrobe} disabled={!wardrobe.length}><Icon name="wardrobe" size={25} /><span><small>FROM WARDROBE</small>Choose a piece</span></button>
        </div>
        <div className="secondary-actions">
          <button onClick={onOpenManualBuilder} disabled={!wardrobe.length}>Build my own outfit <span>--&gt;</span></button>
          <button onClick={onSurprise} disabled={!wardrobe.length}>Surprise me <Icon name="shuffle" size={17} /></button>
        </div>
      </section>

      <section className="manual-anchor card-paper">
        <div className="section-index">OR START WITH A COLOR</div>
        <div className="manual-row">
          <label className="color-well" style={{ background: normalizeHex(manualHex) ?? '#66705A' }}><input type="color" value={normalizeHex(manualHex) ?? '#66705A'} onChange={(e) => onManualHex(e.target.value)} /></label>
          <div className="field-grow"><label>HEX</label><input className="text-input" value={manualHex} onChange={(e) => onManualHex(e.target.value)} spellCheck={false} /></div>
          <div className="field-grow"><label>PIECE</label><select className="select-input" value={manualSlot} onChange={(e) => onManualSlot(e.target.value as Slot)}>{SLOT_ORDER.map((slot) => <option value={slot} key={slot}>{SLOT_LABELS[slot]}</option>)}</select></div>
        </div>
        <button className="text-button" onClick={onBuildManualColor}>Build around this color <span>--&gt;</span></button>
      </section>

      {result && <OutfitResultCard result={result} anchor={anchor} mood={mood} lockedSlots={lockedSlots} onMood={onMood} onSave={onSave} onRebuild={onRebuild} onToggleLock={onToggleLock} onSwap={onSwap} onPickSlot={onPickSlot} />}
    </div>
  )
}

function ContextStrip({ context, onChange }: { context: OutfitContext; onChange: (patch: Partial<OutfitContext>) => void }) {
  return <section className="context-card">
    <div className="section-index">TODAY'S CONTEXT</div>
    <div className="context-groups">
      <Segment label="WEATHER" value={context.climate} options={[['hot','Hot'],['mild','Mild'],['cold','Cold']]} onChange={(value) => onChange({ climate: value as OutfitContext['climate'] })} />
      <Segment label="SKY" value={context.weather} options={[['dry','Dry'],['rain','Rain']]} onChange={(value) => onChange({ weather: value as OutfitContext['weather'] })} />
      <Segment label="MODE" value={context.formality} options={[['either','Any'],['casual','Casual'],['smart-casual','Smart']]} onChange={(value) => onChange({ formality: value as ContextFormality })} />
    </div>
  </section>
}

function Segment({ label, value, options, onChange }: { label: string; value: string; options: [string, string][]; onChange: (value: string) => void }) {
  return <div className="segment"><small>{label}</small><div>{options.map(([key, text]) => <button key={key} className={value === key ? 'selected' : ''} onClick={() => onChange(key)}>{text}</button>)}</div></div>
}

function OutfitResultCard({ result, anchor, mood, lockedSlots, onMood, onSave, onRebuild, onToggleLock, onSwap, onPickSlot }: {
  result: OutfitResult
  anchor: WardrobeItem | null
  mood: GenerationMood
  lockedSlots: Set<Slot>
  onMood: (value: GenerationMood) => void
  onSave: () => void
  onRebuild: () => void
  onToggleLock: (slot: Slot) => void
  onSwap: (slot: Slot) => void
  onPickSlot: (slot: Slot) => void
}) {
  return (
    <section className="outfit-result" id="outfit-result">
      <div className="outfit-heading">
        <div><div className="eyebrow">OUTFIT STUDY / LIVE BUILDER</div><h2>{result.verdict}</h2><p>{result.paletteName}</p></div>
        <div className="score-seal"><strong>{result.score}</strong><span>/100</span></div>
      </div>

      {anchor && <div className="mood-switch"><span>Variation</span>{(['safe','rugged','clean','interesting'] as GenerationMood[]).map((value) => <button key={value} className={mood === value ? 'selected' : ''} onClick={() => onMood(value)}>{value}</button>)}</div>}

      <div className="look-stack interactive">
        {SLOT_ORDER.map((slot) => {
          const item = result.items.find((x) => x.slot === slot)
          const isAnchor = !!item && (item === anchor || (!!anchor?.id && anchor.id === item.id))
          const isLocked = isAnchor || lockedSlots.has(slot)
          if (!item) {
            return <div className="look-row empty" key={slot}><div className="look-color empty-swatch">{SLOT_LABELS[slot].toUpperCase()}</div><div className="look-meta"><strong>No layer</strong><span>Optional / not selected</span></div><button className="row-action add" onClick={() => onPickSlot(slot)} aria-label={`Add ${SLOT_LABELS[slot]}`}><Icon name="plus" size={17}/></button></div>
          }
          return (
            <div className={`look-row ${isAnchor ? 'anchor' : ''} ${isLocked ? 'locked' : ''}`} key={`${slot}-${item.id ?? item.hex}`}>
              <div className="look-color" style={{ background: item.hex, color: readableTextColor(item.hex) }}>{isAnchor ? 'ANCHOR' : SLOT_LABELS[slot].toUpperCase()}</div>
              <button className="look-meta editable" onClick={() => onPickSlot(slot)}><strong>{item.name}</strong><span>{item.colorName} / {item.fit} / {item.material}</span></button>
              <div className="row-actions">
                {!isAnchor && <button onClick={() => onToggleLock(slot)} aria-label={isLocked ? 'Unlock layer' : 'Lock layer'}><Icon name={isLocked ? 'unlock' : 'lock'} size={16}/></button>}
                <button onClick={() => isLocked ? onPickSlot(slot) : onSwap(slot)} aria-label={isLocked ? 'Choose another piece' : 'Swap piece'}><Icon name="swap" size={16}/></button>
              </div>
            </div>
          )
        })}
      </div>

      <div className="builder-hint"><Icon name="lock" size={15}/><span>Lock layers you want to keep. Swap changes only one layer. The anchor is always fixed.</span></div>

      <div className="score-grid">
        <Metric label="Color" value={result.breakdown.color} />
        <Metric label="Silhouette" value={result.breakdown.silhouette} />
        <Metric label="Context" value={result.breakdown.context} />
      </div>

      <div className="analysis-notes">{result.notes.map((note, index) => <p key={`${note}-${index}`}><span>0{index + 1}</span>{note}</p>)}</div>

      <div className="result-actions">
        <button className="button-solid" onClick={onSave}><Icon name="saved" size={19} />Save outfit</button>
        {anchor ? <button className="button-ghost" onClick={onRebuild}><Icon name="shuffle" size={19} />New variation</button> : <button className="button-ghost" onClick={() => onPickSlot('bottom')}><Icon name="edit" size={18}/>Edit look</button>}
      </div>
    </section>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="metric"><div className="metric-top"><span>{label}</span><strong>{value}</strong></div><div className="metric-track"><i style={{ width: `${value}%` }} /></div></div>
}

function WardrobeScreen({ wardrobe, onAdd, onEdit, onUse, onDelete, onExport, onImport }: { wardrobe: WardrobeItem[]; onAdd: () => void; onEdit: (item: WardrobeItem) => void; onUse: (item: WardrobeItem) => void; onDelete: (id?: number) => void; onExport: () => void; onImport: (file: File) => void }) {
  const [filter, setFilter] = useState<Slot | 'all'>('all')
  const inputRef = useRef<HTMLInputElement>(null)
  const visible = filter === 'all' ? wardrobe : wardrobe.filter((x) => x.slot === filter)

  return (
    <div className="screen">
      <Header eyebrow="ARCHIVE / WARDROBE" title="My pieces" action={<button className="circle-button" onClick={onAdd}><Icon name="plus" /></button>} />
      <div className="filter-scroller">
        <button className={filter === 'all' ? 'selected' : ''} onClick={() => setFilter('all')}>All {wardrobe.length}</button>
        {SLOT_ORDER.map((slot) => <button key={slot} className={filter === slot ? 'selected' : ''} onClick={() => setFilter(slot)}>{SLOT_LABELS[slot]}</button>)}
      </div>

      <div className="wardrobe-list">
        {visible.map((item) => (
          <article className={`wardrobe-item ${item.active ? '' : 'inactive'}`} key={item.id}>
            <button className="item-main" onClick={() => onUse(item)}>
              {item.image ? <img className="wardrobe-thumb" src={item.image} alt="" /> : <span className="swatch-square" style={{ background: item.hex }} />}
              <span className="item-copy"><small>{SLOT_LABELS[item.slot]} / {item.subtype}{item.active ? '' : ' / archived'}</small><strong>{item.name}</strong><em>{item.colorName} - {item.fit} - {item.material}</em></span>
              <span className="arrow">--&gt;</span>
            </button>
            <div className="item-actions"><button aria-label={`Edit ${item.name}`} onClick={() => onEdit(item)}><Icon name="edit" size={17}/></button><button aria-label={`Delete ${item.name}`} onClick={() => onDelete(item.id)}><Icon name="trash" size={17}/></button></div>
          </article>
        ))}
      </div>

      <section className="data-tools card-paper">
        <div className="section-index">LOCAL DATA</div>
        <h3>Your wardrobe stays on this device.</h3>
        <p>Photos, garment data and saved outfits are stored locally in IndexedDB. Export a JSON backup before changing phones or clearing browser data.</p>
        <div className="tool-buttons"><button onClick={onExport}><Icon name="download" size={18} />Export JSON</button><button onClick={() => inputRef.current?.click()}><Icon name="upload" size={18} />Import JSON</button></div>
        <input ref={inputRef} className="visually-hidden" type="file" accept="application/json,.json" onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])} />
      </section>
    </div>
  )
}

function PaletteScreen({ wardrobe, onBuild }: { wardrobe: WardrobeItem[]; onBuild: (palette: (typeof CURATED_PALETTES)[number]) => void }) {
  return (
    <div className="screen">
      <Header eyebrow="COLOR ARCHIVE / SANZO STUDIES" title="Palettes" />
      <p className="intro-copy">These are no longer decorative references only. Open a combination and the companion will try to build it with pieces you actually own.</p>
      <div className="palette-library">
        {CURATED_PALETTES.map((palette, index) => (
          <article className="palette-card" key={palette.id}>
            <div className="palette-number">COMBINATION {String(index + 1).padStart(3, '0')}</div>
            <div className="palette-bars">{palette.colors.map((color) => <div key={color.name} style={{ background: color.hex, color: readableTextColor(color.hex) }}><span>{color.name}</span><small>{color.hex}</small></div>)}</div>
            <div className="palette-caption"><strong>{palette.name}</strong><span>{palette.mood}</span></div>
            <button className="palette-build" onClick={() => onBuild(palette)} disabled={!wardrobe.length}>Build from my wardrobe <span>--&gt;</span></button>
          </article>
        ))}
      </div>
      <section className="color-index"><div className="section-index">PERSONAL COLOR INDEX</div><div className="color-chips">{STYLE_COLORS.map((color) => <div key={color.name}><i style={{ background: color.hex }} /><span>{color.name}</span></div>)}</div></section>
    </div>
  )
}

function SavedScreen({ outfits, onWear, onDelete }: { outfits: SavedOutfit[]; onWear: (outfit: SavedOutfit) => void; onDelete: (id?: number) => void }) {
  return (
    <div className="screen">
      <Header eyebrow="ARCHIVE / OUTFITS" title="Saved studies" />
      {!outfits.length && <div className="empty-state"><span>NO. 000</span><h2>No saved outfits yet.</h2><p>Build a look from Today and save the combinations worth repeating.</p></div>}
      <div className="saved-list">
        {outfits.map((outfit) => (
          <article className="saved-card" key={outfit.id}>
            <div className="saved-top"><div><small>{new Date(outfit.createdAt).toLocaleDateString('en-GB')}</small><h3>{outfit.name}</h3><p>{outfit.paletteName}</p></div><div className="mini-score">{outfit.score}</div></div>
            <div className="saved-strips">{outfit.items.map((item, index) => <i key={`${item.hex}-${index}`} style={{ background: item.hex }} title={item.name} />)}</div>
            <div className="saved-pieces">{outfit.items.map((item) => <span key={`${item.slot}-${item.name}`}>{item.name}</span>)}</div>
            <div className="saved-actions"><button onClick={() => onWear(outfit)}><Icon name="check" size={17}/>Wear again</button><button onClick={() => onDelete(outfit.id)}><Icon name="trash" size={17}/>Remove</button></div>
          </article>
        ))}
      </div>
    </div>
  )
}

function Modal({ children, onClose, title }: { children: ReactNode; onClose: () => void; title: string }) {
  return <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}><div className="modal-sheet"><div className="modal-grab"/><div className="modal-head"><div><div className="eyebrow">FIELD NOTES</div><h2>{title}</h2></div><button className="circle-button small" onClick={onClose}><Icon name="close" size={20}/></button></div>{children}</div></div>
}

function WardrobePicker({ wardrobe, onClose, onPick }: { wardrobe: WardrobeItem[]; onClose: () => void; onPick: (item: WardrobeItem) => void }) {
  return <Modal onClose={onClose} title="Choose an anchor"><div className="picker-list">{wardrobe.map((item) => <PickerButton key={item.id} item={item} onClick={() => onPick(item)} />)}</div></Modal>
}

function SlotPicker({ slot, wardrobe, allowClear, onClear, onClose, onPick }: { slot: Slot; wardrobe: WardrobeItem[]; allowClear: boolean; onClear: () => void; onClose: () => void; onPick: (item: WardrobeItem) => void }) {
  const options = wardrobe.filter((item) => item.slot === slot)
  return <Modal onClose={onClose} title={`Choose ${SLOT_LABELS[slot].toLowerCase()}`}><div className="picker-list">{allowClear && <button className="clear-layer" onClick={onClear}><i className="empty-picker"/><span><small>{SLOT_LABELS[slot]}</small><strong>No layer</strong><em>Remove this optional layer</em></span><b>--&gt;</b></button>}{options.map((item) => <PickerButton key={item.id} item={item} onClick={() => onPick(item)} />)}</div></Modal>
}

function PickerButton({ item, onClick }: { item: WardrobeItem; onClick: () => void }) {
  return <button onClick={onClick}>{item.image ? <img className="picker-thumb" src={item.image} alt=""/> : <i style={{ background: item.hex }}/>}<span><small>{SLOT_LABELS[item.slot]}</small><strong>{item.name}</strong><em>{item.colorName} / {item.fit}</em></span><b>--&gt;</b></button>
}

function ManualOutfitBuilder({ wardrobe, onClose, onBuild }: { wardrobe: WardrobeItem[]; onClose: () => void; onBuild: (items: WardrobeItem[]) => void }) {
  const [selected, setSelected] = useState<Partial<Record<Slot, number>>>({})
  const items = SLOT_ORDER.map((slot) => wardrobe.find((item) => item.id === selected[slot])).filter(Boolean) as WardrobeItem[]

  return <Modal onClose={onClose} title="Build my outfit"><div className="manual-builder"><p>Choose what you are actually wearing. You can leave optional layers empty, then ask the companion to evaluate the complete look.</p>{SLOT_ORDER.map((slot) => <label key={slot}><span>{SLOT_LABELS[slot]}</span><select value={selected[slot] ?? ''} onChange={(e) => setSelected((current) => ({ ...current, [slot]: e.target.value ? Number(e.target.value) : undefined }))}><option value="">No layer</option>{wardrobe.filter((item) => item.slot === slot).map((item) => <option key={item.id} value={item.id}>{item.name} / {item.colorName}</option>)}</select></label>)}<div className="builder-preview">{items.map((item) => <i key={item.id} style={{ background: item.hex }} title={item.name}/>)}</div><button className="button-solid full-button" onClick={() => onBuild(items)}>Evaluate outfit</button></div></Modal>
}

async function resizeImage(file: File, maxSize = 900, quality = 0.78): Promise<string> {
  const source = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = source
  })
  const scale = Math.min(1, maxSize / Math.max(image.naturalWidth, image.naturalHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
  canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', quality)
}

function PieceForm({ item, onClose, onSaved }: { item: WardrobeItem | null; onClose: () => void; onSaved: (edited: boolean) => void }) {
  const [name, setName] = useState(item?.name ?? '')
  const [slot, setSlot] = useState<Slot>(item?.slot ?? 'base')
  const [subtype, setSubtype] = useState(item?.subtype ?? 'T-shirt')
  const [hex, setHex] = useState(item?.hex ?? '#E8E1D2')
  const [fit, setFit] = useState<Fit>(item?.fit ?? 'relaxed')
  const [structure, setStructure] = useState<Structure>(item?.structure ?? 'medium')
  const [material, setMaterial] = useState(item?.material ?? 'Cotton')
  const [formality, setFormality] = useState(item?.formality ?? 'casual')
  const [seasons, setSeasons] = useState<Season[]>(item?.seasons ?? ['spring','summer','autumn','winter'])
  const [length, setLength] = useState<GarmentLength>(item?.length ?? 'regular')
  const [visualWeight, setVisualWeight] = useState<VisualWeight>(item?.visualWeight ?? 'medium')
  const [rise, setRise] = useState<Rise>(item?.rise ?? 'mid')
  const [legShape, setLegShape] = useState<LegShape>(item?.legShape ?? 'straight')
  const [image, setImage] = useState(item?.image)
  const [active, setActive] = useState(item?.active ?? true)

  function toggleSeason(season: Season) {
    setSeasons((current) => current.includes(season) ? current.filter((value) => value !== season) : [...current, season])
  }

  async function save() {
    const normalized = normalizeHex(hex)
    if (!name.trim() || !normalized || !seasons.length) return
    const family = nearestStyleColor(normalized)
    const value: WardrobeItem = {
      ...item,
      name: name.trim(), slot, subtype, colorName: family.name, hex: normalized, fit, structure, material,
      formality, seasons, length, visualWeight, active, image,
      rise: slot === 'bottom' ? rise : undefined,
      legShape: slot === 'bottom' ? legShape : undefined,
      createdAt: item?.createdAt ?? new Date().toISOString()
    }
    if (item?.id) await db.wardrobe.put(value)
    else await db.wardrobe.add(value)
    onSaved(!!item?.id)
  }

  return <Modal onClose={onClose} title={item ? 'Edit piece' : 'Add a piece'}><div className="piece-photo-field">{image ? <img src={image} alt="Garment preview"/> : <div style={{ background: normalizeHex(hex) ?? '#E8E1D2' }}><span>NO PHOTO</span></div>}<label><Icon name="camera" size={18}/>{image ? 'Replace photo' : 'Add photo'}<input type="file" accept="image/*" onChange={async (e) => { const file = e.target.files?.[0]; if (file) setImage(await resizeImage(file)) }}/></label>{image && <button onClick={() => setImage(undefined)}>Remove photo</button>}</div><div className="form-grid">
    <label className="full">Name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Navy chore coat" /></label>
    <label>Layer<select value={slot} onChange={(e) => setSlot(e.target.value as Slot)}>{SLOT_ORDER.map((x) => <option key={x} value={x}>{SLOT_LABELS[x]}</option>)}</select></label>
    <label>Type<input value={subtype} onChange={(e) => setSubtype(e.target.value)} /></label>
    <label>Color<input value={hex} onChange={(e) => setHex(e.target.value)} /></label>
    <label className="color-field">Pick<input type="color" value={normalizeHex(hex) ?? '#E8E1D2'} onChange={(e) => setHex(e.target.value)} /></label>
    <label>Fit<select value={fit} onChange={(e) => setFit(e.target.value as Fit)}>{['slim','regular','relaxed','oversized','straight','wide'].map((x) => <option key={x}>{x}</option>)}</select></label>
    <label>Structure<select value={structure} onChange={(e) => setStructure(e.target.value as Structure)}>{['soft','medium','structured'].map((x) => <option key={x}>{x}</option>)}</select></label>
    <label>Length<select value={length} onChange={(e) => setLength(e.target.value as GarmentLength)}>{['short','regular','long'].map((x) => <option key={x}>{x}</option>)}</select></label>
    <label>Visual weight<select value={visualWeight} onChange={(e) => setVisualWeight(e.target.value as VisualWeight)}>{['light','medium','heavy'].map((x) => <option key={x}>{x}</option>)}</select></label>
    {slot === 'bottom' && <><label>Rise<select value={rise} onChange={(e) => setRise(e.target.value as Rise)}>{['low','mid','high'].map((x) => <option key={x}>{x}</option>)}</select></label><label>Leg<select value={legShape} onChange={(e) => setLegShape(e.target.value as LegShape)}>{['tapered','straight','relaxed','wide'].map((x) => <option key={x}>{x}</option>)}</select></label></>}
    <label>Formality<select value={formality} onChange={(e) => setFormality(e.target.value as WardrobeItem['formality'])}><option value="casual">casual</option><option value="smart-casual">smart-casual</option></select></label>
    <label>Availability<select value={active ? 'active' : 'archived'} onChange={(e) => setActive(e.target.value === 'active')}><option value="active">active</option><option value="archived">archived</option></select></label>
    <label className="full">Material<input value={material} onChange={(e) => setMaterial(e.target.value)} placeholder="Canvas, denim, wool..." /></label>
  </div><div className="season-field"><span>SEASONS</span><div>{(['spring','summer','autumn','winter'] as Season[]).map((season) => <button key={season} className={seasons.includes(season) ? 'selected' : ''} onClick={() => toggleSeason(season)}>{season}</button>)}</div></div><button className="button-solid full-button" onClick={save}>{item ? 'Save changes' : 'Add to wardrobe'}</button></Modal>
}

function median(values: number[]) {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

function hexToRgbTuple(hex: string): [number, number, number] {
  const normalized = normalizeHex(hex) ?? '#000000'
  return [Number.parseInt(normalized.slice(1,3), 16), Number.parseInt(normalized.slice(3,5), 16), Number.parseInt(normalized.slice(5,7), 16)]
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r,g,b].map((value) => Math.round(value).toString(16).padStart(2,'0')).join('')}`.toUpperCase()
}

function CameraColorPicker({ onClose, onUse, onSaved }: { onClose: () => void; onUse: (item: WardrobeItem) => void; onSaved: () => void }) {
  const imageRef = useRef<HTMLImageElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [samples, setSamples] = useState<string[]>([])
  const [hex, setHex] = useState('#66705A')
  const [slot, setSlot] = useState<Slot>('bottom')
  const [name, setName] = useState('Camera piece')
  const colorFamily = useMemo(() => nearestStyleColor(normalizeHex(hex) ?? '#66705A'), [hex])

  async function loadFile(file: File) {
    setImageSrc(await resizeImage(file, 1200, 0.84))
    setSamples([])
  }

  function sampleColor(event: ReactMouseEvent<HTMLImageElement>) {
    const image = imageRef.current
    const canvas = canvasRef.current
    if (!image || !canvas || !image.naturalWidth) return
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return
    ctx.drawImage(image, 0, 0)

    const rect = image.getBoundingClientRect()
    const x = Math.round(((event.clientX - rect.left) / rect.width) * image.naturalWidth)
    const y = Math.round(((event.clientY - rect.top) / rect.height) * image.naturalHeight)
    const radius = Math.max(6, Math.round(Math.min(image.naturalWidth, image.naturalHeight) * 0.012))
    const sx = Math.max(0, x - radius)
    const sy = Math.max(0, y - radius)
    const sw = Math.min(radius * 2 + 1, image.naturalWidth - sx)
    const sh = Math.min(radius * 2 + 1, image.naturalHeight - sy)
    const data = ctx.getImageData(sx, sy, sw, sh).data
    const pixels: { r: number; g: number; b: number; lum: number }[] = []
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 100) continue
      const r = data[i], g = data[i + 1], b = data[i + 2]
      pixels.push({ r, g, b, lum: r * .2126 + g * .7152 + b * .0722 })
    }
    if (!pixels.length) return
    const luminances = pixels.map((pixel) => pixel.lum).sort((a,b) => a-b)
    const low = luminances[Math.floor(luminances.length * .12)]
    const high = luminances[Math.floor(luminances.length * .88)]
    const robust = pixels.filter((pixel) => pixel.lum >= low && pixel.lum <= high)
    const sample = rgbToHex(median(robust.map((pixel) => pixel.r)), median(robust.map((pixel) => pixel.g)), median(robust.map((pixel) => pixel.b)))
    const nextSamples = [...samples, sample].slice(-3)
    setSamples(nextSamples)
    const rgbs = nextSamples.map(hexToRgbTuple)
    setHex(rgbToHex(median(rgbs.map((rgb) => rgb[0])), median(rgbs.map((rgb) => rgb[1])), median(rgbs.map((rgb) => rgb[2]))))
  }

  function createVirtual(): WardrobeItem {
    return {
      name: name.trim() || `${colorFamily.name} piece`, slot, subtype: SLOT_LABELS[slot], colorName: colorFamily.name, hex: normalizeHex(hex) ?? '#66705A',
      fit: slot === 'bottom' ? 'straight' : 'regular', structure: 'medium', material: 'Unknown', formality: 'casual',
      seasons: ['spring','summer','autumn','winter'], visualWeight: 'medium', image: imageSrc ?? undefined, active: true, createdAt: new Date().toISOString()
    }
  }

  async function savePiece() {
    await db.wardrobe.add(createVirtual())
    onSaved()
  }

  return <Modal onClose={onClose} title="Capture a color"><div className="camera-flow">
    {!imageSrc ? <label className="camera-drop"><Icon name="camera" size={34}/><strong>Take a photo</strong><span>or choose one from your phone</span><input type="file" accept="image/*" capture="environment" onChange={(e) => e.target.files?.[0] && loadFile(e.target.files[0])}/></label> : <div className="photo-sampler"><img ref={imageRef} src={imageSrc} onClick={sampleColor} alt="Selected garment"/><div className="tap-hint">Tap 2-3 clean areas of the garment</div></div>}
    <canvas ref={canvasRef} className="visually-hidden"/>
    <div className="sample-result"><i style={{ background: normalizeHex(hex) ?? '#66705A' }}/><div><small>ROBUST COLOR ESTIMATE</small><strong>{colorFamily.name}</strong><span>{hex} / {samples.length ? `${samples.length} sample${samples.length > 1 ? 's' : ''}` : 'tap image to sample'}</span></div></div>
    {!!samples.length && <div className="sample-history">{samples.map((sample, index) => <button key={`${sample}-${index}`} style={{ background: sample }} title={sample} onClick={() => { const next = samples.filter((_, i) => i !== index); setSamples(next); if (next.length) { const rgbs = next.map(hexToRgbTuple); setHex(rgbToHex(median(rgbs.map((rgb) => rgb[0])), median(rgbs.map((rgb) => rgb[1])), median(rgbs.map((rgb) => rgb[2])))) } }}/>)}</div>}
    <div className="form-grid camera-fields"><label className="full">Piece name<input value={name} onChange={(e) => setName(e.target.value)}/></label><label>Layer<select value={slot} onChange={(e) => setSlot(e.target.value as Slot)}>{SLOT_ORDER.map((x) => <option key={x} value={x}>{SLOT_LABELS[x]}</option>)}</select></label><label>HEX<input value={hex} onChange={(e) => setHex(e.target.value)}/></label></div>
    <div className="camera-actions"><button className="button-solid" onClick={() => onUse(createVirtual())}>Build outfit</button><button className="button-ghost" onClick={savePiece}>Save piece</button></div>
    <p className="microcopy">Each tap uses the median of a small region and discards the brightest and darkest pixels. Up to three samples are then combined to reduce highlights, shadows and fabric texture noise.</p>
  </div></Modal>
}

export default App
