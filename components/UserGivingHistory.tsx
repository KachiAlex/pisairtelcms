'use client'

import { useEffect, useState } from 'react'

type GivingRecord = {
  id: string
  amount: number
  currency?: string | null
  type: string
  status: string
  paymentMethod?: string | null
  createdAt: string
  project?: { id: string; name: string } | null
}

type Summary = {
  totalAmount: number
  totalDonations: number
  streak: number
}

const STATUS_STYLES: Record<string, string> = {
  CONFIRMED: 'bg-green-100 text-green-700',
  PENDING: 'bg-amber-100 text-amber-700',
  REJECTED: 'bg-red-100 text-red-700',
}

function fmt(amount: number, currency?: string | null) {
  try {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: currency || 'NGN',
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `${currency || 'NGN'} ${amount.toLocaleString()}`
  }
}

export default function UserGivingHistory({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [giving, setGiving] = useState<GivingRecord[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)

  useEffect(() => {
    fetch(`/api/giving/history?userId=${encodeURIComponent(userId)}&limit=100`, { cache: 'no-store' })
      .then(async (r) => {
        if (r.status === 403) {
          setForbidden(true)
          return null
        }
        if (!r.ok) throw new Error()
        return r.json()
      })
      .then((j) => {
        if (!j) return
        setGiving(j.giving || [])
        setSummary(j.summary || null)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [userId])

  // Hidden from members without giving-management access
  if (forbidden) return null
  if (loading) {
    return (
      <div className="bg-white rounded-xl border p-5">
        <div className="animate-pulse h-32 bg-gray-100 rounded" />
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Giving History</h2>
        {summary && (
          <div className="text-sm text-gray-600">
            <span className="font-semibold text-green-700">{fmt(summary.totalAmount)}</span>
            {' '}across {summary.totalDonations} donation{summary.totalDonations === 1 ? '' : 's'}
            {summary.streak > 0 && <span className="ml-2 text-amber-600">{summary.streak}-week streak</span>}
          </div>
        )}
      </div>

      {giving.length === 0 ? (
        <p className="text-sm text-gray-500">No giving recorded for this member yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-gray-500 border-b">
                <th className="py-2 pr-4">Date</th>
                <th className="py-2 pr-4">Type</th>
                <th className="py-2 pr-4">Project</th>
                <th className="py-2 pr-4">Method</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {giving.map((g) => (
                <tr key={g.id} className="border-b last:border-0">
                  <td className="py-2 pr-4 whitespace-nowrap">{new Date(g.createdAt).toLocaleDateString()}</td>
                  <td className="py-2 pr-4">{g.type}</td>
                  <td className="py-2 pr-4">{g.project?.name || '—'}</td>
                  <td className="py-2 pr-4">{g.paymentMethod || '—'}</td>
                  <td className="py-2 pr-4">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[g.status] || 'bg-gray-100 text-gray-600'}`}>
                      {g.status === 'PENDING' ? 'Pending review' : g.status.charAt(0) + g.status.slice(1).toLowerCase()}
                    </span>
                  </td>
                  <td className="py-2 text-right font-medium">{fmt(g.amount, g.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
