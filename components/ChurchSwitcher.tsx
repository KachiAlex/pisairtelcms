'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Church {
  id: string
  name: string
  slug: string
  logo?: string
}

export default function ChurchSwitcher() {
  const router = useRouter()
  const [churches, setChurches] = useState<Church[]>([])
  const [currentChurch, setCurrentChurch] = useState<Church | null>(null)
  const [loading, setLoading] = useState(true)
  const [switching, setSwitching] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      // Churches this account is a member of (multi-tenant memberships)
      const mineRes = await fetch('/api/churches/mine')
      let mine: Church[] = []
      if (mineRes.ok) {
        const mineData = await mineRes.json()
        mine = mineData.churches || []
        const active = mineData.activeChurchId
          ? mine.find((c: Church) => c.id === mineData.activeChurchId)
          : null
        if (active) setCurrentChurch(active)
      }

      if (mine.length > 0) {
        setChurches(mine)
        return
      }

      // No memberships — superadmins get the full church list instead
      const currentRes = await fetch('/api/churches/switch')
      if (currentRes.ok) {
        const currentData = await currentRes.json()
        setCurrentChurch(currentData.church)
      }
      const churchesRes = await fetch('/api/superadmin/churches')
      if (churchesRes.ok) {
        const churchesData = await churchesRes.json()
        setChurches(churchesData.churches || [])
      }
    } catch (error) {
      console.error('Error fetching church data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleChurchChange = async (churchId: string) => {
    if (churchId === currentChurch?.id || switching) return

    setSwitching(true)
    try {
      const res = await fetch('/api/churches/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ churchId }),
      })

      if (res.ok) {
        const selectedChurch = churches.find(c => c.id === churchId)
        setCurrentChurch(selectedChurch || null)
        // Full reload: session pointers, permissions, and per-church state
        // all change with the active tenant.
        window.location.href = '/dashboard'
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to switch church')
      }
    } catch (error) {
      console.error('Error switching church:', error)
      alert('An error occurred while switching church')
    } finally {
      setSwitching(false)
    }
  }

  if (loading) {
    return (
      <div className="w-full">
        <div className="text-xs text-gray-500">Loading churches...</div>
      </div>
    )
  }

  if (churches.length === 0) {
    return (
      <div className="w-full">
        <div className="text-xs text-gray-500">No churches available</div>
      </div>
    )
  }

  return (
    <div className="w-full">
      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
        {currentChurch ? 'Current Church' : 'Select Church'}
      </label>
      <select
        value={currentChurch?.id || ''}
        onChange={(e) => handleChurchChange(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50 truncate"
        disabled={switching}
      >
        <option value="">Select a church...</option>
        {churches.map((church) => (
          <option key={church.id} value={church.id}>
            {church.name}
          </option>
        ))}
      </select>
      <p className="text-xs text-gray-500 mt-1">
        {switching ? 'Switching...' : 'Switch churches to manage different organizations'}
      </p>
    </div>
  )
}