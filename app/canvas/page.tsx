'use client'
// app/canvas/page.tsx

import dynamic from 'next/dynamic'
import { useRef, useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useCanvasStore, type AlignmentType } from '@/lib/store'
import { useTemplateStore } from '@/lib/template-store'
import { useLockerTemplateStore } from '@/lib/locker-template-store'
import PropertiesPanel from '@/components/editor/PropertiesPanel'
import Toolbar from '@/components/editor/Toolbar'
import LockerCreateForm from '@/components/editor/LockerCreateForm'
import { type LockerBlock, type LockerCell, type OfficeInfo, type LabelPosition } from '@/types'
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

// ── Number input that lets the user type freely ───────────────────
// Keeps a local draft string; only commits to the store on blur/Enter.
function DraftNumberInput({
  value, min, max, step, onCommit, className,
}: {
  value: number; min: number; max: number; step?: number
  onCommit: (v: number) => void; className?: string
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const display = draft ?? String(value)
  return (
    <input
      type="number" min={min} max={max} step={step}
      value={display}
      className={className}
      onFocus={(e) => { setDraft(String(value)); e.target.select() }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const v = parseInt(draft ?? '', 10)
        if (!isNaN(v) && v >= min && v <= max) onCommit(v)
        setDraft(null)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        if (e.key === 'Escape') setDraft(null)
      }}
    />
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
function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-500 text-xs">{label}</span>
      <div className="flex items-center gap-1.5">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)}
          className="w-6 h-6 border rounded cursor-pointer" />
        <span className="text-[10px] font-mono text-gray-400">{value}</span>
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

