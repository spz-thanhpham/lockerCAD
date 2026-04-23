'use client'
// components/editor/PropertiesPanel.tsx
// Right sidebar — edit selected LockerObject properties

import type { LockerObject } from '@/types'
import NumericInput from './NumericInput'

interface Props {
  locker: LockerObject | null
  showDepth?: boolean
  onChange: (updated: LockerObject) => void
  onDelete: (id: string) => void
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">
        {label}
      </label>
      {children}
    </div>
  )
}

export default function PropertiesPanel({ locker, showDepth, onChange, onDelete }: Props) {
  if (!locker) {
    return (
      <div className="p-4 text-xs text-gray-400 text-center mt-8">
        Select a locker to edit its properties
      </div>
    )
  }

  const update = (key: keyof LockerObject, value: string | number) =>
    onChange({ ...locker, [key]: value })

  return (
    <div className="p-3 space-y-3 text-xs text-gray-700">
      <p className="font-semibold text-gray-500 uppercase tracking-wide text-[10px]">
        Locker properties
      </p>

      {/* Label */}
      <Field label="Label">
        <input
          className="w-full border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
          value={locker.label}
          onChange={(e) => update('label', e.target.value)}
        />
      </Field>

      {/* Dimensions */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
          Size (mm)
        </p>
        {([
          ['widthMm',  'Width'],
          ['heightMm', 'Height'],
          ['depthMm',  'Depth'],
        ] as [keyof LockerObject, string][]).map(([key, label]) => (
          <div key={key} className="flex items-center justify-between gap-2">
            <span className="text-gray-500 w-12 shrink-0">{label}</span>
            <NumericInput
              min={50}
              value={locker[key] as number}
              onCommit={(v) => update(key, v)}
              className="flex-1 border rounded px-2 py-0.5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
            <span className="text-gray-400 text-[10px] w-6 shrink-0">mm</span>
          </div>
        ))}
      </div>

      {/* Colours */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Colour</p>
        {([
          ['color',      'Body',  locker.color],
          ['depthColor', 'Depth', locker.depthColor ?? locker.color],
        ] as [keyof LockerObject, string, string][]).map(([key, label, val]) => (
          <div key={key} className="flex items-center justify-between">
            <span className="text-gray-500">{label}</span>
            <div className="flex items-center gap-1.5">
              <input type="color" value={val}
                onChange={(e) => update(key, e.target.value)}
                className="w-6 h-6 rounded cursor-pointer border" />
              <span className="text-[10px] font-mono text-gray-400">{val}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Visibility */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Display</p>
        {([
          ['showLabel',     'Show name label'],
          ['showDimension', 'Show dimension'],
        ] as [keyof LockerObject, string][]).map(([key, label]) => (
          <label key={key} className="flex items-center justify-between cursor-pointer">
            <span className="text-gray-500">{label}</span>
            <input type="checkbox"
              checked={(locker[key] as boolean | undefined) !== false}
              onChange={(e) => onChange({ ...locker, [key]: e.target.checked })}
              className="w-4 h-4 accent-blue-500 cursor-pointer" />
          </label>
        ))}
      </div>

      {/* Rotation */}
      <Field label="Rotation">
        <div className="flex gap-1 flex-wrap">
          {[0, 90, 180, 270].map((r) => (
            <button
              key={r}
              onClick={() => update('rotation', r)}
              className={`flex-1 py-0.5 rounded border text-[10px] transition-colors ${
                locker.rotation === r
                  ? 'bg-blue-100 border-blue-400 text-blue-700 font-medium'
                  : 'border-gray-200 text-gray-500 hover:bg-gray-50'
              }`}
            >
              {r}°
            </button>
          ))}
        </div>
      </Field>

      {/* Delete */}
      <button
        onClick={() => onDelete(locker.id)}
        className="w-full mt-1 px-3 py-1.5 bg-red-50 text-red-600 rounded border border-red-200 text-xs hover:bg-red-100"
      >
        Delete locker
      </button>
    </div>
  )
}
