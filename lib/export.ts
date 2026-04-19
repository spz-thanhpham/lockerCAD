// lib/export.ts
// PDF and DXF export logic

import type { CanvasData, ExportOptions, LockerObject } from '@/types'

// ─── PDF Export ─────────────────────────────────────────────────

export async function exportToPDF(
  stageDataUrl: string,
  canvasData: CanvasData,
  options: ExportOptions
): Promise<void> {
  // jsPDF ships both a named and a default export depending on bundler
  const mod = await import('jspdf')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const JsPDF: any = (mod as any).jsPDF ?? (mod as any).default

  const doc = new JsPDF({
    orientation: options.orientation,
    unit: 'mm',
    format: options.paperSize,
  })

  const pageW: number = doc.internal.pageSize.getWidth()
  const pageH: number = doc.internal.pageSize.getHeight()

  const margin  = 10
  const titleH  = 35
  const imgW    = pageW - margin * 2
  const imgH    = pageH - margin * 2 - titleH - 4

  // ── Canvas snapshot ───────────────────────────────────────────
  // jsPDF recognises a data-URL by checking src.indexOf("data:image/") === 0
  // so we MUST pass the full data-URL — never strip the prefix.
  doc.addImage(stageDataUrl, 'PNG', margin, margin, imgW, imgH)

  // ── Title block ───────────────────────────────────────────────
  const tb   = options.titleBlock
  const tbY  = margin + imgH + 4

  doc.setDrawColor(51, 65, 85)
  doc.setFillColor(241, 245, 249)       // slate-100
  doc.setLineWidth(0.3)
  doc.rect(margin, tbY, imgW, titleH, 'FD')

  // 6 equal columns
  const colW = imgW / 6
  const fields: [string, string][] = [
    ['Project',     tb.projectName],
    ['Client',      tb.clientName],
    ['Drawing No.', tb.drawingNo],
    ['Scale',       tb.scale],
    ['Date',        tb.date],
    ['Drawn by / Rev', `${tb.drawnBy}  ${tb.revision}`],
  ]

  fields.forEach(([lbl, val], i) => {
    const cx = margin + colW * i
    // vertical separator
    if (i > 0) {
      doc.setDrawColor(51, 65, 85)
      doc.line(cx, tbY, cx, tbY + titleH)
    }
    // label
    doc.setFontSize(6.5)
    doc.setTextColor(100, 116, 139)     // slate-500
    doc.text(lbl, cx + 2, tbY + 6)
    // value
    doc.setFontSize(9)
    doc.setTextColor(15, 23, 42)        // slate-900
    const safeVal = String(val ?? '')
    doc.text(safeVal, cx + 2, tbY + 16, { maxWidth: colW - 4 })
  })

  // bottom border
  doc.setDrawColor(51, 65, 85)
  doc.rect(margin, tbY, imgW, titleH, 'S')

  // Use blob URL download — more reliable than doc.save() across all browsers
  const blob = doc.output('blob') as Blob
  const blobUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = blobUrl
  a.download = `${(tb.projectName || 'layout').replace(/\s+/g, '-')}-workshop.pdf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
}

// ─── DXF Export ─────────────────────────────────────────────────

export async function exportToDXF(canvasData: CanvasData): Promise<void> {
  // @ts-ignore — dxf-writer has no types
  const DxfWriter = (await import('dxf-writer')).default
  const d = new DxfWriter()

  d.addLayer('ROOM',       DxfWriter.ACI.WHITE,  'CONTINUOUS')
  d.addLayer('LOCKERS',    DxfWriter.ACI.CYAN,   'CONTINUOUS')
  d.addLayer('LABELS',     DxfWriter.ACI.YELLOW, 'CONTINUOUS')
  d.addLayer('DIMENSIONS', DxfWriter.ACI.GREEN,  'CONTINUOUS')

  const { room, lockers } = canvasData

  d.setActiveLayer('ROOM')
  d.drawRect(0, 0, room.widthMm, room.depthMm)

  lockers.forEach((locker: LockerObject) => {
    const x = locker.x / room.scale
    const y = locker.y / room.scale

    d.setActiveLayer('LOCKERS')
    d.drawRect(x, y, x + locker.widthMm, y + locker.heightMm)

    d.setActiveLayer('LABELS')
    d.drawText(x + locker.widthMm / 2, y + locker.heightMm / 2, 50, 0, locker.label)

    d.setActiveLayer('DIMENSIONS')
    const dimY = y - 200
    d.drawLine(x,                  dimY - 50, x,                  dimY + 50)
    d.drawLine(x + locker.widthMm, dimY - 50, x + locker.widthMm, dimY + 50)
    d.drawLine(x,                  dimY,      x + locker.widthMm, dimY)
    d.drawText(x + locker.widthMm / 2, dimY + 80, 100, 0, `${locker.widthMm}`)
  })

  const blob = new Blob([d.toDxfString()], { type: 'application/dxf' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url; a.download = 'locker-layout.dxf'; a.click()
  URL.revokeObjectURL(url)
}

// ─── PNG Export ─────────────────────────────────────────────────

export function exportToPNG(stageDataUrl: string, filename = 'locker-layout.png') {
  const a = document.createElement('a')
  a.href = stageDataUrl
  a.download = filename
  a.click()
}
