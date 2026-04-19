'use client'
// app/layouts/page.tsx
// Dashboard — companies (projects) on the left, layouts for the selected company on the right.

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'

interface Company {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  _count: { layouts: number }
}

interface Layout {
  id: string
  name: string
  roomWidth: number
  roomDepth: number
  updatedAt: string
  projectId: string
}

// ── helpers ────────────────────────────────────────────────────────
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Company sidebar item ────────────────────────────────────────────
function CompanyItem({
  company, active, onSelect, onRename, onDelete,
}: {
  company: Company
  active: boolean
  onSelect: () => void
  onRename: (name: string) => void
  onDelete: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState(company.name)
  const [menu, setMenu]       = useState(false)

  const commit = () => {
    if (draft.trim() && draft.trim() !== company.name) onRename(draft.trim())
    setEditing(false)
    setMenu(false)
  }

  return (
    <div
      onClick={() => { if (!editing) onSelect() }}
      className={`group relative flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
        active ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-100 text-gray-700'
      }`}
    >
      <span className="text-base">🏢</span>

      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(company.name); setEditing(false) } }}
          onClick={(e) => e.stopPropagation()}
          className="flex-1 text-sm border rounded px-1 py-0.5 outline-none focus:ring-1 focus:ring-blue-400"
        />
      ) : (
        <span className="flex-1 text-sm font-medium truncate">{company.name}</span>
      )}

      <span className="text-[10px] text-gray-400">{company._count.layouts}</span>

      {/* ⋯ menu */}
      <button
        onClick={(e) => { e.stopPropagation(); setMenu((v) => !v) }}
        className="opacity-0 group-hover:opacity-100 px-1 text-gray-400 hover:text-gray-700 rounded"
      >
        ⋯
      </button>

      {menu && (
        <div
          className="absolute right-0 top-8 z-20 bg-white border rounded-lg shadow-lg py-1 w-32 text-xs"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => { setEditing(true); setMenu(false) }}
            className="w-full text-left px-3 py-1.5 hover:bg-gray-50 text-gray-700"
          >
            Rename
          </button>
          <button
            onClick={() => { setMenu(false); onDelete() }}
            className="w-full text-left px-3 py-1.5 hover:bg-red-50 text-red-600"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  )
}

// ── Layout card ─────────────────────────────────────────────────────
function LayoutCard({ layout, onDelete, onRename }: {
  layout: Layout
  onDelete: () => void
  onRename: (name: string) => void
}) {
  const [confirm, setConfirm] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [draft, setDraft] = useState(layout.name)

  const commitRename = () => {
    const trimmed = draft.trim()
    if (trimmed && trimmed !== layout.name) onRename(trimmed)
    setEditingName(false)
  }

  return (
    <div className="bg-white border rounded-xl overflow-hidden hover:border-blue-300 hover:shadow-sm transition-all group">
      <Link href={`/canvas?layoutId=${layout.id}`}>
        <div className="w-full h-28 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
          <span className="text-gray-300 text-xs">Open to preview</span>
        </div>
      </Link>

      <div className="p-3">
        {editingName ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename()
              if (e.key === 'Escape') { setDraft(layout.name); setEditingName(false) }
            }}
            className="w-full border border-blue-400 rounded px-1.5 py-0.5 text-sm font-medium text-gray-800 focus:outline-none focus:ring-1 focus:ring-blue-400"
          />
        ) : (
          <button
            onClick={() => { setDraft(layout.name); setEditingName(true) }}
            title="Click to rename"
            className="w-full text-left font-medium text-gray-800 text-sm truncate hover:text-blue-600"
          >
            {layout.name}
          </button>
        )}
        <p className="text-[11px] text-gray-400 mt-0.5">
          {layout.roomWidth}×{layout.roomDepth} mm · {fmtDate(layout.updatedAt)}
        </p>
      </div>

      <div className="px-3 pb-3 flex gap-1">
        <Link
          href={`/canvas?layoutId=${layout.id}`}
          className="flex-1 text-center py-1 text-xs border rounded hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors"
        >
          Open
        </Link>
        {!confirm ? (
          <button
            onClick={() => setConfirm(true)}
            className="px-2 py-1 text-xs border rounded hover:bg-red-50 hover:border-red-300 hover:text-red-600 transition-colors"
            title="Delete layout"
          >
            🗑
          </button>
        ) : (
          <button
            onClick={onDelete}
            className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
          >
            Confirm delete
          </button>
        )}
      </div>
    </div>
  )
}

