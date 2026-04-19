// lib/canvas-helpers.ts

import type { LockerObject } from '@/types'

// ─── Unit conversion ────────────────────────────────────────────

export const mmToPx = (mm: number, scale: number) => Math.round(mm * scale)
export const pxToMm = (px: number, scale: number) => Math.round(px / scale)

// ─── Snap to grid ───────────────────────────────────────────────

export const snapToGrid = (px: number, gridSizeMm: number, scale: number): number => {
  const gridPx = gridSizeMm * scale
  return Math.round(px / gridPx) * gridPx
}

// ─── Room-bound drag function ────────────────────────────────────
//
// Konva's dragBoundFunc receives/returns ABSOLUTE stage-pixel coordinates
// (i.e. they include the stage's own pan-offset and zoom-scale).
// Without this conversion, the bounds break as soon as the user pans or zooms.
//
// getStageTransform is a stable callback that reads the live stage transform
// without causing re-renders.

export const makeRoomBoundFunc = (
  lockerWidthPx:  number,
  lockerHeightPx: number,
  roomWidthPx:    number,
  roomHeightPx:   number,
  roomOffsetX:    number,   // world-px (CANVAS_PADDING)
  roomOffsetY:    number,
  gridSizeMm:     number,
  scale:          number,
  getStageTransform: () => { x: number; y: number; scaleX: number }
) => {
  return (pos: { x: number; y: number }) => {
    const { x: sx, y: sy, scaleX: ss } = getStageTransform()

    // absolute → world
    const wx = (pos.x - sx) / ss
    const wy = (pos.y - sy) / ss

    // snap-to-grid in world coords (relative to room origin)
    const snappedWx = snapToGrid(wx - roomOffsetX, gridSizeMm, scale) + roomOffsetX
    const snappedWy = snapToGrid(wy - roomOffsetY, gridSizeMm, scale) + roomOffsetY

    // clamp inside room in world coords
    const cx = Math.max(roomOffsetX, Math.min(snappedWx, roomOffsetX + roomWidthPx  - lockerWidthPx))
    const cy = Math.max(roomOffsetY, Math.min(snappedWy, roomOffsetY + roomHeightPx - lockerHeightPx))

    // world → absolute
    return { x: cx * ss + sx, y: cy * ss + sy }
  }
}

// ─── Colour helpers ──────────────────────────────────────────────

/** Darken a hex colour by `amount` (0–1). */
export function darkenHex(hex: string, amount: number): string {
  const h = hex.replace('#', '').padEnd(6, '0')
  const r = Math.max(0, Math.round(parseInt(h.slice(0, 2), 16) * (1 - amount)))
  const g = Math.max(0, Math.round(parseInt(h.slice(2, 4), 16) * (1 - amount)))
  const b = Math.max(0, Math.round(parseInt(h.slice(4, 6), 16) * (1 - amount)))
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

// ─── Depth projection ────────────────────────────────────────────

export const PROJ_ANGLE = Math.PI / 6   // 30°
export const PROJ_SCALE = 0.45          // depth appears at 45% of real depth

export function projOffset(depthPx: number) {
  return {
    dx:  depthPx * PROJ_SCALE * Math.cos(PROJ_ANGLE),
    dy: -depthPx * PROJ_SCALE * Math.sin(PROJ_ANGLE),
  }
}

// ─── Label generation ───────────────────────────────────────────

export const nextLabel = (existingLockers: LockerObject[]): string => {
  const nums = existingLockers
    .map((l) => parseInt(l.label.replace(/\D/g, ''), 10))
    .filter((n) => !isNaN(n))
  const max = nums.length > 0 ? Math.max(...nums) : 0
  return `L${String(max + 1).padStart(2, '0')}`
}

// ─── Bounding box ───────────────────────────────────────────────

export const getLockerBounds = (locker: LockerObject, scale: number) => ({
  x: locker.x,
  y: locker.y,
  width:  mmToPx(locker.widthMm,  scale),
  height: mmToPx(locker.heightMm, scale),
})

// ─── Overlap detection ──────────────────────────────────────────

export const checkOverlap = (a: LockerObject, b: LockerObject, scale: number): boolean => {
  const aw = mmToPx(a.widthMm, scale), ah = mmToPx(a.heightMm, scale)
  const bw = mmToPx(b.widthMm, scale), bh = mmToPx(b.heightMm, scale)
  return a.x < b.x + bw && a.x + aw > b.x && a.y < b.y + bh && a.y + ah > b.y
}
