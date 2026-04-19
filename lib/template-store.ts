// lib/template-store.ts
// Persisted block templates — survives page refresh via localStorage.
// Uses skipHydration to avoid SSR mismatch; call rehydrate() in a useEffect.

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { nanoid } from 'nanoid'
import type { LockerBlock } from '@/types'

export interface BlockTemplate {
  id: string
  name: string
  // everything except canvas-position and id — set fresh when placed
  block: Omit<LockerBlock, 'id' | 'x' | 'y'>
}

interface TemplateStore {
  templates: BlockTemplate[]
  saveTemplate: (name: string, block: LockerBlock) => void
  deleteTemplate: (id: string) => void
  renameTemplate: (id: string, name: string) => void
}

export const useTemplateStore = create<TemplateStore>()(
  persist(
    (set) => ({
      templates: [],

      saveTemplate: (name, block) => {
        const { id: _id, x: _x, y: _y, ...rest } = block
        set((s) => ({
          templates: [
            ...s.templates,
            { id: nanoid(), name: name.trim() || 'Template', block: rest },
          ],
        }))
      },

      deleteTemplate: (id) =>
        set((s) => ({ templates: s.templates.filter((t) => t.id !== id) })),

      renameTemplate: (id, name) =>
        set((s) => ({
          templates: s.templates.map((t) =>
            t.id === id ? { ...t, name: name.trim() || t.name } : t
          ),
        })),
    }),
    {
      name: 'lc-block-templates',
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,   // rehydrate manually in a useEffect to avoid SSR mismatch
    }
  )
)
