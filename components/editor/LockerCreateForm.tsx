'use client'
// components/editor/LockerCreateForm.tsx
// Handles both Create (trigger button) and Edit (modal-only) modes.
// In edit mode, pass `editBlock` + `onUpdate` + `onClose` and omit `onAdd`.
// Use key={block.id} on the parent to remount when switching edit targets.

import { useState, useCallback, useMemo } from 'react'
import { nanoid } from 'nanoid'
import {
  DEFAULT_BLOCK_CONFIG,
  blockWidthMm,
  blockHeightMm,
  type LockerBlock,
  type LockerBlockConfig,
  type LockerColumn,
  type LockerCell,
  type LocksetPosition,
} from '@/types'

interface Props {
  // Create mode
  onAdd?: (block: Omit<LockerBlock, 'id'>) => void
  // Edit mode
  editBlock?: LockerBlock
  onUpdate?: (block: LockerBlock) => void
  onClose?: () => void
}

// ── UI atoms ──────────────────────────────────────────────────────

function NumInput({
  label, sublabel, value, onChange, min = 1, unit = 'mm', readOnly = false,
}: {
  label: string; sublabel?: string; value: number
  onChange?: (v: number) => void; min?: number; unit?: string; readOnly?: boolean
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-0.5">{label}</label>
      {sublabel && <p className="text-xs text-gray-400 mb-1">{sublabel}</p>}
      <div className="flex items-center gap-1">
        <input type="number" min={min} value={value} readOnly={readOnly}
          onChange={readOnly ? undefined : (e) => onChange!(Math.max(min, Number(e.target.value)))}
          className={`w-24 border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            readOnly ? 'bg-gray-50 text-gray-400 cursor-default' : ''
          }`}
        />
        <span className="text-xs text-gray-400">{unit}</span>
      </div>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide border-b pb-1 mb-3">
      {children}
    </h3>
  )
}

function Stepper({ label, sublabel, value, onChange, min = 1 }: {
  label: string; sublabel?: string; value: number; onChange: (v: number) => void; min?: number
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {sublabel && <p className="text-xs text-gray-400 mb-1">{sublabel}</p>}
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => onChange(Math.max(min, value - 1))}
          className="w-7 h-7 border rounded text-sm hover:bg-gray-100">−</button>
        <span className="w-8 text-center text-sm font-medium">{value}</span>
        <button type="button" onClick={() => onChange(value + 1)}
          className="w-7 h-7 border rounded text-sm hover:bg-gray-100">+</button>
      </div>
    </div>
  )
}

// ── Dimension helpers ─────────────────────────────────────────────

function locksetTotal(lockW: number, pos: LocksetPosition, numCols: number): number {
  if (pos === 'between') return Math.max(0, numCols - 1) * lockW
  return numCols > 0 ? lockW : 0
}
function deriveColWidth(totalW: number, leftM: number, rightM: number, lockW: number, pos: LocksetPosition, numCols: number) {
  const available = totalW - leftM - rightM - locksetTotal(lockW, pos, numCols)
  return Math.max(1, Math.round(available / Math.max(1, numCols)))
}
function deriveCellHeight(totalH: number, topH: number, baseH: number, numCells: number) {
  return Math.max(1, Math.round((totalH - topH - baseH) / Math.max(1, numCells)))
}
function buildColumns(numCols: number, colWidthMm: number, numCells: number, cellHeightMm: number): LockerColumn[] {
  let n = 1
  return Array.from({ length: numCols }, () => ({
    id: nanoid(),
    widthMm: colWidthMm,
    cells: Array.from({ length: numCells }, () => ({
      heightMm: cellHeightMm,
      label: `L${String(n++).padStart(2, '0')}`,
    } as LockerCell)),
  }))
}

