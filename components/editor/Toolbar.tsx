'use client'
// components/editor/Toolbar.tsx

import { useState, useRef } from 'react'
import type { CanvasData } from '@/types'
import type { ExportImageOpts } from '@/components/editor/CanvasBoard'
import ExportPDF from '@/components/export/ExportPDF'
import ExportDXF from '@/components/export/ExportDXF'
import ExportImage from '@/components/export/ExportImage'

type Tool = 'select' | 'pan'

interface Props {
  activeTool: Tool
  onToolChange: (tool: Tool) => void
  zoom: number
  onZoomIn: () => void
  onZoomOut: () => void
  onZoomReset: () => void
  onSave: () => void
  saving: boolean
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
  zoom, onZoomIn, onZoomOut, onZoomReset,
  onSave, saving, isDirty,
  canvasData, getStageDataUrl, projectName, onRenameProject, showDimensions,
  onSelectAll,
}: Props) {
  const [editing, setEditing] = useState(false)
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
        {([['select', '↖ Select'], ['pan', '✋ Pan']] as [Tool, string][]).map(([tool, label]) => (
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
      <div className="flex items-center gap-1 border rounded p-0.5 ml-1">
        <button onClick={onZoomOut}   className="px-1.5 py-0.5 text-xs text-gray-600 hover:bg-gray-100 rounded">−</button>
        <button onClick={onZoomReset} className="px-2 py-0.5 text-xs text-gray-500 hover:bg-gray-100 rounded min-w-[44px] text-center">
          {Math.round(zoom * 100)}%
        </button>
        <button onClick={onZoomIn}    className="px-1.5 py-0.5 text-xs text-gray-600 hover:bg-gray-100 rounded">+</button>
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-2">
        <ExportImage getStageDataUrl={getStageDataUrl} projectName={projectName} showDimensions={showDimensions} />
        <ExportPDF getStageDataUrl={getStageDataUrl} canvasData={canvasData} projectName={projectName} />
        <ExportDXF canvasData={canvasData} />
      </div>

      <button onClick={onSave} disabled={saving}
        className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 disabled:opacity-50 ml-1">
        {saving ? 'Saving…' : 'Save'}
      </button>
    </header>
  )
}
