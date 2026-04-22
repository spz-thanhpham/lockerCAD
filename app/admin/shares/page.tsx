'use client'

// app/admin/shares/page.tsx
// Admin: view and manage all share permissions

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface ShareEntry {
  id: string
  permission: 'VIEW' | 'EDIT'
  createdAt: string
  user: { id: string; name: string | null; email: string }
  grantedBy: { id: string; name: string | null; email: string }
  project: { id: string; name: string } | null
  layout: { id: string; name: string } | null
}

type FilterType = 'all' | 'project' | 'layout'

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
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

function TypeBadge({ type }: { type: 'project' | 'layout' }) {
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
      type === 'project' ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700'
    }`}>
      {type === 'project' ? 'Project' : 'Layout'}
    </span>
  )
}

export default function AdminSharesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [shares, setShares] = useState<ShareEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<FilterType>('all')
  const [revoking, setRevoking] = useState<string | null>(null)

  const isAdmin = (session?.user as any)?.role === 'ADMIN'

  const fetchShares = useCallback(async (type: FilterType) => {
    setLoading(true)
    const url = type === 'all' ? '/api/admin/shares' : `/api/admin/shares?type=${type}`
    const res = await fetch(url)
    if (!res.ok) { setError('Failed to load shares'); setLoading(false); return }
    setShares(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/auth/signin'); return }
    if (status === 'authenticated' && !isAdmin) { router.push('/layouts'); return }
    if (status === 'authenticated' && isAdmin) fetchShares(filter)
  }, [status, isAdmin, filter, fetchShares, router])

  async function handleRevoke(id: string) {
    if (!confirm('Revoke this share permission?')) return
    setRevoking(id)
    const res = await fetch(`/api/share/${id}`, { method: 'DELETE' })
    setRevoking(null)
    if (!res.ok) { setError('Revoke failed'); return }
    setShares((prev) => prev.filter((s) => s.id !== id))
  }

  if (status === 'loading' || loading) {
    return <div className="flex items-center justify-center h-screen text-sm text-gray-500">Loading…</div>
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/layouts" className="text-sm text-gray-500 hover:text-gray-700">← Back</Link>
          <h1 className="text-sm font-semibold text-gray-800">Share Permissions</h1>
          <Link href="/admin/users" className="text-xs text-gray-500 hover:text-blue-600 border rounded px-2 py-1 hover:border-blue-300">
            User Management
          </Link>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-6">
        {error && (
          <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 rounded text-xs text-red-600 flex justify-between">
            {error}
            <button onClick={() => setError('')} className="ml-4 text-red-400 hover:text-red-600">✕</button>
          </div>
        )}

        {/* Filter tabs */}
        <div className="flex gap-1 mb-5">
          {(['all', 'project', 'layout'] as FilterType[]).map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                filter === t
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border text-gray-600 hover:bg-gray-50'
              }`}
            >
              {t === 'all' ? 'All' : t === 'project' ? 'Projects' : 'Layouts'}
            </button>
          ))}
        </div>

        <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-2 font-semibold text-gray-500">Resource</th>
                <th className="text-left px-4 py-2 font-semibold text-gray-500">Shared With</th>
                <th className="text-left px-4 py-2 font-semibold text-gray-500">Permission</th>
                <th className="text-left px-4 py-2 font-semibold text-gray-500">Granted By</th>
                <th className="text-left px-4 py-2 font-semibold text-gray-500">Date</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {shares.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <TypeBadge type={s.project ? 'project' : 'layout'} />
                      <span className="text-gray-700 font-medium truncate max-w-[150px]">
                        {s.project?.name ?? s.layout?.name ?? '—'}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <p className="text-gray-700 font-medium">{s.user.name ?? s.user.email}</p>
                    {s.user.name && <p className="text-gray-400">{s.user.email}</p>}
                  </td>
                  <td className="px-4 py-2.5">
                    <PermissionBadge permission={s.permission} />
                  </td>
                  <td className="px-4 py-2.5">
                    <p className="text-gray-700">{s.grantedBy.name ?? s.grantedBy.email}</p>
                    {s.grantedBy.name && <p className="text-gray-400">{s.grantedBy.email}</p>}
                  </td>
                  <td className="px-4 py-2.5 text-gray-400">{fmtDate(s.createdAt)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      onClick={() => handleRevoke(s.id)}
                      disabled={revoking === s.id}
                      className="text-gray-400 hover:text-red-600 disabled:opacity-50"
                      title="Revoke"
                    >
                      {revoking === s.id ? '…' : 'Revoke'}
                    </button>
                  </td>
                </tr>
              ))}
              {shares.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">No share permissions found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[10px] text-gray-400">
          {shares.length} permission{shares.length !== 1 ? 's' : ''} total
        </p>
      </div>
    </div>
  )
}
