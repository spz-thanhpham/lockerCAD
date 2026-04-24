'use client'
// app/canvas/page.tsx

import dynamic from 'next/dynamic'
import { useRef, useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useCanvasStore, type AlignmentType } from '@/lib/store'
import { useTemplateStore } from '@/lib/template-store'
import { useLockerTemplateStore } from '@/lib/locker-template-store'
import PropertiesPanel from '@/components/editor/PropertiesPanel'
import NumericInput from '@/components/editor/NumericInput'
import Toolbar from '@/components/editor/Toolbar'
import LockerCreateForm from '@/components/editor/LockerCreateForm'
import { type LockerBlock, type LockerCell, type TextLabel, type ShapeObject, type OfficeInfo, type LabelPosition, type LabelStyle, DEFAULT_LABEL_STYLE } from '@/types'
import type { CanvasBoardHandle, ExportImageOpts } from '@/components/editor/CanvasBoard'
import { captureCanvas } from '@/lib/canvas-capture'

const CanvasBoard = dynamic(() => import('@/components/editor/CanvasBoard'), { ssr: false })

export default function CanvasPage() {
  return (
    <Suspense>
      <CanvasEditor />
    </Suspense>
  )
}


// ── Alignment panel ───────────────────────────────────────────────
const ALIGN_BUTTONS: { key: AlignmentType; label: string; title: string }[] = [
  { key: 'left',         label: '▐◻◻', title: 'Align left edges'       },
  { key: 'center-h',    label: '◻▐◻', title: 'Center horizontally'     },
  { key: 'right',       label: '◻◻▐', title: 'Align right edges'       },
  { key: 'top',         label: '▀▀▀', title: 'Align top edges'         },
  { key: 'center-v',    label: '─▀─', title: 'Center vertically'       },
  { key: 'bottom',      label: '▄▄▄', title: 'Align bottom edges'      },
  { key: 'distribute-h',label: '◻║◻', title: 'Distribute horizontally' },
  { key: 'distribute-v',label: '─║─', title: 'Distribute vertically'   },
]

