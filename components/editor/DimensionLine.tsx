'use client'
// components/editor/DimensionLine.tsx
// Draws CAD-style ←width→ dimension annotation for a locker

import { Group, Line, Arrow, Text } from 'react-konva'
import { mmToPx } from '@/lib/canvas-helpers'
import type { LockerObject } from '@/types'

interface Props {
  locker: LockerObject
  scale: number
}

export default function DimensionLine({ locker, scale }: Props) {
  const wPx = mmToPx(locker.widthMm, scale)
  const hPx = mmToPx(locker.heightMm, scale)
  const x = locker.x
  const y = locker.y
  const offset = 14 // gap above the locker

  return (
    <Group>
      {/* Width dimension line above locker */}
      <Arrow
        points={[x + 4, y - offset, x + wPx - 4, y - offset]}
        pointerLength={4} pointerWidth={4}
        fill="#3b82f6" stroke="#3b82f6" strokeWidth={1}
        pointerAtBeginning pointerAtEnding
      />
      <Text
        x={x} y={y - offset - 10} width={wPx}
        text={`${locker.widthMm}mm`}
        fontSize={9} fill="#3b82f6" align="center" fontFamily="monospace"
      />

      {/* Height dimension line left of locker */}
      <Arrow
        points={[x - offset, y + 4, x - offset, y + hPx - 4]}
        pointerLength={4} pointerWidth={4}
        fill="#3b82f6" stroke="#3b82f6" strokeWidth={1}
        pointerAtBeginning pointerAtEnding
      />
      <Text
        x={x - offset - 8} y={y + hPx / 2}
        text={`${locker.heightMm}`}
        fontSize={9} fill="#3b82f6" fontFamily="monospace"
        rotation={-90}
      />
    </Group>
  )
}
