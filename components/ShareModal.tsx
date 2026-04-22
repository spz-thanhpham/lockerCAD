'use client'

// components/ShareModal.tsx
// Modal for sharing a project or layout with other users

import { useState, useEffect, useCallback, useRef } from 'react'

interface UserResult {
  id: string
  name: string | null
  email: string
}

interface ShareEntry {
  id: string
  permission: 'VIEW' | 'EDIT'
  createdAt: string
  user: UserResult
  grantedBy: UserResult
}

export interface ShareModalProps {
  resourceType: 'project' | 'layout'
  resourceId: string
  resourceName: string
  isOwner: boolean
  onClose: () => void
}

function initials(user: UserResult) {
  const n = user.name ?? user.email
  return n.slice(0, 2).toUpperCase()
}

function PermissionBadge({ permission }: { permission: 'VIEW' | 'EDIT' }) {
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
      permission === 'EDIT' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
    }`}>
      {permission}
    </span>
  )
}

export default function ShareModal({ resourceType, resourceId, resourceName, isOwner, onClose }: ShareModalProps) {
  const [shares, setShares] = useState<ShareEntry[]>([])
  const [loadingShares, setLoadingShares] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<UserResult[]>([])
  const [searching, setSearching] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedPermission, setSelectedPermission] = useState<Record<string, 'VIEW' | 'EDIT'>>({})
  const [sharing, setSharing] = useState<string | null>(null)
  const [revoking, setRevoking] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchRef = useRef<HTMLDivElement>(null)

  const paramKey = resourceType === 'project' ? 'projectId' : 'layoutId'

  const loadShares = useCallback(async () => {
    setLoadingShares(true)
    try {
      const res = await fetch(`/api/share?${paramKey}=${resourceId}`)
      if (res.ok) setShares(await res.json())
    } catch {
      // ignore
    } finally {
      setLoadingShares(false)
    }
  }, [resourceId, paramKey])

  useEffect(() => { loadShares() }, [loadShares])

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (value.trim().length < 2) {
      setSearchResults([])
      setShowDropdown(false)
      return
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(value.trim())}`)
        if (res.ok) {
          const users: UserResult[] = await res.json()
          // Exclude already-shared users
          const sharedIds = new Set(shares.map((s) => s.user.id))
          setSearchResults(users.filter((u) => !sharedIds.has(u.id)))
          setShowDropdown(true)
        }
      } finally {
        setSearching(false)
      }
    }, 400)
  }

  const handleShare = async (targetUser: UserResult) => {
    const perm = selectedPermission[targetUser.id] ?? 'VIEW'
    setSharing(targetUser.id)
    setError(null)
    try {
      const res = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [paramKey]: resourceId, userId: targetUser.id, permission: perm }),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error ?? 'Share failed')
      } else {
        setSearchQuery('')
        setSearchResults([])
        setShowDropdown(false)
        await loadShares()
      }
    } finally {
      setSharing(null)
    }
  }

  const handleRevoke = async (shareId: string) => {
    setRevoking(shareId)
    setError(null)
    try {
      const res = await fetch(`/api/share/${shareId}`, { method: 'DELETE' })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error ?? 'Revoke failed')
      } else {
        setShares((prev) => prev.filter((s) => s.id !== shareId))
      }
    } finally {
      setRevoking(null)
    }
  }

  const handlePermissionChange = async (shareId: string, permission: 'VIEW' | 'EDIT') => {
    setError(null)
    const res = await fetch(`/api/share/${shareId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ permission }),
    })
    if (!res.ok) {
      const d = await res.json()
      setError(d.error ?? 'Update failed')
    } else {
      setShares((prev) => prev.map((s) => s.id === shareId ? { ...s, permission } : s))
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
          <h2 className="text-sm font-semibold text-gray-800 truncate">
            Share — <span className="text-gray-600">{resourceName}</span>
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none ml-2">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && (
            <div className="px-3 py-2 bg-red-50 border border-red-200 rounded text-xs text-red-600 flex justify-between">
              {error}
              <button onClick={() => setError(null)} className="ml-2 text-red-400 hover:text-red-600">✕</button>
            </div>
          )}

          {/* Search section (owner only) */}
          {isOwner && (
            <div ref={searchRef} className="relative">
              <div className="flex items-center border rounded-lg px-3 py-2 gap-2 focus-within:ring-1 focus-within:ring-blue-400 focus-within:border-blue-400">
                {searching ? (
                  <span className="text-gray-400 text-xs shrink-0">⟳</span>
                ) : (
                  <span className="text-gray-400 text-xs shrink-0">🔍</span>
                )}
                <input
                  type="text"
                  placeholder="Search users by name or email…"
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
                  className="flex-1 text-xs outline-none bg-transparent"
                />
              </div>

              {showDropdown && searchResults.length > 0 && (
                <div className="absolute z-10 top-full mt-1 w-full bg-white border rounded-lg shadow-lg py-1 max-h-48 overflow-y-auto">
                  {searchResults.map((u) => (
                    <div key={u.id} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50">
                      <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-600 text-[10px] font-semibold flex items-center justify-center shrink-0">
                        {initials(u)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-800 truncate">{u.name ?? u.email}</p>
                        {u.name && <p className="text-[10px] text-gray-400 truncate">{u.email}</p>}
                      </div>
                      <select
                        value={selectedPermission[u.id] ?? 'VIEW'}
                        onChange={(e) => setSelectedPermission((prev) => ({ ...prev, [u.id]: e.target.value as 'VIEW' | 'EDIT' }))}
                        className="text-[10px] border rounded px-1 py-0.5 text-gray-600"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <option value="VIEW">View</option>
                        <option value="EDIT">Edit</option>
                      </select>
                      <button
                        onClick={() => handleShare(u)}
                        disabled={sharing === u.id}
                        className="text-[10px] bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 disabled:opacity-50 shrink-0"
                      >
                        {sharing === u.id ? '…' : 'Share'}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {showDropdown && !searching && searchResults.length === 0 && searchQuery.trim().length >= 2 && (
                <div className="absolute z-10 top-full mt-1 w-full bg-white border rounded-lg shadow-lg py-3 text-center">
                  <p className="text-xs text-gray-400">No users found</p>
                </div>
              )}
            </div>
          )}

          {/* Current shares */}
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Shared with</p>

            {loadingShares ? (
              <p className="text-xs text-gray-400 py-4 text-center">Loading…</p>
            ) : shares.length === 0 ? (
              <p className="text-xs text-gray-400 py-4 text-center">Not shared with anyone yet.</p>
            ) : (
              <div className="space-y-2">
                {shares.map((s) => (
                  <div key={s.id} className="flex items-center gap-3 py-1.5">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 text-xs font-semibold flex items-center justify-center shrink-0">
                      {initials(s.user)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-800 truncate">{s.user.name ?? s.user.email}</p>
                      {s.user.name && <p className="text-[10px] text-gray-400 truncate">{s.user.email}</p>}
                    </div>
                    {isOwner ? (
                      <select
                        value={s.permission}
                        onChange={(e) => handlePermissionChange(s.id, e.target.value as 'VIEW' | 'EDIT')}
                        className="text-[10px] border rounded px-1 py-0.5 text-gray-600"
                      >
                        <option value="VIEW">View</option>
                        <option value="EDIT">Edit</option>
                      </select>
                    ) : (
                      <PermissionBadge permission={s.permission} />
                    )}
                    {isOwner && (
                      <button
                        onClick={() => handleRevoke(s.id)}
                        disabled={revoking === s.id}
                        title="Revoke access"
                        className="text-gray-300 hover:text-red-500 text-base disabled:opacity-50 shrink-0"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t shrink-0 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs border rounded hover:bg-gray-50 text-gray-600"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