function AlignmentPanel({ count, onAlign }: { count: number; onAlign: (a: AlignmentType) => void }) {
  return (
    <div className="p-3 border-b">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
        Align ({count} selected)
      </p>
      <div className="grid grid-cols-4 gap-1">
        {ALIGN_BUTTONS.map(({ key, label, title }) => (
          <button key={key} title={title} onClick={() => onAlign(key)}
            className="h-7 border rounded text-[10px] font-mono text-gray-600 hover:bg-blue-50 hover:border-blue-300 transition-colors">
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Color row ─────────────────────────────────────────────────────
function ColorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [draft, setDraft] = useState(value)
  useEffect(() => { setDraft(value) }, [value])
  const tryCommit = (text: string) => {
    const s = text.trim()
    const hex = s.startsWith('#') ? s : '#' + s
    if (/^#[0-9a-fA-F]{6}$/.test(hex)) onChange(hex.toLowerCase())
    else setDraft(value)
  }
  return (
    <div className="flex items-center gap-1">
      <input type="color" value={value}
        onChange={(e) => { onChange(e.target.value); setDraft(e.target.value) }}
        className="w-6 h-6 border rounded cursor-pointer shrink-0 p-0.5" />
      <input type="text" value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => tryCommit(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') tryCommit((e.target as HTMLInputElement).value) }}
        className="w-[4.5rem] text-[10px] font-mono text-gray-500 border rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400" />
    </div>
  )
}

function ColorRow({ label, value, onChange, onReset }: { label: string; value: string; onChange: (v: string) => void; onReset?: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-500 text-xs">{label}</span>
      <div className="flex items-center gap-1.5">
        <ColorInput value={value} onChange={onChange} />
        {onReset && (
          <button onClick={onReset} title="Reset to default"
            className="text-[10px] text-gray-400 hover:text-gray-600">↺</button>
        )}
      </div>
    </div>
  )
}

// ── Office info editor ────────────────────────────────────────────
const OFFICE_FIELDS: { key: keyof OfficeInfo; label: string; placeholder: string }[] = [
  { key: 'companyName', label: 'Company',  placeholder: 'ACME Corp' },
  { key: 'madeBy',      label: 'Made by',  placeholder: 'Your name' },
  { key: 'address',     label: 'Address',  placeholder: '123 Street' },
  { key: 'website',     label: 'Website',  placeholder: 'www.example.com' },
  { key: 'email',       label: 'Email',    placeholder: 'info@example.com' },
  { key: 'hotline',     label: 'Hotline',  placeholder: '+84 900 000 000' },
]

function OfficeInfoEditor({ info, onChange }: { info: OfficeInfo; onChange: (k: keyof OfficeInfo, v: string) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide hover:bg-gray-50"
      >
        Office info
        <span className="text-gray-400 text-[10px]">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-2">
          {OFFICE_FIELDS.map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="block text-[10px] text-gray-400 mb-0.5">{label}</label>
              <input
                value={info[key]} placeholder={placeholder}
                onChange={(e) => onChange(key, e.target.value)}
                className="w-full border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Collapsible panel section ─────────────────────────────────────
function PanelSection({
  title, children, defaultOpen = false,
}: {
  title: string; children: React.ReactNode; defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-b shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wide hover:bg-gray-50 transition-colors"
      >
        {title}
        <span className="text-gray-400 ml-1">{open ? '▲' : '▼'}</span>
      </button>
      {open && <div className="px-3 pb-3">{children}</div>}
    </div>
  )
}

// ── Text label properties panel ───────────────────────────────────
function TextLabelPanel({ label, onChange, onDelete }: {
  label: TextLabel
  onChange: (updated: TextLabel) => void
  onDelete: (id: string) => void
}) {
  const update = (patch: Partial<TextLabel>) => onChange({ ...label, ...patch })
  return (
    <div className="p-3 space-y-3 text-xs text-gray-700">
      <p className="font-semibold text-gray-500 uppercase tracking-wide text-[10px]">Text label</p>

      <div>
        <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Text</label>
        <textarea
          value={label.text}
          rows={2}
          onChange={(e) => update({ text: e.target.value })}
          className="w-full border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none"
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="text-gray-500 shrink-0">Font size</span>
        <div className="flex items-center gap-1">
          <NumericInput
            value={label.fontSize}
            min={6} max={200}
            onCommit={(v) => update({ fontSize: v })}
            className="w-16 border rounded px-2 py-0.5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
          <span className="text-[10px] text-gray-400">px</span>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-gray-500">Style</span>
        <div className="flex gap-1">
          {(['normal', 'bold', 'italic'] as const).map((s) => (
            <button key={s} onClick={() => update({ fontStyle: s })}
              className={`px-2 py-0.5 border rounded text-[10px] capitalize transition-colors ${
                label.fontStyle === s ? 'bg-blue-100 border-blue-400 text-blue-700' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-gray-500">Colour</span>
        <ColorInput value={label.color} onChange={(v) => update({ color: v })} />
      </div>

      <div>
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Rotation</p>
        <div className="flex gap-1 flex-wrap">
          {[0, 90, 180, 270].map((r) => (
            <button key={r} onClick={() => update({ rotation: r })}
              className={`flex-1 py-0.5 rounded border text-[10px] transition-colors ${
                label.rotation === r
                  ? 'bg-blue-100 border-blue-400 text-blue-700 font-medium'
                  : 'border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}>
              {r}°
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between pt-1 border-t">
        <span className="text-gray-500">Lock position</span>
        <button
          onClick={() => update({ locked: !label.locked })}
          title={label.locked ? 'Unlock — allow moving' : 'Lock — prevent accidental moves'}
          className={`px-2 py-0.5 border rounded text-[10px] transition-colors ${
            label.locked
              ? 'bg-amber-100 border-amber-400 text-amber-700 font-medium'
              : 'border-gray-200 text-gray-500 hover:bg-gray-50'
          }`}
        >
          {label.locked ? '🔒 Locked' : '🔓 Unlocked'}
        </button>
      </div>

      <p className="text-[10px] text-gray-400">Double-click on canvas to edit text inline.</p>

      <button onClick={() => onDelete(label.id)}
        className="w-full mt-1 px-3 py-1.5 bg-red-50 text-red-600 rounded border border-red-200 text-xs hover:bg-red-100">
        Delete label
      </button>
    </div>
  )
}

// ── 3×3 label position grid ──────────────────────────────────────
const POS_GRID: { pos: LabelPosition; icon: string }[][] = [
  [{ pos: 'top-left',  icon: '↖' }, { pos: 'top-center',  icon: '↑' }, { pos: 'top-right',  icon: '↗' }],
  [{ pos: 'mid-left',  icon: '←' }, { pos: 'center',      icon: '·' }, { pos: 'mid-right',  icon: '→' }],
  [{ pos: 'bot-left',  icon: '↙' }, { pos: 'bot-center',  icon: '↓' }, { pos: 'bot-right',  icon: '↘' }],
]

function PositionGrid({ value, onChange }: { value: LabelPosition | undefined; onChange: (p: LabelPosition | undefined) => void }) {
  return (
    <div className="inline-grid grid-cols-3 gap-0.5">
      {POS_GRID.flat().map(({ pos, icon }) => (
        <button key={pos} title={pos} onClick={() => onChange(value === pos ? undefined : pos)}
          className={`w-6 h-6 flex items-center justify-center text-xs rounded border transition-colors ${
            value === pos
              ? 'bg-blue-100 border-blue-400 text-blue-700'
              : 'border-gray-200 text-gray-500 hover:bg-gray-50'
          }`}>
          {icon}
        </button>
      ))}
    </div>
  )
}

// ── Right-click context menu ──────────────────────────────────────
function ContextMenu({
  x, y, hasSelection, hasClipboard, onClose,
  onCopy, onPaste, onDuplicate, onDelete, onSelectAll,
}: {
  x: number; y: number
  hasSelection: boolean; hasClipboard: boolean
  onClose: () => void
  onCopy: () => void; onPaste: () => void
  onDuplicate: () => void; onDelete: () => void; onSelectAll: () => void
}) {
  useEffect(() => {
    const close = () => onClose()
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [onClose])

  const btn = 'w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-between gap-6'

  return (
    <div
      onMouseDown={(e) => e.stopPropagation()}
      style={{ position: 'fixed', top: y, left: x, zIndex: 9999 }}
      className="bg-white border border-gray-200 rounded shadow-lg py-1 min-w-[160px]"
    >
      <button className={btn} disabled={!hasSelection} onClick={() => { onCopy(); onClose() }}>
        <span>Copy</span><span className="text-gray-400 text-[10px]">Ctrl+C</span>
      </button>
      <button className={btn} disabled={!hasClipboard} onClick={() => { onPaste(); onClose() }}>
        <span>Paste</span><span className="text-gray-400 text-[10px]">Ctrl+V</span>
      </button>
      <button className={btn} disabled={!hasSelection} onClick={() => { onDuplicate(); onClose() }}>
        <span>Duplicate</span><span className="text-gray-400 text-[10px]">Ctrl+D</span>
      </button>
      <div className="border-t my-1" />
      <button className={btn} disabled={!hasSelection}
        onClick={() => { onDelete(); onClose() }}
        style={hasSelection ? { color: '#dc2626' } : undefined}>
        <span>Delete</span><span className="text-gray-400 text-[10px]">Del</span>
      </button>
      <div className="border-t my-1" />
      <button className={btn} onClick={() => { onSelectAll(); onClose() }}>
        <span>Select All</span><span className="text-gray-400 text-[10px]">Ctrl+A</span>
      </button>
    </div>
  )
}

// ── Shape properties panel ────────────────────────────────────────
function ShapePanel({ shape, onChange, onDelete }: {
  shape: ShapeObject
  onChange: (updated: ShapeObject) => void
  onDelete: (id: string) => void
}) {
  const update = (patch: Partial<ShapeObject>) => onChange({ ...shape, ...patch })
  return (
    <div className="p-3 space-y-3 text-xs text-gray-700">
      <p className="font-semibold text-gray-500 uppercase tracking-wide text-[10px]">
        {shape.type === 'rect' ? 'Rectangle' : 'Circle / Ellipse'}
      </p>

      {/* Fill */}
      <div className="flex items-center justify-between">
        <span className="text-gray-500">Fill</span>
        <div className="flex items-center gap-1.5">
          <ColorInput
            value={shape.fill === 'transparent' ? '#ffffff' : (shape.fill.startsWith('rgba') ? '#3b82f6' : shape.fill)}
            onChange={(v) => update({ fill: v })} />
          <button onClick={() => update({ fill: 'transparent' })}
            title="No fill"
            className={`px-1.5 py-0.5 rounded border text-[10px] transition-colors ${
              shape.fill === 'transparent' ? 'bg-blue-100 border-blue-400 text-blue-700' : 'border-gray-200 text-gray-400 hover:bg-gray-50'
            }`}>
            None
          </button>
        </div>
      </div>

      {/* Fill opacity */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-gray-500 shrink-0">Opacity</span>
        <input
          type="range" min={0} max={1} step={0.05}
          value={shape.opacity}
          onChange={(e) => update({ opacity: parseFloat(e.target.value) })}
          className="flex-1"
        />
        <span className="text-[10px] text-gray-400 w-8 text-right">
          {Math.round(shape.opacity * 100)}%
        </span>
      </div>

      {/* Stroke colour */}
      <div className="flex items-center justify-between">
        <span className="text-gray-500">Border colour</span>
        <ColorInput value={shape.stroke} onChange={(v) => update({ stroke: v })} />
      </div>

      {/* Stroke width */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-gray-500 shrink-0">Border width</span>
        <div className="flex items-center gap-1">
          <NumericInput
            value={shape.strokeWidth}
            min={0} max={20}
            onCommit={(v) => update({ strokeWidth: v })}
            className="w-14 border rounded px-2 py-0.5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
          <span className="text-[10px] text-gray-400">px</span>
        </div>
      </div>

      {/* Corner radius — rect only */}
      {shape.type === 'rect' && (
        <div className="flex items-center justify-between gap-2">
          <span className="text-gray-500 shrink-0">Corner radius</span>
          <div className="flex items-center gap-1">
            <NumericInput
              value={shape.cornerRadius ?? 0}
              min={0} max={200}
              onCommit={(v) => update({ cornerRadius: v })}
              className="w-14 border rounded px-2 py-0.5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
            <span className="text-[10px] text-gray-400">px</span>
          </div>
        </div>
      )}

      {/* Rotation */}
      <div>
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Rotation</p>
        <div className="flex gap-1 flex-wrap">
          {[0, 45, 90, 135, 180].map((r) => (
            <button key={r} onClick={() => update({ rotation: r })}
              className={`flex-1 py-0.5 rounded border text-[10px] transition-colors ${
                shape.rotation === r
                  ? 'bg-blue-100 border-blue-400 text-blue-700 font-medium'
                  : 'border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}>
              {r}°
            </button>
          ))}
        </div>
      </div>

      {/* Lock */}
      <div className="flex items-center justify-between pt-1 border-t">
        <span className="text-gray-500">Lock position</span>
        <button
          onClick={() => update({ locked: !shape.locked })}
          className={`px-2 py-0.5 border rounded text-[10px] transition-colors ${
            shape.locked
              ? 'bg-amber-100 border-amber-400 text-amber-700 font-medium'
              : 'border-gray-200 text-gray-500 hover:bg-gray-50'
          }`}>
          {shape.locked ? '🔒 Locked' : '🔓 Unlocked'}
        </button>
      </div>

      <p className="text-[10px] text-gray-400">Drag handles to resize · drag shape to move.</p>

      <button onClick={() => onDelete(shape.id)}
        className="w-full mt-1 px-3 py-1.5 bg-red-50 text-red-600 rounded border border-red-200 text-xs hover:bg-red-100">
        Delete shape
      </button>
    </div>
  )
}

// ── Main editor ───────────────────────────────────────────────────
function CanvasEditor() {
  const searchParams   = useSearchParams()
  const layoutId       = searchParams.get('layoutId')
  const projectId      = searchParams.get('projectId')
  const canvasBoardRef  = useRef<CanvasBoardHandle>(null)

  const [activeTool, setActiveTool]   = useState<'select' | 'pan' | 'text' | 'rect' | 'circle'>('select')
  const [zoom, setZoom]               = useState(1)
  const [cadView, setCadView]         = useState(false)
  const [saving, setSaving]           = useState(false)
  const [autoSaving, setAutoSaving]   = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const [saveCountdown, setSaveCountdown] = useState<number | null>(null)
  const [editingBlock, setEditingBlock] = useState<LockerBlock | null>(null)
  const savedLayoutId = useRef<string | null>(layoutId)
  const savedProjectId = useRef<string | null>(projectId)

  const lockers        = useCanvasStore((s) => s.lockers)
  const lockerBlocks   = useCanvasStore((s) => s.lockerBlocks)
  const textLabels     = useCanvasStore((s) => s.textLabels)
  const shapes         = useCanvasStore((s) => s.shapes)
  const room           = useCanvasStore((s) => s.room)
  const selectedId     = useCanvasStore((s) => s.selectedId)
  const selectedType   = useCanvasStore((s) => s.selectedType)
  const selectedIds    = useCanvasStore((s) => s.selectedIds)
  const showDimensions      = useCanvasStore((s) => s.showDimensions)
  const showDepth           = useCanvasStore((s) => s.showDepth)
  const showBlockDimensions = useCanvasStore((s) => s.showBlockDimensions)
  const isDirty        = useCanvasStore((s) => s.isDirty)
  const projectName    = useCanvasStore((s) => s.projectName)
  const labelStyle     = useCanvasStore((s) => s.labelStyle)
  const officeInfo     = useCanvasStore((s) => s.officeInfo)

  const addLocker         = useCanvasStore((s) => s.addLocker)
  const updateLocker      = useCanvasStore((s) => s.updateLocker)
  const deleteLocker      = useCanvasStore((s) => s.deleteLocker)
  const addLockerBlock    = useCanvasStore((s) => s.addLockerBlock)
  const updateLockerBlock = useCanvasStore((s) => s.updateLockerBlock)
  const deleteLockerBlock = useCanvasStore((s) => s.deleteLockerBlock)
  const addTextLabel      = useCanvasStore((s) => s.addTextLabel)
  const updateTextLabel   = useCanvasStore((s) => s.updateTextLabel)
  const deleteTextLabel   = useCanvasStore((s) => s.deleteTextLabel)
  const addShape          = useCanvasStore((s) => s.addShape)
  const updateShape       = useCanvasStore((s) => s.updateShape)
  const deleteShape       = useCanvasStore((s) => s.deleteShape)
  const copySelected      = useCanvasStore((s) => s.copySelected)
  const paste             = useCanvasStore((s) => s.paste)
  const duplicate         = useCanvasStore((s) => s.duplicate)
  const deleteSelected    = useCanvasStore((s) => s.deleteSelected)
  const hasClipboard      = useCanvasStore((s) => s.clipboard.length > 0)
  const selectItem        = useCanvasStore((s) => s.selectItem)
  const toggleSelectItem  = useCanvasStore((s) => s.toggleSelectItem)
  const selectBatch       = useCanvasStore((s) => s.selectBatch)
  const bulkMove          = useCanvasStore((s) => s.bulkMove)
  const selectAll         = useCanvasStore((s) => s.selectAll)
  const alignItems        = useCanvasStore((s) => s.alignItems)
  const setShowDimensions      = useCanvasStore((s) => s.setShowDimensions)
  const setShowDepth           = useCanvasStore((s) => s.setShowDepth)
  const setShowBlockDimensions = useCanvasStore((s) => s.setShowBlockDimensions)
  const setLabelStyle     = useCanvasStore((s) => s.setLabelStyle)
  const setOfficeInfo     = useCanvasStore((s) => s.setOfficeInfo)
  const setProjectName    = useCanvasStore((s) => s.setProjectName)
  const setRoom           = useCanvasStore((s) => s.setRoom)
  const getCanvasData     = useCanvasStore((s) => s.getCanvasData)
  const loadCanvasData    = useCanvasStore((s) => s.loadCanvasData)
  const markSaved         = useCanvasStore((s) => s.markSaved)
  const resetCanvas       = useCanvasStore((s) => s.resetCanvas)

  const selectedLocker    = selectedType === 'locker'    ? lockers.find((l) => l.id === selectedId) ?? null : null
  const selectedBlock     = selectedType === 'block'     ? lockerBlocks.find((b) => b.id === selectedId) ?? null : null
  const selectedTextLabel = selectedType === 'textLabel' ? textLabels.find((t) => t.id === selectedId) ?? null : null
  const selectedShape     = selectedType === 'shape'     ? shapes.find((sh) => sh.id === selectedId) ?? null : null

  // Cell-level selection (within a block)
  const [selectedCell, setSelectedCell] = useState<{ blockId: string; colIdx: number; cellIdx: number } | null>(null)
  const [lockFrame, setLockFrame]       = useState(true)
  const [showRenumber, setShowRenumber] = useState(false)  // offer renumber after delete

  // Lockset tray selection (within a block)
  const [selectedLockset, setSelectedLockset] = useState<{ blockId: string; locksetIdx: number } | null>(null)

  // No effect needed: sub-selections are scoped by blockId and naturally
  // become inactive when selectedId points to a different block.

  const handleSelectCell = useCallback((blockId: string, colIdx: number, cellIdx: number) => {
    selectItem(blockId, 'block')
    setSelectedLockset(null)
    setSelectedCell({ blockId, colIdx, cellIdx })
  }, [selectItem])

  const handleSelectLockset = useCallback((blockId: string, locksetIdx: number) => {
    selectItem(blockId, 'block')
    setSelectedCell(null)
    setSelectedLockset({ blockId, locksetIdx })
  }, [selectItem])

  // Sub-selections are only active when they belong to the currently selected block
  const activeCell    = selectedCell?.blockId    === selectedId ? selectedCell    : null
  const activeLockset = selectedLockset?.blockId === selectedId ? selectedLockset : null

  const selectedLocksetColor = activeLockset && selectedBlock
    ? selectedBlock.locksets?.[activeLockset.locksetIdx]?.color ?? null
    : null

  const updateLocksetColor = useCallback((color: string | undefined) => {
    if (!activeLockset || !selectedBlock) return
    const { locksetIdx } = activeLockset
    const existing = selectedBlock.locksets ?? []
    const updated  = [...existing]
    while (updated.length <= locksetIdx) updated.push({})
    updated[locksetIdx] = color !== undefined ? { ...updated[locksetIdx], color } : {}
    updateLockerBlock({ ...selectedBlock, locksets: updated })
  }, [activeLockset, selectedBlock, updateLockerBlock])

  const selectedCellData = activeCell && selectedBlock
    ? selectedBlock.config.columns[activeCell.colIdx]?.cells[activeCell.cellIdx] ?? null
    : null

  const updateCell = useCallback((changes: Partial<LockerCell>) => {
    if (!activeCell || !selectedBlock || !selectedCellData) return
    const { colIdx, cellIdx } = activeCell

    const newCols = selectedBlock.config.columns.map((col, ci) => {
      if (ci !== colIdx) return col
      let newCells = col.cells.map((c, ri) => ri === cellIdx ? { ...c, ...changes } : c)

      if (lockFrame && typeof changes.heightMm === 'number') {
        const delta  = changes.heightMm - col.cells[cellIdx].heightMm
        const adjIdx = cellIdx + 1 < newCells.length ? cellIdx + 1
                     : cellIdx - 1 >= 0              ? cellIdx - 1 : -1
        if (adjIdx >= 0 && delta !== 0) {
          const adjNewH    = Math.max(50, newCells[adjIdx].heightMm - delta)
          const absorbed   = col.cells[adjIdx].heightMm - adjNewH
          newCells[adjIdx] = { ...newCells[adjIdx], heightMm: adjNewH }
          if (Math.abs(absorbed) < Math.abs(delta)) {
            newCells[cellIdx] = { ...newCells[cellIdx], heightMm: col.cells[cellIdx].heightMm + absorbed }
          }
        }
      }
      return { ...col, cells: newCells }
    })
    updateLockerBlock({ ...selectedBlock, config: { ...selectedBlock.config, columns: newCols } })
  }, [activeCell, selectedBlock, selectedCellData, lockFrame, updateLockerBlock])

  const deleteCell = useCallback(() => {
    if (!activeCell || !selectedBlock) return
    const { colIdx, cellIdx } = activeCell
    const newCols = selectedBlock.config.columns
      .map((col, ci) => ci === colIdx
        ? { ...col, cells: col.cells.filter((_, ri) => ri !== cellIdx) }
        : col)
      .filter((col) => col.cells.length > 0)
    setSelectedCell(null)
    setShowRenumber(true)
    updateLockerBlock({ ...selectedBlock, config: { ...selectedBlock.config, columns: newCols } })
  }, [activeCell, selectedBlock, updateLockerBlock])

  // Sequentially re-label all cells L01, L02, ... across columns (left→right, top→bottom)
  const renumberCells = useCallback((prefix = 'L') => {
    if (!selectedBlock) return
    let n = 1
    const newCols = selectedBlock.config.columns.map((col) => ({
      ...col,
      cells: col.cells.map((cell) => ({
        ...cell,
        label: `${prefix}${String(n++).padStart(2, '0')}`,
      })),
    }))
    setShowRenumber(false)
    updateLockerBlock({ ...selectedBlock, config: { ...selectedBlock.config, columns: newCols } })
  }, [selectedBlock, updateLockerBlock])

  // Block templates (localStorage-persisted)
  const templates       = useTemplateStore((s) => s.templates)
  const saveTemplate    = useTemplateStore((s) => s.saveTemplate)
  const deleteTemplate  = useTemplateStore((s) => s.deleteTemplate)
  const [savingTpl, setSavingTpl]   = useState(false)
  const [tplName, setTplName]       = useState('')

  // Locker quick-add templates (localStorage-persisted)
  const lockerTpls          = useLockerTemplateStore((s) => s.templates)
  const addLockerTpl        = useLockerTemplateStore((s) => s.addTemplate)
  const updateLockerTpl     = useLockerTemplateStore((s) => s.updateTemplate)
  const deleteLockerTpl     = useLockerTemplateStore((s) => s.deleteTemplate)
  const [editingLTplId, setEditingLTplId] = useState<string | null>(null)
  const [addingLTpl, setAddingLTpl]       = useState(false)
  const [newLTpl, setNewLTpl]             = useState({ widthMm: 300, heightMm: 1800, depthMm: 450, color: '#94a3b8' })

  // Rehydrate template stores from localStorage (skip SSR)
  useEffect(() => {
    useTemplateStore.persist.rehydrate()
    useLockerTemplateStore.getState().rehydrate()
  }, [])

  const handleSaveTemplate = () => {
    if (!selectedBlock) return
    const name = tplName.trim() || selectedBlock.label
    saveTemplate(name, selectedBlock)
    setTplName('')
    setSavingTpl(false)
  }

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      const editable = tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable
      if (editable) return

      if ((e.ctrlKey || e.metaKey) && e.key === 'a') { e.preventDefault(); selectAll(); return }
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') { e.preventDefault(); copySelected(); return }
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') { e.preventDefault(); paste(); return }
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') { e.preventDefault(); duplicate(); return }
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSelected() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectAll, copySelected, paste, duplicate, deleteSelected])

  // Reset store for new layouts; load existing layout from URL
  useEffect(() => {
    if (!layoutId) { resetCanvas(); return }
    fetch(`/api/layouts/${layoutId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.canvasData) { loadCanvasData(data.canvasData); savedLayoutId.current = data.id }
      })
      .catch(console.error)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutId, resetCanvas])

  // Save
  const handleSave = useCallback(async () => {
    if (saving) return
    setSaving(true)
    try {
      const canvasData = getCanvasData()
      if (savedLayoutId.current) {
        await fetch(`/api/layouts/${savedLayoutId.current}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ canvasData, name: projectName }),
        })
      } else {
        const res = await fetch('/api/layouts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            canvasData,
            name: projectName,
            ...(savedProjectId.current ? { projectId: savedProjectId.current } : {}),
          }),
        })
        const created = await res.json()
        if (created.id) {
          savedLayoutId.current  = created.id
          savedProjectId.current = created.projectId ?? savedProjectId.current
          const qp = savedProjectId.current
            ? `?layoutId=${created.id}&projectId=${savedProjectId.current}`
            : `?layoutId=${created.id}`
          window.history.replaceState(null, '', qp)
        }
      }
      markSaved()
      setLastSavedAt(new Date())
    } catch (err) {
      console.error('Save failed:', err)
    } finally {
      setSaving(false)
    }
  }, [saving, getCanvasData, projectName, markSaved])

  // ── Auto-save: 15 s of inactivity → save ─────────────────────────
  const AUTO_SAVE_DELAY = 15_000
  const lastChangeRef   = useRef<number>(0)
  const handleSaveRef   = useRef(handleSave)
  handleSaveRef.current = handleSave  // keep ref current without recreating intervals

  // Track the timestamp of every state mutation while dirty
  useEffect(() => {
    return useCanvasStore.subscribe((state) => {
      if (state.isDirty) lastChangeRef.current = Date.now()
    })
  }, [])

  // Interval: auto-save when dirty + 15 s have elapsed since last change
  useEffect(() => {
    const interval = setInterval(async () => {
      const state = useCanvasStore.getState()
      if (!state.isDirty || saving || autoSaving) return
      if (Date.now() - lastChangeRef.current < AUTO_SAVE_DELAY) return
      setAutoSaving(true)
      try { await handleSaveRef.current() } finally { setAutoSaving(false) }
    }, 3_000)
    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])  // intentionally empty — reads everything via refs

  // Countdown display: ticks every second while dirty
  useEffect(() => {
    if (!isDirty) { setSaveCountdown(null); return }
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((AUTO_SAVE_DELAY - (Date.now() - lastChangeRef.current)) / 1000))
      setSaveCountdown(remaining)
    }
    tick()
    const timer = setInterval(tick, 1_000)
    return () => clearInterval(timer)
  }, [isDirty])

  const getStageDataUrl = useCallback((opts?: ExportImageOpts) => captureCanvas(opts), [])
  const updateBlockColor = (block: LockerBlock, key: 'color' | 'frameColor' | 'locksetColor' | 'depthColor', value: string) =>
    updateLockerBlock({ ...block, [key]: value })
  const isMultiSelect = selectedIds.length >= 2

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-50">
      <Toolbar
        activeTool={activeTool} onToolChange={setActiveTool}
        zoom={zoom}
        onSave={handleSave} saving={saving} autoSaving={autoSaving} isDirty={isDirty}
        canvasData={getCanvasData()} getStageDataUrl={getStageDataUrl}
        projectName={projectName} onRenameProject={setProjectName}
        showDimensions={showDimensions} onSelectAll={selectAll}
      />

      <div className="flex flex-1 overflow-hidden">

        {/* ── Left sidebar ─────────────────────────────────────── */}
        <aside className="w-52 border-r bg-white flex flex-col shrink-0">

          {/* Always-visible: add block button */}
          <div className="px-3 py-2 border-b shrink-0">
            <LockerCreateForm onAdd={addLockerBlock} />
          </div>

          {/* Collapsible sections — no scroll; collapse to fit */}
          <PanelSection title="Quick add — lockers">
            <div className="space-y-1.5">
              {lockerTpls.map((t) => (
                <div key={t.id} className="group">
                  {editingLTplId === t.id ? (
                    <div className="border rounded p-1.5 space-y-1 bg-blue-50">
                      {([['widthMm','W'],['heightMm','H'],['depthMm','D']] as [keyof typeof t, string][]).map(([k, lbl]) => (
                        <div key={k} className="flex items-center gap-1">
                          <span className="text-[10px] text-gray-500 w-4 shrink-0">{lbl}</span>
                          <NumericInput min={50}
                            value={t[k] as number}
                            onCommit={(v) => updateLockerTpl(t.id, { [k]: v })}
                            className="min-w-0 flex-1 border rounded px-1 py-0.5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-400" />
                          <span className="text-[10px] text-gray-400 shrink-0">mm</span>
                        </div>
                      ))}
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-gray-500 w-10 shrink-0">Color</span>
                        <ColorInput value={t.color} onChange={(v) => updateLockerTpl(t.id, { color: v })} />
                      </div>
                      <button onClick={() => setEditingLTplId(null)}
                        className="w-full mt-0.5 py-0.5 bg-blue-600 text-white text-[10px] rounded hover:bg-blue-700">Done</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <button onClick={() => addLocker(t)}
                        className="flex-1 min-w-0 text-left px-2 py-1.5 rounded border text-xs hover:bg-blue-50 hover:border-blue-300 transition-colors">
                        <div className="font-medium text-gray-700 truncate">{t.widthMm}W × {t.heightMm}H</div>
                        <div className="text-gray-400 truncate">D {t.depthMm}mm</div>
                      </button>
                      <button onClick={() => setEditingLTplId(t.id)} title="Edit"
                        className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-blue-500 transition-opacity text-sm shrink-0">✎</button>
                      <button onClick={() => deleteLockerTpl(t.id)} title="Remove"
                        className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-opacity shrink-0">×</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {addingLTpl ? (
              <div className="border rounded p-1.5 space-y-1 mt-2 bg-gray-50">
                {([['widthMm','W'],['heightMm','H'],['depthMm','D']] as [keyof typeof newLTpl, string][]).map(([k, lbl]) => (
                  <div key={k} className="flex items-center gap-1">
                    <span className="text-[10px] text-gray-500 w-4 shrink-0">{lbl}</span>
                    <NumericInput min={50}
                      value={newLTpl[k] as number}
                      onCommit={(v) => setNewLTpl((p) => ({ ...p, [k]: v }))}
                      className="min-w-0 flex-1 border rounded px-1 py-0.5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-400" />
                    <span className="text-[10px] text-gray-400 shrink-0">mm</span>
                  </div>
                ))}
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-gray-500 w-10 shrink-0">Color</span>
                  <ColorInput value={newLTpl.color} onChange={(v) => setNewLTpl((p) => ({ ...p, color: v }))} />
                </div>
                <div className="flex gap-1 mt-0.5">
                  <button onClick={() => { addLockerTpl(newLTpl); setAddingLTpl(false) }}
                    className="flex-1 py-0.5 bg-green-600 text-white text-[10px] rounded hover:bg-green-700">Add</button>
                  <button onClick={() => setAddingLTpl(false)}
                    className="flex-1 py-0.5 border rounded text-[10px] text-gray-500 hover:bg-gray-100">Cancel</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setAddingLTpl(true)}
                className="mt-2 w-full py-1 border border-dashed border-gray-300 rounded text-[10px] text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors">
                + Add locker type
              </button>
            )}
          </PanelSection>

          <PanelSection title="Block templates">
            {templates.length === 0 ? (
              <p className="text-[10px] text-gray-400">Select a block then "Save as template".</p>
            ) : (
              <div className="space-y-1.5">
                {templates.map((tpl) => (
                  <div key={tpl.id} className="flex items-center gap-1 group">
                    <button
                      onClick={() => addLockerBlock({ ...tpl.block, x: 80, y: 80 })}
                      className="flex-1 min-w-0 text-left px-2 py-1.5 rounded border text-xs hover:bg-blue-50 hover:border-blue-300 transition-colors"
                    >
                      <div className="font-medium text-gray-700 truncate">{tpl.name}</div>
                      <div className="text-gray-400">
                        {tpl.block.config.columns.length} col ·{' '}
                        {tpl.block.config.columns.reduce((s, c) => s + c.cells.length, 0)} cells
                      </div>
                    </button>
                    <button onClick={() => deleteTemplate(tpl.id)} title="Remove"
                      className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-opacity shrink-0">×</button>
                  </div>
                ))}
              </div>
            )}
          </PanelSection>

          <PanelSection title="Room" defaultOpen>
            <div className="space-y-2">
              {([
                ['widthMm', 'Width'],
                ['depthMm', 'Depth'],
              ] as [keyof typeof room, string][]).map(([key, label]) => (
                <div key={key}>
                  <label className="block text-[10px] text-gray-400 mb-0.5">{label} (mm)</label>
                  <NumericInput
                    value={room[key] as number}
                    min={1000} max={50000}
                    onCommit={(v) => setRoom({ [key]: v })}
                    className="w-full border rounded px-2 py-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                </div>
              ))}
              <div>
                <label className="block text-[10px] text-gray-400 mb-0.5">Scale</label>
                <select
                  value={room.scale}
                  onChange={(e) => setRoom({ scale: Number(e.target.value) })}
                  className="w-full border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                >
                  <option value={0.05}>1:20  (1px = 20mm)</option>
                  <option value={0.1}>1:10  (1px = 10mm)</option>
                  <option value={0.2}>1:5   (1px = 5mm)</option>
                  <option value={0.5}>1:2   (1px = 2mm)</option>
                  <option value={1}>1:1   (1px = 1mm)</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-gray-400 mb-0.5">Snap grid (mm)</label>
                <NumericInput
                  value={room.gridSizeMm}
                  min={10} max={1000}
                  onCommit={(v) => setRoom({ gridSizeMm: v })}
                  className="w-full border rounded px-2 py-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>
            </div>
          </PanelSection>

          {/* Office info — already has its own collapse toggle */}
          <OfficeInfoEditor info={officeInfo} onChange={(k, v) => setOfficeInfo({ [k]: v })} />

          {/* Always-visible footer */}
          <div className="px-3 py-2 border-t mt-auto shrink-0 space-y-1.5">
            {/* Design / CAD view toggle */}
            <div className="flex gap-1 p-0.5 bg-gray-100 rounded">
              <button
                onClick={() => setCadView(false)}
                className={`flex-1 py-0.5 rounded text-[10px] font-medium transition-colors ${
                  !cadView ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}>
                Design
              </button>
              <button
                onClick={() => setCadView(true)}
                className={`flex-1 py-0.5 rounded text-[10px] font-medium transition-colors ${
                  cadView ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}>
                CAD
              </button>
            </div>
            <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
              <input type="checkbox" checked={showDepth}
                onChange={(e) => setShowDepth(e.target.checked)} className="rounded" />
              Show 3D depth
            </label>
            <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
              <input type="checkbox" checked={showBlockDimensions}
                onChange={(e) => setShowBlockDimensions(e.target.checked)} className="rounded" />
              Show block dimensions
            </label>
            <div className="text-[10px] text-center pt-0.5 space-y-0.5">
              {saving || autoSaving ? (
                <p className="text-blue-500 animate-pulse">↺ Saving…</p>
              ) : isDirty ? (
                <>
                  <p className="text-amber-600">● Unsaved changes</p>
                  {saveCountdown !== null && saveCountdown > 0 && (
                    <p className="text-gray-400">Auto-save in {saveCountdown}s</p>
                  )}
                </>
              ) : (
                <p className="text-green-600">
                  ✓ Saved{lastSavedAt ? ` · ${lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                </p>
              )}
            </div>
          </div>
        </aside>

        {/* ── Canvas ───────────────────────────────────────────── */}
        <main
          className="flex-1 overflow-hidden"
          onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY }) }}
        >
          <CanvasBoard
            ref={canvasBoardRef}
            lockers={lockers} lockerBlocks={lockerBlocks} textLabels={textLabels} shapes={shapes} room={room}
            selectedId={selectedId} selectedIds={selectedIds}
            labelStyle={labelStyle}
            onSelectItem={selectItem} onToggleSelectItem={toggleSelectItem} onSelectBatch={selectBatch}
            onSelectCell={handleSelectCell}
            onSelectLockset={handleSelectLockset}
            selectedCellKey={activeCell ? `${activeCell.blockId}:${activeCell.colIdx}:${activeCell.cellIdx}` : undefined}
            selectedLocksetKey={activeLockset ? `${activeLockset.blockId}:${activeLockset.locksetIdx}` : undefined}
            onUpdateLocker={updateLocker} onUpdateLockerBlock={updateLockerBlock}
            onUpdateTextLabel={updateTextLabel} onAddTextLabel={addTextLabel}
            onUpdateShape={updateShape} onAddShape={addShape}
            onBulkMove={bulkMove}
            showDimensions={showDimensions} showDepth={showDepth} showBlockDimensions={showBlockDimensions}
            cadView={cadView}
            activeTool={activeTool} onZoomChange={setZoom} onToolChange={setActiveTool}
          />
        </main>

        {/* ── Right: Properties ────────────────────────────────── */}
        <aside className="w-56 border-l bg-white shrink-0 overflow-y-auto">
          <div className="p-3 border-b">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Properties</h2>
          </div>

          {isMultiSelect && (
            <AlignmentPanel count={selectedIds.length} onAlign={alignItems} />
          )}

          {/* ── Lockset tray properties (shown when a tray is clicked) ── */}
          {!isMultiSelect && selectedType === 'block' && selectedBlock && activeLockset && (
            <div className="p-3 space-y-3 text-xs text-gray-600 border-b">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-gray-500 uppercase tracking-wide text-[10px]">
                  Lockset Tray {activeLockset.locksetIdx + 1}
                </p>
                <button onClick={() => setSelectedLockset(null)}
                  className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
              </div>

              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Tray colour</p>
                <div className="flex items-center gap-1.5">
                  <ColorInput
                    value={selectedLocksetColor ?? selectedBlock.locksetColor ?? '#1e293b'}
                    onChange={(v) => updateLocksetColor(v)} />
                  {selectedLocksetColor && (
                    <button onClick={() => updateLocksetColor(undefined)}
                      title="Reset to block default" className="text-[10px] text-gray-400 hover:text-gray-600">↺</button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Cell-level properties (shown when a cell is clicked) ── */}
          {!isMultiSelect && selectedType === 'block' && selectedBlock && activeCell && selectedCellData && (
            <div className="p-3 space-y-3 text-xs text-gray-600 border-b">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-gray-500 uppercase tracking-wide text-[10px]">
                  Cell — col {activeCell.colIdx + 1} · row {activeCell.cellIdx + 1}
                </p>
                <button onClick={() => setSelectedCell(null)}
                  className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
              </div>

              {/* ── Label section ── */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Label</p>
                  <label className="flex items-center gap-1 text-[10px] text-gray-500 cursor-pointer">
                    <input type="checkbox"
                      checked={selectedCellData.showLabel !== false}
                      onChange={(e) => updateCell({ showLabel: e.target.checked })}
                      className="rounded" />
                    Show
                  </label>
                </div>
                <input value={selectedCellData.label ?? ''}
                  onChange={(e) => updateCell({ label: e.target.value })}
                  placeholder="e.g. L01"
                  disabled={selectedCellData.showLabel === false}
                  className="w-full border rounded px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:opacity-40" />
                {selectedCellData.showLabel !== false && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Label colour</span>
                    <div className="flex items-center gap-1.5">
                      <ColorInput
                        value={selectedCellData.labelColor ?? '#1e293b'}
                        onChange={(v) => updateCell({ labelColor: v })} />
                      {selectedCellData.labelColor && (
                        <button onClick={() => updateCell({ labelColor: undefined as unknown as string })}
                          title="Reset to global" className="text-[10px] text-gray-400 hover:text-gray-600">↺</button>
                      )}
                    </div>
                  </div>
                )}
                {selectedCellData.showLabel !== false && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-gray-500">Label position</span>
                      {selectedCellData.labelPosition && (
                        <button onClick={() => updateCell({ labelPosition: undefined as unknown as LabelPosition })}
                          title="Use block default" className="text-[10px] text-gray-400 hover:text-gray-600">↺</button>
                      )}
                    </div>
                    <PositionGrid
                      value={selectedCellData.labelPosition}
                      onChange={(p) => updateCell({ labelPosition: p as LabelPosition | undefined })}
                    />
                    {!selectedCellData.labelPosition && (
                      <p className="text-[10px] text-gray-400 mt-0.5">Using block default</p>
                    )}
                  </div>
                )}
              </div>

              {/* ── Dimension line ── */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Dimension</p>
                  <label className="flex items-center gap-1 text-[10px] text-gray-500 cursor-pointer">
                    <input type="checkbox"
                      checked={selectedCellData.showDimension !== false}
                      onChange={(e) => updateCell({ showDimension: e.target.checked })}
                      className="rounded" />
                    Show W×H
                  </label>
                </div>
                {selectedCellData.showDimension !== false && (
                  <div>
                    <p className="text-[10px] text-gray-400 mb-1">Dim position</p>
                    <div className="flex gap-1">
                      {(['top', 'center', 'bottom'] as const).map((pos) => (
                        <button key={pos} onClick={() => updateCell({ dimensionPosition: pos })}
                          className={`flex-1 py-0.5 rounded border text-[10px] transition-colors ${
                            (selectedCellData.dimensionPosition ?? 'bottom') === pos
                              ? 'bg-blue-100 border-blue-400 text-blue-700'
                              : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                          }`}>
                          {pos.charAt(0).toUpperCase() + pos.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* ── Height ── */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Height</p>
                  <label className="flex items-center gap-1 text-[10px] text-gray-500 cursor-pointer">
                    <input type="checkbox" checked={lockFrame} onChange={(e) => setLockFrame(e.target.checked)}
                      className="rounded" />
                    Lock frame
                  </label>
                </div>
                <div className="flex items-center gap-1">
                  <NumericInput min={50}
                    value={selectedCellData.heightMm}
                    onCommit={(v) => updateCell({ heightMm: v })}
                    className="flex-1 border rounded px-2 py-0.5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-400" />
                  <span className="text-[10px] text-gray-400">mm</span>
                </div>
                {lockFrame && <p className="text-[10px] text-gray-400 mt-0.5">Adjacent cell adjusts to keep block height.</p>}
              </div>

              {/* ── Corner radius ── */}
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Corner radius</p>
                <div className="flex items-center gap-1">
                  <NumericInput min={0} max={40}
                    value={selectedCellData.cornerRadius ?? selectedBlock.cellCornerRadius ?? 1}
                    onCommit={(v) => updateCell({ cornerRadius: v })}
                    className="flex-1 border rounded px-2 py-0.5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-400" />
                  <span className="text-[10px] text-gray-400">px</span>
                  {selectedCellData.cornerRadius != null && (
                    <button onClick={() => updateCell({ cornerRadius: undefined as unknown as number })}
                      title="Reset to block default" className="text-[10px] text-gray-400 hover:text-gray-600">↺</button>
                  )}
                </div>
              </div>

              {/* ── Door colour ── */}
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Door colour</p>
                <div className="flex items-center gap-1.5">
                  <ColorInput
                    value={selectedCellData.color ?? selectedBlock.color}
                    onChange={(v) => updateCell({ color: v })} />
                  {selectedCellData.color && (
                    <button onClick={() => updateCell({ color: undefined as unknown as string })}
                      className="text-[10px] text-gray-400 hover:text-gray-600" title="Reset to block default">↺</button>
                  )}
                </div>
              </div>

              <button onClick={deleteCell}
                className="w-full px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded text-xs hover:bg-red-100">
                Delete cell
              </button>
            </div>
          )}

          {/* ── Renumber banner (after a cell is deleted) ── */}
          {!isMultiSelect && selectedType === 'block' && selectedBlock && showRenumber && !activeCell && (
            <div className="mx-3 my-2 p-2 bg-amber-50 border border-amber-200 rounded text-xs">
              <p className="text-amber-700 mb-2">Cell deleted. Renumber remaining cells?</p>
              <div className="flex gap-1">
                <button onClick={() => renumberCells('L')}
                  className="flex-1 py-1 bg-amber-500 text-white rounded hover:bg-amber-600 text-[10px]">
                  Renumber (L01…)
                </button>
                <button onClick={() => setShowRenumber(false)}
                  className="px-2 py-1 border rounded text-gray-500 hover:bg-gray-50 text-[10px]">
                  Skip
                </button>
              </div>
            </div>
          )}

          {!isMultiSelect && selectedType === 'block' && selectedBlock && (
            <div className="p-3 space-y-3 text-xs text-gray-600">
              <div>
                <p className="font-medium text-gray-700">{selectedBlock.label}</p>
                <p className="text-gray-400">
                  {selectedBlock.config.columns.length} cols ·{' '}
                  {selectedBlock.config.columns.reduce((s, c) => s + c.cells.length, 0)} cells
                </p>
              </div>

              <div className="space-y-1.5">
                <p className="font-semibold text-gray-500 uppercase tracking-wide text-[10px]">Display</p>
                {([
                  ['showBlockLabel',     'Block name'],
                  ['showCellLabels',     'Cell labels'],
                  ['showCellDimensions', 'Cell dimensions'],
                  ['showCreaseLine',     'Door crease line'],
                  ['showDepthLabel',     'Depth annotation'],
                ] as [keyof typeof selectedBlock, string][]).map(([key, label]) => (
                  <label key={key} className="flex items-center justify-between cursor-pointer">
                    <span className="text-gray-500 text-xs">{label}</span>
                    <input type="checkbox"
                      checked={(selectedBlock[key] as boolean | undefined) !== false}
                      onChange={(e) => updateLockerBlock({ ...selectedBlock, [key]: e.target.checked })}
                      className="w-4 h-4 accent-blue-500 cursor-pointer" />
                  </label>
                ))}
              </div>

              {/* ── Size annotations (W / H dimension lines outside block) ── */}
              <div className="space-y-2 pt-2 border-t">
                <p className="font-semibold text-gray-500 uppercase tracking-wide text-[10px]">Size annotations</p>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 text-xs">Width line</span>
                  <div className="flex items-center gap-1.5">
                    <input type="checkbox"
                      checked={selectedBlock.showWidthAnnotation === true}
                      onChange={(e) => updateLockerBlock({ ...selectedBlock, showWidthAnnotation: e.target.checked })}
                      className="w-4 h-4 accent-blue-500 cursor-pointer" />
                    {selectedBlock.showWidthAnnotation && (
                      <select
                        value={selectedBlock.widthAnnotationSide ?? 'bottom'}
                        onChange={(e) => updateLockerBlock({ ...selectedBlock, widthAnnotationSide: e.target.value as 'top' | 'bottom' })}
                        className="border rounded px-1 py-0.5 text-[10px] focus:outline-none">
                        <option value="bottom">Bottom</option>
                        <option value="top">Top</option>
                      </select>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 text-xs">Height line</span>
                  <div className="flex items-center gap-1.5">
                    <input type="checkbox"
                      checked={selectedBlock.showHeightAnnotation === true}
                      onChange={(e) => updateLockerBlock({ ...selectedBlock, showHeightAnnotation: e.target.checked })}
                      className="w-4 h-4 accent-blue-500 cursor-pointer" />
                    {selectedBlock.showHeightAnnotation && (
                      <select
                        value={selectedBlock.heightAnnotationSide ?? 'left'}
                        onChange={(e) => updateLockerBlock({ ...selectedBlock, heightAnnotationSide: e.target.value as 'left' | 'right' })}
                        className="border rounded px-1 py-0.5 text-[10px] focus:outline-none">
                        <option value="left">Left</option>
                        <option value="right">Right</option>
                      </select>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 text-xs">Depth label</span>
                  <input type="checkbox"
                    checked={selectedBlock.showDepthAnnotation === true}
                    onChange={(e) => updateLockerBlock({ ...selectedBlock, showDepthAnnotation: e.target.checked })}
                    className="w-4 h-4 accent-blue-500 cursor-pointer" />
                </div>
                {(selectedBlock.showWidthAnnotation || selectedBlock.showHeightAnnotation || selectedBlock.showDepthAnnotation) && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 text-xs">Font size (px)</span>
                    <NumericInput min={6} max={24}
                      value={selectedBlock.sizeAnnotationFontSize ?? 9}
                      onCommit={(v) => updateLockerBlock({ ...selectedBlock, sizeAnnotationFontSize: v })}
                      className="w-16 border rounded px-1.5 py-0.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-400" />
                  </div>
                )}
              </div>

              {/* ── Label style (block-level override of global) ── */}
              <div className="space-y-2 pt-2 border-t">
                <p className="font-semibold text-gray-500 uppercase tracking-wide text-[10px]">Label style</p>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 text-xs">Font size (px, 0=auto)</span>
                  <NumericInput min={0} max={32}
                    value={selectedBlock.labelStyle?.fontSize ?? labelStyle.fontSize}
                    onCommit={(v) => updateLockerBlock({ ...selectedBlock, labelStyle: { ...selectedBlock.labelStyle, fontSize: v } })}
                    className="w-16 border rounded px-1.5 py-0.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-400" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 text-xs">Label colour</span>
                  <div className="flex items-center gap-1.5">
                    <ColorInput
                      value={selectedBlock.labelStyle?.color ?? labelStyle.color}
                      onChange={(v) => updateLockerBlock({ ...selectedBlock, labelStyle: { ...selectedBlock.labelStyle, color: v } })} />
                    {selectedBlock.labelStyle?.color && (
                      <button onClick={() => { const ls = { ...selectedBlock.labelStyle }; delete ls.color; updateLockerBlock({ ...selectedBlock, labelStyle: ls }) }}
                        title="Reset to global" className="text-[10px] text-gray-400 hover:text-gray-600">↺</button>
                    )}
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-gray-500 text-xs">Label position</span>
                    {selectedBlock.labelStyle?.position && (
                      <button onClick={() => { const ls = { ...selectedBlock.labelStyle }; delete ls.position; updateLockerBlock({ ...selectedBlock, labelStyle: ls }) }}
                        title="Reset to global" className="text-[10px] text-gray-400 hover:text-gray-600">↺ Reset</button>
                    )}
                  </div>
                  <PositionGrid
                    value={selectedBlock.labelStyle?.position}
                    onChange={(p) => updateLockerBlock({ ...selectedBlock, labelStyle: { ...selectedBlock.labelStyle, position: p } })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <p className="font-semibold text-gray-500 uppercase tracking-wide text-[10px]">Colours</p>
                <ColorRow label="Door"    value={selectedBlock.color}
                  onChange={(v) => updateBlockColor(selectedBlock, 'color', v)} />
                <ColorRow label="Frame"   value={selectedBlock.frameColor   ?? '#334155'}
                  onChange={(v) => updateBlockColor(selectedBlock, 'frameColor', v)} />
                <ColorRow label="Lockset Tray" value={selectedBlock.locksetColor ?? '#1e293b'}
                  onChange={(v) => updateBlockColor(selectedBlock, 'locksetColor', v)} />
                <ColorRow label="Depth"
                  value={selectedBlock.depthColor ?? selectedBlock.frameColor ?? '#334155'}
                  onChange={(v) => updateLockerBlock({ ...selectedBlock, depthColor: v })} />
              </div>

              {/* All-cells corner radius */}
              <div className="space-y-1.5 pt-2 border-t">
                <p className="font-semibold text-gray-500 uppercase tracking-wide text-[10px]">Corner radius</p>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 text-xs">All doors (px)</span>
                  <NumericInput min={0} max={40}
                    value={selectedBlock.cellCornerRadius ?? 1}
                    onCommit={(v) => updateLockerBlock({ ...selectedBlock, cellCornerRadius: v })}
                    className="w-16 border rounded px-1.5 py-0.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-400" />
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t">
                <p className="font-semibold text-gray-500 uppercase tracking-wide text-[10px]">Border</p>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 text-xs">Width (px)</span>
                  <NumericInput min={0} max={12}
                    value={selectedBlock.borderWidth ?? 0}
                    onCommit={(v) => updateLockerBlock({ ...selectedBlock, borderWidth: v })}
                    className="w-16 border rounded px-1.5 py-0.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-400" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 text-xs">Radius (px)</span>
                  <NumericInput min={0} max={40}
                    value={selectedBlock.borderRadius ?? 0}
                    onCommit={(v) => updateLockerBlock({ ...selectedBlock, borderRadius: v })}
                    className="w-16 border rounded px-1.5 py-0.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-400" />
                </div>
                <ColorRow label="Colour"
                  value={selectedBlock.borderColor ?? '#1e293b'}
                  onChange={(v) => updateLockerBlock({ ...selectedBlock, borderColor: v })} />
              </div>

              <div className="space-y-2 pt-2 border-t">
                <p className="font-semibold text-gray-500 uppercase tracking-wide text-[10px]">Legs</p>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 text-xs">Height (mm)</span>
                  <NumericInput min={0} max={300}
                    value={selectedBlock.legsHeightMm ?? 0}
                    onCommit={(v) => updateLockerBlock({ ...selectedBlock, legsHeightMm: v })}
                    className="w-16 border rounded px-1.5 py-0.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-400" />
                </div>
                {(selectedBlock.legsHeightMm ?? 0) > 0 && (<>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 text-xs">Width (mm)</span>
                    <NumericInput min={20} max={200}
                      value={selectedBlock.legsWidthMm ?? 50}
                      onCommit={(v) => updateLockerBlock({ ...selectedBlock, legsWidthMm: v })}
                      className="w-16 border rounded px-1.5 py-0.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-400" />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 text-xs">Depth (mm)</span>
                    <NumericInput min={10} max={1000}
                      value={selectedBlock.legsDepthMm ?? selectedBlock.config.depthMm}
                      onCommit={(v) => updateLockerBlock({ ...selectedBlock, legsDepthMm: v })}
                      className="w-16 border rounded px-1.5 py-0.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-400" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 text-xs">Inset (mm)</span>
                    <NumericInput min={0} max={500}
                      value={selectedBlock.legsInsetMm ?? Math.round(Math.min(selectedBlock.config.leftMarginMm, selectedBlock.config.rightMarginMm) / 2)}
                      onCommit={(v) => updateLockerBlock({ ...selectedBlock, legsInsetMm: v })}
                      className="w-16 border rounded px-1.5 py-0.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-400" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 text-xs">Radius (px)</span>
                    <NumericInput min={0} max={40}
                      value={selectedBlock.legsCornerRadius ?? 2}
                      onCommit={(v) => updateLockerBlock({ ...selectedBlock, legsCornerRadius: v })}
                      className="w-16 border rounded px-1.5 py-0.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-400" />
                  </div>
                  <ColorRow label="Colour"
                    value={selectedBlock.legsColor ?? selectedBlock.frameColor ?? '#334155'}
                    onChange={(v) => updateLockerBlock({ ...selectedBlock, legsColor: v })} />
                </>)}
              </div>

              <div className="grid grid-cols-2 gap-1 text-gray-400 pt-2 border-t">
                <span>Top:</span>   <span>{selectedBlock.config.topHeightMm}mm</span>
                <span>Base:</span>  <span>{selectedBlock.config.baseHeightMm}mm</span>
                <span>Depth:</span> <span>{selectedBlock.config.depthMm}mm</span>
              </div>

              <button onClick={() => setEditingBlock(selectedBlock)}
                className="w-full px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded text-xs hover:bg-blue-100">
                Edit block…
              </button>

              {/* Save as template */}
              {savingTpl ? (
                <div className="flex gap-1">
                  <input
                    autoFocus
                    placeholder="Template name…"
                    value={tplName}
                    onChange={(e) => setTplName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveTemplate()
                      if (e.key === 'Escape') setSavingTpl(false)
                    }}
                    className="flex-1 border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                  <button onClick={handleSaveTemplate}
                    className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700">
                    ✓
                  </button>
                  <button onClick={() => setSavingTpl(false)}
                    className="px-2 py-1 border rounded text-xs text-gray-500 hover:bg-gray-50">
                    ✕
                  </button>
                </div>
              ) : (
                <button onClick={() => { setTplName(selectedBlock.label); setSavingTpl(true) }}
                  className="w-full px-3 py-1.5 bg-gray-50 text-gray-600 border border-gray-200 rounded text-xs hover:bg-gray-100">
                  ☆ Save as template
                </button>
              )}

              <button onClick={() => deleteLockerBlock(selectedBlock.id)}
                className="w-full px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded text-xs hover:bg-red-100">
                Delete block
              </button>
            </div>
          )}

          {!isMultiSelect && selectedType === 'locker' && (
            <PropertiesPanel locker={selectedLocker} showDepth={showDepth} onChange={updateLocker} onDelete={deleteLocker} />
          )}

          {!isMultiSelect && selectedType === 'textLabel' && selectedTextLabel && (
            <TextLabelPanel label={selectedTextLabel} onChange={updateTextLabel} onDelete={deleteTextLabel} />
          )}

          {!isMultiSelect && selectedType === 'shape' && selectedShape && (
            <ShapePanel shape={selectedShape} onChange={updateShape} onDelete={deleteShape} />
          )}

          {!selectedId && !isMultiSelect && (
            <p className="p-4 text-xs text-gray-400">
              Select an item to edit its properties.<br />
              <span className="text-gray-300">Ctrl+click to multi-select · Ctrl+A to select all</span>
            </p>
          )}
        </aside>
      </div>

      {/* Edit block modal — key forces full remount when target changes */}
      {editingBlock && (
        <LockerCreateForm
          key={editingBlock.id}
          editBlock={editingBlock}
          onUpdate={(updated) => { updateLockerBlock(updated); setEditingBlock(null) }}
          onClose={() => setEditingBlock(null)}
        />
      )}

      {/* Right-click context menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x} y={contextMenu.y}
          hasSelection={selectedIds.length > 0}
          hasClipboard={hasClipboard}
          onClose={() => setContextMenu(null)}
          onCopy={copySelected}
          onPaste={paste}
          onDuplicate={duplicate}
          onDelete={deleteSelected}
          onSelectAll={selectAll}
        />
      )}
    </div>
  )
}
