// lib/store.ts
// Zustand store — single source of truth for canvas state

import { create } from 'zustand'
import { nanoid } from 'nanoid'
import { nextLabel } from './canvas-helpers'
import {
  DEFAULT_ROOM_CONFIG,
  DEFAULT_LABEL_STYLE,
  DEFAULT_OFFICE_INFO,
  mmToPx,
  blockWidthMm,
  blockHeightMm,
  type LockerObject,
  type LockerBlock,
  type RoomConfig,
  type CanvasData,
  type LabelStyle,
  type OfficeInfo,
} from '@/types'

export type AlignmentType =
  | 'left' | 'right' | 'top' | 'bottom'
  | 'center-h' | 'center-v'
  | 'distribute-h' | 'distribute-v'

interface CanvasStore {
  // State
  lockers: LockerObject[]
  lockerBlocks: LockerBlock[]
  room: RoomConfig
  selectedId: string | null
  selectedType: 'locker' | 'block' | null
  selectedIds: string[]
  showDimensions: boolean
  showDepth: boolean
  isDirty: boolean
  projectName: string
  labelStyle: LabelStyle
  officeInfo: OfficeInfo

  // LockerObject actions
  addLocker: (template: Partial<LockerObject>) => void
  updateLocker: (updated: LockerObject) => void
  deleteLocker: (id: string) => void

  // LockerBlock actions
  addLockerBlock: (block: Omit<LockerBlock, 'id'>) => void
  updateLockerBlock: (updated: LockerBlock) => void
  deleteLockerBlock: (id: string) => void

  // Selection
  selectItem: (id: string | null, type: 'locker' | 'block' | null) => void
  toggleSelectItem: (id: string, type: 'locker' | 'block') => void
  selectAll: () => void
  clearSelection: () => void
  selectBatch: (items: { id: string; type: 'locker' | 'block' }[]) => void
  bulkMove: (dx: number, dy: number) => void

  // Alignment (operates on selectedIds)
  alignItems: (alignment: AlignmentType) => void

  // Canvas / room
  setRoom: (room: Partial<RoomConfig>) => void
  setShowDimensions: (show: boolean) => void
  setShowDepth: (show: boolean) => void
  setProjectName: (name: string) => void
  setLabelStyle: (style: Partial<LabelStyle>) => void
  setOfficeInfo: (info: Partial<OfficeInfo>) => void
  loadCanvasData: (data: CanvasData) => void
  getCanvasData: () => CanvasData
  markSaved: () => void
  resetCanvas: () => void
}