// ── Main editor ───────────────────────────────────────────────────
function CanvasEditor() {
  const searchParams   = useSearchParams()
  const layoutId       = searchParams.get('layoutId')
  const projectId      = searchParams.get('projectId')
  const canvasBoardRef  = useRef<CanvasBoardHandle>(null)

  const [activeTool, setActiveTool]   = useState<'select' | 'pan'>('select')
  const [zoom, setZoom]               = useState(1)
  const [saving, setSaving]           = useState(false)
  const [editingBlock, setEditingBlock] = useState<LockerBlock | null>(null)
  const savedLayoutId = useRef<string | null>(layoutId)
  const savedProjectId = useRef<string | null>(projectId)

  const lockers        = useCanvasStore((s) => s.lockers)
  const lockerBlocks   = useCanvasStore((s) => s.lockerBlocks)
  const room           = useCanvasStore((s) => s.room)
  const selectedId     = useCanvasStore((s) => s.selectedId)
  const selectedType   = useCanvasStore((s) => s.selectedType)
  const selectedIds    = useCanvasStore((s) => s.selectedIds)
  const showDimensions = useCanvasStore((s) => s.showDimensions)
  const showDepth      = useCanvasStore((s) => s.showDepth)
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
  const selectItem        = useCanvasStore((s) => s.selectItem)
  const toggleSelectItem  = useCanvasStore((s) => s.toggleSelectItem)
  const selectBatch       = useCanvasStore((s) => s.selectBatch)
  const bulkMove          = useCanvasStore((s) => s.bulkMove)
  const selectAll         = useCanvasStore((s) => s.selectAll)
  const alignItems        = useCanvasStore((s) => s.alignItems)
  const setShowDimensions = useCanvasStore((s) => s.setShowDimensions)
  const setShowDepth      = useCanvasStore((s) => s.setShowDepth)
  const setLabelStyle     = useCanvasStore((s) => s.setLabelStyle)
  const setOfficeInfo     = useCanvasStore((s) => s.setOfficeInfo)
  const setProjectName    = useCanvasStore((s) => s.setProjectName)
  const setRoom           = useCanvasStore((s) => s.setRoom)
  const getCanvasData     = useCanvasStore((s) => s.getCanvasData)
  const loadCanvasData    = useCanvasStore((s) => s.loadCanvasData)
  const markSaved         = useCanvasStore((s) => s.markSaved)
  const resetCanvas       = useCanvasStore((s) => s.resetCanvas)

  const selectedLocker = selectedType === 'locker' ? lockers.find((l) => l.id === selectedId) ?? null : null
  const selectedBlock  = selectedType === 'block'  ? lockerBlocks.find((b) => b.id === selectedId) ?? null : null

  // Cell-level selection (within a block)
  const [selectedCell, setSelectedCell] = useState<{ blockId: string; colIdx: number; cellIdx: number } | null>(null)
  const [lockFrame, setLockFrame]       = useState(true)
  const [showRenumber, setShowRenumber] = useState(false)  // offer renumber after delete

  // Lockset tray selection (within a block)
  const [selectedLockset, setSelectedLockset] = useState<{ blockId: string; locksetIdx: number } | null>(null)

  // Clear sub-selections whenever the block selection changes
  useEffect(() => { setSelectedCell(null); setShowRenumber(false); setSelectedLockset(null) }, [selectedId])

  const handleSelectCell = useCallback((blockId: string, colIdx: number, cellIdx: number) => {
    if (selectedId !== blockId) selectItem(blockId, 'block')
    setSelectedLockset(null)
    setSelectedCell({ blockId, colIdx, cellIdx })
  }, [selectedId, selectItem])

  const handleSelectLockset = useCallback((blockId: string, locksetIdx: number) => {
    if (selectedId !== blockId) selectItem(blockId, 'block')
    setSelectedCell(null)
    setSelectedLockset({ blockId, locksetIdx })
  }, [selectedId, selectItem])

  const selectedLocksetColor = selectedLockset && selectedBlock
    ? selectedBlock.locksets?.[selectedLockset.locksetIdx]?.color ?? null
    : null

  const updateLocksetColor = useCallback((color: string | undefined) => {
    if (!selectedLockset || !selectedBlock) return
    const { locksetIdx } = selectedLockset
    const existing = selectedBlock.locksets ?? []
    const updated  = [...existing]
    while (updated.length <= locksetIdx) updated.push({})
    updated[locksetIdx] = color !== undefined ? { ...updated[locksetIdx], color } : {}
    updateLockerBlock({ ...selectedBlock, locksets: updated })
  }, [selectedLockset, selectedBlock, updateLockerBlock])

  const selectedCellData = selectedCell && selectedBlock
    ? selectedBlock.config.columns[selectedCell.colIdx]?.cells[selectedCell.cellIdx] ?? null
    : null

  const updateCell = useCallback((changes: Partial<LockerCell>) => {
    if (!selectedCell || !selectedBlock || !selectedCellData) return
    const { colIdx, cellIdx } = selectedCell

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
  }, [selectedCell, selectedBlock, selectedCellData, lockFrame, updateLockerBlock])

  const deleteCell = useCallback(() => {
    if (!selectedCell || !selectedBlock) return
    const { colIdx, cellIdx } = selectedCell
    const newCols = selectedBlock.config.columns
      .map((col, ci) => ci === colIdx
        ? { ...col, cells: col.cells.filter((_, ri) => ri !== cellIdx) }
        : col)
      .filter((col) => col.cells.length > 0)
    setSelectedCell(null)
    setShowRenumber(true)
    updateLockerBlock({ ...selectedBlock, config: { ...selectedBlock.config, columns: newCols } })
  }, [selectedCell, selectedBlock, updateLockerBlock])

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

  // Ctrl+A = select all
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') { e.preventDefault(); selectAll() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectAll])

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
    } catch (err) {
      console.error('Save failed:', err)
    } finally {
      setSaving(false)
    }
  }, [saving, getCanvasData, projectName, markSaved])

  useEffect(() => {
    if (!isDirty) return
    const timer = setTimeout(handleSave, 30_000)
    return () => clearTimeout(timer)
  }, [isDirty, handleSave])

  const getStageDataUrl = useCallback((opts?: ExportImageOpts) => captureCanvas(opts), [])
  const updateBlockColor = (block: LockerBlock, key: 'color' | 'frameColor' | 'locksetColor' | 'depthColor', value: string) =>
    updateLockerBlock({ ...block, [key]: value })
  const isMultiSelect = selectedIds.length >= 2

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-50">
      <Toolbar
        activeTool={activeTool} onToolChange={setActiveTool}
        zoom={zoom}
        onSave={handleSave} saving={saving} isDirty={isDirty}
        canvasData={getCanvasData()} getStageDataUrl={getStageDataUrl}
        projectName={projectName} onRenameProject={setProjectName}
        showDimensions={showDimensions} onSelectAll={selectAll}
      />

      <div className="flex flex-1 overflow-hidden">

        {/* ── Left sidebar ─────────────────────────────────────── */}
        <aside className="w-52 border-r bg-white flex flex-col shrink-0 overflow-y-auto">
          <div className="p-3 border-b">
            <LockerCreateForm onAdd={addLockerBlock} />
          </div>

          {/* Quick add — lockers */}
          <div className="p-3 border-b">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Quick add — lockers</h2>
            <div className="space-y-1.5">
              {lockerTpls.map((t) => (
                <div key={t.id} className="group">
                  {editingLTplId === t.id ? (
                    <div className="border rounded p-1.5 space-y-1 bg-blue-50">
                      {([['widthMm','W'],['heightMm','H'],['depthMm','D']] as [keyof typeof t, string][]).map(([k, lbl]) => (
                        <div key={k} className="flex items-center gap-1">
                          <span className="text-[10px] text-gray-500 w-5 shrink-0">{lbl}</span>
                          <input type="number" min={50} step={10}
                            value={t[k] as number}
                            onChange={(e) => updateLockerTpl(t.id, { [k]: Math.max(50, Number(e.target.value)) })}
                            className="min-w-0 flex-1 border rounded px-1 py-0.5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-400" />
                          <span className="text-[10px] text-gray-400 shrink-0">mm</span>
                        </div>
                      ))}
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-gray-500 w-14 shrink-0">Color</span>
                        <input type="color" value={t.color}
                          onChange={(e) => updateLockerTpl(t.id, { color: e.target.value })}
                          className="w-7 h-5 rounded cursor-pointer border" />
                      </div>
                      <button onClick={() => setEditingLTplId(null)}
                        className="w-full mt-0.5 py-0.5 bg-blue-600 text-white text-[10px] rounded hover:bg-blue-700">Done</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <button onClick={() => addLocker(t)}
                        className="flex-1 text-left px-2 py-1.5 rounded border text-xs hover:bg-blue-50 hover:border-blue-300 transition-colors">
                        <div className="font-medium text-gray-700">{t.widthMm}W × {t.heightMm}H</div>
                        <div className="text-gray-400">Depth {t.depthMm}mm</div>
                      </button>
                      <button onClick={() => setEditingLTplId(t.id)} title="Edit"
                        className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-blue-500 transition-opacity text-sm">✎</button>
                      <button onClick={() => deleteLockerTpl(t.id)} title="Remove"
                        className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-opacity">×</button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Add new locker template */}
            {addingLTpl ? (
              <div className="border rounded p-1.5 space-y-1 mt-2 bg-gray-50">
                {([['widthMm','W'],['heightMm','H'],['depthMm','D']] as [keyof typeof newLTpl, string][]).map(([k, lbl]) => (
                  <div key={k} className="flex items-center gap-1">
                    <span className="text-[10px] text-gray-500 w-5 shrink-0">{lbl}</span>
                    <input type="number" min={50} step={10}
                      value={newLTpl[k] as number}
                      onChange={(e) => setNewLTpl((p) => ({ ...p, [k]: Math.max(50, Number(e.target.value)) }))}
                      className="min-w-0 flex-1 border rounded px-1 py-0.5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-400" />
                    <span className="text-[10px] text-gray-400 shrink-0">mm</span>
                  </div>
                ))}
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-gray-500 w-14 shrink-0">Color</span>
                  <input type="color" value={newLTpl.color}
                    onChange={(e) => setNewLTpl((p) => ({ ...p, color: e.target.value }))}
                    className="w-7 h-5 rounded cursor-pointer border" />
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
          </div>

          {/* Block templates */}
          <div className="p-3 border-b">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Quick add — block templates</h2>
            {templates.length === 0 ? (
              <p className="text-[10px] text-gray-400">
                Select a block on canvas and click<br />"Save as template" to add it here.
              </p>
            ) : (
              <div className="space-y-1.5">
                {templates.map((tpl) => (
                  <div key={tpl.id} className="flex items-center gap-1 group">
                    <button
                      onClick={() => addLockerBlock({ ...tpl.block, x: 80, y: 80 })}
                      className="flex-1 text-left px-2 py-1.5 rounded border text-xs hover:bg-blue-50 hover:border-blue-300 transition-colors"
                    >
                      <div className="font-medium text-gray-700 truncate">{tpl.name}</div>
                      <div className="text-gray-400">
                        {tpl.block.config.columns.length} col ·{' '}
                        {tpl.block.config.columns.reduce((s, c) => s + c.cells.length, 0)} cells
                      </div>
                    </button>
                    <button
                      onClick={() => deleteTemplate(tpl.id)}
                      title="Remove template"
                      className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-opacity"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Room dimensions */}
          <div className="p-3 border-b space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Room</p>
            {([
              ['widthMm',  'Width',     1000, 50000, 100],
              ['depthMm',  'Depth',     1000, 50000, 100],
            ] as [keyof typeof room, string, number, number, number][]).map(([key, label, min, max, step]) => (
              <div key={key} className="flex items-center justify-between gap-1">
                <span className="text-xs text-gray-500 w-10 shrink-0">{label}</span>
                <DraftNumberInput
                  value={room[key] as number}
                  min={min} max={max} step={step}
                  onCommit={(v) => setRoom({ [key]: v })}
                  className="flex-1 border rounded px-2 py-0.5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
                <span className="text-[10px] text-gray-400 w-6 shrink-0">mm</span>
              </div>
            ))}
            <div className="flex items-center justify-between gap-1">
              <span className="text-xs text-gray-500 w-10 shrink-0">Scale</span>
              <select
                value={room.scale}
                onChange={(e) => setRoom({ scale: Number(e.target.value) })}
                className="flex-1 border rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
              >
                <option value={0.05}>1:20 (0.05)</option>
                <option value={0.1}>1:10 (0.1)</option>
                <option value={0.2}>1:5 (0.2)</option>
                <option value={0.5}>1:2 (0.5)</option>
                <option value={1}>1:1 (1.0)</option>
              </select>
            </div>
            <div className="flex items-center justify-between gap-1">
              <span className="text-xs text-gray-500 w-10 shrink-0">Grid</span>
              <DraftNumberInput
                value={room.gridSizeMm}
                min={10} max={1000} step={10}
                onCommit={(v) => setRoom({ gridSizeMm: v })}
                className="flex-1 border rounded px-2 py-0.5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
              <span className="text-[10px] text-gray-400 w-6 shrink-0">mm</span>
            </div>
          </div>

          {/* Label style */}
          <div className="p-3 border-b space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Label style</p>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Font size</span>
              <div className="flex items-center gap-1">
                <input type="number" min={0} max={32} step={1}
                  value={labelStyle.fontSize}
                  onChange={(e) => setLabelStyle({ fontSize: Number(e.target.value) })}
                  className="w-14 border rounded px-1.5 py-0.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-400" />
                <span className="text-[10px] text-gray-400">px (0=auto)</span>
              </div>
            </div>
            <ColorRow label="Label colour" value={labelStyle.color}
              onChange={(v) => setLabelStyle({ color: v })} />
            <div>
              <p className="text-xs text-gray-500 mb-1">Label position</p>
              <div className="grid grid-cols-3 gap-1">
                {([
                  ['top-left',  'Top L'],
                  ['center',    'Center'],
                  ['top-right', 'Top R'],
                ] as [LabelPosition, string][]).map(([pos, lbl]) => (
                  <button key={pos} onClick={() => setLabelStyle({ position: pos })}
                    className={`py-1 rounded border text-[10px] transition-colors ${
                      labelStyle.position === pos
                        ? 'bg-blue-100 border-blue-400 text-blue-700 font-medium'
                        : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                    }`}>
                    {lbl}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Office info */}
          <OfficeInfoEditor info={officeInfo} onChange={(k, v) => setOfficeInfo({ [k]: v })} />

          <div className="p-3 border-t mt-auto space-y-2">
            <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
              <input type="checkbox" checked={showDepth}
                onChange={(e) => setShowDepth(e.target.checked)} className="rounded" />
              Show 3D depth
            </label>
            <div className="text-xs text-gray-400 text-center">
              {isDirty ? '● Unsaved changes' : '✓ Saved'}
            </div>
          </div>
        </aside>

        {/* ── Canvas ───────────────────────────────────────────── */}
        <main className="flex-1 overflow-hidden">
          <CanvasBoard
            ref={canvasBoardRef}
            lockers={lockers} lockerBlocks={lockerBlocks} room={room}
            selectedId={selectedId} selectedIds={selectedIds}
            labelStyle={labelStyle}
            onSelectItem={selectItem} onToggleSelectItem={toggleSelectItem} onSelectBatch={selectBatch}
            onSelectCell={handleSelectCell}
            onSelectLockset={handleSelectLockset}
            selectedCellKey={selectedCell ? `${selectedCell.blockId}:${selectedCell.colIdx}:${selectedCell.cellIdx}` : undefined}
            selectedLocksetKey={selectedLockset ? `${selectedLockset.blockId}:${selectedLockset.locksetIdx}` : undefined}
            onUpdateLocker={updateLocker} onUpdateLockerBlock={updateLockerBlock}
            onBulkMove={bulkMove}
            showDimensions={showDimensions} showDepth={showDepth} activeTool={activeTool} onZoomChange={setZoom}
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
          {!isMultiSelect && selectedType === 'block' && selectedBlock && selectedLockset && (
            <div className="p-3 space-y-3 text-xs text-gray-600 border-b">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-gray-500 uppercase tracking-wide text-[10px]">
                  Lockset Tray {selectedLockset.locksetIdx + 1}
                </p>
                <button onClick={() => setSelectedLockset(null)}
                  className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
              </div>

              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Tray colour</p>
                <div className="flex items-center gap-1.5">
                  <input type="color"
                    value={selectedLocksetColor ?? selectedBlock.locksetColor ?? '#1e293b'}
                    onChange={(e) => updateLocksetColor(e.target.value)}
                    className="w-6 h-6 rounded cursor-pointer border" />
                  <span className="text-[10px] font-mono text-gray-400">
                    {selectedLocksetColor ?? selectedBlock.locksetColor ?? '#1e293b'}
                  </span>
                  {selectedLocksetColor && (
                    <button onClick={() => updateLocksetColor(undefined)}
                      title="Reset to block default" className="text-[10px] text-gray-400 hover:text-gray-600">↺</button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Cell-level properties (shown when a cell is clicked) ── */}
          {!isMultiSelect && selectedType === 'block' && selectedBlock && selectedCell && selectedCellData && (
            <div className="p-3 space-y-3 text-xs text-gray-600 border-b">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-gray-500 uppercase tracking-wide text-[10px]">
                  Cell — col {selectedCell.colIdx + 1} · row {selectedCell.cellIdx + 1}
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
                      <input type="color"
                        value={selectedCellData.labelColor ?? '#1e293b'}
                        onChange={(e) => updateCell({ labelColor: e.target.value })}
                        className="w-6 h-6 rounded cursor-pointer border" />
                      {selectedCellData.labelColor && (
                        <button onClick={() => updateCell({ labelColor: undefined as unknown as string })}
                          title="Reset to global" className="text-[10px] text-gray-400 hover:text-gray-600">↺</button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* ── Dimension line ── */}
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
                  <input type="number" min={50} step={25}
                    value={selectedCellData.heightMm}
                    onChange={(e) => { const v = parseInt(e.target.value, 10); if (!isNaN(v) && v >= 50) updateCell({ heightMm: v }) }}
                    className="flex-1 border rounded px-2 py-0.5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-400" />
                  <span className="text-[10px] text-gray-400">mm</span>
                </div>
                {lockFrame && <p className="text-[10px] text-gray-400 mt-0.5">Adjacent cell adjusts to keep block height.</p>}
              </div>

              {/* ── Corner radius ── */}
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Corner radius</p>
                <div className="flex items-center gap-1">
                  <input type="number" min={0} max={40} step={1}
                    value={selectedCellData.cornerRadius ?? selectedBlock.cellCornerRadius ?? 1}
                    onChange={(e) => updateCell({ cornerRadius: Math.max(0, Number(e.target.value)) })}
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
                  <input type="color"
                    value={selectedCellData.color ?? selectedBlock.color}
                    onChange={(e) => updateCell({ color: e.target.value })}
                    className="w-6 h-6 rounded cursor-pointer border" />
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
          {!isMultiSelect && selectedType === 'block' && selectedBlock && showRenumber && !selectedCell && (
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
                  <input type="number" min={0} max={40} step={1}
                    value={selectedBlock.cellCornerRadius ?? 1}
                    onChange={(e) => updateLockerBlock({ ...selectedBlock, cellCornerRadius: Math.max(0, Number(e.target.value)) })}
                    className="w-16 border rounded px-1.5 py-0.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-400" />
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t">
                <p className="font-semibold text-gray-500 uppercase tracking-wide text-[10px]">Border</p>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 text-xs">Width (px)</span>
                  <input type="number" min={0} max={12} step={1}
                    value={selectedBlock.borderWidth ?? 0}
                    onChange={(e) => updateLockerBlock({ ...selectedBlock, borderWidth: Math.max(0, Number(e.target.value)) })}
                    className="w-16 border rounded px-1.5 py-0.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-400" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 text-xs">Radius (px)</span>
                  <input type="number" min={0} max={40} step={1}
                    value={selectedBlock.borderRadius ?? 0}
                    onChange={(e) => updateLockerBlock({ ...selectedBlock, borderRadius: Math.max(0, Number(e.target.value)) })}
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
                  <input type="number" min={0} max={300} step={10}
                    value={selectedBlock.legsHeightMm ?? 0}
                    onChange={(e) => updateLockerBlock({ ...selectedBlock, legsHeightMm: Math.max(0, Number(e.target.value)) })}
                    className="w-16 border rounded px-1.5 py-0.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-400" />
                </div>
                {(selectedBlock.legsHeightMm ?? 0) > 0 && (<>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 text-xs">Width (mm)</span>
                    <input type="number" min={20} max={200} step={5}
                      value={selectedBlock.legsWidthMm ?? 50}
                      onChange={(e) => updateLockerBlock({ ...selectedBlock, legsWidthMm: Math.max(20, Number(e.target.value)) })}
                      className="w-16 border rounded px-1.5 py-0.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-400" />
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 text-xs">Depth (mm)</span>
                    <input type="number" min={10} max={1000} step={10}
                      value={selectedBlock.legsDepthMm ?? selectedBlock.config.depthMm}
                      onChange={(e) => updateLockerBlock({ ...selectedBlock, legsDepthMm: Math.max(10, Number(e.target.value)) })}
                      className="w-16 border rounded px-1.5 py-0.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-400" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 text-xs">Inset (mm)</span>
                    <input type="number" min={0} max={500} step={5}
                      value={selectedBlock.legsInsetMm ?? Math.round(Math.min(selectedBlock.config.leftMarginMm, selectedBlock.config.rightMarginMm) / 2)}
                      onChange={(e) => updateLockerBlock({ ...selectedBlock, legsInsetMm: Math.max(0, Number(e.target.value)) })}
                      className="w-16 border rounded px-1.5 py-0.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-400" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 text-xs">Radius (px)</span>
                    <input type="number" min={0} max={40} step={1}
                      value={selectedBlock.legsCornerRadius ?? 2}
                      onChange={(e) => updateLockerBlock({ ...selectedBlock, legsCornerRadius: Math.max(0, Number(e.target.value)) })}
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
    </div>
  )
}
