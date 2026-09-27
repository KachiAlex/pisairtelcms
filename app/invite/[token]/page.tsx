'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useTenantBrand } from '@/lib/branding/useTenantBrand'

type Branch = { id: string; name: string; level?: string; levelLabel?: string | null; parentBranchId?: string | null }

type InviteContext = {
  invite: { id: string; churchId: string; branchId?: string | null; purpose: string; targetRole?: string | null }
  church: { id: string; name: string }
  branches: Branch[]
  hierarchy?: {
    levels: { key: string; label: string; order: number }[]
    labels: Record<string, string>
  }
}

export default function InviteSignupPage({ params }: { params: { token: string } }) {
  const router = useRouter()

  const token = params.token

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [ctx, setCtx] = useState<InviteContext | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [joining, setJoining] = useState(false)
  const [joinedChurch, setJoinedChurch] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ kind: 'info' | 'error'; text: string; showLogin?: boolean } | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const { data: session, status: sessionStatus } = useSession()
  const [branchValidationError, setBranchValidationError] = useState('')
  const { brand } = useTenantBrand({ churchId: ctx?.church?.id })

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    branchId: '',
    dateOfBirth: '',
    phone: '',
    address: '',
    employmentStatus: '',
  })

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const res = await fetch(`/api/invite/${encodeURIComponent(token)}`, { cache: 'no-store' })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data?.error || 'Invalid invite link')
        setCtx(data as InviteContext)

        const defaultBranchId = (data as any)?.invite?.branchId || ''
        setForm((p) => ({ ...p, branchId: defaultBranchId }))
      } catch (e: any) {
        setError(e?.message || 'Failed to load invite')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [token])

  const branchMap = useMemo(() => {
    const map = new Map<string, Branch>()
    ctx?.branches?.forEach((branch) => map.set(branch.id, branch))
    return map
  }, [ctx])
  const branchesByParent = useMemo(() => {
    const result: Record<string, Branch[]> = {}
    ctx?.branches?.forEach((branch) => {
      const key = branch.parentBranchId ?? 'ROOT'
      if (!result[key]) result[key] = []
      result[key].push(branch)
    })
    return result
  }, [ctx])
  // Flatten the branch tree (DFS) so every branch is selectable regardless of
  // how its level maps to the configured hierarchy — depth shows structure.
  const flatBranchOptions = useMemo(() => {
    const ordered: Array<{ branch: Branch; depth: number }> = []
    const seen = new Set<string>()
    const walk = (parentKey: string, depth: number) => {
      for (const branch of branchesByParent[parentKey] ?? []) {
        if (seen.has(branch.id)) continue
        seen.add(branch.id)
        ordered.push({ branch, depth })
        walk(branch.id, depth + 1)
      }
    }
    walk('ROOT', 0)
    ctx?.branches?.forEach((branch) => {
      if (!seen.has(branch.id)) ordered.push({ branch, depth: 0 })
    })
    return ordered
  }, [branchesByParent, ctx])
  const lockedBranch = ctx?.invite?.branchId ? branchMap.get(ctx.invite.branchId) ?? null : null
  const lockedBranchPath = useMemo(() => {
    if (!lockedBranch) return []
    const path: Branch[] = []
    let current: Branch | null | undefined = lockedBranch
    while (current) {
      path.unshift(current)
      if (!current.parentBranchId) break
      current = branchMap.get(current.parentBranchId) ?? null
    }
    return path
  }, [lockedBranch, branchMap])

  useEffect(() => {
    if (!ctx) return
    setForm((prev) => ({ ...prev, branchId: ctx.invite.branchId ?? '' }))
  }, [ctx])

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }))
    if (e.target.name === 'branchId' && e.target.value) {
      setBranchValidationError('')
    }
    setError('')
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (form.password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    if (!ctx?.invite.branchId && !form.branchId && flatBranchOptions.length > 0) {
      setBranchValidationError('Please select a branch.')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/invite/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          password: form.password,
          branchId: form.branchId || undefined,
          dateOfBirth: form.dateOfBirth || undefined,
          phone: form.phone || undefined,
          address: form.address || undefined,
          employmentStatus: form.employmentStatus || undefined,
        }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (res.status === 409 && data?.code === 'already_member') {
          setNotice({ kind: 'info', text: data.error, showLogin: true })
        } else if (res.status === 409 && data?.code === 'account_exists') {
          setNotice({ kind: 'info', text: data.error, showLogin: true })
        } else {
          throw new Error(data?.error || 'Failed to create account')
        }
        return
      }

      router.push('/auth/login')
    } catch (e: any) {
      setError(e?.message || 'Failed to create account')
    } finally {
      setSubmitting(false)
    }
  }

  const acceptInvite = async () => {
    setError('')
    setNotice(null)
    setJoining(true)
    try {
      const res = await fetch(`/api/invite/${encodeURIComponent(token)}/accept`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (res.status === 401) {
        router.push(`/auth/login?callbackUrl=${encodeURIComponent(`/invite/${token}`)}`)
        return
      }
      if (!res.ok) throw new Error(data?.error || 'Failed to join church')
      setJoinedChurch(data?.church?.name || ctx?.church?.name || 'the church')
    } catch (e: any) {
      setError(e?.message || 'Failed to join church')
    } finally {
      setJoining(false)
    }
  }

  const loginUrl = `/auth/login?callbackUrl=${encodeURIComponent(`/invite/${token}`)}`

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-600">Loading invite...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 px-4 py-12">
      <div className="relative z-10 max-w-xl w-full">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center space-x-2 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
              <img src={brand.logo} alt={brand.name} className="w-10 h-10 object-contain" />
            </div>
            <span className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">{brand.name}</span>
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Join {ctx?.church?.name || brand.name}</h1>
          <p className="text-gray-600 mt-2">{brand.tagline || 'Complete your details to create your account.'}</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-800 rounded-xl">{error}</div>
        )}
        {notice && (
          <div className={`mb-6 p-4 rounded-xl border ${notice.kind === 'info' ? 'bg-blue-50 border-blue-200 text-blue-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
            <p className="text-sm">{notice.text}</p>
            {notice.showLogin && (
              <Link href={loginUrl} className="mt-2 inline-block text-sm font-semibold text-blue-700 underline">
                Log in to continue
              </Link>
            )}
          </div>
        )}

        {joinedChurch ? (
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100 text-center">
            <div className="text-4xl mb-3">🎉</div>
            <h2 className="text-xl font-bold text-gray-900">You're in!</h2>
            <p className="text-gray-600 mt-1 text-sm">You are now a member of {joinedChurch}.</p>
            <button
              onClick={() => router.push('/dashboard')}
              className="mt-6 w-full py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700"
            >
              Go to your dashboard
            </button>
          </div>
        ) : sessionStatus === 'authenticated' && session?.user ? (
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100 text-center">
            <h2 className="text-xl font-bold text-gray-900">Join {ctx?.church?.name}</h2>
            <p className="text-gray-600 mt-1 text-sm">
              Signed in as <span className="font-medium">{session.user.email}</span>.
              {ctx?.invite?.branchId && lockedBranch
                ? ` You'll be added to ${lockedBranch.name}.`
                : ''}
            </p>
            <button
              onClick={acceptInvite}
              disabled={joining}
              className="mt-6 w-full py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50"
            >
              {joining ? 'Joining…' : 'Join this church'}
            </button>
            <p className="mt-4 text-xs text-gray-500">
              Not you?{' '}
              <Link href={loginUrl} className="text-blue-600 underline">
                Switch account
              </Link>{' '}
              or fill the form below with a different email.
            </p>
          </div>
        ) : null}

        {sessionStatus !== 'authenticated' && !joinedChurch && (
        <form onSubmit={submit} className="space-y-6 bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">First Name</label>
              <input
                name="firstName"
                value={form.firstName}
                onChange={onChange}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Last Name</label>
              <input
                name="lastName"
                value={form.lastName}
                onChange={onChange}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={onChange}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Password</label>
              <div className="relative">
                <input
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={onChange}
                  required
                  minLength={8}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10 text-gray-900"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5 text-gray-500"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Confirm Password</label>
              <input
                name="confirmPassword"
                type="password"
                value={form.confirmPassword}
                onChange={onChange}
                required
                minLength={8}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Branch</label>
            {lockedBranch ? (
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-sm text-gray-600 mb-2">This invite automatically assigns you to:</p>
                <div className="flex flex-wrap gap-2 text-sm font-medium text-gray-900">
                  {lockedBranchPath.map((node, index) => (
                    <span key={node.id} className="flex items-center gap-2">
                      {index > 0 && <span className="text-gray-400">/</span>}
                      <span>{node.name}</span>
                    </span>
                  ))}
                </div>
              </div>
            ) : flatBranchOptions.length > 0 ? (
              <div className="space-y-2">
                <select
                  name="branchId"
                  value={form.branchId}
                  onChange={(e) => {
                    onChange(e)
                    if (e.target.value) setBranchValidationError('')
                  }}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                >
                  <option value="">Select branch</option>
                  {flatBranchOptions.map(({ branch, depth }) => (
                    <option key={branch.id} value={branch.id}>
                      {'\u00A0'.repeat(depth * 4)}
                      {depth > 0 ? '↳ ' : ''}
                      {branch.name}
                      {branch.levelLabel ? ` (${branch.levelLabel})` : ''}
                    </option>
                  ))}
                </select>
                {branchValidationError && (
                  <p className="text-sm text-red-600">{branchValidationError}</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No branches available yet.</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Date of Birth</label>
              <input
                name="dateOfBirth"
                type="date"
                value={form.dateOfBirth}
                onChange={onChange}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Phone</label>
              <input
                name="phone"
                value={form.phone}
                onChange={onChange}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Address</label>
            <input
              name="address"
              value={form.address}
              onChange={onChange}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Employment Status (optional)</label>
            <input
              name="employmentStatus"
              value={form.employmentStatus}
              onChange={onChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Creating account...' : 'Create account'}
          </button>
        </form>
        )}

        <div className="mt-6 text-center">
          <Link href={loginUrl} className="text-sm text-blue-600 hover:underline">Already have an account? Sign in</Link>
        </div>
      </div>
    </div>
  )
}
