// types/index.ts
// Shared TypeScript types used across the entire app

// ─── Individual locker (drag-drop) ──────────────────────────────
export interface LockerObject {
  id: string
  x: number           // canvas position in px
  y: number
  widthMm: number
  heightMm: number
  depthMm: number
  label: string
  color: string
  depthColor?: string  // depth face base colour (defaults to color if unset)
  rotation: number
  templateId?: string
}

// ─── Locker Block assembly ───────────────────────────────────────
// A block is the full manufactured unit: frame + columns + cells.
//
// Visual anatomy (top-down cross-section):
//
//  ┌────────────────── TOP PANEL ──────────────────┐  ← topHeightMm
//  │LEFT│ col0 │lockset│ col1 │lockset│ col2 │RIGHT│  ← column area
//  └────────────────── BASE PANEL ─────────────────┘  ← baseHeightMm
//
// Within each column, cells stack vertically.
// Each door is inset from the lockset channel by doorToLocksetGapMm.
// Adjacent doors in a column are separated by doorGapMm.

export interface LockerCell {
  heightMm: number       // compartment height (door + surrounding gap)
  label?: string         // e.g. "L01" — auto-assigned if omitted
  color?: string         // override block door color
  showLabel?: boolean    // false hides the label text; default true
  labelColor?: string    // per-cell label color override
  showDimension?: boolean // false hides the WxH dimension text; default true
  cornerRadius?: number  // door corner radius in px; overrides block default
}

export interface LockerColumn {
  id: string
  widthMm: number
  cells: LockerCell[]
}

// Where the lockset channel sits relative to the columns:
//  'between' — one channel between each pair of adjacent columns (default for 2+ cols)
//  'left'    — single channel between left-margin and col[0]
//  'right'   — single channel between col[last] and right-margin
export type LocksetPosition = 'between' | 'left' | 'right'

export interface LockerBlockConfig {
  topHeightMm: number         // top panel height
  baseHeightMm: number        // base/plinth height
  leftMarginMm: number        // left side panel width
  rightMarginMm: number       // right side panel width
  locksetWidthMm: number      // vertical lockset channel width
  locksetPosition: LocksetPosition
  doorGapMm: number           // vertical gap between adjacent doors
  doorToLocksetGapMm: number  // horizontal gap: door edge → lockset channel
  depthMm: number             // cabinet depth
  columns: LockerColumn[]
}

export interface LockerBlock {
  id: string
  x: number           // canvas position (px, includes CANVAS_PADDING)
  y: number
  rotation: number
  label: string       // block label, e.g. "Block A"
  color: string       // default door fill colour
  frameColor?: string    // TOP/BASE/margin panel colour (default dark slate)
  locksetColor?: string  // lockset channel colour (default darker slate)
  depthColor?: string    // depth face base colour (defaults to frameColor if unset)
  borderWidth?: number   // outer border stroke width in px (0 = none)
  borderColor?: string   // outer border stroke colour
  borderRadius?: number  // outer block border corner radius in px
  cellCornerRadius?: number // default door corner radius for all cells in this block
  locksets?: Array<{ color?: string }> // per-tray color overrides; index matches lockset channel order
  config: LockerBlockConfig
}

// ─── Room & canvas config ────────────────────────────────────────
export interface RoomConfig {
  widthMm: number
  depthMm: number
  scale: number       // px per mm — default 0.1 (1px = 10mm)
  gridSizeMm: number  // snap grid — default 100mm
}

// ─── Label style ─────────────────────────────────────────────────
export type LabelPosition = 'top-left' | 'top-right' | 'center'

export interface LabelStyle {
  fontSize: number        // 0 = auto-size per element; >0 = fixed px override
  color: string           // hex colour applied to all text labels
  position: LabelPosition // position of cell label inside each compartment
}

export const DEFAULT_LABEL_STYLE: LabelStyle = { fontSize: 0, color: '#1e293b', position: 'center' }

// ─── Office / title-block info ────────────────────────────────────
export interface OfficeInfo {
  companyName: string
  madeBy: string
  address: string
  website: string
  email: string
  hotline: string
}

export const DEFAULT_OFFICE_INFO: OfficeInfo = {
  companyName: '',
  madeBy: '',
  address: '',
  website: '',
  email: '',
  hotline: '',
}

export interface CanvasData {
  room: RoomConfig
  lockers: LockerObject[]
  lockerBlocks: LockerBlock[]
  labelStyle?: LabelStyle
  officeInfo?: OfficeInfo
  version: number
}

// ─── Export ──────────────────────────────────────────────────────
export interface TitleBlock {
  projectName: string
  clientName: string
  drawingNo: string
  drawnBy: string
  date: string
  scale: string
  revision: string
}

export interface ExportOptions {
  format: 'pdf' | 'dxf' | 'png'
  paperSize: 'A4' | 'A3'
  orientation: 'landscape' | 'portrait'
  includeDimensions: boolean
  includeGrid: boolean
  titleBlock: TitleBlock
}

// ─── Helpers ─────────────────────────────────────────────────────
export const mmToPx = (mm: number, scale: number): number => mm * scale
export const pxToMm = (px: number, scale: number): number => px / scale

/** Total rendered width of a block in mm */
export function blockWidthMm(config: LockerBlockConfig): number {
  const cols = config.columns
  const colsTotal = cols.reduce((s, c) => s + c.widthMm, 0)
  // 'between': N-1 channels;  'left' or 'right': exactly 1 channel
  const locksets = config.locksetPosition === 'between'
    ? Math.max(0, cols.length - 1) * config.locksetWidthMm
    : cols.length > 0 ? config.locksetWidthMm : 0
  return config.leftMarginMm + colsTotal + locksets + config.rightMarginMm
}

/** Total rendered height of a block in mm */
export function blockHeightMm(config: LockerBlockConfig): number {
  const colH = config.columns.reduce((max, col) => {
    const h = col.cells.reduce((s, c) => s + c.heightMm, 0)
    return Math.max(max, h)
  }, 0)
  return config.topHeightMm + colH + config.baseHeightMm
}

// ─── Default templates ───────────────────────────────────────────
export const DEFAULT_LOCKER_TEMPLATES: Omit<LockerObject, 'id' | 'x' | 'y' | 'label' | 'rotation'>[] = [
  { widthMm: 300, heightMm: 1800, depthMm: 450, color: '#94a3b8', templateId: 'std-300' },
  { widthMm: 400, heightMm: 1800, depthMm: 450, color: '#94a3b8', templateId: 'std-400' },
  { widthMm: 600, heightMm: 1800, depthMm: 450, color: '#94a3b8', templateId: 'std-600' },
  { widthMm: 300, heightMm: 900,  depthMm: 450, color: '#7dd3fc', templateId: 'half-300' },
  { widthMm: 400, heightMm: 900,  depthMm: 450, color: '#7dd3fc', templateId: 'half-400' },
]

export const DEFAULT_ROOM_CONFIG: RoomConfig = {
  widthMm: 6000,
  depthMm: 4000,
  scale: 0.1,
  gridSizeMm: 100,
}

export const DEFAULT_BLOCK_CONFIG: LockerBlockConfig = {
  topHeightMm: 20,
  baseHeightMm: 40,
  leftMarginMm: 20,
  rightMarginMm: 20,
  locksetWidthMm: 25,
  locksetPosition: 'between',
  doorGapMm: 2,
  doorToLocksetGapMm: 5,
  depthMm: 450,
  columns: [],
}
