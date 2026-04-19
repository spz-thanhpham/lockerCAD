'use client'
// components/editor/RoomOutline.tsx
import { Rect, Text, Line } from 'react-konva'
import type { RoomConfig } from '@/types'

interface Props {
  x: number; y: number
  widthPx: number; heightPx: number
  room: RoomConfig
}

export default function RoomOutline({ x, y, widthPx, heightPx, room }: Props) {
  const gridPx = room.gridSizeMm * room.scale

  // Build grid lines
  const verticals = []
  for (let gx = gridPx; gx < widthPx; gx += gridPx) {
    verticals.push(<Line key={`v${gx}`} points={[x + gx, y, x + gx, y + heightPx]} stroke="#e2e8f0" strokeWidth={0.5} />)
  }
  const horizontals = []
  for (let gy = gridPx; gy < heightPx; gy += gridPx) {
    horizontals.push(<Line key={`h${gy}`} points={[x, y + gy, x + widthPx, y + gy]} stroke="#e2e8f0" strokeWidth={0.5} />)
  }

  return (
    <>
      {/* Grid */}
      {verticals}
      {horizontals}
      {/* Room boundary */}
      <Rect x={x} y={y} width={widthPx} height={heightPx} fill="white" stroke="#334155" strokeWidth={2} />
      {/* Room label */}
      <Text x={x + 4} y={y + 4} text={`${room.widthMm} × ${room.depthMm} mm`} fontSize={10} fill="#94a3b8" fontFamily="monospace" />
    </>
  )
}
