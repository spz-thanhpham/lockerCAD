'use client'

import { useRef, useEffect } from 'react'
import { Rect, Ellipse, Transformer } from 'react-konva'
import type Konva from 'konva'
import type { ShapeObject } from '@/types'

interface Props {
  shape: ShapeObject
  isSelected: boolean
  onChange: (updated: ShapeObject) => void
  onSelect: () => void
  roomX: number
  roomY: number
  roomWidthPx: number
  roomHeightPx: number
}

export default function ShapeObjectComponent({
  shape, isSelected, onChange, onSelect,
  roomX, roomY, roomWidthPx, roomHeightPx,
}: Props) {
  const rectRef    = useRef<Konva.Rect>(null)
  const ellipseRef = useRef<Konva.Ellipse>(null)
  const trRef      = useRef<Konva.Transformer>(null)

  useEffect(() => {
    const node = shape.type === 'rect' ? rectRef.current : ellipseRef.current
    if (isSelected && trRef.current && node) {
      trRef.current.nodes([node])
      trRef.current.getLayer()?.batchDraw()
    }
    // Re-attach when dimensions change so Transformer bounding box stays accurate
  }, [isSelected, shape.type, shape.width, shape.height])

  const handleTransformEnd = () => {
    if (shape.type === 'rect' && rectRef.current) {
      const node = rectRef.current
      const newW = Math.max(4, node.width()  * node.scaleX())
      const newH = Math.max(4, node.height() * node.scaleY())
      node.scaleX(1); node.scaleY(1)
      onChange({ ...shape, x: node.x(), y: node.y(), width: newW, height: newH, rotation: node.rotation() })
    } else if (shape.type === 'circle' && ellipseRef.current) {
      const node = ellipseRef.current
      const newRX = Math.max(2, node.radiusX() * node.scaleX())
      const newRY = Math.max(2, node.radiusY() * node.scaleY())
      node.scaleX(1); node.scaleY(1)
      onChange({ ...shape, x: node.x(), y: node.y(), width: newRX * 2, height: newRY * 2, rotation: node.rotation() })
    }
  }

  const commonProps = {
    fill:        shape.fill,
    stroke:      shape.stroke,
    strokeWidth: shape.strokeWidth,
    opacity:     shape.opacity,
    rotation:    shape.rotation,
    draggable:   !shape.locked,
    onClick:     (e: Konva.KonvaEventObject<MouseEvent>) => { e.cancelBubble = true; onSelect() },
    onTap:       (e: Konva.KonvaEventObject<Event>)      => { e.cancelBubble = true; onSelect() },
    onTransformEnd: handleTransformEnd,
  }

  const handleRectDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    const x = Math.max(roomX, Math.min(roomX + roomWidthPx,  e.target.x()))
    const y = Math.max(roomY, Math.min(roomY + roomHeightPx, e.target.y()))
    onChange({ ...shape, x, y })
  }

  const handleEllipseDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
    // Ellipse x, y is center; clamp so the shape stays within the room
    const cx = Math.max(roomX + shape.width / 2,  Math.min(roomX + roomWidthPx  - shape.width / 2,  e.target.x()))
    const cy = Math.max(roomY + shape.height / 2, Math.min(roomY + roomHeightPx - shape.height / 2, e.target.y()))
    onChange({ ...shape, x: cx, y: cy })
  }

  return (
    <>
      {shape.type === 'rect' ? (
        <Rect
          ref={rectRef}
          x={shape.x}
          y={shape.y}
          width={shape.width}
          height={shape.height}
          cornerRadius={shape.cornerRadius ?? 0}
          onDragEnd={handleRectDragEnd}
          {...commonProps}
        />
      ) : (
        <Ellipse
          ref={ellipseRef}
          x={shape.x}
          y={shape.y}
          radiusX={shape.width  / 2}
          radiusY={shape.height / 2}
          onDragEnd={handleEllipseDragEnd}
          {...commonProps}
        />
      )}

      {isSelected && (
        <Transformer
          ref={trRef}
          rotateEnabled
          rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
          // No lower bound here — handleTransformEnd clamps to min 5px.
          // A hard pixel minimum in boundBoxFunc would prevent making shapes
          // small at any zoom level.
        />
      )}
    </>
  )
}
