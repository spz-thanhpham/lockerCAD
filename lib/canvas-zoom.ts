// lib/canvas-zoom.ts
// Module-level registry so toolbar zoom buttons work around the
// forwardRef + Next.js dynamic() ref-forwarding limitation.

type ZoomControls = {
  zoomIn:    () => void
  zoomOut:   () => void
  zoomReset: () => void
  fitToRoom: () => void
  setLevel:  (zoom: number) => void
}

const registry: { ctrl: ZoomControls | null; locked: boolean } = { ctrl: null, locked: false }

export function registerZoom(ctrl: ZoomControls | null): void {
  registry.ctrl = ctrl
}

export const isZoomLocked  = () => registry.locked
export const setZoomLocked = (v: boolean) => { registry.locked = v }

export const zoomIn       = () => { if (!registry.locked) registry.ctrl?.zoomIn() }
export const zoomOut      = () => { if (!registry.locked) registry.ctrl?.zoomOut() }
export const zoomReset    = () => { if (!registry.locked) registry.ctrl?.zoomReset() }
export const fitToRoom    = () => { if (!registry.locked) registry.ctrl?.fitToRoom() }
export const setZoomLevel = (z: number) => { if (!registry.locked) registry.ctrl?.setLevel(z) }
