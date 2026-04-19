'use client'
// components/export/ExportDXF.tsx
// DXF export button — generates AutoCAD-compatible .dxf file

import { useState } from 'react'
import type { CanvasData } from '@/types'
import { exportToDXF } from '@/lib/export'

interface Props {
  canvasData: CanvasData
}

export default function ExportDXF({ canvasData }: Props) {
  const [loading, setLoading] = useState(false)

  const handleExport = async () => {
    setLoading(true)
    try {
      await exportToDXF(canvasData)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className="w-full px-3 py-1.5 border border-gray-200 text-gray-700 rounded text-xs hover:bg-gray-50 flex items-center gap-1.5 disabled:opacity-50"
    >
      <span>📐</span> {loading ? 'Generating…' : 'Export DXF (AutoCAD)'}
    </button>
  )
}
