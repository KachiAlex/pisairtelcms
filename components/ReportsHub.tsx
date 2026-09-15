'use client'

import { useEffect, useMemo, useState } from 'react'

type Branch = {
  id: string
  name: string
  city?: string
  state?: string
  country?: string
}

type AttendanceSummary = {
  totalSessions: number
  totalHeadcount: number
  averageHeadcount: number
  firstTimers: number
  byType: Record<string, number>
  byMode: Record<string, number>
  peakSession: {
    sessionId: string | null
    title: string | null
    date: string | null
    headcount: number
  }
  timeline: Array<{
    id: string
    title: string
    type: string
    mode: string
    date: string
    headcount: number
  }>
}

type FinancialSummary = {
  givingTotal: number
  manualIncomeTotal: number
  totalIncome: number
  totalExpenses: number
  net: number
  topExpenseCategories: Record<string, number>
  timeline: Array<{ month: string; income: number; expenses: number }>
}

type MemberSummary = {
  totalMembers: number
  membersByRole: Record<string, number>
  membersByRegion: Record<string, number>
  branches: Array<{
    id: string
    name: string
    city?: string
    state?: string
    country?: string
    members: number
  }>
  recent: Array<{
    id: string
    name: string
    role: string
    branchId: string | null
    joinedAt: string
    lastLoginAt: string | null
  }>
}

type ResourcesSummary = {
  totalResources: number
  sampleByType: Record<string, number>
  totalPlans: number
  activePlans: number
}

type ReportsResponse = {
  filters: {
    branchId: string | null
    start: string | null
    end: string | null
  }
  attendance: AttendanceSummary
  finances: FinancialSummary
  members: MemberSummary
  resources: ResourcesSummary
  meta: {
    generatedAt: string
  }
}

const numberFormatter = new Intl.NumberFormat('en-US')
const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

