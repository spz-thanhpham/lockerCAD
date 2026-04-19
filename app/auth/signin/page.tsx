'use client'

import { useState, Suspense } from 'react'
import { signIn } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  )
}

function SignInForm() {
  const searchParams = useSearchParams()
  const callbackUrl  = searchParams.get('callbackUrl') ?? '/layouts'
  const error        = searchParams.get('error')

  const [tab, setTab]         = useState<'admin' | 'magic'>('admin')
  const [email, setEmail]     = useState('')
  const [password, setPassword] = useState('')
  const [magicEmail, setMagicEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [magicSent, setMagicSent] = useState(false)
  const [credError, setCredError] = useState('')

  // ── Credentials login ──────────────────────────────────────
  const handleCredentials = async (e: React.FormEvent) => {
    e.preventDefault()
    setCredError('')
    setLoading(true)
    const res = await signIn('credentials', {
      email,
      password,
      callbackUrl,
      redirect: false,
    })
    setLoading(false)
    if (res?.error) {
      setCredError('Invalid email or password.')
    } else if (res?.url) {
      window.location.href = res.url
    }
  }

  // ── Magic link login ───────────────────────────────────────
  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    await signIn('email', { email: magicEmail, callbackUrl, redirect: false })
    setLoading(false)
    setMagicSent(true)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-sm border w-full max-w-sm p-8">

        {/* Logo */}
        <div className="text-center mb-6">
          <div className="text-3xl mb-2">🔒</div>
          <h1 className="text-xl font-semibold text-gray-800">LockerCAD</h1>
          <p className="text-sm text-gray-500 mt-1">Sign in to your account</p>
        </div>

        {/* Auth error from URL */}
        {error && (
          <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 rounded text-xs text-red-600">
            {error === 'OAuthAccountNotLinked'
              ? 'This email is already linked to another provider.'
              : 'Sign-in failed. Please try again.'}
          </div>
        )}

        {/* Tabs */}
        <div className="flex border rounded-lg overflow-hidden mb-5 text-xs">
          {(['admin', 'magic'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-1.5 font-medium transition-colors ${
                tab === t ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              {t === 'admin' ? 'Admin login' : 'Magic link'}
            </button>
          ))}
        </div>

        {/* ── Admin / credentials tab ──────────────────────────── */}
        {tab === 'admin' && (
          <form onSubmit={handleCredentials} className="space-y-4">
            {credError && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                {credError}
              </p>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@lockerapp.com"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50 transition-colors"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
            <p className="text-xs text-center text-gray-400">
              Set credentials via <code className="bg-gray-100 px-1 rounded">ADMIN_EMAIL</code> /{' '}
              <code className="bg-gray-100 px-1 rounded">ADMIN_PASSWORD</code> in .env
            </p>
          </form>
        )}

        {/* ── Magic link tab ───────────────────────────────────── */}
        {tab === 'magic' && (
          magicSent ? (
            <div className="text-center py-4">
              <div className="text-2xl mb-3">📬</div>
              <p className="text-sm font-medium text-gray-700">Check your email</p>
              <p className="text-xs text-gray-500 mt-1">
                A sign-in link was sent to <strong>{magicEmail}</strong>
              </p>
              <p className="text-xs text-gray-400 mt-2">
                (Dev mode: check terminal for the link)
              </p>
              <button
                onClick={() => setMagicSent(false)}
                className="mt-4 text-xs text-blue-600 hover:underline"
              >
                Use a different email
              </button>
            </div>
          ) : (
            <form onSubmit={handleMagicLink} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Email address
                </label>
                <input
                  type="email"
                  required
                  value={magicEmail}
                  onChange={(e) => setMagicEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50 transition-colors"
              >
                {loading ? 'Sending…' : 'Send magic link'}
              </button>
              <p className="text-xs text-center text-gray-400">
                Requires SMTP configured in .env
              </p>
            </form>
          )
        )}
      </div>
    </div>
  )
}
