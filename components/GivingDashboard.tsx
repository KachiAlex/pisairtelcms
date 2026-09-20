'use client'

import { useState, useEffect } from 'react'
import { formatCurrency, formatDate } from '@/lib/utils'
import Link from 'next/link'

interface GivingRecord {
  id: string
  amount: number
  type: string
  status?: string
  createdAt: string
  project?: {
    id: string
    name: string
  } | null
}

interface Summary {
  totalAmount: number
  totalDonations: number
  streak: number
}

export default function GivingDashboard() {
  const [giving, setGiving] = useState<GivingRecord[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadHistory()
  }, [])

  const loadHistory = async () => {
    try {
      const response = await fetch('/api/giving/history')
      if (response.ok) {
        const data = await response.json()
        setGiving(data.giving)
        setSummary(data.summary)
      }
    } catch (error) {
      console.error('Error loading giving history:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">Loading...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-3xl font-bold">My Giving</h1>
        <Link
          href="/dashboard/giving"
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          Give Now
        </Link>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="text-sm text-gray-600 mb-2">Total Given</div>
            <div className="text-3xl font-bold text-primary-600">
              {formatCurrency(summary.totalAmount)}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="text-sm text-gray-600 mb-2">Total Donations</div>
            <div className="text-3xl font-bold text-primary-600">
              {summary.totalDonations}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="text-sm text-gray-600 mb-2">Giving Streak</div>
            <div className="text-3xl font-bold text-primary-600">
              {summary.streak} {summary.streak === 1 ? 'day' : 'days'}
            </div>
          </div>
        </div>
      )}

      {/* Giving History */}
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold">Giving History</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Project
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {giving.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    No giving history yet
                  </td>
                </tr>
              ) : (
                giving.map((record) => (
                  <tr key={record.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(record.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 bg-primary-100 text-primary-800 rounded text-sm">
                        {record.type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {record.project?.name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {record.status === 'PENDING' ? (
                        <span className="px-2 py-1 bg-amber-100 text-amber-800 rounded text-xs font-medium">Pending review</span>
                      ) : record.status === 'REJECTED' ? (
                        <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs font-medium">Rejected</span>
                      ) : (
                        <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">Confirmed</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {formatCurrency(record.amount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

