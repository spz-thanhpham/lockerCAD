// lib/canvas-capture.ts
// Module-level registry so export buttons can capture the Konva stage
// without relying on React forwardRef + Next.js dynamic() ref forwarding.

import type { ExportImageOpts } from '@/components/editor/CanvasBoard'

type CaptureFn = (opts?: ExportImageOpts) => string | null

const registry: { fn: CaptureFn | null } = { fn: null }

export function registerCapture(fn: CaptureFn | null): void {
  registry.fn = fn
}

export function captureCanvas(opts?: ExportImageOpts): string | null {
  return registry.fn ? registry.fn(opts) : null
}
