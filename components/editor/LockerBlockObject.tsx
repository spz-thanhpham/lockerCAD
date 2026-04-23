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
  cadView?: boolean
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
  showBlockDimensions?: boolean
  roomX: number
  roomY: number
  roomWidthPx: number
  roomHeightPx: number
  gridSizeMm: number
}

function cellLabelProps(pos: LabelPosition, li: number, cellY: number, doorW: number, doorH: number, fs: number) {
  const PAD = 4
  const isLeft  = pos === 'top-left'  || pos === 'mid-left'  || pos === 'bot-left'
  const isCenterH = pos === 'top-center' || pos === 'center'   || pos === 'bot-center'
  const isRight = pos === 'top-right' || pos === 'mid-right' || pos === 'bot-right'
  const isTop   = pos === 'top-left'  || pos === 'top-center' || pos === 'top-right'
  const isMid   = pos === 'mid-left'  || pos === 'center'    || pos === 'mid-right'
  const isBot   = pos === 'bot-left'  || pos === 'bot-center' || pos === 'bot-right'

  const x     = li + (isLeft ? PAD : 0)
  const width = doorW - (isLeft || isRight ? PAD : 0)
  const align = isLeft ? 'left' as const : isCenterH ? 'center' as const : 'right' as const
  const y     = isTop ? cellY + PAD
              : isMid ? cellY + doorH / 2 - fs / 2
              : isBot ? cellY + doorH - fs - PAD
              : cellY + doorH / 2 - fs / 2  // fallback center

  return { x, y, width, align }
}

