'use client'
// Numeric input that allows free typing — only commits on blur/Enter.
// Uses type="text" to avoid browser number-input quirks that prevent clearing the field.

import { useState, useEffect, useRef } from 'react'

interface Props {
  value: number
  min?: number
  max?: number
  step?: number
  className?: string
  onCommit: (v: number) => void
}

export default function NumericInput({ value, min, max, className, onCommit }: Props) {
  const [draft, setDraft] = useState<string | null>(null)
  const focusedRef = useRef(false)
  const display = draft !== null ? draft : String(value)

  // Sync display when value changes from outside while not focused
  useEffect(() => {
    if (!focusedRef.current) setDraft(null)
  }, [value])

  const commit = () => {
    const parsed = Number(draft)
    if (draft === null || draft.trim() === '' || !isFinite(parsed)) {
      setDraft(null)
      return
    }
    let v = parsed
    if (min !== undefined) v = Math.max(min, v)
    if (max !== undefined) v = Math.min(max, v)
    onCommit(v)
    setDraft(null)
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      value={display}
      className={className}
      onFocus={(e) => { focusedRef.current = true; setDraft(String(value)); e.target.select() }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => { focusedRef.current = false; commit() }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') { commit(); (e.target as HTMLInputElement).blur() }
        if (e.key === 'Escape') { setDraft(null); (e.target as HTMLInputElement).blur() }
      }}
    />
  )
}