export default function ReportsHub({ isManager = true }: { isManager?: boolean }) {
  const [branches, setBranches] = useState<Branch[]>([])
  const [branchId, setBranchId] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reports, setReports] = useState<ReportsResponse | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const queryString = useMemo(() => {
    const qs = new URLSearchParams()
    if (branchId.trim()) qs.set('branchId', branchId.trim())
    if (start) qs.set('start', new Date(start).toISOString())
    if (end) qs.set('end', new Date(end).toISOString())
    const s = qs.toString()
    return s ? `?${s}` : ''
  }, [branchId, start, end])

  useEffect(() => {
    loadBranches()
  }, [])

  useEffect(() => {
    loadReports()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryString])

  async function readApiError(res: Response) {
    try {
      const json = await res.json()
      return json?.error || 'Request failed'
    } catch {
      return 'Request failed'
    }
  }

  async function loadBranches() {
    try {
      const currentChurch = await fetch('/api/churches/switch', { cache: 'no-store' })
      if (!currentChurch.ok) return
      const { churchId } = await currentChurch.json()
      if (!churchId) return

      const res = await fetch(`/api/churches/${churchId}/branches`, { cache: 'no-store' })
      if (!res.ok) return
      const json = await res.json()
      setBranches(
        (json || []).map((b: any) => ({
          id: b.id,
          name: b.name,
          city: b.city,
          state: b.state,
          country: b.country,
        }))
      )
    } catch {
      // ignore
    }
  }

  async function loadReports(isRefresh = false) {
    setError(null)
    setRefreshing(isRefresh)
    if (!isRefresh) setLoading(true)

    try {
      const res = await fetch(`/api/reports/overview${queryString}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(await readApiError(res))
      const json = await res.json()
      setReports(json)
    } catch (err: any) {
      setError(err?.message || 'Failed to load reports')
      setReports(null)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const sectionTitle = (title: string, description?: string) => (
    <div>
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      {description && <p className="text-sm text-gray-600 mt-1">{description}</p>}
    </div>
  )

  const keyMetricCard = (label: string, value: string | number, helper?: string, tone: 'default' | 'positive' | 'negative' = 'default') => {
    const toneClass =
      tone === 'positive'
        ? 'text-green-600'
        : tone === 'negative'
        ? 'text-red-600'
        : 'text-gray-900'
    return (
      <div className="bg-white rounded-xl border p-5 shadow-sm space-y-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
        <p className={`text-3xl font-bold ${toneClass}`}>
          {typeof value === 'number' ? numberFormatter.format(value) : value}
        </p>
        {helper && <p className="text-xs text-gray-500">{helper}</p>}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto py-12 text-center text-gray-600">
        Generating church-wide reports...
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto mt-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-red-700">
          {error}
        </div>
        <button
          onClick={() => loadReports()}
          className="mt-4 px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-semibold"
        >
          Try again
        </button>
      </div>
    )
  }

  if (!reports) {
    return null
  }

  const { attendance, finances, members, resources, meta } = reports

  const branchOptions = [
    { id: '', name: 'All branches' },
    ...branches.map((b) => ({ id: b.id, name: b.name })),
  ]

  const expenseTopList = Object.entries(finances.topExpenseCategories || {})
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)

  const timeline = finances.timeline.slice(-6)
  const attendanceTimeline = attendance.timeline

  const membersByRoleEntries = Object.entries(members.membersByRole || {})
  const membersByRegionEntries = Object.entries(members.membersByRegion || {})

  const resourceTypeEntries = Object.entries(resources.sampleByType || {})

  const formatDate = (value: string | null | undefined) =>
    value ? new Date(value).toLocaleDateString() : 'N/A'

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <div>
        <p className="text-sm uppercase text-gray-500 tracking-wide">Reports & Analytics</p>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mt-1">
          {isManager ? 'Operational Pulse' : 'Church Reports'}
        </h1>
        <p className="text-gray-600 mt-2 text-sm sm:text-base">
          {isManager 
            ? 'Consolidated attendance, finances, member growth, and resource impact across your church.'
            : 'View available church reports and statistics that have been made accessible to members.'
          }
        </p>
      </div>

      {!isManager && (
        <div className="bg-primary-50 border border-primary-200 rounded-xl p-4 sm:p-6 text-center">
          <h2 className="text-base sm:text-lg font-semibold text-primary-900 mb-2">Member Reports Access</h2>
          <p className="text-primary-700 mb-4 text-sm sm:text-base">
            Your church administrators can configure which reports are available to members. 
            Currently, the following reports may be accessible:
          </p>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 text-left">
            <div className="bg-white rounded-lg p-4 border border-primary-100">
              <h3 className="font-semibold text-gray-900 mb-2 text-sm sm:text-base">ðŸ“Š Attendance Summary</h3>
              <p className="text-xs sm:text-sm text-gray-600">General attendance trends and participation statistics</p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-primary-100">
              <h3 className="font-semibold text-gray-900 mb-2 text-sm sm:text-base">ðŸ‘¥ Membership Growth</h3>
              <p className="text-xs sm:text-sm text-gray-600">Church growth metrics and member milestones</p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-primary-100">
              <h3 className="font-semibold text-gray-900 mb-2 text-sm sm:text-base">ðŸ“š Resource Usage</h3>
              <p className="text-xs sm:text-sm text-gray-600">Digital school and reading plan engagement</p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-primary-100">
              <h3 className="font-semibold text-gray-900 mb-2 text-sm sm:text-base">ðŸŽ¯ Ministry Impact</h3>
              <p className="text-xs sm:text-sm text-gray-600">Community outreach and ministry effectiveness</p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-primary-100">
              <h3 className="font-semibold text-gray-900 mb-2 text-sm sm:text-base">ðŸ’ Giving Overview</h3>
              <p className="text-xs sm:text-sm text-gray-600">General giving trends (amounts may be hidden)</p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-primary-100">
              <h3 className="font-semibold text-gray-900 mb-2 text-sm sm:text-base">ðŸ“… Event Participation</h3>
              <p className="text-xs sm:text-sm text-gray-600">Event attendance and engagement metrics</p>
            </div>
          </div>
          <div className="mt-6 p-4 bg-blue-100 rounded-lg">
            <p className="text-sm text-primary-800">
              <strong>Note:</strong> Report availability is configured by your church administrators. 
              Contact your church leadership if you need access to specific reports for ministry purposes.
            </p>
          </div>
        </div>
      )}

      {isManager && (
        <>
          {/* Filters - Only for managers */}
          <div className="bg-white rounded-2xl border shadow-sm p-5 space-y-4">
        {sectionTitle('Filters', 'Segment reports by branch or time range.')}
        <div className="grid gap-4 md:grid-cols-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-600 uppercase">Branch</label>
            <select
              className="border rounded-lg px-3 py-2 text-sm"
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
            >
              {branchOptions.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-600 uppercase">Start date</label>
            <input
              type="date"
              className="border rounded-lg px-3 py-2 text-sm"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-600 uppercase">End date</label>
            <input
              type="date"
              className="border rounded-lg px-3 py-2 text-sm"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </div>

          <div className="flex flex-col justify-end">
            <button
              onClick={() => loadReports(true)}
              disabled={refreshing}
              className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-primary-600 text-white text-sm font-semibold shadow-sm hover:bg-primary-700 disabled:opacity-60 disabled:hover:bg-primary-600"
            >
              {refreshing ? 'Refreshing...' : 'Apply filters'}
            </button>
          </div>
        </div>
        <p className="text-xs text-gray-500">
          Generated: {formatDate(meta.generatedAt)}{' '}
          {reports.filters.branchId
            ? `(Filtered to branch ${branches.find((b) => b.id === reports.filters.branchId)?.name || reports.filters.branchId})`
            : '(All branches)'}
        </p>
      </div>

      {/* Key metrics */}
      <div>
        {sectionTitle('Key Metrics', 'High-level indicators across attendance, finances, and members.')}
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4 mt-4">
          {keyMetricCard('Total Attendance', attendance.totalHeadcount)}
          {keyMetricCard('Avg Meeting Headcount', attendance.averageHeadcount)}
          {keyMetricCard('Total Income', currencyFormatter.format(finances.totalIncome), undefined, 'positive')}
          {keyMetricCard('Total Expenses', currencyFormatter.format(finances.totalExpenses), undefined, 'negative')}
          {keyMetricCard('Net Position', currencyFormatter.format(finances.net), undefined, finances.net >= 0 ? 'positive' : 'negative')}
          {keyMetricCard('Members', members.totalMembers)}
          {keyMetricCard('Reading Plans', resources.totalPlans)}
          {keyMetricCard('Digital Resources', resources.totalResources)}
        </div>
      </div>

      {/* Attendance */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="bg-white rounded-2xl border shadow-sm p-5 space-y-5">
          {sectionTitle('Attendance', 'Headcount trends, channels, and first-timer insights.')}
          <div className="grid gap-3 md:grid-cols-2">
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs text-gray-500 font-semibold uppercase">Sessions Recorded</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                {numberFormatter.format(attendance.totalSessions)}
              </p>
              <p className="text-sm text-gray-600">First timers: {numberFormatter.format(attendance.firstTimers)}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs text-gray-500 font-semibold uppercase">Peak Session</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {attendance.peakSession.headcount > 0
                  ? numberFormatter.format(attendance.peakSession.headcount)
                  : '--'}
              </p>
              <p className="text-sm text-gray-600">{attendance.peakSession.title || 'No data'}</p>
            </div>
          </div>
          <div className="border rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase">Recent sessions</p>
            <div className="space-y-2 max-h-72 overflow-auto pr-1">
              {attendanceTimeline.length === 0 && (
                <p className="text-sm text-gray-500">No attendance sessions recorded for this filter.</p>
              )}
              {attendanceTimeline.map((item) => (
                <div key={item.id} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium text-gray-900">{item.title}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(item.date).toLocaleDateString()}  -  {item.type}  -  {item.mode}
                    </p>
                  </div>
                  <div className="text-right font-semibold text-gray-900">
                    {numberFormatter.format(item.headcount)}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="border rounded-xl p-4 space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase">By meeting type</p>
              {Object.entries(attendance.byType || {}).map(([type, count]) => (
                <div key={type} className="flex items-center justify-between text-sm">
                  <span className="capitalize text-gray-600">{type.toLowerCase()}</span>
                  <span className="font-semibold text-gray-900">{count}</span>
                </div>
              ))}
              {Object.keys(attendance.byType || {}).length === 0 && (
                <p className="text-sm text-gray-500">No session types recorded.</p>
              )}
            </div>
            <div className="border rounded-xl p-4 space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase">By mode</p>
              {Object.entries(attendance.byMode || {}).map(([mode, count]) => (
                <div key={mode} className="flex items-center justify-between text-sm">
                  <span className="capitalize text-gray-600">{mode.toLowerCase()}</span>
                  <span className="font-semibold text-gray-900">{count}</span>
                </div>
              ))}
              {Object.keys(attendance.byMode || {}).length === 0 && (
                <p className="text-sm text-gray-500">No modes captured.</p>
              )}
            </div>
          </div>
        </div>

        {/* Finances */}
        <div className="bg-white rounded-2xl border shadow-sm p-5 space-y-5">
          {sectionTitle('Finance & Giving', 'Branch-level ledger combining digital giving, manual income, and expenses.')}
          <div className="grid gap-3 md:grid-cols-2">
            <div className="bg-green-50 rounded-xl p-4 border border-green-100">
              <p className="text-xs font-semibold text-green-600 uppercase">Total income</p>
              <p className="text-2xl font-bold text-green-700 mt-1">{currencyFormatter.format(finances.totalIncome)}</p>
              <p className="text-xs text-green-700">
                {currencyFormatter.format(finances.givingTotal)} giving Â· {currencyFormatter.format(finances.manualIncomeTotal)} manual
              </p>
            </div>
            <div className="bg-red-50 rounded-xl p-4 border border-red-100">
              <p className="text-xs font-semibold text-red-600 uppercase">Expenses</p>
              <p className="text-2xl font-bold text-red-700 mt-1">{currencyFormatter.format(finances.totalExpenses)}</p>
              <p className="text-xs text-red-700">Net {currencyFormatter.format(finances.net)}</p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase">6-Month trend</p>
            <div className="space-y-2">
              {timeline.length === 0 && (
                <p className="text-sm text-gray-500">Not enough data to plot a trend.</p>
              )}
              {timeline.map((point) => (
                <div key={point.month}>
                  <div className="flex items-center justify-between text-xs text-gray-600">
                    <span>{point.month}</span>
                    <span>
                      {currencyFormatter.format(point.income)} / {currencyFormatter.format(point.expenses)}
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500"
                      style={{
                        width: `${Math.min(100, (point.income / Math.max(point.income, point.expenses || 1)) * 100)}%`,
                      }}
                    ></div>
                    <div
                      className="h-full bg-red-500 -mt-2"
                      style={{
                        width: `${Math.min(100, (point.expenses / Math.max(point.income || 1, point.expenses)) * 100)}%`,
                      }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border rounded-xl p-4 space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase">Top Expense Categories</p>
            {expenseTopList.length === 0 && (
              <p className="text-sm text-gray-500">No expense categories recorded.</p>
            )}
            {expenseTopList.map(([category, amount]) => (
              <div key={category} className="flex items-center justify-between text-sm">
                <div className="font-medium text-gray-800">{category}</div>
                <div className="font-semibold text-gray-900">{currencyFormatter.format(amount)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Members & Regions */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="bg-white rounded-2xl border shadow-sm p-5 space-y-5">
          {sectionTitle('Members by Role', 'Leadership vs member distribution.')}
          <div className="space-y-2">
            {membersByRoleEntries.length === 0 && (
              <p className="text-sm text-gray-500">No member role data available.</p>
            )}
            {membersByRoleEntries.map(([role, count]) => (
              <div key={role} className="flex items-center justify-between">
                <span className="text-gray-700 font-medium">{role.replace('_', ' ')}</span>
                <span className="font-semibold text-gray-900">{numberFormatter.format(count)}</span>
              </div>
            ))}
          </div>

          <div className="border rounded-xl p-4 space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase">Recent members</p>
            <div className="space-y-2 max-h-64 overflow-auto pr-1">
              {members.recent.length === 0 && (
                <p className="text-sm text-gray-500">No recent members.</p>
              )}
              {members.recent.map((member) => (
                <div key={member.id} className="text-sm">
                  <p className="font-semibold text-gray-900">{member.name}</p>
                  <p className="text-xs text-gray-500">
                    {member.role}  -  Joined {formatDate(member.joinedAt)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border shadow-sm p-5 space-y-5">
          {sectionTitle('Members by Region', 'Regional spread across branches.')}
          <div className="space-y-4">
            {membersByRegionEntries.length === 0 && (
              <p className="text-sm text-gray-500">No region data available.</p>
            )}
            {membersByRegionEntries.slice(0, 6).map(([region, count]) => (
              <div key={region}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-800">{region}</span>
                  <span className="font-semibold text-gray-900">{numberFormatter.format(count)}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full mt-1">
                  <div
                    className="h-full bg-indigo-500 rounded-full"
                    style={{
                      width: `${Math.min(100, (count / Math.max(...membersByRegionEntries.map(([, value]) => value), 1)) * 100)}%`,
                    }}
                  ></div>
                </div>
              </div>
            ))}
          </div>

          <div className="border rounded-xl p-4 space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase">Branches</p>
            <div className="space-y-2 max-h-64 overflow-auto pr-1">
              {members.branches.map((branch) => (
                <div key={branch.id} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium text-gray-900">{branch.name}</p>
                    <p className="text-xs text-gray-500">
                      {[branch.city, branch.state, branch.country].filter(Boolean).join(', ') || '--'}
                    </p>
                  </div>
                  <div className="font-semibold text-gray-900">{numberFormatter.format(branch.members)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Resources */}
      <div className="bg-white rounded-2xl border shadow-sm p-5 space-y-5">
        {sectionTitle('Reading & Resources', 'Discipleship content footprint from your reading library.')}
        <div className="grid gap-4 md:grid-cols-3">
          <div className="bg-gradient-to-br from-amber-50 to-white rounded-2xl border border-amber-100 p-4">
            <p className="text-xs uppercase font-semibold text-amber-600">Digital Resources</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{numberFormatter.format(resources.totalResources)}</p>
            <p className="text-xs text-amber-700">Across all categories</p>
          </div>
          <div className="bg-gradient-to-br from-blue-50 to-white rounded-2xl border border-primary-100 p-4">
            <p className="text-xs uppercase font-semibold text-primary-600">Reading Plans</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{numberFormatter.format(resources.totalPlans)}</p>
            <p className="text-xs text-primary-700">{resources.activePlans} currently active</p>
          </div>
          <div className="bg-gradient-to-br from-emerald-50 to-white rounded-2xl border border-emerald-100 p-4">
            <p className="text-xs uppercase font-semibold text-emerald-600">Formats</p>
            <ul className="mt-2 space-y-1 text-sm text-emerald-700">
              {resourceTypeEntries.length === 0 && <li>No uploads yet.</li>}
              {resourceTypeEntries.map(([type, count]) => (
                <li key={type} className="flex items-center justify-between">
                  <span className="capitalize">{type}</span>
                  <span className="font-semibold text-gray-900">{count}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
        </>
      )}
    </div>
  )
}