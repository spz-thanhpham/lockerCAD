// lib/export.ts
// PDF and DXF export logic

import type { CanvasData, ExportOptions, LockerObject } from '@/types'

// Canvas constants — must stay in sync with CanvasBoard.tsx
const _CANVAS_PADDING   = 60   // px  (padding on each side of the room)

// ─── PDF Export ─────────────────────────────────────────────────

export async function exportToPDF(
  stageDataUrl: string,
  canvasData: CanvasData,
  options: ExportOptions,
  filename?: string,
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

  const margin   = 10
  // Title block layout: company header row + 2 data rows
  const tbRowH   = 13   // mm per data row
  const tbHeadH  = 9    // mm company name header
  const titleH   = tbHeadH + tbRowH * 2   // 35mm total
  const availW   = pageW - margin * 2
  const availH   = pageH - margin * 2 - titleH - 4

  // ── Compute the true aspect ratio of the captured image ───────
  // captureCanvas crops to: room + 2×padding on all sides (no TitleBlock on canvas)
  const { room, officeInfo: oi } = canvasData
  const capW      = room.widthMm * room.scale + _CANVAS_PADDING * 2
  const capH      = room.depthMm * room.scale + _CANVAS_PADDING * 2
  const imgAspect = capW / capH

  // Fit image into available area while preserving aspect ratio
  let imgW = availW
  let imgH = imgW / imgAspect
  if (imgH > availH) { imgH = availH; imgW = imgH * imgAspect }
  const imgX = margin + (availW - imgW) / 2
  const imgY = margin

  // ── Canvas snapshot — full data-URL required by jsPDF ────────
  doc.addImage(stageDataUrl, 'PNG', imgX, imgY, imgW, imgH)

  // ── Title block — anchored to the page bottom ─────────────────
  const tb   = options.titleBlock
  const tbY  = pageH - margin - titleH
  const r1Y  = tbY  + tbHeadH           // top of first data row
  const r2Y  = r1Y  + tbRowH            // top of second data row
  const colW = availW / 6
  const pad  = 2                        // inner horizontal padding (mm)

  // Outer fill + border
  doc.setFillColor(248, 250, 252)       // slate-50
  doc.setDrawColor(51, 65, 85)
  doc.setLineWidth(0.3)
  doc.rect(margin, tbY, availW, titleH, 'FD')

  // Company name header
  doc.setFillColor(30, 41, 59)          // slate-800
  doc.rect(margin, tbY, availW, tbHeadH, 'F')
  doc.setFontSize(9)
  doc.setTextColor(226, 232, 240)       // slate-200
  const company = String(oi?.companyName ?? tb.projectName ?? '')
  doc.text(company, margin + availW / 2, tbY + 6, { align: 'center' })

  // Horizontal dividers
  doc.setDrawColor(51, 65, 85)
  doc.line(margin, r1Y, margin + availW, r1Y)
  doc.line(margin, r2Y, margin + availW, r2Y)

  // Vertical column separators (skip first col)
  for (let i = 1; i < 6; i++) {
    const cx = margin + colW * i
    doc.line(cx, r1Y, cx, tbY + titleH)
  }

  // Row 1 — drawing metadata (6 cols)
  const row1: [string, string][] = [
    ['Project',      tb.projectName],
    ['Client',       tb.clientName],
    ['Drawing No.',  tb.drawingNo],
    ['Scale',        tb.scale],
    ['Date',         tb.date],
    ['Drawn by',     `${tb.drawnBy}  Rev: ${tb.revision}`],
  ]
  // Row 2 — office contact (5 cols + empty)
  const row2: [string, string][] = [
    ['Made by',  String(oi?.madeBy   ?? '')],
    ['Address',  String(oi?.address  ?? '')],
    ['Website',  String(oi?.website  ?? '')],
    ['Email',    String(oi?.email    ?? '')],
    ['Hotline',  String(oi?.hotline  ?? '')],
    ['',         ''],
  ]

  const drawRow = (fields: [string, string][], rowY: number) => {
    fields.forEach(([lbl, val], i) => {
      const cx = margin + colW * i
      doc.setFontSize(6)
      doc.setTextColor(100, 116, 139)   // label slate-500
      doc.text(lbl, cx + pad, rowY + 4)
      doc.setFontSize(8)
      doc.setTextColor(15, 23, 42)      // value slate-900
      doc.text(String(val ?? ''), cx + pad, rowY + 10, { maxWidth: colW - pad * 2 })
    })
  }

  drawRow(row1, r1Y)
  drawRow(row2, r2Y)

  // Outer border on top of everything
  doc.setDrawColor(51, 65, 85)
  doc.setLineWidth(0.4)
  doc.rect(margin, tbY, availW, titleH, 'S')

  // Use blob URL download — more reliable than doc.save() across all browsers
  const blob = doc.output('blob') as Blob
  const blobUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = blobUrl
  a.download = filename ?? `${(tb.projectName || 'layout').replace(/\s+/g, '-')}-workshop.pdf`
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