function dimTextY(pos: 'top' | 'center' | 'bottom', cellY: number, doorH: number, fs: number) {
  if (pos === 'top')    return cellY + 2
  if (pos === 'center') return cellY + doorH / 2 - fs / 2
  return cellY + doorH - fs - 2  // bottom (default)
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
  block, scale, isSelected, isInMultiSelect, labelStyle, showDepth, cadView, getStageTransform,
  onSelect, onSelectCell, onSelectLockset, selectedCellKey, selectedLocksetIdx, onChange,
  onMultiDragMove, onMultiDragEnd,
  shiftHeld, showBlockDimensions, roomX, roomY, roomWidthPx, roomHeightPx, gridSizeMm,
}: Props) {
  // Merge: global default → block override
  const ls: LabelStyle = { ...(labelStyle ?? DEFAULT_LABEL_STYLE), ...(block.labelStyle ?? {}) }
  const groupRef    = useRef<Konva.Group>(null)
  const trRef       = useRef<Konva.Transformer>(null)
  const dragOrigin  = useRef<{ x: number; y: number } | null>(null)
  const cfg      = block.config
  const pos      = cfg.locksetPosition
  const numCols  = cfg.columns.length

  const CAD_FILL      = 'white'
  const CAD_STROKE    = '#1e293b'
  const frameColor   = cadView ? CAD_FILL : (block.frameColor   ?? DEFAULT_FRAME_COLOR)
  const locksetColor = cadView ? '#e2e8f0' : (block.locksetColor ?? DEFAULT_LOCKSET_COLOR)

  const wPx      = mmToPx(blockWidthMm(cfg), scale)
  const hPx      = mmToPx(blockHeightMm(cfg), scale)
  const legsPx   = mmToPx(block.legsHeightMm ?? 0, scale)
  const legsWPx  = mmToPx(block.legsWidthMm  ?? 50, scale)
  const legsColor = cadView ? CAD_FILL : (block.legsColor ?? (block.frameColor ?? DEFAULT_FRAME_COLOR))
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
          const base       = cadView ? '#e2e8f0' : (block.depthColor ?? (block.frameColor ?? DEFAULT_FRAME_COLOR))
          const topFill    = cadView ? CAD_FILL : darkenHex(base, 0.15)
          const sideFill   = cadView ? '#f1f5f9' : darkenHex(base, 0.30)

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
              onClick={(e) => { e.cancelBubble = true; onSelectLockset(block.id, i) }}
              onTap={(e)   => { e.cancelBubble = true; onSelectLockset(block.id, i) }}
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
              <Rect x={0} y={topH} width={colW} height={innerH} fill={cadView ? CAD_FILL : COL_BG}
                stroke={cadView ? CAD_STROKE : undefined} strokeWidth={cadView ? 0.5 : 0} />
              {col.cells.map((cell, ri2) => {
                const cellH   = mmToPx(cell.heightMm, scale)
                const doorH   = cellH - doorGap
                const fill    = cadView ? CAD_FILL : (cell.color ?? block.color)
                const thisCellKey = `${ci}:${ri2}`
                const isCellSel   = isSelected && selectedCellKey === thisCellKey
                const startY  = cellY
                const cellRadius = cell.cornerRadius ?? block.cellCornerRadius ?? 1
                const node = (
                  <Group key={`${col.id}-${ri2}`}
                    onClick={(e) => { e.cancelBubble = true; onSelectCell(block.id, ci, ri2) }}
                    onTap={(e)   => { e.cancelBubble = true; onSelectCell(block.id, ci, ri2) }}
                  >
                    <Rect x={li} y={startY} width={doorW} height={doorH}
                      fill={fill} stroke={isCellSel ? '#f59e0b' : DOOR_STROKE}
                      strokeWidth={isCellSel ? 2 : 0.5} cornerRadius={cellRadius} />
                    {/* centre crease line */}
                    <Line
                      points={[li + doorW / 2, startY + 4, li + doorW / 2, startY + doorH - 4]}
                      stroke={DOOR_STROKE} strokeWidth={0.5} opacity={0.35} listening={false} />
                    {cell.label && (() => {
                      // cell.showLabel explicitly set overrides block; undefined follows block
                      const show = cell.showLabel !== undefined
                        ? cell.showLabel
                        : block.showCellLabels !== false
                      if (!show) return null
                      const fs  = ls.fontSize > 0 ? ls.fontSize : Math.max(8, doorW * 0.18)
                      const fc  = cell.labelColor ?? ls.color
                      const pos = cell.labelPosition ?? ls.position
                      const lp  = cellLabelProps(pos, li, startY, doorW, doorH, fs)
                      return (
                        <Text {...lp} text={cell.label}
                          fontSize={fs} fontFamily="monospace" fill={fc} listening={false} />
                      )
                    })()}
                    {showBlockDimensions !== false && (() => {
                      // cell.showDimension explicitly set overrides block; undefined follows block
                      const show = cell.showDimension !== undefined
                        ? cell.showDimension
                        : block.showCellDimensions !== false
                      if (!show) return null
                      const fs  = ls.fontSize > 0 ? Math.max(6, ls.fontSize * 0.7) : Math.max(6, doorW * 0.1)
                      const dimY = dimTextY(cell.dimensionPosition ?? 'bottom', startY, doorH, fs)
                      return (
                        <Text x={li} y={dimY}
                          width={doorW} align="center"
                          text={`${col.widthMm}×${cell.heightMm}`}
                          fontSize={fs}
                          fontFamily="monospace" fill={cell.labelColor ?? ls.color} opacity={0.5} listening={false} />
                      )
                    })()}
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

        {/* ── Width annotation (CAD dimension line) ── */}
        {block.showWidthAnnotation && (() => {
          const OFFSET = 16
          const fs = block.sizeAnnotationFontSize ?? 9
          const side = block.widthAnnotationSide ?? 'bottom'
          const y = side === 'bottom' ? hPx + OFFSET : -(OFFSET + 4)
          const tickH = 5
          const label = `${Math.round(blockWidthMm(cfg))}mm`
          return (
            <Group name="width-annot" listening={false}>
              <Line points={[0, y - tickH, 0, y + tickH]} stroke="#3b82f6" strokeWidth={0.8} />
              <Line points={[wPx, y - tickH, wPx, y + tickH]} stroke="#3b82f6" strokeWidth={0.8} />
              <Arrow points={[0, y, wPx, y]}
                pointerLength={5} pointerWidth={4}
                fill="#3b82f6" stroke="#3b82f6" strokeWidth={0.8}
                pointerAtBeginning pointerAtEnding />
              <Text x={0} y={y - fs - 2} width={wPx} align="center"
                text={label} fontSize={fs} fontFamily="monospace" fill="#3b82f6" listening={false} />
            </Group>
          )
        })()}

        {/* ── Depth annotation (text label below the width line or block) ── */}
        {block.showDepthAnnotation && (() => {
          const OFFSET = 16
          const fs = block.sizeAnnotationFontSize ?? 9
          const widthSide = block.widthAnnotationSide ?? 'bottom'
          // Stack below width annotation if both are shown; otherwise just below block
          const y = block.showWidthAnnotation
            ? (widthSide === 'bottom' ? hPx + OFFSET * 2 + fs + 4 : -(OFFSET * 2 + fs + 4))
            : (hPx + OFFSET)
          const label = `D: ${cfg.depthMm}mm`
          return (
            <Text x={0} y={y} width={wPx} align="center"
              text={label} fontSize={fs} fontFamily="monospace" fill="#3b82f6"
              listening={false} />
          )
        })()}

        {/* ── Height annotation (CAD dimension line) ── */}
        {block.showHeightAnnotation && (() => {
          const OFFSET = 16
          const fs = block.sizeAnnotationFontSize ?? 9
          const side = block.heightAnnotationSide ?? 'left'
          const x = side === 'left' ? -OFFSET : wPx + OFFSET
          const tickW = 5
          const label = `${Math.round(blockHeightMm(cfg))}mm`
          const midY = hPx / 2
          return (
            <Group name="height-annot" listening={false}>
              <Line points={[x - tickW, 0, x + tickW, 0]} stroke="#3b82f6" strokeWidth={0.8} />
              <Line points={[x - tickW, hPx, x + tickW, hPx]} stroke="#3b82f6" strokeWidth={0.8} />
              <Arrow points={[x, 0, x, hPx]}
                pointerLength={5} pointerWidth={4}
                fill="#3b82f6" stroke="#3b82f6" strokeWidth={0.8}
                pointerAtBeginning pointerAtEnding />
              <Text
                x={side === 'left' ? x - fs - 2 : x + 4}
                y={midY - (label.length * fs * 0.3)}
                text={label} fontSize={fs} fontFamily="monospace" fill="#3b82f6"
                rotation={-90} listening={false} />
            </Group>
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
