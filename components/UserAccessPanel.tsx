'use client'

import { useEffect, useState } from 'react'

type Grant = {
  id: string
  permission: string
  scopeType: 'CHURCH' | 'BRANCH'
  scopeId: string
  createdAt: string
}

type Branch = { id: string; name: string }

const GRANTABLE: { value: string; label: string }[] = [
  { value: 'manage_attendance', label: 'Manage Attendance' },
  { value: 'manage_giving', label: 'Manage Giving' },
  { value: 'manage_accounting', label: 'Manage Accounting' },
  { value: 'manage_events', label: 'Manage Events' },
  { value: 'manage_sermons', label: 'Manage Sermons' },
  { value: 'manage_groups', label: 'Manage Groups' },
  { value: 'manage_departments', label: 'Manage Departments' },
  { value: 'manage_volunteers', label: 'Manage Volunteers' },
  { value: 'send_broadcasts', label: 'Send Broadcasts' },
  { value: 'approve_testimonies', label: 'Approve Testimonies' },
  { value: 'view_users', label: 'View Members' },
  { value: 'edit_users', label: 'Edit Members' },
  { value: 'view_payroll', label: 'View Payroll' },
  { value: 'view_analytics', label: 'View Analytics' },
]

const PERMISSION_LABELS = Object.fromEntries(GRANTABLE.map((g) => [g.value, g.label]))

export default function UserAccessPanel({ userId }: { userId: string }) {
  const [grants, setGrants] = useState<Grant[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [permission, setPermission] = useState('manage_attendance')
  const [scope, setScope] = useState('CHURCH')
  const [branchId, setBranchId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [allowed, setAllowed] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [grantsRes, meRes] = await Promise.all([
          fetch(`/api/permissions/grants?userId=${userId}`),
          fetch('/api/me/permissions'),
        ])
        if (!grantsRes.ok || !meRes.ok) {
          return // non-grantor — hide the panel entirely
        }
        const grantsJson = await grantsRes.json()
        const meJson = await meRes.json()
        if (cancelled) return
        setGrants(grantsJson.grants || [])
        setAllowed(true)

        if (meJson.churchId) {
          const branchRes = await fetch(`/api/churches/${meJson.churchId}/branches`)
          if (branchRes.ok) {
            const branchJson = await branchRes.json()
            if (!cancelled) setBranches(branchJson.branches || branchJson || [])
          }
        }
      } catch {
        // hide panel on failure
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [userId])

  async function grantAccess() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/permissions/grants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          permission,
          scopeType: scope,
          scopeId: scope === 'BRANCH' ? branchId : undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Failed to grant access')
      setGrants((prev) => [data.grant, ...prev])
    } catch (e: any) {
      setError(e?.message || 'Failed to grant access')
    } finally {
      setSaving(false)
    }
  }

  async function revokeAccess(grantId: string) {
    setError(null)
    const res = await fetch(`/api/permissions/grants/${grantId}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data?.error || 'Failed to revoke')
      return
    }
    setGrants((prev) => prev.filter((g) => g.id !== grantId))
  }

  const branchName = (id: string) => branches.find((b) => b.id === id)?.name || id

  if (loading || !allowed) return null

  return (
    <div className="bg-white rounded-xl border p-5 space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Delegated Access</h2>
        <p className="text-sm text-gray-600">
          Grant this member access to specific features — church-wide or limited to a branch — without changing their role.
        </p>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">{error}</div>}

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="text-xs font-semibold text-gray-600">Feature</label>
          <select
            className="mt-1 block border rounded-lg px-3 py-2 text-sm"
            value={permission}
            onChange={(e) => setPermission(e.target.value)}
          >
            {GRANTABLE.map((g) => (
              <option key={g.value} value={g.value}>{g.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-600">Scope</label>
          <select
            className="mt-1 block border rounded-lg px-3 py-2 text-sm"
            value={scope}
            onChange={(e) => setScope(e.target.value)}
          >
            <option value="CHURCH">Whole church</option>
            <option value="BRANCH">Specific branch</option>
          </select>
        </div>
        {scope === 'BRANCH' && (
          <div>
            <label className="text-xs font-semibold text-gray-600">Branch</label>
            <select
              className="mt-1 block border rounded-lg px-3 py-2 text-sm"
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
            >
              <option value="">Select branch…</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        )}
        <button
          type="button"
          disabled={saving || (scope === 'BRANCH' && !branchId)}
          onClick={grantAccess}
          className="px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-semibold disabled:opacity-60"
        >
          {saving ? 'Granting…' : 'Grant access'}
        </button>
      </div>

      <div className="space-y-2">
        {grants.length === 0 ? (
          <div className="text-sm text-gray-500">No delegated access yet.</div>
        ) : (
          grants.map((g) => (
            <div key={g.id} className="flex items-center justify-between rounded-lg border px-4 py-2.5">
              <div>
                <span className="font-medium text-sm">{PERMISSION_LABELS[g.permission] || g.permission}</span>
                <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                  {g.scopeType === 'CHURCH' ? 'Whole church' : `Branch: ${branchName(g.scopeId)}`}
                </span>
              </div>
              <button
                type="button"
                onClick={() => revokeAccess(g.id)}
                className="text-xs text-red-600 hover:text-red-700 font-medium"
              >
                Revoke
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
