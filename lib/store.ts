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
  type TextLabel,
  type ShapeObject,
  type ShapeType,
  type RoomConfig,
  type CanvasData,
  type LabelStyle,
  type OfficeInfo,
} from '@/types'

export type AlignmentType =
  | 'left' | 'right' | 'top' | 'bottom'
  | 'center-h' | 'center-v'
  | 'distribute-h' | 'distribute-v'

type ClipboardItem =
  | { type: 'locker';    data: LockerObject }
  | { type: 'block';     data: LockerBlock  }
  | { type: 'textLabel'; data: TextLabel    }
  | { type: 'shape';     data: ShapeObject  }

interface CanvasStore {
  // State
  lockers: LockerObject[]
  lockerBlocks: LockerBlock[]
  textLabels: TextLabel[]
  shapes: ShapeObject[]
  room: RoomConfig
  selectedId: string | null
  selectedType: 'locker' | 'block' | 'textLabel' | 'shape' | null
  selectedIds: string[]
  clipboard: ClipboardItem[]
  clipboardOffset: number   // px offset added to each successive paste
  showDimensions: boolean
  showBlockDimensions: boolean
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

  // TextLabel actions
  addTextLabel: (x: number, y: number) => void
  updateTextLabel: (updated: TextLabel) => void
  deleteTextLabel: (id: string) => void

  // Shape actions
  addShape: (type: ShapeType, x: number, y: number) => void
  updateShape: (updated: ShapeObject) => void
  deleteShape: (id: string) => void

  // Clipboard / bulk delete
  copySelected: () => void
  paste: () => void
  duplicate: () => void
  deleteSelected: () => void

  // Selection
  selectItem: (id: string | null, type: 'locker' | 'block' | 'textLabel' | 'shape' | null) => void
  toggleSelectItem: (id: string, type: 'locker' | 'block' | 'textLabel' | 'shape') => void
  selectAll: () => void
  clearSelection: () => void
  selectBatch: (items: { id: string; type: 'locker' | 'block' | 'shape' }[]) => void
  bulkMove: (dx: number, dy: number) => void

  // Alignment (operates on selectedIds)
  alignItems: (alignment: AlignmentType) => void

  // Canvas / room
  setRoom: (room: Partial<RoomConfig>) => void
  setShowDimensions: (show: boolean) => void
  setShowBlockDimensions: (show: boolean) => void
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
  textLabels: [],
  shapes: [],
  room: DEFAULT_ROOM_CONFIG,
  clipboard: [],
  clipboardOffset: 20,
  selectedId: null,
  selectedType: null,
  selectedIds: [],
  showDimensions: true,
  showBlockDimensions: true,
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

  // ── TextLabel ────────────────────────────────────────────────
  addTextLabel: (x, y) => {
    const newLabel: TextLabel = {
      id: nanoid(),
      x, y,
      text: 'Text',
      fontSize: 14,
      fontStyle: 'normal',
      color: '#1e293b',
      rotation: 0,
    }
    set((s) => ({
      textLabels: [...s.textLabels, newLabel],
      selectedId: newLabel.id,
      selectedType: 'textLabel',
      selectedIds: [newLabel.id],
      isDirty: true,
    }))
  },

  updateTextLabel: (updated) =>
    set((s) => ({
      textLabels: s.textLabels.map((t) => (t.id === updated.id ? updated : t)),
      isDirty: true,
    })),

  deleteTextLabel: (id) =>
    set((s) => ({
      textLabels: s.textLabels.filter((t) => t.id !== id),
      selectedId: s.selectedId === id ? null : s.selectedId,
      selectedType: s.selectedId === id ? null : s.selectedType,
      selectedIds: s.selectedIds.filter((i) => i !== id),
      isDirty: true,
    })),

  // ── ShapeObject ──────────────────────────────────────────────
  addShape: (type, x, y) => {
    const newShape: ShapeObject = {
      id: nanoid(),
      type,
      x,
      y,
      width:  type === 'rect' ? 120 : 80,
      height: type === 'rect' ?  80 : 80,
      fill: 'rgba(59,130,246,0.15)',
      stroke: '#3b82f6',
      strokeWidth: 1.5,
      opacity: 1,
      rotation: 0,
      cornerRadius: 0,
    }
    set((s) => ({
      shapes: [...s.shapes, newShape],
      selectedId: newShape.id,
      selectedType: 'shape',
      selectedIds: [newShape.id],
      isDirty: true,
    }))
  },

  updateShape: (updated) =>
    set((s) => ({
      shapes: s.shapes.map((sh) => (sh.id === updated.id ? updated : sh)),
      isDirty: true,
    })),

  deleteShape: (id) =>
    set((s) => ({
      shapes: s.shapes.filter((sh) => sh.id !== id),
      selectedId: s.selectedId === id ? null : s.selectedId,
      selectedType: s.selectedId === id ? null : s.selectedType,
      selectedIds: s.selectedIds.filter((i) => i !== id),
      isDirty: true,
    })),