// ── Main form ─────────────────────────────────────────────────────
export default function LockerCreateForm({ onAdd, editBlock, onUpdate, onClose }: Props) {
  const isEdit = !!editBlock
  const [open, setOpen] = useState(isEdit)  // edit mode starts open

  // ── State — lazy-initialised from editBlock when editing ──────
  const cfg = editBlock?.config ?? DEFAULT_BLOCK_CONFIG
  const [topH,   setTopH]   = useState(cfg.topHeightMm)
  const [baseH,  setBaseH]  = useState(cfg.baseHeightMm)
  const [leftM,  setLeftM]  = useState(cfg.leftMarginMm)
  const [rightM, setRightM] = useState(cfg.rightMarginMm)
  const [lockW,      setLockW]      = useState(cfg.locksetWidthMm)
  const [locksetPos, setLocksetPos] = useState<LocksetPosition>(cfg.locksetPosition)
  const [doorGap, setDoorGap] = useState(cfg.doorGapMm)
  const [dlGap,   setDlGap]   = useState(cfg.doorToLocksetGapMm)

  // Total cabinet dimensions — for edit, reverse-derive from block
  const [totalW, setTotalW] = useState(() => isEdit ? blockWidthMm(cfg) : 1000)
  const [totalH, setTotalH] = useState(() => isEdit ? blockHeightMm(cfg) : 1800)
  const [depth,  setDepth]  = useState(cfg.depthMm)
  const [numCols,  setNumCols]  = useState(() => isEdit ? Math.max(1, cfg.columns.length) : 1)
  const [numCells, setNumCells] = useState(() => isEdit ? Math.max(1, cfg.columns[0]?.cells.length ?? 1) : 3)

  const [label,        setLabel]        = useState(editBlock?.label ?? 'Block A')
  const [color,        setColor]        = useState(editBlock?.color ?? '#94a3b8')
  const [frameColor,   setFrameColor]   = useState(editBlock?.frameColor ?? '#334155')
  const [locksetColor, setLocksetColor] = useState(editBlock?.locksetColor ?? '#1e293b')
  const [borderWidth,  setBorderWidth]  = useState(editBlock?.borderWidth ?? 0)
  const [borderColor,  setBorderColor]  = useState(editBlock?.borderColor ?? '#1e293b')

  // ── Derived values ────────────────────────────────────────────
  const colWidth   = useMemo(() => deriveColWidth(totalW, leftM, rightM, lockW, locksetPos, numCols),
    [totalW, leftM, rightM, lockW, locksetPos, numCols])
  const cellHeight = useMemo(() => deriveCellHeight(totalH, topH, baseH, numCells),
    [totalH, topH, baseH, numCells])
  const actualW = leftM + colWidth * numCols + locksetTotal(lockW, locksetPos, numCols) + rightM
  const actualH = topH + cellHeight * numCells + baseH

  const handleClose = () => { setOpen(false); onClose?.() }

  const handleSave = useCallback(() => {
    const config: LockerBlockConfig = {
      topHeightMm: topH, baseHeightMm: baseH,
      leftMarginMm: leftM, rightMarginMm: rightM,
      locksetWidthMm: lockW, locksetPosition: locksetPos,
      doorGapMm: doorGap, doorToLocksetGapMm: dlGap,
      depthMm: depth,
      columns: buildColumns(numCols, colWidth, numCells, cellHeight),
    }
    if (isEdit && editBlock && onUpdate) {
      onUpdate({ ...editBlock, label, color, frameColor, locksetColor, borderWidth, borderColor, config })
    } else if (!isEdit && onAdd) {
      onAdd({ x: 80, y: 80, rotation: 0, label, color, frameColor, locksetColor, borderWidth, borderColor, config })
    }
    handleClose()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topH, baseH, leftM, rightM, lockW, locksetPos, doorGap, dlGap, depth,
      numCols, colWidth, numCells, cellHeight, label, color, frameColor, locksetColor, borderWidth, borderColor,
      isEdit, editBlock, onAdd, onUpdate])

  return (
    <>
      {/* Trigger button — only in create mode */}
      {!isEdit && (
        <button onClick={() => setOpen(true)}
          className="w-full px-3 py-2 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 transition-colors">
          + Create Locker Block
        </button>
      )}

      {open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h2 className="font-semibold text-gray-800">
                {isEdit ? `Edit Block — ${editBlock!.label}` : 'Create Locker Block'}
              </h2>
              <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
            </div>

            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-6">

              {/* Cabinet dimensions */}
              <div>
                <SectionTitle>Cabinet dimensions (Kích thước tổng thể)</SectionTitle>
                <div className="grid grid-cols-3 gap-x-6 gap-y-3">
                  <NumInput label="Total width"  sublabel="Chiều rộng tủ" value={totalW} onChange={setTotalW} />
                  <NumInput label="Total height" sublabel="Chiều cao tủ"  value={totalH} onChange={setTotalH} />
                  <NumInput label="Depth"        sublabel="Chiều sâu tủ"  value={depth}  onChange={setDepth}  />
                </div>
              </div>

              {/* Layout */}
              <div>
                <SectionTitle>Layout (Bố cục)</SectionTitle>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                  <Stepper label="Columns"          sublabel="Số cột tủ"        value={numCols}  onChange={setNumCols} />
                  <Stepper label="Cells per column" sublabel="Số ngăn mỗi cột"  value={numCells} onChange={setNumCells} />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs bg-gray-50 rounded-lg p-3 text-gray-600">
                  <div>
                    <span className="text-gray-400">Per-column width: </span>
                    <span className="font-medium text-gray-700">{colWidth} mm</span>
                    {colWidth < 1 && <span className="text-red-500 ml-1">— too narrow!</span>}
                  </div>
                  <div>
                    <span className="text-gray-400">Per-cell height: </span>
                    <span className="font-medium text-gray-700">{cellHeight} mm</span>
                    {cellHeight < 1 && <span className="text-red-500 ml-1">— too short!</span>}
                  </div>
                  <div>
                    <span className="text-gray-400">Actual W: </span>
                    <span className={`font-medium ${actualW !== totalW ? 'text-amber-600' : 'text-gray-700'}`}>
                      {actualW} mm {actualW !== totalW ? `(rounded from ${totalW})` : ''}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">Actual H: </span>
                    <span className={`font-medium ${actualH !== totalH ? 'text-amber-600' : 'text-gray-700'}`}>
                      {actualH} mm {actualH !== totalH ? `(rounded from ${totalH})` : ''}
                    </span>
                  </div>
                </div>
                {isEdit && (
                  <p className="mt-2 text-[11px] text-amber-600 bg-amber-50 rounded px-2 py-1">
                    ⚠ Saving will rebuild all columns and reset cell labels.
                  </p>
                )}
              </div>

              {/* Frame */}
              <div>
                <SectionTitle>Frame (Khung tủ)</SectionTitle>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                  <NumInput label="Top height"   sublabel="Chiều cao TOP"         value={topH}   onChange={setTopH}   />
                  <NumInput label="Base height"  sublabel="Chiều cao Base"        value={baseH}  onChange={setBaseH}  />
                  <NumInput label="Left margin"  sublabel="Chiều rộng cạnh trái" value={leftM}  onChange={setLeftM}  />
                  <NumInput label="Right margin" sublabel="Chiều rộng cạnh phải" value={rightM} onChange={setRightM} />
                </div>
              </div>

              {/* Locks & gaps */}
              <div className="space-y-3">
                <SectionTitle>Locks &amp; gaps (Khóa &amp; khe hở)</SectionTitle>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Lockset position <span className="text-gray-400 font-normal ml-1">(Vị trí thanh quản lý khóa)</span>
                  </label>
                  <div className="flex gap-2">
                    {([
                      ['left',    'Bên trái',  '│▌ col'],
                      ['between', 'Giữa',      'col ▌ col'],
                      ['right',   'Bên phải',  'col ▌│'],
                    ] as [LocksetPosition, string, string][]).map(([val, lbl, hint]) => (
                      <button key={val} type="button" onClick={() => setLocksetPos(val)}
                        className={`flex-1 py-2 px-2 rounded border text-xs transition-colors text-center ${
                          locksetPos === val ? 'bg-blue-100 border-blue-400 text-blue-700 font-medium' : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                        }`}>
                        <div className="font-mono text-gray-400 mb-0.5 text-[10px]">{hint}</div>
                        {lbl}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                  <NumInput label="Lockset width"        sublabel="Chiều rộng thanh khóa"        value={lockW}   onChange={setLockW}   />
                  <NumInput label="Door-to-door gap"     sublabel="Khoảng cách 2 cánh cửa"       value={doorGap} onChange={setDoorGap} />
                  <NumInput label="Door-to-lockset gap"  sublabel="Khoảng cách cửa và thanh khóa" value={dlGap}   onChange={setDlGap}   />
                </div>
              </div>

              {/* Identity & colours */}
              <div>
                <SectionTitle>Identity &amp; Colours</SectionTitle>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Block label</label>
                    <input value={label} onChange={(e) => setLabel(e.target.value)}
                      className="w-full border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  {([
                    ['Door colour',    color,        setColor        ],
                    ['Frame colour',   frameColor,   setFrameColor   ],
                    ['Lockset colour', locksetColor, setLocksetColor ],
                  ] as [string, string, (v: string) => void][]).map(([lbl, val, setter]) => (
                    <div key={lbl}>
                      <label className="block text-xs font-medium text-gray-600 mb-1">{lbl}</label>
                      <div className="flex items-center gap-2">
                        <input type="color" value={val} onChange={(e) => setter(e.target.value)}
                          className="w-8 h-8 border rounded cursor-pointer" />
                        <span className="text-xs text-gray-400 font-mono">{val}</span>
                      </div>
                    </div>
                  ))}

                  {/* Border */}
                  <div className="col-span-2 pt-2 border-t">
                    <label className="block text-xs font-medium text-gray-600 mb-2">
                      Border <span className="text-gray-400 font-normal">(Viền khung)</span>
                    </label>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-500">Width (px)</label>
                        <input type="number" min={0} max={12} step={1}
                          value={borderWidth}
                          onChange={(e) => setBorderWidth(Math.max(0, Math.min(12, Number(e.target.value))))}
                          className="w-16 border rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-500">Colour</label>
                        <input type="color" value={borderColor}
                          onChange={(e) => setBorderColor(e.target.value)}
                          className="w-8 h-8 border rounded cursor-pointer" />
                        <span className="text-xs text-gray-400 font-mono">{borderColor}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Summary */}
              <div className="bg-blue-50 rounded-lg px-4 py-3 text-sm text-blue-800">
                <span className="font-semibold">Block: </span>
                {actualW} × {actualH} × {depth} mm —{' '}
                {numCols} {numCols === 1 ? 'column' : 'columns'} × {numCells} cells
                <span className="text-blue-500 ml-1">= {numCols * numCells} compartments</span>
              </div>
            </div>

            <div className="flex gap-3 px-5 py-4 border-t">
              <button onClick={handleClose}
                className="flex-1 px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={handleSave}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                {isEdit ? 'Save changes' : 'Add to Canvas'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
