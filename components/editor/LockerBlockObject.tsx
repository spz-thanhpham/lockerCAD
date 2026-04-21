'use client'
// components/editor/LockerBlockObject.tsx

import { useRef, useEffect } from 'react'
import { Group, Rect, Text, Transformer, Line, Arrow } from 'react-konva'
import type Konva from 'konva'
import { mmToPx, blockWidthMm, blockHeightMm, DEFAULT_LABEL_STYLE, type LockerBlock, type LocksetPosition, type LabelStyle, type LabelPosition } from '@/types'
import { makeRoomBoundFunc, projOffset, darkenHex } from '@/lib/canvas-helpers'

const DEFAULT_FRAME_COLOR   = '#334155'
const DEFAULT_LOCKSET_COLOR = '#1e293b'
const DOOR_STROKE   = '#475569'
const COL_BG        = '#cbd5e1'

interface Props {
  block: LockerBlock
  scale: number
  isSelected: boolean
  isInMultiSelect: boolean
  labelStyle?: LabelStyle
  showDepth?: boolean
  getStageTransform: () => { x: number; y: number; scaleX: number }
  onSelect: (addToSelection: boolean) => void
  onSelectCell: (blockId: string, colIdx: number, cellIdx: number) => void
  onSelectLockset: (blockId: string, locksetIdx: number) => void
  selectedCellKey?: string      // "colIdx:cellIdx" for THIS block, or undefined
  selectedLocksetIdx?: number   // index of selected lockset tray in THIS block
  onChange: (updated: LockerBlock) => void
  onMultiDragMove?: (dx: number, dy: number) => void
  onMultiDragEnd?: (dx: number, dy: number) => void
  shiftHeld?: boolean
  roomX: number
  roomY: number
  roomWidthPx: number
  roomHeightPx: number
  gridSizeMm: number
}

function cellLabelProps(pos: LabelPosition, li: number, cellY: number, doorW: number, doorH: number) {
  if (pos === 'top-left')  return { x: li + 4,  y: cellY + 4, width: doorW - 8,  align: 'left'   as const }
  if (pos === 'top-right') return { x: li,       y: cellY + 4, width: doorW - 4,  align: 'right'  as const }
  return                          { x: li,       y: cellY + doorH / 2 - 8, width: doorW, align: 'center' as const }
}

function doorInsets(
  ci: number, numCols: number,
  pos: LocksetPosition, dlGap: number
): { left: number; right: number } {
  if (pos === 'between') {
    return { left: ci === 0 ? 0 : dlGap, right: ci === numCols - 1 ? 0 : dlGap }
  }
  if (pos === 'left') return { left: ci === 0 ? dlGap : 0, right: 0 }
  return { left: 0, right: ci === numCols - 1 ? dlGap : 0 }
}

const SNAP_ANGLES = [0, 30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330]

