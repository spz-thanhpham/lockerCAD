'use client'
// components/editor/CanvasBoard.tsx

import { useRef, useState, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react'
import { Stage, Layer, Rect } from 'react-konva'
import type Konva from 'konva'
import { mmToPx } from '@/lib/canvas-helpers'
import { registerCapture } from '@/lib/canvas-capture'
import { registerZoom, isZoomLocked } from '@/lib/canvas-zoom'
import { DEFAULT_LABEL_STYLE, blockWidthMm, blockHeightMm, type LockerObject, type LockerBlock, type TextLabel, type ShapeObject, type ShapeType, type RoomConfig, type LabelStyle } from '@/types'
import LockerObjectComponent from './LockerObject'
import LockerBlockObjectComponent from './LockerBlockObject'
import TextLabelObject from './TextLabelObject'
import ShapeObjectComponent from './ShapeObject'
import RoomOutline from './RoomOutline'
import DimensionLine from './DimensionLine'

const CANVAS_PADDING  = 60
const ZOOM_STEP       = 1.12
const ZOOM_MIN        = 0.2
const ZOOM_MAX        = 5

export interface ExportImageOpts {
  hideDimensions?: boolean
  pixelRatio?: number
  mimeType?: 'image/png' | 'image/jpeg'
}

export interface CanvasBoardHandle {
  getStageDataUrl: (opts?: ExportImageOpts) => string | null
  zoomIn: () => void
  zoomOut: () => void
  zoomReset: () => void
  fitToRoom: () => void
}

type ActiveTool = 'select' | 'pan' | 'text' | 'rect' | 'circle'

interface CanvasBoardProps {
  lockers: LockerObject[]
  lockerBlocks: LockerBlock[]
  textLabels: TextLabel[]
  shapes: ShapeObject[]
  room: RoomConfig
  selectedId: string | null
  selectedIds: string[]
  labelStyle?: LabelStyle
  onSelectItem: (id: string | null, type: 'locker' | 'block' | 'textLabel' | 'shape' | null) => void
  onToggleSelectItem: (id: string, type: 'locker' | 'block' | 'textLabel' | 'shape') => void
  onSelectBatch: (items: { id: string; type: 'locker' | 'block' }[]) => void
  onSelectCell: (blockId: string, colIdx: number, cellIdx: number) => void
  onSelectLockset: (blockId: string, locksetIdx: number) => void
  selectedCellKey?: string      // "blockId:colIdx:cellIdx"
  selectedLocksetKey?: string   // "blockId:locksetIdx"
  onUpdateLocker: (updated: LockerObject) => void
  onUpdateLockerBlock: (updated: LockerBlock) => void
  onUpdateTextLabel: (updated: TextLabel) => void
  onAddTextLabel: (x: number, y: number) => void
  onUpdateShape: (updated: ShapeObject) => void
  onAddShape: (type: ShapeType, x: number, y: number) => void
  onBulkMove?: (dx: number, dy: number) => void
  showDimensions: boolean
  showBlockDimensions?: boolean
  showDepth?: boolean
  cadView?: boolean
  activeTool?: ActiveTool
  onZoomChange?: (zoom: number) => void
  onToolChange?: (tool: ActiveTool) => void
}

const CanvasBoard = forwardRef<CanvasBoardHandle, CanvasBoardProps>(function CanvasBoard(
  {
    lockers, lockerBlocks, textLabels, shapes, room,
    selectedId, selectedIds,
    labelStyle = DEFAULT_LABEL_STYLE,
    onSelectItem, onToggleSelectItem, onSelectBatch, onSelectCell, onSelectLockset,
    selectedCellKey, selectedLocksetKey,
    onUpdateLocker, onUpdateLockerBlock, onUpdateTextLabel, onAddTextLabel,
    onUpdateShape, onAddShape,
    onBulkMove,
    showDimensions, showBlockDimensions = true, showDepth = false, cadView = false, activeTool = 'select', onZoomChange, onToolChange,
  },
  ref
) {
  const stageRef     = useRef<Konva.Stage>(null)
  const dimLayerRef  = useRef<Konva.Layer>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const hasFittedRef = useRef(false)
  const [zoom, setZoom]                   = useState(1)
  const [containerSize, setContainerSize] = useState({ width: 1600, height: 900 })
  const [shiftHeld, setShiftHeld]         = useState(false)
  const [dragDelta, setDragDelta]         = useState<{ sourceId: string; dx: number; dy: number } | null>(null)

  // Drag-select (marquee) state
  const selOriginRef  = useRef<{ x: number; y: number } | null>(null)
  const wasDragSelect = useRef(false)
  const [selBox, setSelBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => setContainerSize({ width: el.clientWidth, height: el.clientHeight })
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Track Shift key globally so Transformer can enable rotation snaps
  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.key === 'Shift') setShiftHeld(true)  }
    const up   = (e: KeyboardEvent) => { if (e.key === 'Shift') setShiftHeld(false) }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup',   up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [])

  const roomWidthPx  = mmToPx(room.widthMm, room.scale)
  const roomHeightPx = mmToPx(room.depthMm, room.scale)
  const stageWidth  = Math.max(containerSize.width,  roomWidthPx  + CANVAS_PADDING * 2)
  const stageHeight = Math.max(containerSize.height, roomHeightPx + CANVAS_PADDING * 2)

  // Register capture fn in module-level registry every render so refs stay fresh.
  // Bypasses the forwardRef + Next.js dynamic() ref-forwarding issue entirely.
  useEffect(() => {
    registerCapture((opts?: ExportImageOpts) => {
      const stage    = stageRef.current
      const dimLayer = dimLayerRef.current
      if (!stage) return null

      // Crop to exact content bounds regardless of current zoom/pan
      const cW = roomWidthPx  + CANVAS_PADDING * 2
      const cH = roomHeightPx + CANVAS_PADDING * 2

      // Save current viewport transform
      const prevScale = stage.scaleX()
      const prevPos   = stage.position()

      // Reset to 1:1 so content coords match pixel coords
      stage.scale({ x: 1, y: 1 })
      stage.position({ x: 0, y: 0 })

      const hide = opts?.hideDimensions
      if (hide) {
        dimLayer?.hide()
        // Hide depth CAD annotations embedded in the main layer
        stage.find('.depth-dim').forEach((n) => n.hide())
        stage.draw()
      }

      const url = stage.toDataURL({
        x: 0, y: 0, width: cW, height: cH,
        pixelRatio: opts?.pixelRatio ?? 2,
        mimeType:   opts?.mimeType  ?? 'image/png',
      })

      if (hide) {
        dimLayer?.show()
        stage.find('.depth-dim').forEach((n) => n.show())
      }
      // Restore viewport
      stage.scale({ x: prevScale, y: prevScale })
      stage.position(prevPos)
      stage.batchDraw()

      return url
    })
    return () => registerCapture(null)
  })

  // Register zoom controls — same registry pattern as capture
  useEffect(() => {
    registerZoom({
      zoomIn:    () => applyZoom(zoom * ZOOM_STEP),
      zoomOut:   () => applyZoom(zoom / ZOOM_STEP),
      zoomReset: () => {
        const stage = stageRef.current; if (!stage) return
        stage.scale({ x: 1, y: 1 }); stage.position({ x: 0, y: 0 })
        setZoom(1); onZoomChange?.(1)
      },
      fitToRoom,
      setLevel: (z) => applyZoom(z),
    })
    return () => registerZoom(null)
  })

  // Stable callback — reads live stage transform without causing re-renders
  const getStageTransform = useCallback(
    () => ({ x: stageRef.current?.x() ?? 0, y: stageRef.current?.y() ?? 0, scaleX: stageRef.current?.scaleX() ?? 1 }),
    []
  )

  const fitToRoom = useCallback(() => {
    const stage = stageRef.current
    const container = containerRef.current
    if (!stage || !container) return
    const availW = container.clientWidth
    const availH = container.clientHeight
    const pad = CANVAS_PADDING * 2
    const newZoom = Math.min(
      ZOOM_MAX,
      Math.max(ZOOM_MIN, Math.min(availW / (roomWidthPx + pad), availH / (roomHeightPx + pad)))
    )
    const roomCenterX = CANVAS_PADDING + roomWidthPx / 2
    const roomCenterY = CANVAS_PADDING + roomHeightPx / 2
    stage.scale({ x: newZoom, y: newZoom })
    stage.position({ x: availW / 2 - roomCenterX * newZoom, y: availH / 2 - roomCenterY * newZoom })
    setZoom(newZoom)
    onZoomChange?.(newZoom)
  }, [roomWidthPx, roomHeightPx, onZoomChange])

  // Auto-fit on first real container measurement
  useEffect(() => {
    if (!hasFittedRef.current && containerSize.width !== 1600) {
      hasFittedRef.current = true
      fitToRoom()
    }
  }, [containerSize, fitToRoom])

  const applyZoom = useCallback((newZoom: number, centerX?: number, centerY?: number) => {
    const stage = stageRef.current
    if (!stage) return
    const clampedZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, newZoom))
    const cx = centerX ?? stage.width() / 2
    const cy = centerY ?? stage.height() / 2
    const oldZoom = stage.scaleX()
    const mousePointTo = { x: (cx - stage.x()) / oldZoom, y: (cy - stage.y()) / oldZoom }
    stage.scale({ x: clampedZoom, y: clampedZoom })
    stage.position({ x: cx - mousePointTo.x * clampedZoom, y: cy - mousePointTo.y * clampedZoom })
    setZoom(clampedZoom)
    onZoomChange?.(clampedZoom)
  }, [onZoomChange])

  useImperativeHandle(ref, () => ({
    getStageDataUrl: (opts?: ExportImageOpts) => {
      const stage = stageRef.current
      const dimLayer = dimLayerRef.current
      if (!stage) return null
      const hide = opts?.hideDimensions && dimLayer
      if (hide) { dimLayer!.hide(); stage.draw() }
      const url = stage.toDataURL({
        pixelRatio: opts?.pixelRatio ?? 2,
        mimeType: opts?.mimeType ?? 'image/png',
      })
      if (hide) { dimLayer!.show(); stage.draw() }
      return url
    },
    zoomIn:    () => applyZoom(zoom * ZOOM_STEP),
    zoomOut:   () => applyZoom(zoom / ZOOM_STEP),
    zoomReset: () => {
      const stage = stageRef.current
      if (!stage) return
      stage.scale({ x: 1, y: 1 })
      stage.position({ x: 0, y: 0 })
      setZoom(1)
      onZoomChange?.(1)
    },
    fitToRoom,
  }), [zoom, applyZoom, fitToRoom, onZoomChange])

  // ── Drag-select helpers ──────────────────────────────────────────
  const isOnObject = (target: Konva.Node) => {
    let node: Konva.Node | null = target
    while (node) { if ((node as any).draggable?.()) return true; node = node.getParent() }
    return false
  }

  const handleStageMouseDown = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    if (activeTool !== 'select') return
    if (isOnObject(e.target)) return
    const pos = stageRef.current?.getRelativePointerPosition()
    if (!pos) return
    selOriginRef.current = pos
    setSelBox(null)
  }, [activeTool])

  const handleStageMouseMove = useCallback((_e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!selOriginRef.current) return
    const pos = stageRef.current?.getRelativePointerPosition()
    if (!pos) return
    const o = selOriginRef.current
    setSelBox({ x: Math.min(o.x, pos.x), y: Math.min(o.y, pos.y), w: Math.abs(pos.x - o.x), h: Math.abs(pos.y - o.y) })
  }, [])

  // Use refs so handleStageMouseUp is stable and always sees latest values
  const selBoxRef      = useRef(selBox)
  const lockersRef     = useRef(lockers)
  const blocksRef      = useRef(lockerBlocks)
  const scaleRef       = useRef(room.scale)
  const selectBatchRef = useRef(onSelectBatch)
  selBoxRef.current      = selBox
  lockersRef.current     = lockers
  blocksRef.current      = lockerBlocks
  scaleRef.current       = room.scale
  selectBatchRef.current = onSelectBatch

  const handleStageMouseUp = useCallback(() => {
    const box = selBoxRef.current
    selOriginRef.current = null
    setSelBox(null)
    if (!box || (box.w < 5 && box.h < 5)) { wasDragSelect.current = false; return }
    wasDragSelect.current = true

    const sc = scaleRef.current
    const hits = (ax: number, ay: number, aw: number, ah: number) =>
      ax < box.x + box.w && ax + aw > box.x && ay < box.y + box.h && ay + ah > box.y

    const matched: { id: string; type: 'locker' | 'block' }[] = []
    lockersRef.current.forEach((l) => {
      if (hits(l.x, l.y, mmToPx(l.widthMm, sc), mmToPx(l.heightMm, sc)))
        matched.push({ id: l.id, type: 'locker' })
    })
    blocksRef.current.forEach((b) => {
      const bw = mmToPx(blockWidthMm(b.config), sc)
      const bh = mmToPx(blockHeightMm(b.config) + (b.legsHeightMm ?? 0), sc)
      if (hits(b.x, b.y, bw, bh)) matched.push({ id: b.id, type: 'block' })
    })
    selectBatchRef.current(matched) // single atomic store update
  }, []) // stable — reads everything through refs

  // Cancel drag-select if mouse releases outside the canvas
  useEffect(() => {
    const onWindowMouseUp = () => {
      if (selOriginRef.current) { selOriginRef.current = null; setSelBox(null) }
    }
    window.addEventListener('mouseup', onWindowMouseUp)
    return () => window.removeEventListener('mouseup', onWindowMouseUp)
  }, [])

  const handleStageClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (activeTool === 'text') {
        const pos = stageRef.current?.getRelativePointerPosition()
        if (pos) { onAddTextLabel(pos.x, pos.y); onToolChange?.('select') }
        return
      }
      if (activeTool === 'rect' || activeTool === 'circle') {
        const pos = stageRef.current?.getRelativePointerPosition()
        if (pos) { onAddShape(activeTool, pos.x, pos.y); onToolChange?.('select') }
        return
      }
      // After a drag-select, suppress the click-deselect
      if (wasDragSelect.current) { wasDragSelect.current = false; return }
      if (!isOnObject(e.target)) onSelectItem(null, null)
    },
    [activeTool, onAddTextLabel, onAddShape, onToolChange, onSelectItem]
  )

  const handleWheel = useCallback((e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault()
    if (isZoomLocked()) return
    const pointer = stageRef.current?.getPointerPosition()
    applyZoom(
      e.evt.deltaY < 0 ? zoom * ZOOM_STEP : zoom / ZOOM_STEP,
      pointer?.x, pointer?.y
    )
  }, [zoom, applyZoom])

  // Drawing frame — outer border around the room
  const frameW    = roomWidthPx  + CANVAS_PADDING * 2
  const frameH    = roomHeightPx + CANVAS_PADDING * 2

  return (
    <div ref={containerRef} className="bg-gray-100 rounded-lg border border-gray-200 w-full h-full overflow-hidden">
      <Stage
        ref={stageRef}
        width={stageWidth}
        height={stageHeight}
        onClick={handleStageClick}
        onMouseDown={handleStageMouseDown}
        onMouseMove={handleStageMouseMove}
        onMouseUp={handleStageMouseUp}
        onWheel={handleWheel}
        draggable={activeTool === 'pan'}
        style={{ cursor: activeTool === 'text' ? 'text' : activeTool === 'rect' || activeTool === 'circle' ? 'crosshair' : selBox ? 'crosshair' : undefined }}
      >
        <Layer>
          {/* White background so PNG export has a clean base */}
          <Rect x={0} y={0} width={frameW} height={frameH}
            fill="white" listening={false} />

          <RoomOutline
            x={CANVAS_PADDING} y={CANVAS_PADDING}
            widthPx={roomWidthPx} heightPx={roomHeightPx}
            room={room}
          />

          {lockerBlocks.map((block) => {
            const pfx = block.id + ':'
            const blockCellKey = selectedCellKey?.startsWith(pfx)
              ? selectedCellKey.slice(pfx.length)
              : undefined
            const blockLocksetIdx = selectedLocksetKey?.startsWith(pfx)
              ? parseInt(selectedLocksetKey.slice(pfx.length), 10)
              : undefined
            const isMultiMember = selectedIds.length > 1 && selectedIds.includes(block.id)
            const isDragSource = dragDelta?.sourceId === block.id
            const displayBlock = dragDelta && isMultiMember && !isDragSource
              ? { ...block, x: block.x + dragDelta.dx, y: block.y + dragDelta.dy }
              : block
            return (
              <LockerBlockObjectComponent
                key={block.id}
                block={displayBlock}
                scale={room.scale}
                isSelected={block.id === selectedId}
                isInMultiSelect={selectedIds.includes(block.id)}
                labelStyle={labelStyle}
                showDepth={showDepth}
                cadView={cadView}
                getStageTransform={getStageTransform}
                onSelect={(add) =>
                  add ? onToggleSelectItem(block.id, 'block') : onSelectItem(block.id, 'block')
                }
                onSelectCell={onSelectCell}
                onSelectLockset={onSelectLockset}
                selectedCellKey={blockCellKey}
                selectedLocksetIdx={blockLocksetIdx}
                onChange={onUpdateLockerBlock}
                showBlockDimensions={showBlockDimensions}
                onMultiDragMove={isMultiMember ? (dx, dy) => setDragDelta({ sourceId: block.id, dx, dy }) : undefined}
                onMultiDragEnd={isMultiMember ? (dx, dy) => { setDragDelta(null); onBulkMove?.(dx, dy) } : undefined}
                roomX={CANVAS_PADDING} roomY={CANVAS_PADDING}
                roomWidthPx={roomWidthPx} roomHeightPx={roomHeightPx}
                gridSizeMm={room.gridSizeMm}
                shiftHeld={shiftHeld}
              />
            )
          })}

          {lockers.map((locker) => {
            const isMultiMember = selectedIds.length > 1 && selectedIds.includes(locker.id)
            const isDragSource = dragDelta?.sourceId === locker.id
            const displayLocker = dragDelta && isMultiMember && !isDragSource
              ? { ...locker, x: locker.x + dragDelta.dx, y: locker.y + dragDelta.dy }
              : locker
            return (
              <LockerObjectComponent
                key={locker.id}
                locker={displayLocker}
                scale={room.scale}
                isSelected={locker.id === selectedId}
                isInMultiSelect={selectedIds.includes(locker.id)}
                labelStyle={labelStyle}
                showDepth={showDepth}
                cadView={cadView}
                getStageTransform={getStageTransform}
                onSelect={(add) =>
                  add ? onToggleSelectItem(locker.id, 'locker') : onSelectItem(locker.id, 'locker')
                }
                onChange={onUpdateLocker}
                onMultiDragMove={isMultiMember ? (dx, dy) => setDragDelta({ sourceId: locker.id, dx, dy }) : undefined}
                onMultiDragEnd={isMultiMember ? (dx, dy) => { setDragDelta(null); onBulkMove?.(dx, dy) } : undefined}
                shiftHeld={shiftHeld}
                roomX={CANVAS_PADDING} roomY={CANVAS_PADDING}
                roomWidthPx={roomWidthPx} roomHeightPx={roomHeightPx}
                gridSizeMm={room.gridSizeMm}
              />
            )
          })}

          {textLabels.map((tl) => (
            <TextLabelObject
              key={tl.id}
              label={tl}
              scale={room.scale}
              isSelected={tl.id === selectedId}
              onChange={onUpdateTextLabel}
              onSelect={() => onSelectItem(tl.id, 'textLabel')}
              roomX={CANVAS_PADDING} roomY={CANVAS_PADDING}
              roomWidthPx={roomWidthPx} roomHeightPx={roomHeightPx}
            />
          ))}

          {shapes.map((sh) => (
            <ShapeObjectComponent
              key={sh.id}
              shape={sh}
              isSelected={sh.id === selectedId}
              onChange={onUpdateShape}
              onSelect={() => onSelectItem(sh.id, 'shape')}
              roomX={CANVAS_PADDING} roomY={CANVAS_PADDING}
              roomWidthPx={roomWidthPx} roomHeightPx={roomHeightPx}
            />
          ))}

          {/* Drag-select rectangle */}
          {selBox && selBox.w > 1 && selBox.h > 1 && (
            <Rect
              x={selBox.x} y={selBox.y} width={selBox.w} height={selBox.h}
              fill="rgba(59,130,246,0.08)" stroke="#3b82f6" strokeWidth={1}
              dash={[4, 3]} listening={false}
            />
          )}
        </Layer>

        {/* Dimension layer — separate so it can be hidden during image export */}
        <Layer ref={dimLayerRef} listening={false}>
          {showDimensions && lockers.map((locker) => (
            <DimensionLine key={`dim-${locker.id}`} locker={locker} scale={room.scale} />
          ))}
        </Layer>
      </Stage>
    </div>
  )
})

export default CanvasBoard