export const useCanvasStore = create<CanvasStore>((set, get) => ({
  lockers: [],
  lockerBlocks: [],
  room: DEFAULT_ROOM_CONFIG,
  selectedId: null,
  selectedType: null,
  selectedIds: [],
  showDimensions: true,
  showDepth: false,
  isDirty: false,
  projectName: 'New Layout',
  labelStyle: DEFAULT_LABEL_STYLE,
  officeInfo: DEFAULT_OFFICE_INFO,

  // ── LockerObject ──────────────────────────────────────────────
  addLocker: (template) => {
    const { lockers } = get()
    const newLocker: LockerObject = {
      id: nanoid(),
      x: 80,
      y: 80,
      widthMm: 300,
      heightMm: 1800,
      depthMm: 450,
      label: nextLabel(lockers),
      color: '#94a3b8',
      rotation: 0,
      ...template,
    }
    set({ lockers: [...lockers, newLocker], selectedId: newLocker.id, selectedType: 'locker', selectedIds: [newLocker.id], isDirty: true })
  },

  updateLocker: (updated) =>
    set((s) => ({
      lockers: s.lockers.map((l) => (l.id === updated.id ? updated : l)),
      isDirty: true,
    })),

  deleteLocker: (id) =>
    set((s) => ({
      lockers: s.lockers.filter((l) => l.id !== id),
      selectedId: s.selectedId === id ? null : s.selectedId,
      selectedType: s.selectedId === id ? null : s.selectedType,
      selectedIds: s.selectedIds.filter((i) => i !== id),
      isDirty: true,
    })),

  // ── LockerBlock ───────────────────────────────────────────────
  addLockerBlock: (block) => {
    const newBlock: LockerBlock = { ...block, id: nanoid() }
    set((s) => ({
      lockerBlocks: [...s.lockerBlocks, newBlock],
      selectedId: newBlock.id,
      selectedType: 'block',
      selectedIds: [newBlock.id],
      isDirty: true,
    }))
  },

  updateLockerBlock: (updated) =>
    set((s) => ({
      lockerBlocks: s.lockerBlocks.map((b) => (b.id === updated.id ? updated : b)),
      isDirty: true,
    })),

  deleteLockerBlock: (id) =>
    set((s) => ({
      lockerBlocks: s.lockerBlocks.filter((b) => b.id !== id),
      selectedId: s.selectedId === id ? null : s.selectedId,
      selectedType: s.selectedId === id ? null : s.selectedType,
      selectedIds: s.selectedIds.filter((i) => i !== id),
      isDirty: true,
    })),

  // ── Selection ────────────────────────────────────────────────
  selectItem: (id, type) =>
    set({ selectedId: id, selectedType: type, selectedIds: id ? [id] : [] }),

  toggleSelectItem: (id, type) =>
    set((s) => {
      const already = s.selectedIds.includes(id)
      const nextIds = already ? s.selectedIds.filter((i) => i !== id) : [...s.selectedIds, id]
      const nextPrimary = already ? (nextIds[0] ?? null) : id
      const nextType = nextPrimary
        ? (nextPrimary === id ? type : s.selectedType)
        : null
      return { selectedIds: nextIds, selectedId: nextPrimary, selectedType: nextType }
    }),

  selectAll: () =>
    set((s) => {
      const allIds = [...s.lockers.map((l) => l.id), ...s.lockerBlocks.map((b) => b.id)]
      const first = allIds[0] ?? null
      return {
        selectedIds: allIds,
        selectedId: first,
        selectedType: first
          ? (s.lockers.find((l) => l.id === first) ? 'locker' : 'block')
          : null,
      }
    }),

  clearSelection: () => set({ selectedId: null, selectedType: null, selectedIds: [] }),

  selectBatch: (items) => {
    if (items.length === 0) { set({ selectedId: null, selectedType: null, selectedIds: [] }); return }
    set({
      selectedIds: items.map((i) => i.id),
      selectedId:   items[0].id,
      selectedType: items[0].type,
    })
  },

  bulkMove: (dx, dy) =>
    set((s) => ({
      lockers: s.lockers.map((l) =>
        s.selectedIds.includes(l.id) ? { ...l, x: l.x + dx, y: l.y + dy } : l
      ),
      lockerBlocks: s.lockerBlocks.map((b) =>
        s.selectedIds.includes(b.id) ? { ...b, x: b.x + dx, y: b.y + dy } : b
      ),
      isDirty: true,
    })),

  // ── Alignment ────────────────────────────────────────────────
  alignItems: (alignment) => {
    const { lockers, lockerBlocks, selectedIds, room } = get()
    const scale = room.scale

    type BBox = { id: string; kind: 'locker' | 'block'; x: number; y: number; w: number; h: number }
    const items: BBox[] = []
    for (const id of selectedIds) {
      const lo = lockers.find((l) => l.id === id)
      if (lo) { items.push({ id, kind: 'locker', x: lo.x, y: lo.y, w: mmToPx(lo.widthMm, scale), h: mmToPx(lo.heightMm, scale) }); continue }
      const bl = lockerBlocks.find((b) => b.id === id)
      if (bl) items.push({ id, kind: 'block', x: bl.x, y: bl.y, w: mmToPx(blockWidthMm(bl.config), scale), h: mmToPx(blockHeightMm(bl.config), scale) })
    }
    if (items.length < 2) return

    const minX = Math.min(...items.map((i) => i.x))
    const maxX = Math.max(...items.map((i) => i.x + i.w))
    const minY = Math.min(...items.map((i) => i.y))
    const maxY = Math.max(...items.map((i) => i.y + i.h))
    const midX = (minX + maxX) / 2
    const midY = (minY + maxY) / 2

    const newPos: Record<string, { x: number; y: number }> = {}

    if (alignment === 'distribute-h') {
      const sorted = [...items].sort((a, b) => a.x - b.x)
      const totalW = sorted.reduce((s, i) => s + i.w, 0)
      const gap = Math.max(0, (maxX - minX - totalW) / (items.length - 1))
      let cur = minX
      sorted.forEach((item) => { newPos[item.id] = { x: cur, y: item.y }; cur += item.w + gap })
    } else if (alignment === 'distribute-v') {
      const sorted = [...items].sort((a, b) => a.y - b.y)
      const totalH = sorted.reduce((s, i) => s + i.h, 0)
      const gap = Math.max(0, (maxY - minY - totalH) / (items.length - 1))
      let cur = minY
      sorted.forEach((item) => { newPos[item.id] = { x: item.x, y: cur }; cur += item.h + gap })
    } else {
      items.forEach((item) => {
        let x = item.x, y = item.y
        if (alignment === 'left')     x = minX
        if (alignment === 'right')    x = maxX - item.w
        if (alignment === 'top')      y = minY
        if (alignment === 'bottom')   y = maxY - item.h
        if (alignment === 'center-h') x = midX - item.w / 2
        if (alignment === 'center-v') y = midY - item.h / 2
        newPos[item.id] = { x, y }
      })
    }

    set((s) => ({
      lockers:      s.lockers.map((l)      => newPos[l.id] ? { ...l, ...newPos[l.id] } : l),
      lockerBlocks: s.lockerBlocks.map((b) => newPos[b.id] ? { ...b, ...newPos[b.id] } : b),
      isDirty: true,
    }))
  },

  // ── Canvas / room ────────────────────────────────────────────
  setRoom: (room) =>
    set((s) => ({ room: { ...s.room, ...room }, isDirty: true })),

  setShowDimensions: (show) => set({ showDimensions: show }),
  setShowDepth: (show) => set({ showDepth: show }),

  setProjectName: (name) => set({ projectName: name, isDirty: true }),

  setLabelStyle: (style) =>
    set((s) => ({ labelStyle: { ...s.labelStyle, ...style }, isDirty: true })),

  setOfficeInfo: (info) =>
    set((s) => ({ officeInfo: { ...s.officeInfo, ...info }, isDirty: true })),

  loadCanvasData: (data) =>
    set({
      lockers: data.lockers ?? [],
      lockerBlocks: data.lockerBlocks ?? [],
      room: data.room,
      labelStyle: data.labelStyle ?? DEFAULT_LABEL_STYLE,
      officeInfo: data.officeInfo ?? DEFAULT_OFFICE_INFO,
      isDirty: false,
      selectedId: null,
      selectedType: null,
      selectedIds: [],
    }),

  getCanvasData: (): CanvasData => {
    const { lockers, lockerBlocks, room, labelStyle, officeInfo } = get()
    return { lockers, lockerBlocks, room, labelStyle, officeInfo, version: 1 }
  },

  markSaved: () => set({ isDirty: false }),

  resetCanvas: () => set({
    lockers: [],
    lockerBlocks: [],
    room: DEFAULT_ROOM_CONFIG,
    selectedId: null,
    selectedType: null,
    selectedIds: [],
    isDirty: false,
    projectName: 'New Layout',
    labelStyle: DEFAULT_LABEL_STYLE,
    officeInfo: DEFAULT_OFFICE_INFO,
  }),
}))
