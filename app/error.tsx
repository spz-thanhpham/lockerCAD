'use client'
import { useEffect } from 'react'

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error) }, [error])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white border rounded-xl shadow-sm p-8 max-w-md w-full text-center">
        <div className="text-3xl mb-3">⚠️</div>
        <h2 className="text-lg font-semibold text-gray-800 mb-2">Something went wrong</h2>
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2 mb-4 text-left font-mono break-all">
          {error.message || 'Unknown error'}
        </p>
        <button
          onClick={reset}
          className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