export default function LockerBlockObjectComponent({
  block, scale, isSelected, isInMultiSelect, labelStyle, showDepth, getStageTransform,
  onSelect, onSelectCell, onSelectLockset, selectedCellKey, selectedLocksetIdx, onChange,
  onMultiDragMove, onMultiDragEnd,
  shiftHeld, roomX, roomY, roomWidthPx, roomHeightPx, gridSizeMm,
}: Props) {
  const ls = labelStyle ?? DEFAULT_LABEL_STYLE
  const groupRef    = useRef<Konva.Group>(null)
  const trRef       = useRef<Konva.Transformer>(null)
  const dragOrigin  = useRef<{ x: number; y: number } | null>(null)
  const cfg      = block.config
  const pos      = cfg.locksetPosition
  const numCols  = cfg.columns.length

  const frameColor   = block.frameColor   ?? DEFAULT_FRAME_COLOR
  const locksetColor = block.locksetColor ?? DEFAULT_LOCKSET_COLOR

  const wPx      = mmToPx(blockWidthMm(cfg), scale)
  const hPx      = mmToPx(blockHeightMm(cfg), scale)
  const legsPx   = mmToPx(block.legsHeightMm ?? 0, scale)
  const legsWPx  = mmToPx(block.legsWidthMm  ?? 50, scale)
  const legsColor = block.legsColor ?? frameColor
  const totalHPx  = hPx + legsPx
  // Legs use their own depth (or fall back to cabinet depth)
  const legsDepthPx = mmToPx(block.legsDepthMm ?? cfg.depthMm, scale)

  useEffect(() => {
    if (isSelected && trRef.current && groupRef.current) {
      trRef.current.nodes([groupRef.current])
      trRef.current.getLayer()?.batchDraw()
    }
  }, [isSelected])

  const boundFunc = makeRoomBoundFunc(wPx, totalHPx, roomWidthPx, roomHeightPx, roomX, roomY, gridSizeMm, scale, getStageTransform)

  const topH    = mmToPx(cfg.topHeightMm, scale)
  const baseH   = mmToPx(cfg.baseHeightMm, scale)
  const leftM   = mmToPx(cfg.leftMarginMm, scale)
  const rightM  = mmToPx(cfg.rightMarginMm, scale)
  const lockW   = mmToPx(cfg.locksetWidthMm, scale)
  const doorGap = mmToPx(cfg.doorGapMm, scale)
  const dlGap   = mmToPx(cfg.doorToLocksetGapMm, scale)
  const innerH  = hPx - topH - baseH

  const colOffsets: number[] = []
  let cursor = pos === 'left' ? leftM + lockW : leftM
  cfg.columns.forEach((col, i) => {
    colOffsets.push(cursor)
    cursor += mmToPx(col.widthMm, scale)
    if (pos === 'between' && i < numCols - 1) cursor += lockW
  })

  const locksetRects: { x: number }[] = []
  if (pos === 'between') {
    cfg.columns.slice(0, -1).forEach((_, i) => {
      locksetRects.push({ x: colOffsets[i] + mmToPx(cfg.columns[i].widthMm, scale) })
    })
  } else if (pos === 'left') {
    locksetRects.push({ x: leftM })
  } else {
    const lastIdx = numCols - 1
    if (lastIdx >= 0)
      locksetRects.push({ x: colOffsets[lastIdx] + mmToPx(cfg.columns[lastIdx].widthMm, scale) })
  }

  // Selection outline colour: thick blue = primary, thin blue = multi-select member
  const outlineStroke = isSelected ? '#3b82f6' : isInMultiSelect ? '#93c5fd' : 'transparent'
  const outlineWidth  = isSelected ? 2 : 1

  return (
    <>
      <Group
        ref={groupRef}
        x={block.x} y={block.y} rotation={block.rotation}
        draggable
        onClick={(e) => onSelect(e.evt.ctrlKey || e.evt.metaKey)}
        onTap={() => onSelect(false)}
        dragBoundFunc={boundFunc}
        onDragStart={() => { dragOrigin.current = { x: block.x, y: block.y } }}
        onDragMove={(e) => {
          if (onMultiDragMove && dragOrigin.current)
            onMultiDragMove(e.target.x() - dragOrigin.current.x, e.target.y() - dragOrigin.current.y)
        }}
        onDragEnd={(e) => {
          if (onMultiDragEnd && dragOrigin.current) {
            onMultiDragEnd(e.target.x() - dragOrigin.current.x, e.target.y() - dragOrigin.current.y)
          } else {
            onChange({ ...block, x: e.target.x(), y: e.target.y() })
          }
          dragOrigin.current = null
        }}
        onTransformEnd={() => {
          const node = groupRef.current!
          onChange({ ...block, x: node.x(), y: node.y(), rotation: node.rotation() })
          node.scaleX(1); node.scaleY(1)
        }}
      >
        {/* Depth projection — drawn first so it sits behind the front face */}
        {showDepth && (() => {
          const depthPx    = mmToPx(cfg.depthMm, scale)
          const { dx, dy } = projOffset(depthPx)
          const base       = block.depthColor ?? frameColor
          const topFill    = darkenHex(base, 0.15)
          const sideFill   = darkenHex(base, 0.30)

          // Back legs — rendered before cabinet faces so they appear behind
          const backLegNodes = legsPx > 0 ? (() => {
            const defaultInset = Math.min(leftM, rightM) * 0.5
            const insetPx   = block.legsInsetMm != null ? mmToPx(block.legsInsetMm, scale) : defaultInset
            const legRadius = block.legsCornerRadius ?? 2
            const { dx: ldx, dy: ldy } = projOffset(legsDepthPx)
            const legTopF   = darkenHex(legsColor, 0.15)
            const legSideF  = darkenHex(legsColor, 0.30)
            const legFrontF = darkenHex(legsColor, 0.10)
            const positions = [insetPx, wPx - insetPx - legsWPx]
            return positions.map((lx, i) => {
              const bx = lx + ldx, by = hPx + ldy
              return (
                <Group key={`back-leg-${i}`}>
                  <Line closed
                    points={[bx, by, bx + legsWPx, by, bx + legsWPx + ldx, by + ldy, bx + ldx, by + ldy]}
                    fill={legTopF} stroke={DOOR_STROKE} strokeWidth={0.5} />
                  <Line closed
                    points={[bx + legsWPx, by, bx + legsWPx, by + legsPx,
                             bx + legsWPx + ldx, by + legsPx + ldy, bx + legsWPx + ldx, by + ldy]}
                    fill={legSideF} stroke={DOOR_STROKE} strokeWidth={0.5} />
                  <Rect x={bx} y={by} width={legsWPx} height={legsPx}
                    fill={legFrontF} stroke={DOOR_STROKE} strokeWidth={0.5}
                    cornerRadius={legRadius} />
                </Group>
              )
            })
          })() : null

          // CAD depth dimension
          const len = Math.sqrt(dx * dx + dy * dy)
          const dimOffset = 10
          const ox = len > 0 ? (dy / len) * dimOffset  : 0
          const oy = len > 0 ? (-dx / len) * dimOffset : 0
          const ax = wPx + ox,        ay = oy
          const bx = wPx + dx + ox,   by = dy + oy
          const midX = (ax + bx) / 2, midY = (ay + by) / 2
          const angleDeg = Math.atan2(dy, dx) * 180 / Math.PI
          const label = `${cfg.depthMm}mm`

          return (
            <>
              {backLegNodes}

              {/* Top face */}
              <Line closed
                points={[0, 0, wPx, 0, wPx + dx, dy, dx, dy]}
                fill={topFill} stroke={DOOR_STROKE} strokeWidth={0.5} />
              {/* Right face */}
              <Line closed
                points={[wPx, 0, wPx, hPx, wPx + dx, hPx + dy, wPx + dx, dy]}
                fill={sideFill} stroke={DOOR_STROKE} strokeWidth={0.5} />

              {/* Depth dimension annotation */}
              {block.showDepthLabel !== false && (
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
              )}
            </>
          )
        })()}

        {/* Front legs — rendered before cabinet panels so the base panel sits on top */}
        {legsPx > 0 && (() => {
          const defaultInset = Math.min(leftM, rightM) * 0.5
          const insetPx   = block.legsInsetMm != null ? mmToPx(block.legsInsetMm, scale) : defaultInset
          const legRadius = block.legsCornerRadius ?? 2
          const { dx: ldx, dy: ldy } = showDepth ? projOffset(legsDepthPx) : { dx: 0, dy: 0 }
          const legTopFill  = darkenHex(legsColor, 0.15)
          const legSideFill = darkenHex(legsColor, 0.30)
          const positions   = [insetPx, wPx - insetPx - legsWPx]

          return positions.map((lx, i) => (
            <Group key={`front-leg-${i}`}>
              {showDepth && (
                <>
                  <Line closed
                    points={[lx, hPx, lx + legsWPx, hPx, lx + legsWPx + ldx, hPx + ldy, lx + ldx, hPx + ldy]}
                    fill={legTopFill} stroke={DOOR_STROKE} strokeWidth={0.5} />
                  <Line closed
                    points={[lx + legsWPx, hPx, lx + legsWPx, hPx + legsPx,
                             lx + legsWPx + ldx, hPx + legsPx + ldy, lx + legsWPx + ldx, hPx + ldy]}
                    fill={legSideFill} stroke={DOOR_STROKE} strokeWidth={0.5} />
                </>
              )}
              <Rect x={lx} y={hPx} width={legsWPx} height={legsPx}
                fill={legsColor} stroke={DOOR_STROKE} strokeWidth={0.5}
                cornerRadius={legRadius} />
            </Group>
          ))
        })()}

        {/* Selection / multi-select outline — covers legs too */}
        <Rect width={wPx} height={totalHPx} fill="transparent"
          stroke={outlineStroke} strokeWidth={outlineWidth} />

        {/* TOP panel */}
        <Rect x={0} y={0} width={wPx} height={topH} fill={frameColor} />

        {/* BASE panel */}
        <Rect x={0} y={hPx - baseH} width={wPx} height={baseH} fill={frameColor} />

        {/* LEFT margin */}
        <Rect x={0} y={topH} width={leftM} height={innerH} fill={frameColor} />

        {/* RIGHT margin */}
        <Rect x={wPx - rightM} y={topH} width={rightM} height={innerH} fill={frameColor} />

        {/* Lockset tray channels */}
        {locksetRects.map((lr, i) => {
          const trayColor  = block.locksets?.[i]?.color ?? locksetColor
          const isTraySel  = isSelected && selectedLocksetIdx === i
          return (
            <Rect key={`lock-${i}`}
              x={lr.x} y={topH} width={lockW} height={innerH}
              fill={trayColor}
              stroke={isTraySel ? '#f59e0b' : 'transparent'}
              strokeWidth={isTraySel ? 2 : 0}
              onClick={(e) => {
                if (!isSelected) return
                e.cancelBubble = true
                onSelectLockset(block.id, i)
              }}
            />
          )
        })}

        {/* Columns */}
        {cfg.columns.map((col, ci) => {
          const colX = colOffsets[ci]
          const colW = mmToPx(col.widthMm, scale)
          const { left: li, right: ri } = doorInsets(ci, numCols, pos, dlGap)
          const doorW = colW - li - ri

          let cellY = topH
          return (
            <Group key={col.id} x={colX}>
              <Rect x={0} y={topH} width={colW} height={innerH} fill={COL_BG} />
              {col.cells.map((cell, ri2) => {
                const cellH   = mmToPx(cell.heightMm, scale)
                const doorH   = cellH - doorGap
                const fill    = cell.color ?? block.color
                const thisCellKey = `${ci}:${ri2}`
                const isCellSel   = isSelected && selectedCellKey === thisCellKey
                const startY  = cellY
                const cellRadius = cell.cornerRadius ?? block.cellCornerRadius ?? 1
                const node = (
                  <Group key={`${col.id}-${ri2}`}
                    onClick={(e) => {
                      if (!isSelected) return  // let block-level click handle first select
                      e.cancelBubble = true
                      onSelectCell(block.id, ci, ri2)
                    }}
                  >
                    <Rect x={li} y={startY} width={doorW} height={doorH}
                      fill={fill} stroke={isCellSel ? '#f59e0b' : DOOR_STROKE}
                      strokeWidth={isCellSel ? 2 : 0.5} cornerRadius={cellRadius} />
                    {/* centre crease line */}
                    <Line
                      points={[li + doorW / 2, startY + 4, li + doorW / 2, startY + doorH - 4]}
                      stroke={DOOR_STROKE} strokeWidth={0.5} opacity={0.35} listening={false} />
                    {cell.label && block.showCellLabels !== false && cell.showLabel !== false && (() => {
                      const lp = cellLabelProps(ls.position, li, startY, doorW, doorH)
                      const fs = ls.fontSize > 0 ? ls.fontSize : Math.max(8, doorW * 0.18)
                      const fc = cell.labelColor ?? ls.color
                      return (
                        <Text {...lp} text={cell.label}
                          fontSize={fs} fontFamily="monospace" fill={fc} listening={false} />
                      )
                    })()}
                    {block.showCellDimensions !== false && cell.showDimension !== false && (
                      <Text x={li} y={startY + doorH - 12}
                        width={doorW} align="center"
                        text={`${col.widthMm}×${cell.heightMm}`}
                        fontSize={ls.fontSize > 0 ? Math.max(6, ls.fontSize * 0.7) : Math.max(6, doorW * 0.1)}
                        fontFamily="monospace" fill={cell.labelColor ?? ls.color} opacity={0.5} listening={false} />
                    )}
                  </Group>
                )
                cellY += cellH
                return node
              })}
            </Group>
          )
        })}


        {/* Permanent border — always visible, on top of content */}
        {(block.borderWidth ?? 0) > 0 && (
          <Rect width={wPx} height={hPx} fill="transparent"
            stroke={block.borderColor ?? '#334155'}
            strokeWidth={block.borderWidth}
            cornerRadius={block.borderRadius ?? 0} />
        )}

        {/* Block label — rendered ABOVE the frame (shifted further up when depth is shown) */}
        {block.showBlockLabel !== false && (() => {
          const fs = ls.fontSize > 0 ? ls.fontSize : Math.max(10, topH * 0.7)
          const depthDy = showDepth ? projOffset(mmToPx(cfg.depthMm, scale)).dy : 0
          return (
            <Text x={0} y={depthDy - (fs + 4)} width={wPx} align="center"
              text={block.label}
              fontSize={fs} fontFamily="monospace" fontStyle="bold"
              fill={ls.color} />
          )
        })()}
      </Group>

      {isSelected && (
        <Transformer ref={trRef} rotateEnabled={true} enabledAnchors={[]}
          rotationSnaps={shiftHeld ? SNAP_ANGLES : []}
          rotationSnapTolerance={shiftHeld ? 10 : 0}
          borderStroke="#3b82f6" borderStrokeWidth={1} />
      )}
    </>
  )
}
