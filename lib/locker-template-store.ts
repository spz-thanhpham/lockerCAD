// lib/locker-template-store.ts
// Persisted quick-add locker templates — survives page refresh via localStorage.

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { nanoid } from 'nanoid'
import { DEFAULT_LOCKER_TEMPLATES } from '@/types'

export interface LockerTemplate {
  id: string
  widthMm: number
  heightMm: number
  depthMm: number
  color: string
}

interface LockerTemplateStore {
  templates: LockerTemplate[]
  addTemplate: (t: Omit<LockerTemplate, 'id'>) => void
  updateTemplate: (id: string, patch: Partial<Omit<LockerTemplate, 'id'>>) => void
  deleteTemplate: (id: string) => void
  rehydrate: () => void
}

const SEED: LockerTemplate[] = DEFAULT_LOCKER_TEMPLATES.map((t) => ({
  id: t.templateId ?? nanoid(),
  widthMm: t.widthMm,
  heightMm: t.heightMm,
  depthMm: t.depthMm,
  color: t.color,
}))

export const useLockerTemplateStore = create<LockerTemplateStore>()(
  persist(
    (set, get) => ({
      templates: [],

      addTemplate: (t) =>
        set((s) => ({ templates: [...s.templates, { id: nanoid(), ...t }] })),

      updateTemplate: (id, patch) =>
        set((s) => ({
          templates: s.templates.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        })),

      deleteTemplate: (id) =>
        set((s) => ({ templates: s.templates.filter((t) => t.id !== id) })),

      rehydrate: () => {
        useLockerTemplateStore.persist.rehydrate()
        // Seed defaults on first ever load
        setTimeout(() => {
          if (get().templates.length === 0) set({ templates: SEED })
        }, 0)
      },
    }),
    {
      name: 'lc-locker-templates',
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
    }
  )
)
