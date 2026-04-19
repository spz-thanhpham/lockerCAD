'use client'
// components/editor/CanvasBoard.tsx

import { useRef, useState, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react'
import { Stage, Layer, Rect } from 'react-konva'
import type Konva from 'konva'
import { mmToPx } from '@/lib/canvas-helpers'
import { registerCapture } from '@/lib/canvas-capture'
import { DEFAULT_LABEL_STYLE, DEFAULT_OFFICE_INFO, type LockerObject, type LockerBlock, type RoomConfig, type LabelStyle, type OfficeInfo } from '@/types'
import LockerObjectComponent from './LockerObject'
import LockerBlockObjectComponent from './LockerBlockObject'
import RoomOutline from './RoomOutline'
import DimensionLine from './DimensionLine'
import TitleBlock from './TitleBlock'

const CANVAS_PADDING  = 60
const ZOOM_STEP       = 1.12
const ZOOM_MIN        = 0.2
const ZOOM_MAX        = 5
const TITLE_BLOCK_W   = 260
const TITLE_BLOCK_GAP = 20
// Must match TitleBlock.tsx: HEADER_H(28) + 6 rows×ROW(18) + 1
const TITLE_BLOCK_H   = 137

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
}

interface CanvasBoardProps {
  lockers: LockerObject[]
  lockerBlocks: LockerBlock[]
  room: RoomConfig
  selectedId: string | null
  selectedIds: string[]
  labelStyle?: LabelStyle
  officeInfo?: OfficeInfo
  projectName?: string
  onSelectItem: (id: string | null, type: 'locker' | 'block' | null) => void
  onToggleSelectItem: (id: string, type: 'locker' | 'block') => void
  onUpdateLocker: (updated: LockerObject) => void
  onUpdateLockerBlock: (updated: LockerBlock) => void
  showDimensions: boolean
  showDepth?: boolean
  activeTool?: 'select' | 'pan'
  onZoomChange?: (zoom: number) => void
}

const CanvasBoard = forwardRef<CanvasBoardHandle, CanvasBoardProps>(function CanvasBoard(
  {
    lockers, lockerBlocks, room,
    selectedId, selectedIds,
    labelStyle = DEFAULT_LABEL_STYLE,
    officeInfo = DEFAULT_OFFICE_INFO,
    projectName = '',
    onSelectItem, onToggleSelectItem,
    onUpdateLocker, onUpdateLockerBlock,
    showDimensions, showDepth = false, activeTool = 'select', onZoomChange,
  },
  ref
) {
  const stageRef     = useRef<Konva.Stage>(null)
  const dimLayerRef  = useRef<Konva.Layer>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom]                   = useState(1)
  const [containerSize, setContainerSize] = useState({ width: 1600, height: 900 })

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => setContainerSize({ width: el.clientWidth, height: el.clientHeight })
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const roomWidthPx  = mmToPx(room.widthMm, room.scale)
  const roomHeightPx = mmToPx(room.depthMm, room.scale)
  // Extra height below room for title block
  const stageWidth  = Math.max(containerSize.width,  roomWidthPx  + CANVAS_PADDING * 2)
  const stageHeight = Math.max(containerSize.height, roomHeightPx + CANVAS_PADDING * 2 + 160)

  // Register capture fn in module-level registry every render so refs stay fresh.
  // Bypasses the forwardRef + Next.js dynamic() ref-forwarding issue entirely.
  useEffect(() => {
    registerCapture((opts?: ExportImageOpts) => {
      const stage    = stageRef.current
      const dimLayer = dimLayerRef.current
      if (!stage) return null

      // Crop to exact content bounds regardless of current zoom/pan
      const cW = roomWidthPx  + CANVAS_PADDING * 2
      const cH = roomHeightPx + CANVAS_PADDING * 2 + TITLE_BLOCK_GAP + TITLE_BLOCK_H

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

  // Stable callback — reads live stage transform without causing re-renders
  const getStageTransform = useCallback(
    () => ({ x: stageRef.current?.x() ?? 0, y: stageRef.current?.y() ?? 0, scaleX: stageRef.current?.scaleX() ?? 1 }),
    []
  )

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
  }), [zoom, applyZoom, onZoomChange])

  const handleStageClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (e.target === e.target.getStage()) onSelectItem(null, null)
    },
    [onSelectItem]
  )

  const handleWheel = useCallback((e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault()
    const pointer = stageRef.current?.getPointerPosition()
    applyZoom(
      e.evt.deltaY < 0 ? zoom * ZOOM_STEP : zoom / ZOOM_STEP,
      pointer?.x, pointer?.y
    )
  }, [zoom, applyZoom])

  // Title block positioned bottom-right of room
  const titleX    = CANVAS_PADDING + roomWidthPx - TITLE_BLOCK_W
  const titleY    = CANVAS_PADDING + roomHeightPx + TITLE_BLOCK_GAP
  // Drawing frame — outer border that spans room + title block
  const frameW    = roomWidthPx  + CANVAS_PADDING * 2
  const frameH    = roomHeightPx + CANVAS_PADDING * 2 + TITLE_BLOCK_GAP + TITLE_BLOCK_H

  return (
    <div ref={containerRef} className="bg-gray-100 rounded-lg border border-gray-200 w-full h-full overflow-hidden">
      <Stage
        ref={stageRef}
        width={stageWidth}
        height={stageHeight}
        onClick={handleStageClick}
        onWheel={handleWheel}
        draggable={activeTool === 'pan'}
      >
        <Layer>
          {/* Outer drawing frame border — encompasses room + title block */}
          <Rect x={1} y={1} width={frameW - 2} height={frameH - 2}
            fill="white" stroke="#334155" strokeWidth={1.5} listening={false} />

          <RoomOutline
            x={CANVAS_PADDING} y={CANVAS_PADDING}
            widthPx={roomWidthPx} heightPx={roomHeightPx}
            room={room}
          />

          {lockerBlocks.map((block) => (
            <LockerBlockObjectComponent
              key={block.id}
              block={block}
              scale={room.scale}
              isSelected={block.id === selectedId}
              isInMultiSelect={selectedIds.includes(block.id)}
              labelStyle={labelStyle}
              showDepth={showDepth}
              getStageTransform={getStageTransform}
              onSelect={(add) =>
                add ? onToggleSelectItem(block.id, 'block') : onSelectItem(block.id, 'block')
              }
              onChange={onUpdateLockerBlock}
              roomX={CANVAS_PADDING} roomY={CANVAS_PADDING}
              roomWidthPx={roomWidthPx} roomHeightPx={roomHeightPx}
              gridSizeMm={room.gridSizeMm}
            />
          ))}

          {lockers.map((locker) => (
            <LockerObjectComponent
              key={locker.id}
              locker={locker}
              scale={room.scale}
              isSelected={locker.id === selectedId}
              isInMultiSelect={selectedIds.includes(locker.id)}
              labelStyle={labelStyle}
              showDepth={showDepth}
              getStageTransform={getStageTransform}
              onSelect={(add) =>
                add ? onToggleSelectItem(locker.id, 'locker') : onSelectItem(locker.id, 'locker')
              }
              onChange={onUpdateLocker}
              roomX={CANVAS_PADDING} roomY={CANVAS_PADDING}
              roomWidthPx={roomWidthPx} roomHeightPx={roomHeightPx}
              gridSizeMm={room.gridSizeMm}
            />
          ))}

          {/* Workshop title block */}
          <TitleBlock
            x={titleX}
            y={titleY}
            officeInfo={officeInfo}
            projectName={projectName}
          />
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
