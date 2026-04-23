'use client'
// components/editor/RoomSetupPanel.tsx
// Input panel to set room dimensions and canvas scale

import type { RoomConfig } from '@/types'
import NumericInput from './NumericInput'

interface Props {
  room: RoomConfig
  onChange: (updated: Partial<RoomConfig>) => void
}

const SCALE_OPTIONS = [
  { label: '1:20  (1px = 20mm)', value: 0.05 },
  { label: '1:50  (1px = 50mm)', value: 0.02 },
  { label: '1:100 (1px = 100mm)', value: 0.01 },
  { label: '1:10  (1px = 10mm)', value: 0.1 },
]

export default function RoomSetupPanel({ room, onChange }: Props) {
  return (
    <div className="p-3 border-b space-y-3">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Room dimensions</h3>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Width (mm)</label>
          <NumericInput
            className="w-full border rounded px-2 py-1 text-xs"
            value={room.widthMm}
            min={500}
            onCommit={(v) => onChange({ widthMm: v })}
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Depth (mm)</label>
          <NumericInput
            className="w-full border rounded px-2 py-1 text-xs"
            value={room.depthMm}
            min={500}
            onCommit={(v) => onChange({ depthMm: v })}
          />
        </div>
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1">Drawing scale</label>
        <select
          className="w-full border rounded px-2 py-1 text-xs"
          value={room.scale}
          onChange={(e) => onChange({ scale: parseFloat(e.target.value) })}
        >
          {SCALE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs text-gray-500 mb-1">Snap grid (mm)</label>
        <select
          className="w-full border rounded px-2 py-1 text-xs"
          value={room.gridSizeMm}
          onChange={(e) => onChange({ gridSizeMm: parseInt(e.target.value, 10) })}
        >
          {[10, 25, 50, 100].map((v) => (
            <option key={v} value={v}>{v}mm</option>
          ))}
        </select>
      </div>
    </div>
  )
}
