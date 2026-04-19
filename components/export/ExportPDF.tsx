'use client'
// components/export/ExportPDF.tsx
// PDF export button — captures canvas + builds workshop drawing PDF

import { useState } from 'react'
import type { CanvasData, ExportOptions } from '@/types'
import { exportToPDF } from '@/lib/export'

interface Props {
  getStageDataUrl: () => string | null   // call stage.toDataURL({ pixelRatio: 2 })
  canvasData: CanvasData
  projectName?: string
}

export default function ExportPDF({ getStageDataUrl, canvasData, projectName = 'Layout' }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    paperSize: 'A3' as 'A3' | 'A4',
    orientation: 'landscape' as 'landscape' | 'portrait',
    includeDimensions: true,
    clientName: '',
    drawingNo: 'DWG-001',
    drawnBy: '',
    revision: 'A',
    scale: '1:50',
  })

  const handleExport = async () => {
    const dataUrl = getStageDataUrl()
    if (!dataUrl) { setError('Canvas not ready — try again.'); return }

    setLoading(true)
    setError(null)
    try {
      const options: ExportOptions = {
        format: 'pdf',
        paperSize: form.paperSize,
        orientation: form.orientation,
        includeDimensions: form.includeDimensions,
        includeGrid: false,
        titleBlock: {
          projectName,
          clientName: form.clientName,
          drawingNo: form.drawingNo,
          drawnBy: form.drawnBy,
          date: new Date().toLocaleDateString('en-AU'),
          scale: form.scale,
          revision: form.revision,
        },
      }
      await exportToPDF(dataUrl, canvasData, options)
      setOpen(false)
    } catch (err) {
      console.error('PDF export failed:', err)
      setError(err instanceof Error ? err.message : 'PDF generation failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full px-3 py-1.5 border border-gray-200 text-gray-700 rounded text-xs hover:bg-gray-50 flex items-center gap-1.5"
      >
        <span>📄</span> Export PDF
      </button>

      {/* Simple modal */}
      {open && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl w-80 p-5">
            <h3 className="font-semibold text-gray-800 mb-4">Workshop Drawing PDF</h3>

            <div className="space-y-3 text-sm">
              {/* Paper size */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-gray-500 mb-1">Paper</label>
                  <select className="w-full border rounded px-2 py-1 text-sm"
                    value={form.paperSize}
                    onChange={e => setForm(f => ({ ...f, paperSize: e.target.value as any }))}>
                    <option value="A3">A3</option>
                    <option value="A4">A4</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-gray-500 mb-1">Orientation</label>
                  <select className="w-full border rounded px-2 py-1 text-sm"
                    value={form.orientation}
                    onChange={e => setForm(f => ({ ...f, orientation: e.target.value as any }))}>
                    <option value="landscape">Landscape</option>
                    <option value="portrait">Portrait</option>
                  </select>
                </div>
              </div>

              {/* Title block fields */}
              {([
                ['clientName', 'Client name'],
                ['drawingNo', 'Drawing no.'],
                ['drawnBy', 'Drawn by'],
                ['scale', 'Scale'],
                ['revision', 'Revision'],
              ] as const).map(([key, label]) => (
                <div key={key}>
                  <label className="block text-gray-500 mb-1">{label}</label>
                  <input
                    className="w-full border rounded px-2 py-1 text-sm"
                    value={(form as any)[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  />
                </div>
              ))}

              <label className="flex items-center gap-2 text-gray-600 cursor-pointer">
                <input type="checkbox" checked={form.includeDimensions}
                  onChange={e => setForm(f => ({ ...f, includeDimensions: e.target.checked }))} />
                Include dimension annotations
              </label>
            </div>

            {error && (
              <p className="mt-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1.5">
                {error}
              </p>
            )}

            <div className="flex gap-2 mt-5">
              <button onClick={() => setOpen(false)}
                className="flex-1 px-3 py-1.5 border rounded text-sm text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={handleExport} disabled={loading}
                className="flex-1 px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50">
                {loading ? 'Generating…' : 'Download PDF'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
