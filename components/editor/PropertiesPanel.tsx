'use client'
// components/editor/PropertiesPanel.tsx
// Right sidebar — edit selected locker properties

import type { LockerObject } from '@/types'

interface Props {
  locker: LockerObject | null
  showDepth?: boolean
  onChange: (updated: LockerObject) => void
  onDelete: (id: string) => void
}

export default function PropertiesPanel({ locker, showDepth, onChange, onDelete }: Props) {
  if (!locker) {
    return (
      <div className="p-4 text-sm text-gray-400 text-center mt-8">
        Select a locker to edit its properties
      </div>
    )
  }

  const update = (key: keyof LockerObject, value: string | number) => {
    onChange({ ...locker, [key]: value })
  }

  return (
    <div className="p-4 space-y-4 text-sm">
      <h3 className="font-semibold text-gray-700">Locker Properties</h3>

      {/* Label */}
      <div>
        <label className="block text-gray-500 mb-1">Label</label>
        <input
          className="w-full border rounded px-2 py-1 text-sm"
          value={locker.label}
          onChange={(e) => update('label', e.target.value)}
        />
      </div>

      {/* Dimensions */}
      <div className="grid grid-cols-2 gap-2">
        {(['widthMm', 'heightMm', 'depthMm'] as const).map((key) => (
          <div key={key}>
            <label className="block text-gray-500 mb-1 capitalize">
              {key.replace('Mm', ' (mm)')}
            </label>
            <input
              type="number"
              className="w-full border rounded px-2 py-1 text-sm"
              value={locker[key]}
              min={100}
              step={50}
              onChange={(e) => update(key, parseInt(e.target.value, 10))}
            />
          </div>
        ))}
      </div>

      {/* Color */}
      <div className="space-y-2">
        <label className="block text-gray-500 mb-1">Colour</label>
        {([
          { key: 'color'      as keyof LockerObject, label: 'Body',  val: locker.color },
          { key: 'depthColor' as keyof LockerObject, label: 'Depth', val: locker.depthColor ?? locker.color },
        ]).map(({ key, label, val }) => (
          <div key={key} className="flex items-center justify-between">
            <span className="text-gray-400 text-xs">{label}</span>
            <div className="flex items-center gap-1.5">
              <input type="color" value={val}
                onChange={(e) => update(key, e.target.value)}
                className="w-6 h-6 rounded cursor-pointer border" />
              <span className="text-[10px] font-mono text-gray-400">{val}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Rotation */}
      <div>
        <label className="block text-gray-500 mb-1">Rotation (°)</label>
        <select
          className="w-full border rounded px-2 py-1 text-sm"
          value={locker.rotation}
          onChange={(e) => update('rotation', parseInt(e.target.value, 10))}
        >
          {[0, 90, 180, 270].map((r) => <option key={r} value={r}>{r}°</option>)}
        </select>
      </div>

      {/* Delete */}
      <button
        onClick={() => onDelete(locker.id)}
        className="w-full mt-2 px-3 py-1.5 bg-red-50 text-red-600 rounded border border-red-200 text-sm hover:bg-red-100"
      >
        Delete locker
      </button>
    </div>
  )
}
