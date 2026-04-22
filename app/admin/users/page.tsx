'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Provider = { provider: string }
type User = {
  id: string
  email: string
  name: string | null
  role: 'ADMIN' | 'DESIGNER' | 'CUSTOMER'
  createdAt: string
  accounts: Provider[]
}

const ROLES = ['DESIGNER', 'CUSTOMER', 'ADMIN'] as const

export default function AdminUsersPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [users, setUsers]       = useState<User[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<{ name: string; email: string; role: string }>({ name: '', email: '', role: '' })
  const [newForm, setNewForm]   = useState({ name: '', email: '', role: 'DESIGNER' })
  const [showNew, setShowNew]   = useState(false)
  const [saving, setSaving]     = useState(false)

  const isAdmin = (session?.user as any)?.role === 'ADMIN'

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/auth/signin'); return }
    if (status === 'authenticated' && !isAdmin) { router.push('/layouts'); return }
    if (status === 'authenticated' && isAdmin) fetchUsers()
  }, [status, isAdmin])

  async function fetchUsers() {
    setLoading(true)
    const res = await fetch('/api/admin/users')
    if (!res.ok) { setError('Failed to load users'); setLoading(false); return }
    setUsers(await res.json())
    setLoading(false)
  }

  function startEdit(u: User) {
    setEditingId(u.id)
    setEditForm({ name: u.name ?? '', email: u.email, role: u.role })
  }

  async function saveEdit(id: string) {
    setSaving(true)
    const res = await fetch(`/api/admin/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    })
    setSaving(false)
    if (!res.ok) { setError('Save failed'); return }
    setEditingId(null)
    fetchUsers()
  }

  async function deleteUser(id: string, email: string) {
    if (!confirm(`Delete user ${email}? This removes all their data.`)) return
    const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' })
    if (!res.ok) { const d = await res.json(); setError(d.error ?? 'Delete failed'); return }
    fetchUsers()
  }

  async function createUser() {
    if (!newForm.email) return
    setSaving(true)
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newForm),
    })
    setSaving(false)
    if (!res.ok) { setError('Create failed'); return }
    setNewForm({ name: '', email: '', role: 'DESIGNER' })
    setShowNew(false)
    fetchUsers()
  }

  async function unlinkAccount(userId: string, provider: string) {
    if (!confirm(`Unlink ${provider} from this user? They will need to re-link on next login.`)) return
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unlinkProvider: provider }),
    })
    if (!res.ok) { setError('Unlink failed'); return }
    fetchUsers()
  }

  if (status === 'loading' || loading) {
    return <div className="flex items-center justify-center h-screen text-sm text-gray-500">Loading…</div>
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/layouts')} className="text-sm text-gray-500 hover:text-gray-700">← Back</button>
          <h1 className="text-sm font-semibold text-gray-800">User Management</h1>
          <Link href="/admin/shares" className="text-xs text-gray-500 hover:text-blue-600 border rounded px-2 py-1 hover:border-blue-300">
            Manage Shares
          </Link>
        </div>
        <button onClick={() => setShowNew(true)}
          className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700">
          + Add user
        </button>
      </header>

      <div className="max-w-5xl mx-auto p-6">
        {error && (
          <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 rounded text-xs text-red-600 flex justify-between">
            {error}
            <button onClick={() => setError('')} className="ml-4 text-red-400 hover:text-red-600">✕</button>
          </div>
        )}

        {/* New user form */}
        {showNew && (
          <div className="mb-4 bg-white border rounded-lg p-4 shadow-sm">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">New user</p>
            <div className="flex gap-2 flex-wrap">
              <input placeholder="Name" value={newForm.name}
                onChange={(e) => setNewForm(f => ({ ...f, name: e.target.value }))}
                className="border rounded px-2 py-1 text-xs flex-1 min-w-[140px]" />
              <input placeholder="Email *" value={newForm.email}
                onChange={(e) => setNewForm(f => ({ ...f, email: e.target.value }))}
                className="border rounded px-2 py-1 text-xs flex-1 min-w-[200px]" />
              <select value={newForm.role}
                onChange={(e) => setNewForm(f => ({ ...f, role: e.target.value }))}
                className="border rounded px-2 py-1 text-xs">
                {ROLES.map(r => <option key={r}>{r}</option>)}
              </select>
              <button onClick={createUser} disabled={saving || !newForm.email}
                className="bg-blue-600 text-white text-xs px-3 py-1 rounded hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Saving…' : 'Create'}
              </button>
              <button onClick={() => setShowNew(false)}
                className="text-xs px-3 py-1 border rounded hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        )}

        {/* Users table */}
        <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-2 font-semibold text-gray-500">Name</th>
                <th className="text-left px-4 py-2 font-semibold text-gray-500">Email</th>
                <th className="text-left px-4 py-2 font-semibold text-gray-500">Role</th>
                <th className="text-left px-4 py-2 font-semibold text-gray-500">Sign-in</th>
                <th className="text-left px-4 py-2 font-semibold text-gray-500">Created</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  {editingId === u.id ? (
                    <>
                      <td className="px-4 py-2">
                        <input value={editForm.name}
                          onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))}
                          className="border rounded px-2 py-0.5 w-full text-xs" />
                      </td>
                      <td className="px-4 py-2">
                        <input value={editForm.email}
                          onChange={(e) => setEditForm(f => ({ ...f, email: e.target.value }))}
                          className="border rounded px-2 py-0.5 w-full text-xs" />
                      </td>
                      <td className="px-4 py-2">
                        <select value={editForm.role}
                          onChange={(e) => setEditForm(f => ({ ...f, role: e.target.value }))}
                          className="border rounded px-2 py-0.5 text-xs">
                          {ROLES.map(r => <option key={r}>{r}</option>)}
                        </select>
                      </td>
                      <td className="px-4 py-2 text-gray-400">—</td>
                      <td className="px-4 py-2 text-gray-400">—</td>
                      <td className="px-4 py-2 flex gap-2 justify-end">
                        <button onClick={() => saveEdit(u.id)} disabled={saving}
                          className="text-blue-600 hover:underline disabled:opacity-50">Save</button>
                        <button onClick={() => setEditingId(null)}
                          className="text-gray-400 hover:text-gray-600">Cancel</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-2 text-gray-700">{u.name ?? <span className="text-gray-400 italic">—</span>}</td>
                      <td className="px-4 py-2 text-gray-700">{u.email}</td>
                      <td className="px-4 py-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          u.role === 'ADMIN' ? 'bg-red-100 text-red-700' :
                          u.role === 'DESIGNER' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-600'}`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-gray-500">
                        {u.accounts.length === 0
                          ? <span className="text-gray-400 italic">credentials</span>
                          : u.accounts.map(a => (
                            <span key={a.provider}
                              className="inline-block bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-[10px] mr-1">
                              {a.provider}
                            </span>
                          ))
                        }
                      </td>
                      <td className="px-4 py-2 text-gray-400">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex gap-3 justify-end">
                          <button onClick={() => startEdit(u)}
                            className="text-gray-500 hover:text-blue-600">Edit</button>
                          <button onClick={() => deleteUser(u.id, u.email)}
                            className="text-gray-400 hover:text-red-600">Delete</button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No users found</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[10px] text-gray-400">
          {users.length} user{users.length !== 1 ? 's' : ''} total
        </p>
      </div>
    </div>
  )
}
