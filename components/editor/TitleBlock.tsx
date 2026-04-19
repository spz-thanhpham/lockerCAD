'use client'
// components/editor/TitleBlock.tsx
// Workshop-drawing title block rendered on the Konva canvas.
// Positioned just below the room outline, right-aligned.

import { Group, Rect, Text, Line } from 'react-konva'
import type { OfficeInfo } from '@/types'

interface Props {
  x: number
  y: number
  officeInfo: OfficeInfo
  projectName: string
}

const W  = 260   // total block width (px)
const ROW = 18   // row height
const PAD = 6    // inner horizontal padding
const HEADER_H = 28

const BORDER = '#334155'
const BG_HEAD = '#1e293b'
const BG_ROW1 = '#f8fafc'
const BG_ROW2 = '#f1f5f9'
const TEXT_HEAD = '#e2e8f0'
const TEXT_LABEL = '#64748b'
const TEXT_VAL   = '#1e293b'
const FONT = 'monospace'

function Row({ y, label, value, bg }: { y: number; label: string; value: string; bg: string }) {
  return (
    <Group y={y}>
      <Rect x={0} width={W} height={ROW} fill={bg} />
      <Line points={[0, ROW, W, ROW]} stroke={BORDER} strokeWidth={0.5} opacity={0.4} />
      <Text x={PAD} y={4} text={label} fontSize={8} fontFamily={FONT}
        fill={TEXT_LABEL} fontStyle="bold" />
      <Text x={60} y={4} text={value || '—'} fontSize={8} fontFamily={FONT} fill={TEXT_VAL}
        width={W - 64} ellipsis />
    </Group>
  )
}

export default function TitleBlock({ x, y, officeInfo, projectName }: Props) {
  const rows: { label: string; value: string }[] = [
    { label: 'Project',  value: projectName           },
    { label: 'Made by',  value: officeInfo.madeBy     },
    { label: 'Address',  value: officeInfo.address    },
    { label: 'Website',  value: officeInfo.website    },
    { label: 'Email',    value: officeInfo.email      },
    { label: 'Hotline',  value: officeInfo.hotline    },
  ]
  const totalH = HEADER_H + rows.length * ROW + 1

  return (
    <Group x={x} y={y}>
      {/* Border */}
      <Rect width={W} height={totalH} fill={BG_ROW1}
        stroke={BORDER} strokeWidth={1} cornerRadius={2} />

      {/* Header — company name */}
      <Rect width={W} height={HEADER_H} fill={BG_HEAD} cornerRadius={[2, 2, 0, 0]} />
      <Text x={PAD} y={7} width={W - PAD * 2} text={officeInfo.companyName || 'Company Name'}
        fontSize={11} fontFamily={FONT} fill={TEXT_HEAD} fontStyle="bold" align="center" />

      {/* Info rows */}
      {rows.map((r, i) => (
        <Row key={r.label}
          y={HEADER_H + i * ROW}
          label={r.label}
          value={r.value}
          bg={i % 2 === 0 ? BG_ROW1 : BG_ROW2}
        />
      ))}
    </Group>
  )
}
