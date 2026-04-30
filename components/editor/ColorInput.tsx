'use client'
// components/editor/ColorInput.tsx
// Colour swatch that opens a palette popover + hex text field

import { useState, useEffect, useRef } from 'react'

// 10-column palette — grays → blues → cyans → greens → yellows → oranges → reds → purples
const PALETTE: string[] = [
  // Whites / grays / slates
  '#ffffff', '#f8fafc', '#f1f5f9', '#e2e8f0', '#cbd5e1', '#94a3b8', '#64748b', '#475569', '#334155', '#1e293b',
  // Blues
  '#eff6ff', '#dbeafe', '#bfdbfe', '#93c5fd', '#60a5fa', '#3b82f6', '#2563eb', '#1d4ed8', '#1e40af', '#1e3a8a',
  // Sky / cyan
  '#f0f9ff', '#e0f2fe', '#bae6fd', '#7dd3fc', '#38bdf8', '#0ea5e9', '#0284c7', '#0369a1', '#075985', '#0c4a6e',
  // Greens
  '#f0fdf4', '#dcfce7', '#bbf7d0', '#86efac', '#4ade80', '#22c55e', '#16a34a', '#15803d', '#166534', '#14532d',
  // Yellows / amber
  '#fefce8', '#fef9c3', '#fef08a', '#fde047', '#facc15', '#eab308', '#ca8a04', '#a16207', '#854d0e', '#713f12',
  // Oranges
  '#fff7ed', '#ffedd5', '#fed7aa', '#fdba74', '#fb923c', '#f97316', '#ea580c', '#c2410c', '#9a3412', '#7c2d12',
  // Reds
  '#fef2f2', '#fee2e2', '#fecaca', '#fca5a5', '#f87171', '#ef4444', '#dc2626', '#b91c1c', '#991b1b', '#7f1d1d',
  // Purples / violet
  '#faf5ff', '#f3e8ff', '#e9d5ff', '#d8b4fe', '#c084fc', '#a855f7', '#9333ea', '#7c3aed', '#6d28d9', '#5b21b6',
]

interface Props {
  value: string
  onChange: (v: string) => void
  align?: 'left' | 'right'  // which side the popover anchors to
}

export default function ColorInput({ value, onChange, align = 'right' }: Props) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(value)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setDraft(value) }, [value])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node))
        setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const commit = (text: string) => {
    const s = text.trim()
    const hex = s.startsWith('#') ? s : '#' + s
    if (/^#[0-9a-fA-F]{6}$/.test(hex)) { onChange(hex.toLowerCase()); setOpen(false) }
    else setDraft(value)
  }

  return (
    <div className="relative inline-block" ref={containerRef}>
      {/* Swatch trigger */}
      <button
        onClick={() => setOpen((v) => !v)}
        title={value}
        style={{ backgroundColor: value }}
        className="w-6 h-6 rounded border border-gray-300 shadow-sm cursor-pointer hover:scale-105 transition-transform shrink-0"
      />

      {/* Popover */}
      {open && (
        <div
          className={`absolute z-[9999] bg-white border border-gray-200 rounded-lg shadow-xl p-2 w-[13.5rem] ${
            align === 'right' ? 'right-0' : 'left-0'
          } top-8`}
        >
          {/* Palette grid */}
          <div className="grid grid-cols-10 gap-0.5 mb-2">
            {PALETTE.map((c) => (
              <button
                key={c}
                onClick={() => { onChange(c); setDraft(c); setOpen(false) }}
                title={c}
                style={{ backgroundColor: c }}
                className={`w-[18px] h-[18px] rounded-sm cursor-pointer border transition-transform hover:scale-125 hover:z-10 hover:shadow ${
                  value.toLowerCase() === c ? 'border-blue-500 ring-1 ring-blue-400 scale-110' : 'border-gray-200'
                }`}
              />
            ))}
          </div>

          {/* Custom hex + native picker */}
          <div className="flex items-center gap-1 pt-1.5 border-t border-gray-100">
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={(e) => commit(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') commit((e.target as HTMLInputElement).value) }}
              placeholder="#rrggbb"
              className="flex-1 min-w-0 text-[10px] font-mono text-gray-600 border rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
            <input
              type="color"
              value={value}
              onChange={(e) => { onChange(e.target.value); setDraft(e.target.value) }}
              title="Custom colour"
              className="w-6 h-6 border rounded cursor-pointer shrink-0 p-0"
            />
          </div>
        </div>
      )}
    </div>
  )
}
