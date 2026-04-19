'use client'
// components/export/ExportImage.tsx

import { useState } from 'react'
import type { ExportImageOpts } from '@/components/editor/CanvasBoard'

interface Props {
  getStageDataUrl: (opts?: ExportImageOpts) => string | null
  projectName?: string
  showDimensions: boolean
}

export default function ExportImage({ getStageDataUrl, projectName = 'Layout', showDimensions }: Props) {
  const [open, setOpen] = useState(false)
  const [withDimensions, setWithDimensions] = useState(true)
  const [format, setFormat]     = useState<'png' | 'jpeg'>('png')
  const [pixelRatio, setPixelRatio] = useState(2)
  const [error, setError]       = useState<string | null>(null)

  const handleExport = () => {
    setError(null)
    try {
      // Hide dimension lines only when: they're currently visible AND user chose to exclude them
      const hideDimensions = showDimensions && !withDimensions

      const dataUrl = getStageDataUrl({
        hideDimensions,
        pixelRatio,
        mimeType: format === 'jpeg' ? 'image/jpeg' : 'image/png',
      })
      if (!dataUrl) { setError('Canvas not ready — try again.'); return }

      const ext = format === 'jpeg' ? 'jpg' : 'png'
      const filename = `${(projectName || 'layout').replace(/\s+/g, '-')}-layout.${ext}`
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed')
    }
  }

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="px-3 py-1.5 border border-gray-200 text-gray-700 rounded text-xs hover:bg-gray-50 flex items-center gap-1.5">
        <span>🖼</span> Export Image
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl w-72 p-5">
            <h3 className="font-semibold text-gray-800 mb-4">Export Image</h3>

            <div className="space-y-3 text-sm">

              {/* Format */}
              <div>
                <label className="block text-gray-500 mb-1">Format</label>
                <div className="flex gap-2">
                  {(['png', 'jpeg'] as const).map((f) => (
                    <button key={f} onClick={() => setFormat(f)}
                      className={`flex-1 py-1.5 rounded border text-xs transition-colors ${
                        format === f
                          ? 'bg-blue-100 border-blue-400 text-blue-700 font-medium'
                          : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                      }`}>
                      {f.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Resolution */}
              <div>
                <label className="block text-gray-500 mb-1">Resolution</label>
                <div className="flex gap-2">
                  {([1, 2, 3] as const).map((r) => (
                    <button key={r} onClick={() => setPixelRatio(r)}
                      className={`flex-1 py-1.5 rounded border text-xs transition-colors ${
                        pixelRatio === r
                          ? 'bg-blue-100 border-blue-400 text-blue-700 font-medium'
                          : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                      }`}>
                      {r}×
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-gray-400 mt-1">
                  {pixelRatio}× = {pixelRatio * 96} dpi equivalent
                </p>
              </div>

              {/* Dimensions toggle */}
              <label className="flex items-center gap-2 text-gray-600 cursor-pointer">
                <input type="checkbox"
                  checked={withDimensions}
                  onChange={(e) => setWithDimensions(e.target.checked)}
                  className="rounded" />
                Include dimension annotations
              </label>

              {!showDimensions && withDimensions && (
                <p className="text-[10px] text-amber-600 bg-amber-50 rounded px-2 py-1">
                  Dimensions are currently hidden on canvas — enable "Show dimensions" first to include them.
                </p>
              )}
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
              <button onClick={handleExport}
                className="flex-1 px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">
                Download
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
