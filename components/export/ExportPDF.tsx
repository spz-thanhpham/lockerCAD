'use client'
// components/export/ExportPDF.tsx

import { useState, useEffect } from 'react'
import type { CanvasData, ExportOptions } from '@/types'
import type { ExportImageOpts } from '@/components/editor/CanvasBoard'
import { exportToPDF } from '@/lib/export'

interface Props {
  getStageDataUrl: (opts?: ExportImageOpts) => string | null
  canvasData: CanvasData
  projectName?: string
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs text-gray-500">{label}</label>
        {hint && <span className="text-[10px] text-blue-400">{hint}</span>}
      </div>
      {children}
    </div>
  )
}

function slugify(s: string) {
  return s.trim().replace(/\s+/g, '-').replace(/[^\w\-]/g, '') || ''
}

export default function ExportPDF({ getStageDataUrl, canvasData, projectName = 'Layout' }: Props) {
  const [open, setOpen]       = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const oi = canvasData.officeInfo

  const [form, setForm] = useState({
    paperSize:         'A3' as 'A3' | 'A4',
    orientation:       'landscape' as 'landscape' | 'portrait',
    includeDimensions: true,
    companyName:       '',
    clientName:        '',
    drawingNo:         'DWG-001',
    drawnBy:           '',
    revision:          'A',
    scale:             '1:50',
  })

  // Pre-fill from officeInfo whenever the dialog opens
  useEffect(() => {
    if (!open) return
    setForm((f) => ({
      ...f,
      companyName: oi?.companyName ?? f.companyName,
      drawnBy:     f.drawnBy || (oi?.madeBy ?? ''),
    }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const set = (k: keyof typeof form, v: string | boolean) =>
    setForm((f) => ({ ...f, [k]: v }))

  // Build filename: CompanyName-CustomerName-LayoutName-DrawingNo-Revision.pdf
  const filename = [
    slugify(form.companyName),
    slugify(form.clientName),
    slugify(projectName),
    slugify(form.drawingNo),
    slugify(form.revision),
  ].filter(Boolean).join('-') + '.pdf'

  const handleExport = async () => {
    const dataUrl = getStageDataUrl({
      pixelRatio: 5,
      hideDimensions: !form.includeDimensions,
    })
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
          clientName:  form.clientName,
          drawingNo:   form.drawingNo,
          drawnBy:     form.drawnBy,
          date:        new Date().toLocaleDateString('en-AU'),
          scale:       form.scale,
          revision:    form.revision,
        },
      }
      await exportToPDF(dataUrl, canvasData, options, filename)
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
        className="px-3 py-1.5 border border-gray-200 text-gray-700 rounded text-xs hover:bg-gray-50 flex items-center gap-1.5"
      >
        <span>📄</span> Export PDF
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl w-96 p-5 max-h-[90vh] overflow-y-auto">
            <h3 className="font-semibold text-gray-800 mb-4">Workshop Drawing — PDF Export</h3>

            <div className="space-y-3">

              {/* Paper */}
              <div className="flex gap-3">
                <Field label="Paper size">
                  <select className="w-full border rounded px-2 py-1 text-xs"
                    value={form.paperSize}
                    onChange={(e) => set('paperSize', e.target.value)}>
                    <option value="A3">A3</option>
                    <option value="A4">A4</option>
                  </select>
                </Field>
                <Field label="Orientation">
                  <select className="w-full border rounded px-2 py-1 text-xs"
                    value={form.orientation}
                    onChange={(e) => set('orientation', e.target.value)}>
                    <option value="landscape">Landscape</option>
                    <option value="portrait">Portrait</option>
                  </select>
                </Field>
              </div>

              <div className="border-t pt-3">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Drawing info</p>

                <div className="space-y-2">
                  <Field label="Company name" hint="auto-filled from Office Info">
                    <input className="w-full border rounded px-2 py-1 text-xs"
                      value={form.companyName}
                      onChange={(e) => set('companyName', e.target.value)} />
                  </Field>

                  <Field label="Client / customer name">
                    <input className="w-full border rounded px-2 py-1 text-xs"
                      placeholder="e.g. ACME Corp"
                      value={form.clientName}
                      onChange={(e) => set('clientName', e.target.value)} />
                  </Field>

                  <div className="flex gap-2">
                    <Field label="Drawing no.">
                      <input className="w-full border rounded px-2 py-1 text-xs"
                        value={form.drawingNo}
                        onChange={(e) => set('drawingNo', e.target.value)} />
                    </Field>
                    <Field label="Revision">
                      <input className="w-full border rounded px-2 py-1 text-xs"
                        value={form.revision}
                        onChange={(e) => set('revision', e.target.value)} />
                    </Field>
                  </div>

                  <div className="flex gap-2">
                    <Field label="Drawn by" hint="auto-filled">
                      <input className="w-full border rounded px-2 py-1 text-xs"
                        value={form.drawnBy}
                        onChange={(e) => set('drawnBy', e.target.value)} />
                    </Field>
                    <Field label="Scale">
                      <input className="w-full border rounded px-2 py-1 text-xs"
                        value={form.scale}
                        onChange={(e) => set('scale', e.target.value)} />
                    </Field>
                  </div>
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer pt-1">
                <input type="checkbox" checked={form.includeDimensions}
                  onChange={(e) => set('includeDimensions', e.target.checked)} className="rounded" />
                Include dimension annotations
              </label>

              {/* Filename preview */}
              <div className="bg-gray-50 border rounded px-3 py-2">
                <p className="text-[10px] text-gray-400 mb-0.5">Output filename</p>
                <p className="text-xs font-mono text-gray-700 break-all">{filename}</p>
              </div>
            </div>

            {error && (
              <p className="mt-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1.5">
                {error}
              </p>
            )}

            <div className="flex gap-2 mt-4">
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