// ── Main dashboard ──────────────────────────────────────────────────
export default function LayoutsPage() {
  const router = useRouter()
  const [companies, setCompanies]         = useState<Company[]>([])
  const [selectedId, setSelectedId]       = useState<string | null>(null)
  const [layouts, setLayouts]             = useState<Layout[]>([])
  const [loadingCo, setLoadingCo]         = useState(true)
  const [loadingLayouts, setLoadingLayouts] = useState(false)
  const [newCoName, setNewCoName]         = useState('')
  const [addingCo, setAddingCo]           = useState(false)
  const [error, setError]                 = useState<string | null>(null)

  // Load companies
  const loadCompanies = useCallback(async () => {
    setLoadingCo(true)
    try {
      const res = await fetch('/api/projects')
      if (res.status === 401) { router.push('/api/auth/signin'); return }
      const data = await res.json()
      setCompanies(data)
      // Auto-select first company
      if (data.length > 0 && !selectedId) setSelectedId(data[0].id)
    } catch {
      setError('Failed to load companies')
    } finally {
      setLoadingCo(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Load layouts for selected company
  const loadLayouts = useCallback(async (projectId: string) => {
    setLoadingLayouts(true)
    try {
      const res = await fetch(`/api/layouts?projectId=${projectId}`)
      const data = await res.json()
      setLayouts(Array.isArray(data) ? data.filter((l: Layout) => l.projectId === projectId) : [])
    } catch {
      setLayouts([])
    } finally {
      setLoadingLayouts(false)
    }
  }, [])

  useEffect(() => { loadCompanies() }, [loadCompanies])
  useEffect(() => { if (selectedId) loadLayouts(selectedId) }, [selectedId, loadLayouts])

  const handleAddCompany = async () => {
    if (!newCoName.trim()) return
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newCoName.trim() }),
    })
    if (!res.ok) return
    const created: Company = await res.json()
    setCompanies((prev) => [...prev, created])
    setSelectedId(created.id)
    setNewCoName('')
    setAddingCo(false)
  }

  const handleRenameCompany = async (id: string, name: string) => {
    const res = await fetch(`/api/projects/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    if (!res.ok) return
    const updated: Company = await res.json()
    setCompanies((prev) => prev.map((c) => (c.id === id ? updated : c)))
  }

  const handleDeleteCompany = async (id: string) => {
    if (!confirm(`Delete this company and all its layouts?`)) return
    await fetch(`/api/projects/${id}`, { method: 'DELETE' })
    setCompanies((prev) => prev.filter((c) => c.id !== id))
    if (selectedId === id) setSelectedId(companies.find((c) => c.id !== id)?.id ?? null)
  }

  const handleRenameLayout = async (id: string, name: string) => {
    await fetch(`/api/layouts/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    setLayouts((prev) => prev.map((l) => (l.id === id ? { ...l, name } : l)))
  }

  const handleDeleteLayout = async (id: string) => {
    await fetch(`/api/layouts/${id}`, { method: 'DELETE' })
    setLayouts((prev) => prev.filter((l) => l.id !== id))
    setCompanies((prev) =>
      prev.map((c) =>
        c.id === selectedId ? { ...c, _count: { layouts: Math.max(0, c._count.layouts - 1) } } : c
      )
    )
  }

  const selectedCompany = companies.find((c) => c.id === selectedId)

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <header className="h-12 bg-white border-b flex items-center px-4 gap-3 shrink-0">
        <div className="flex flex-col leading-none">
          <span className="text-sm font-semibold text-gray-800">🔒 LockerCAD</span>
          <span className="text-[10px] text-gray-400 tracking-wide">a locker layout tool</span>
        </div>
        <div className="flex-1" />
        {selectedId && (
          <Link
            href={`/canvas?projectId=${selectedId}`}
            className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
          >
            + New Layout
          </Link>
        )}
        <button
          onClick={() => signOut({ callbackUrl: '/auth/signin' })}
          className="px-3 py-1.5 border border-gray-200 text-gray-500 text-xs rounded hover:bg-gray-50 hover:text-gray-700"
        >
          Log out
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Company sidebar ─────────────────────────────────── */}
        <aside className="w-56 bg-white border-r flex flex-col shrink-0">
          <div className="p-3 border-b flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Customers</span>
            <button
              onClick={() => setAddingCo(true)}
              className="text-blue-600 hover:text-blue-800 text-lg leading-none"
              title="Add customer"
            >
              +
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {loadingCo ? (
              <p className="text-xs text-gray-400 p-2">Loading…</p>
            ) : companies.length === 0 ? (
              <p className="text-xs text-gray-400 p-2">No customers yet.</p>
            ) : (
              companies.map((c) => (
                <CompanyItem
                  key={c.id}
                  company={c}
                  active={c.id === selectedId}
                  onSelect={() => setSelectedId(c.id)}
                  onRename={(name) => handleRenameCompany(c.id, name)}
                  onDelete={() => handleDeleteCompany(c.id)}
                />
              ))
            )}

            {/* Inline add form */}
            {addingCo && (
              <div className="flex gap-1 mt-1 px-1">
                <input
                  autoFocus
                  placeholder="Customer name"
                  value={newCoName}
                  onChange={(e) => setNewCoName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddCompany()
                    if (e.key === 'Escape') { setAddingCo(false); setNewCoName('') }
                  }}
                  className="flex-1 border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
                <button onClick={handleAddCompany}
                  className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700">
                  Add
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* ── Layouts panel ────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto p-6">
          {error && (
            <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>
          )}

          {!selectedCompany ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <p className="text-sm">Select or create a company to get started.</p>
            </div>
          ) : (
            <>
              <div className="flex items-baseline justify-between mb-5">
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">{selectedCompany.name}</h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {selectedCompany._count.layouts} layout{selectedCompany._count.layouts !== 1 ? 's' : ''}
                    {' · '}Created {fmtDate(selectedCompany.createdAt)}
                  </p>
                </div>
                <Link
                  href={`/canvas?projectId=${selectedId}`}
                  className="px-3 py-1.5 border border-blue-300 text-blue-700 text-xs rounded hover:bg-blue-50"
                >
                  + New Layout
                </Link>
              </div>

              {loadingLayouts ? (
                <p className="text-sm text-gray-400">Loading layouts…</p>
              ) : layouts.length === 0 ? (
                <div className="text-center py-20 text-gray-400">
                  <p className="text-sm">No layouts yet for this company.</p>
                  <Link
                    href={`/canvas?projectId=${selectedId}`}
                    className="text-blue-500 text-sm mt-2 inline-block hover:underline"
                  >
                    Create first layout →
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {layouts.map((l) => (
                    <LayoutCard
                      key={l.id}
                      layout={l}
                      onDelete={() => handleDeleteLayout(l.id)}
                      onRename={(name) => handleRenameLayout(l.id, name)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  )
}
