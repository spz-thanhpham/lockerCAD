'use client'
// components/editor/LockerObject.tsx

import { useRef, useEffect } from 'react'
import { Rect, Text, Group, Transformer, Line, Arrow } from 'react-konva'
import type Konva from 'konva'
import { mmToPx, makeRoomBoundFunc, projOffset, darkenHex } from '@/lib/canvas-helpers'
import { DEFAULT_LABEL_STYLE, type LockerObject, type LabelStyle } from '@/types'

interface Props {
  locker: LockerObject
  scale: number
  isSelected: boolean
  isInMultiSelect: boolean
  labelStyle?: LabelStyle
  showDepth?: boolean
  getStageTransform: () => { x: number; y: number; scaleX: number }
  onSelect: (addToSelection: boolean) => void
  onChange: (updated: LockerObject) => void
  onMultiDragMove?: (dx: number, dy: number) => void
  onMultiDragEnd?: (dx: number, dy: number) => void
  shiftHeld?: boolean
  roomX: number
  roomY: number
  roomWidthPx: number
  roomHeightPx: number
  gridSizeMm: number
}

const SNAP_ANGLES = [0, 30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330]

export default function LockerObjectComponent({
  locker, scale, isSelected, isInMultiSelect, labelStyle, showDepth, getStageTransform, onSelect, onChange,
  onMultiDragMove, onMultiDragEnd,
  shiftHeld, roomX, roomY, roomWidthPx, roomHeightPx, gridSizeMm,
}: Props) {
  const ls = labelStyle ?? DEFAULT_LABEL_STYLE
  const shapeRef    = useRef<Konva.Group>(null)
  const trRef       = useRef<Konva.Transformer>(null)
  const dragOrigin  = useRef<{ x: number; y: number } | null>(null)

  const wPx = mmToPx(locker.widthMm, scale)
  const hPx = mmToPx(locker.heightMm, scale)

  useEffect(() => {
    if (isSelected && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current])
      trRef.current.getLayer()?.batchDraw()
    }
  }, [isSelected])

  const boundFunc = makeRoomBoundFunc(wPx, hPx, roomWidthPx, roomHeightPx, roomX, roomY, gridSizeMm, scale, getStageTransform)

  const strokeColor = isSelected ? '#3b82f6' : isInMultiSelect ? '#93c5fd' : '#475569'
  const strokeWidth = isSelected ? 2 : isInMultiSelect ? 1.5 : 1

  return (
    <>
      <Group
        ref={shapeRef}
        x={locker.x}
        y={locker.y}
        rotation={locker.rotation}
        draggable
        onClick={(e) => onSelect(e.evt.ctrlKey || e.evt.metaKey)}
        onTap={() => onSelect(false)}
        dragBoundFunc={boundFunc}
        onDragStart={() => { dragOrigin.current = { x: locker.x, y: locker.y } }}
        onDragMove={(e) => {
          if (onMultiDragMove && dragOrigin.current)
            onMultiDragMove(e.target.x() - dragOrigin.current.x, e.target.y() - dragOrigin.current.y)
        }}
        onDragEnd={(e) => {
          if (onMultiDragEnd && dragOrigin.current) {
            onMultiDragEnd(e.target.x() - dragOrigin.current.x, e.target.y() - dragOrigin.current.y)
          } else {
            onChange({ ...locker, x: e.target.x(), y: e.target.y() })
          }
          dragOrigin.current = null
        }}
        onTransformEnd={() => {
          const node = shapeRef.current!
          onChange({
            ...locker,
            x: node.x(), y: node.y(), rotation: node.rotation(),
            widthMm:  Math.round(wPx * node.scaleX() / scale),
            heightMm: Math.round(hPx * node.scaleY() / scale),
          })
          node.scaleX(1); node.scaleY(1)
        }}
      >
        {showDepth && (() => {
          const depthPx    = mmToPx(locker.depthMm, scale)
          const { dx, dy } = projOffset(depthPx)
          const base       = locker.depthColor ?? locker.color
          const len        = Math.sqrt(dx * dx + dy * dy)

          // CAD depth dimension along the projected right edge
          const dimOffset  = 10
          const ox = len > 0 ? (dy / len) * dimOffset  : 0
          const oy = len > 0 ? (-dx / len) * dimOffset : 0
          const ax = wPx + ox,        ay = oy
          const bx = wPx + dx + ox,   by = dy + oy
          const midX = (ax + bx) / 2, midY = (ay + by) / 2
          const angleDeg = Math.atan2(dy, dx) * 180 / Math.PI
          const label = `${locker.depthMm}mm`

          return (
            <>
              <Line closed
                points={[0, 0, wPx, 0, wPx + dx, dy, dx, dy]}
                fill={darkenHex(base, 0.15)} stroke="#475569" strokeWidth={0.5} />
              <Line closed
                points={[wPx, 0, wPx, hPx, wPx + dx, hPx + dy, wPx + dx, dy]}
                fill={darkenHex(base, 0.30)} stroke="#475569" strokeWidth={0.5} />

              {/* Depth dimension annotation — hidden on export when dims excluded */}
              <Group name="depth-dim">
                <Line points={[wPx, 0, ax, ay]}         stroke="#3b82f6" strokeWidth={0.5} dash={[2, 2]} />
                <Line points={[wPx + dx, dy, bx, by]}   stroke="#3b82f6" strokeWidth={0.5} dash={[2, 2]} />
                <Arrow
                  points={[ax, ay, bx, by]}
                  pointerLength={4} pointerWidth={3}
                  fill="#3b82f6" stroke="#3b82f6" strokeWidth={0.8}
                  pointerAtBeginning pointerAtEnding
                />
                <Text
                  x={midX} y={midY}
                  offsetX={label.length * 2.8}
                  offsetY={9}
                  text={label}
                  fontSize={9} fontFamily="monospace" fill="#3b82f6"
                  rotation={angleDeg}
                />
              </Group>
            </>
          )
        })()}
        <Rect width={wPx} height={hPx} fill={locker.color}
          stroke={strokeColor} strokeWidth={strokeWidth} cornerRadius={2} />
        <Rect x={wPx / 2 - 0.5} y={4} width={1} height={hPx - 8} fill="#475569" opacity={0.3} />
        {locker.showLabel !== false && (
          <Text text={locker.label}
            fontSize={ls.fontSize > 0 ? ls.fontSize : Math.max(10, wPx * 0.18)}
            fontFamily="monospace" fill={ls.color}
            width={wPx} align="center" y={hPx / 2 - 8} />
        )}
        {locker.showDimension !== false && (
          <Text text={`${locker.widthMm}×${locker.heightMm}`}
            fontSize={ls.fontSize > 0 ? Math.max(7, ls.fontSize * 0.7) : Math.max(8, wPx * 0.12)}
            fontFamily="monospace" fill={ls.color} opacity={0.6}
            width={wPx} align="center" y={hPx / 2 + 6} />
        )}
      </Group>

      {isSelected && (
        <Transformer ref={trRef}
          boundBoxFunc={(oldBox, newBox) => newBox.width < mmToPx(100, scale) ? oldBox : newBox}
          enabledAnchors={['middle-left', 'middle-right', 'top-center', 'bottom-center']}
          rotateEnabled={true}
          rotationSnaps={shiftHeld ? SNAP_ANGLES : []}
          rotationSnapTolerance={shiftHeld ? 10 : 0} />
      )}
    </>
  )
}
