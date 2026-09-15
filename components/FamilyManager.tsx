'use client'

import { useCallback, useEffect, useState } from 'react'

interface FamilyMember {
  id: string
  firstName: string
  lastName: string
  email?: string
  profileImage?: string
  role?: string
}

interface FamilyManagerProps {
  /** Manage another user's family (requires privileged role). Defaults to current user. */
  userId?: string
  /** Called after any family link change so the parent can refresh */
  onChanged?: () => void
}

export default function FamilyManager({ userId, onChanged }: FamilyManagerProps) {
  const [children, setChildren] = useState<FamilyMember[]>([])
  const [spouse, setSpouse] = useState<FamilyMember | null>(null)
  const [targetUserId, setTargetUserId] = useState<string | null>(userId ?? null)
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<FamilyMember[]>([])
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const loadFamily = useCallback(async () => {
    try {
      setError('')
      const profileRes = await fetch(userId ? `/api/users/${userId}` : '/api/users/me')
      if (!profileRes.ok) throw new Error('Failed to load profile')
      const profile = await profileRes.json()
      const resolvedId = userId || profile.id
      setTargetUserId(resolvedId)

      if (profile.spouseId) {
        const spouseRes = await fetch(`/api/users/${profile.spouseId}`)
        if (spouseRes.ok) setSpouse(await spouseRes.json())
        else setSpouse(null)
      } else {
        setSpouse(null)
      }

      const childrenRes = await fetch(`/api/children/list?parentId=${resolvedId}`)
      if (childrenRes.ok) setChildren(await childrenRes.json())
      else setChildren([])
    } catch (err: any) {
      setError(err.message || 'Failed to load family')
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    loadFamily()
  }, [loadFamily])

  useEffect(() => {
    const term = search.trim()
    if (term.length < 2) {
      setResults([])
      return
    }
    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/users?search=${encodeURIComponent(term)}&limit=8`)
        if (res.ok) {
          const data = await res.json()
          setResults(data.users || [])
        }
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const linkChild = async (childId: string) => {
    setError('')
    const res = await fetch('/api/children/link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ childId, parentId: targetUserId }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'Failed to link child')
      return
    }
    setSearch('')
    setResults([])
    await loadFamily()
    onChanged?.()
  }

  const unlinkChild = async (childId: string) => {
    setError('')
    const res = await fetch('/api/children/link', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ childId, parentId: targetUserId }),
    })
    if (!res.ok) {
      const data = await res.json()
      setError(data.error || 'Failed to unlink child')
      return
    }
    await loadFamily()
    onChanged?.()
  }

  const setSpouseLink = async (spouseId: string | null) => {
    if (!targetUserId) return
    setError('')
    const res = await fetch(`/api/users/${targetUserId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spouseId }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || 'Failed to update spouse')
      return
    }
    setSearch('')
    setResults([])
    await loadFamily()
    onChanged?.()
  }

  const renderMember = (member: FamilyMember, action: React.ReactNode) => (
    <div key={member.id} className="flex items-center justify-between py-2">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center overflow-hidden">
          {member.profileImage ? (
            <img src={member.profileImage} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-primary-600 text-sm font-bold">
              {member.firstName?.[0]}{member.lastName?.[0]}
            </span>
          )}
        </div>
        <div>
          <div className="text-sm font-medium text-gray-900">
            {member.firstName} {member.lastName}
          </div>
          {member.email && <div className="text-xs text-gray-500">{member.email}</div>}
        </div>
      </div>
      {action}
    </div>
  )

  const isLinked = (id: string) =>
    children.some((c) => c.id === id) || spouse?.id === id || id === targetUserId

  if (loading) {
    return <div className="text-sm text-gray-500">Loading family…</div>
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-lg font-semibold mb-4">Family</h2>

      {error && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
          {error}
        </div>
      )}

      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Spouse</h3>
        {spouse ? (
          renderMember(
            spouse,
            <button
              onClick={() => setSpouseLink(null)}
              className="text-xs text-red-600 hover:text-red-800"
            >
              Unlink
            </button>
          )
        ) : (
          <p className="text-sm text-gray-500">No spouse linked</p>
        )}
      </div>

      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Children</h3>
        {children.length === 0 ? (
          <p className="text-sm text-gray-500">No children linked</p>
        ) : (
          <div className="divide-y">
            {children.map((child) =>
              renderMember(
                child,
                <button
                  onClick={() => unlinkChild(child.id)}
                  className="text-xs text-red-600 hover:text-red-800"
                >
                  Unlink
                </button>
              )
            )}
          </div>
        )}
      </div>

      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-2">Add family member</h3>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search members by name or email…"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
        />
        {searching && <p className="text-xs text-gray-500 mt-2">Searching…</p>}
        {results.length > 0 && (
          <div className="mt-2 border border-gray-200 rounded-lg divide-y max-h-64 overflow-y-auto">
            {results
              .filter((member) => !isLinked(member.id))
              .map((member) => (
                <div key={member.id} className="flex items-center justify-between px-3 py-2">
                  <div className="text-sm">
                    {member.firstName} {member.lastName}
                    {member.email && (
                      <span className="text-xs text-gray-500 ml-2">{member.email}</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {!spouse && (
                      <button
                        onClick={() => setSpouseLink(member.id)}
                        className="text-xs px-2 py-1 bg-gray-100 rounded hover:bg-gray-200"
                      >
                        Set spouse
                      </button>
                    )}
                    <button
                      onClick={() => linkChild(member.id)}
                      className="text-xs px-2 py-1 bg-primary-600 text-white rounded hover:bg-primary-700"
                    >
                      Add child
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  )
}
