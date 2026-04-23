'use client'
// components/editor/Toolbar.tsx

import { useState, useRef } from 'react'
import type { CanvasData } from '@/types'
import type { ExportImageOpts } from '@/components/editor/CanvasBoard'
import ExportPDF from '@/components/export/ExportPDF'
import ExportDXF from '@/components/export/ExportDXF'
import ExportImage from '@/components/export/ExportImage'
import { zoomIn, zoomOut, fitToRoom, setZoomLevel, setZoomLocked } from '@/lib/canvas-zoom'

const ZOOM_PRESETS = [
  { label: 'Fit', value: 'fit' },
  { label: '25%',  value: 0.25 },
  { label: '50%',  value: 0.50 },
  { label: '75%',  value: 0.75 },
  { label: '100%', value: 1.00 },
  { label: '150%', value: 1.50 },
  { label: '200%', value: 2.00 },
  { label: '300%', value: 3.00 },
] as const

type Tool = 'select' | 'pan' | 'text' | 'rect' | 'circle'

interface Props {
  activeTool: Tool
  onToolChange: (tool: Tool) => void
  zoom: number
  onSave: () => void
  saving: boolean
  autoSaving: boolean
  isDirty: boolean
  canvasData: CanvasData
  getStageDataUrl: (opts?: ExportImageOpts) => string | null
  projectName: string
  onRenameProject: (name: string) => void
  showDimensions: boolean
  onSelectAll: () => void
}

export default function Toolbar({
  activeTool, onToolChange,
  zoom,
  onSave, saving, autoSaving, isDirty,
  canvasData, getStageDataUrl, projectName, onRenameProject, showDimensions,
  onSelectAll,
}: Props) {
  const [editing, setEditing] = useState(false)
  const [zoomLocked, setZoomLockedState] = useState(false)

  const toggleZoomLock = () => {
    const next = !zoomLocked
    setZoomLockedState(next)
    setZoomLocked(next)
  }
  const [draft, setDraft] = useState(projectName)
  const inputRef = useRef<HTMLInputElement>(null)

  const startEdit = () => { setDraft(projectName); setEditing(true); setTimeout(() => inputRef.current?.select(), 0) }
  const commitEdit = () => {
    const trimmed = draft.trim()
    if (trimmed && trimmed !== projectName) onRenameProject(trimmed)
    setEditing(false)
  }

  return (
    <header className="h-11 border-b bg-white flex items-center gap-2 px-3 shrink-0">
      <a href="/layouts" className="text-xs text-gray-400 hover:text-gray-700 mr-1" title="Back to dashboard">←</a>
      <div className="flex flex-col leading-none mr-2 shrink-0">
        <span className="text-xs font-semibold text-gray-700">🔒 LockerCAD</span>
        <span className="text-[9px] text-gray-400 tracking-wide">a locker layout tool</span>
      </div>

      {/* Editable layout name */}
      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditing(false) }}
          className="border border-blue-400 rounded px-2 py-0.5 text-sm font-medium text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-400 w-48"
        />
      ) : (
        <button
          onClick={startEdit}
          title="Click to rename layout"
          className="text-sm font-medium text-gray-700 hover:text-blue-600 hover:bg-blue-50 px-2 py-0.5 rounded truncate max-w-[180px]"
        >
          {projectName}
        </button>
      )}
      <span className="text-[10px] text-gray-400 shrink-0">{isDirty ? '●' : '✓'}</span>

      {/* Tool mode */}
      <div className="flex items-center gap-1 border rounded p-0.5">
        {([
          ['select', '↖ Select'],
          ['pan',    '✋ Pan'],
          ['text',   'T Text'],
          ['rect',   '▭ Rect'],
          ['circle', '○ Circle'],
        ] as [Tool, string][]).map(([tool, label]) => (
          <button key={tool} onClick={() => onToolChange(tool)}
            className={`px-2 py-0.5 rounded text-xs transition-colors ${
              activeTool === tool ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* Select All */}
      <button onClick={onSelectAll} title="Select all items (Ctrl+A)"
        className="px-2 py-0.5 rounded border text-xs text-gray-600 hover:bg-gray-100 transition-colors">
        ⊞ All
      </button>

      {/* Zoom */}
      <div className="flex items-center border rounded p-0.5 ml-1">
        <button onClick={zoomOut} className="px-1.5 py-0.5 text-xs text-gray-600 hover:bg-gray-100 rounded">−</button>
        <select
          value={ZOOM_PRESETS.find((p) => p.value !== 'fit' && Math.abs((p.value as number) - zoom) < 0.01)?.value ?? ''}
          onChange={(e) => {
            const v = e.target.value
            if (v === 'fit') fitToRoom()
            else if (v !== '') setZoomLevel(Number(v))
          }}
          className="px-1 py-0.5 text-xs text-gray-600 bg-transparent hover:bg-gray-100 rounded cursor-pointer focus:outline-none min-w-[54px] text-center"
        >
          <option value="" disabled>{Math.round(zoom * 100)}%</option>
          {ZOOM_PRESETS.map((p) => (
            <option key={String(p.value)} value={String(p.value)}>{p.label}</option>
          ))}
        </select>
        <button onClick={zoomIn} className="px-1.5 py-0.5 text-xs text-gray-600 hover:bg-gray-100 rounded">+</button>
        <button
          onClick={toggleZoomLock}
          title={zoomLocked ? 'Zoom locked — click to unlock' : 'Lock zoom'}
          className={`px-1.5 py-0.5 text-xs rounded border-l transition-colors ${
            zoomLocked
              ? 'text-amber-600 bg-amber-50 hover:bg-amber-100'
              : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
          }`}
        >
          {zoomLocked ? '🔒' : '🔓'}
        </button>
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-2">
        <ExportImage getStageDataUrl={getStageDataUrl} projectName={projectName} showDimensions={showDimensions} />
        <ExportPDF getStageDataUrl={getStageDataUrl} canvasData={canvasData} projectName={projectName} />
        <ExportDXF canvasData={canvasData} />
      </div>

      <button onClick={onSave} disabled={saving || autoSaving}
        className={`px-3 py-1 rounded text-xs disabled:opacity-60 ml-1 transition-colors ${
          autoSaving
            ? 'bg-amber-500 text-white'
            : 'bg-blue-600 text-white hover:bg-blue-700'
        }`}>
        {saving || autoSaving ? '↺ Saving…' : 'Save'}
      </button>
    </header>
  )
}