  // ── Clipboard ────────────────────────────────────────────────
  copySelected: () => {
    const { lockers, lockerBlocks, textLabels, shapes, selectedIds } = get()
    const items: ClipboardItem[] = []
    for (const id of selectedIds) {
      const lo = lockers.find((l) => l.id === id)
      if (lo) { items.push({ type: 'locker', data: lo }); continue }
      const bl = lockerBlocks.find((b) => b.id === id)
      if (bl) { items.push({ type: 'block', data: bl }); continue }
      const tl = textLabels.find((t) => t.id === id)
      if (tl) { items.push({ type: 'textLabel', data: tl }); continue }
      const sh = shapes.find((s) => s.id === id)
      if (sh) { items.push({ type: 'shape', data: sh }) }
    }
    if (items.length > 0) set({ clipboard: items, clipboardOffset: 20 })
  },

  paste: () => {
    const { clipboard, clipboardOffset } = get()
    if (clipboard.length === 0) return
    const off = clipboardOffset
    const newIds: string[] = []
    set((s) => {
      const newLockers     = [...s.lockers]
      const newBlocks      = [...s.lockerBlocks]
      const newTextLabels  = [...s.textLabels]
      const newShapes      = [...s.shapes]
      for (const item of clipboard) {
        const id = nanoid()
        newIds.push(id)
        if (item.type === 'locker')
          newLockers.push({ ...item.data, id, x: item.data.x + off, y: item.data.y + off })
        else if (item.type === 'block')
          newBlocks.push({ ...item.data, id, x: item.data.x + off, y: item.data.y + off })
        else if (item.type === 'textLabel')
          newTextLabels.push({ ...item.data, id, x: item.data.x + off, y: item.data.y + off })
        else
          newShapes.push({ ...item.data, id, x: item.data.x + off, y: item.data.y + off })
      }
      const firstType = clipboard[0]?.type === 'locker' ? 'locker'
        : clipboard[0]?.type === 'block' ? 'block'
        : clipboard[0]?.type === 'textLabel' ? 'textLabel'
        : 'shape'
      return {
        lockers: newLockers, lockerBlocks: newBlocks,
        textLabels: newTextLabels, shapes: newShapes,
        selectedIds: newIds, selectedId: newIds[0] ?? null,
        selectedType: newIds.length > 0 ? firstType : null,
        clipboardOffset: off + 20,
        isDirty: true,
      }
    })
  },

  duplicate: () => {
    // Copy current selection then immediately paste
    get().copySelected()
    // clipboardOffset was just reset to 20 by copySelected; paste will use it
    get().paste()
  },

  deleteSelected: () => {
    const { selectedIds } = get()
    if (selectedIds.length === 0) return
    set((s) => ({
      lockers:      s.lockers.filter((l)  => !s.selectedIds.includes(l.id)),
      lockerBlocks: s.lockerBlocks.filter((b) => !s.selectedIds.includes(b.id)),
      textLabels:   s.textLabels.filter((t)  => !s.selectedIds.includes(t.id)),
      shapes:       s.shapes.filter((sh) => !s.selectedIds.includes(sh.id)),
      selectedId: null, selectedType: null, selectedIds: [],
      isDirty: true,
    }))
  },

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
      const allIds = [
        ...s.lockers.map((l) => l.id),
        ...s.lockerBlocks.map((b) => b.id),
        ...s.textLabels.map((t) => t.id),
        ...s.shapes.map((sh) => sh.id),
      ]
      const first = allIds[0] ?? null
      const firstType = first
        ? s.lockers.find((l) => l.id === first) ? 'locker'
          : s.lockerBlocks.find((b) => b.id === first) ? 'block'
          : s.textLabels.find((t) => t.id === first) ? 'textLabel'
          : 'shape'
        : null
      return { selectedIds: allIds, selectedId: first, selectedType: firstType }
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
      textLabels: s.textLabels.map((t) =>
        s.selectedIds.includes(t.id) ? { ...t, x: t.x + dx, y: t.y + dy } : t
      ),
      shapes: s.shapes.map((sh) =>
        s.selectedIds.includes(sh.id) ? { ...sh, x: sh.x + dx, y: sh.y + dy } : sh
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
  setShowBlockDimensions: (show) => set({ showBlockDimensions: show }),
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
      textLabels: data.textLabels ?? [],
      shapes: data.shapes ?? [],
      room: data.room,
      labelStyle: data.labelStyle ?? DEFAULT_LABEL_STYLE,
      officeInfo: data.officeInfo ?? DEFAULT_OFFICE_INFO,
      isDirty: false,
      selectedId: null,
      selectedType: null,
      selectedIds: [],
    }),

  getCanvasData: (): CanvasData => {
    const { lockers, lockerBlocks, textLabels, shapes, room, labelStyle, officeInfo } = get()
    return { lockers, lockerBlocks, textLabels, shapes, room, labelStyle, officeInfo, version: 1 }
  },

  markSaved: () => set({ isDirty: false }),

  resetCanvas: () => set({
    lockers: [],
    lockerBlocks: [],
    textLabels: [],
    shapes: [],
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
