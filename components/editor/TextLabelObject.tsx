'use client'
// Draggable, selectable, inline-editable text annotation.

import { useRef, useState, useEffect } from 'react'
import { Group, Text, Rect } from 'react-konva'
import type Konva from 'konva'
import type { TextLabel } from '@/types'

interface Props {
  label: TextLabel
  isSelected: boolean
  scale: number
  onChange: (updated: TextLabel) => void
  onSelect: () => void
  roomX: number
  roomY: number
  roomWidthPx: number
  roomHeightPx: number
}

export default function TextLabelObject({
  label, isSelected, onChange, onSelect,
  roomX, roomY, roomWidthPx, roomHeightPx,
}: Props) {
  const textRef = useRef<Konva.Text>(null)
  // Re-measure after mount so hit rect matches actual text size
  const [size, setSize] = useState({ w: 0, h: 0 })

  useEffect(() => {
    if (textRef.current) {
      setSize({ w: textRef.current.width(), h: textRef.current.height() })
    }
  })

  const PAD = 4
  const w = size.w || Math.max(40, label.text.length * label.fontSize * 0.6)
  const h = size.h || label.fontSize * 1.4

  // Inline editing: overlay an HTML textarea positioned over the Konva text
  const startEdit = () => {
    const node = textRef.current
    if (!node) return
    const stage = node.getStage()
    if (!stage) return

    const stageBox = stage.container().getBoundingClientRect()
    const absPos   = node.getAbsolutePosition()
    const sx       = stage.scaleX()

    const textarea = document.createElement('textarea')
    document.body.appendChild(textarea)

    textarea.value = label.text
    Object.assign(textarea.style, {
      position:        'fixed',
      top:             `${stageBox.top  + absPos.y}px`,
      left:            `${stageBox.left + absPos.x}px`,
      minWidth:        `${Math.max(60, w * sx)}px`,
      minHeight:       `${h * sx}px`,
      fontSize:        `${label.fontSize * sx}px`,
      fontFamily:      node.fontFamily(),
      fontStyle:       label.fontStyle === 'italic' ? 'italic' : 'normal',
      fontWeight:      label.fontStyle === 'bold'   ? 'bold'   : 'normal',
      color:           label.color,
      lineHeight:      String(node.lineHeight()),
      padding:         '0',
      margin:          '0',
      border:          '1.5px solid #3b82f6',
      borderRadius:    '2px',
      background:      'rgba(255,255,255,0.97)',
      outline:         'none',
      resize:          'none',
      overflow:        'hidden',
      zIndex:          '9999',
      transformOrigin: 'left top',
      transform:       label.rotation ? `rotate(${label.rotation}deg)` : '',
    })

    textarea.focus()
    textarea.select()

    const grow = () => { textarea.style.height = 'auto'; textarea.style.height = textarea.scrollHeight + 'px' }
    textarea.addEventListener('input', grow)
    grow()

    const commit = () => {
      const next = textarea.value.trim()
      if (document.body.contains(textarea)) document.body.removeChild(textarea)
      if (next) onChange({ ...label, text: next })
    }

    textarea.addEventListener('blur', commit)
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        textarea.removeEventListener('blur', commit)
        if (document.body.contains(textarea)) document.body.removeChild(textarea)
      }
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); textarea.blur() }
    })
  }

  return (
    <Group
      x={label.x}
      y={label.y}
      rotation={label.rotation}
      draggable={!label.locked}
      onDragMove={(e) => {
        e.target.x(Math.max(roomX, Math.min(roomX + roomWidthPx, e.target.x())))
        e.target.y(Math.max(roomY, Math.min(roomY + roomHeightPx, e.target.y())))
      }}
      onDragEnd={(e) => onChange({ ...label, x: e.target.x(), y: e.target.y() })}
      onClick={(e)    => { e.cancelBubble = true; onSelect() }}
      onTap={(e)      => { e.cancelBubble = true; onSelect() }}
      onDblClick={(e) => { e.cancelBubble = true; if (!label.locked) startEdit() }}
      onDblTap={(e)   => { e.cancelBubble = true; if (!label.locked) startEdit() }}
    >
      {/* Transparent hit area — always present so the group is clickable */}
      <Rect
        x={-PAD} y={-PAD}
        width={w + PAD * 2}
        height={h + PAD * 2}
        fill="transparent"
      />

      {/* Selection border */}
      {isSelected && (
        <Rect
          x={-PAD} y={-PAD}
          width={w + PAD * 2}
          height={h + PAD * 2}
          stroke={label.locked ? '#f59e0b' : '#3b82f6'}
          strokeWidth={1}
          dash={[4, 3]}
          fill={label.locked ? 'rgba(245,158,11,0.04)' : 'rgba(59,130,246,0.04)'}
          listening={false}
        />
      )}

      {/* Lock badge */}
      {label.locked && isSelected && (
        <Text x={w + PAD - 2} y={-PAD - 1} text="🔒" fontSize={10} listening={false} />
      )}

      <Text
        ref={textRef}
        text={label.text}
        fontSize={label.fontSize}
        fontStyle={label.fontStyle}
        fill={label.color}
        listening={false}
      />
    </Group>
  )
}
