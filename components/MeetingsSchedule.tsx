'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

type Branch = {
  id: string
  name: string
}

type MeetingRecurrenceFrequency = 'WEEKLY' | 'MONTHLY' | 'CUSTOM'

type MeetingRecurrence = {
  frequency: MeetingRecurrenceFrequency
  interval?: number
  byWeekday?: number[]
  byMonthDay?: number
  until?: string
}

type MeetingOccurrence = {
  id: string
  seriesId: string
  churchId: string
  branchId?: string | null
  title: string
  description?: string
  startAt: string
  endAt?: string
  timezone?: string
  google?: {
    calendarEventId?: string
    calendarId?: string
    meetUrl?: string
  }
  jitsi?: {
    roomName?: string
    joinUrl?: string
  }
}

function weekdayLabel(d: number): string {
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d] || String(d)
}

async function readApiError(res: Response) {
  try {
    const json = await res.json()
    return json?.error || 'Request failed'
  } catch {
    try {
      const text = await res.text()
      return text || 'Request failed'
    } catch {
      return 'Request failed'
    }
  }
}

export default function MeetingsSchedule({ canManageMeetings }: { canManageMeetings: boolean }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [occurrences, setOccurrences] = useState<MeetingOccurrence[]>([])
  const [seriesById, setSeriesById] = useState<Record<string, any>>({})

  const [me, setMe] = useState<any>(null)
  const [branches, setBranches] = useState<Branch[]>([])

  const [googleStatus, setGoogleStatus] = useState<{ connected: boolean; calendarId?: string | null } | null>(null)
  const [connectingGoogle, setConnectingGoogle] = useState(false)

  const [showCreate, setShowCreate] = useState(false)
  const [editingMeetingId, setEditingMeetingId] = useState<string | null>(null)
  const [attBusy, setAttBusy] = useState<string | null>(null)

  const [form, setForm] = useState({
    title: '',
    description: '',
    startAt: new Date().toISOString().slice(0, 16),
    endAt: '',
    timezone: '',
    scope: 'ALL' as 'ALL' | 'BRANCH',
    branchId: '',
    recurrenceEnabled: false,
    recurrenceFrequency: 'WEEKLY' as MeetingRecurrenceFrequency,
    recurrenceInterval: 1,
    recurrenceWeekdays: [new Date().getDay()] as number[],
    recurrenceMonthDay: new Date().getDate(),
    recurrenceUntil: '',
    customMode: 'WEEKLY' as 'WEEKLY' | 'MONTHLY',
    platform: 'JITSI' as 'JITSI' | 'GOOGLE_MEET' | 'BOTH',
  })

  const canChooseBranchScope = useMemo(() => {
    const role = String(me?.role || '')
    return role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'PASTOR'
  }, [me])

  const rangeStart = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - 7)
    return d
  }, [])

  const rangeEnd = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() + 60)
    return d
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const meRes = await fetch('/api/users/me', { cache: 'no-store' })
      if (meRes.ok) {
        const meJson = await meRes.json().catch(() => null)
        setMe(meJson)

        const churchId = meJson?.churchId
        if (churchId) {
          const bRes = await fetch(`/api/churches/${churchId}/branches`, { cache: 'no-store' })
          if (bRes.ok) {
            const bJson = await bRes.json().catch(() => [])
            setBranches((bJson || []).map((b: any) => ({ id: b.id, name: b.name })))
          }
        }
      }

      const gsRes = await fetch('/api/google/status', { cache: 'no-store' })
      if (gsRes.ok) {
        const gs = await gsRes.json().catch(() => null)
        setGoogleStatus(gs)
      }

      const qs = new URLSearchParams({
        start: rangeStart.toISOString(),
        end: rangeEnd.toISOString(),
      })
      const res = await fetch(`/api/meetings?${qs.toString()}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(await readApiError(res))
      const json = await res.json()
      setOccurrences(json.occurrences || [])
      setSeriesById(
        Object.fromEntries(
          (json.series || []).map((s: any) => [String(s.id), s])
        )
      )
    } catch (e: any) {
      setError(e?.message || 'Failed to load meetings')
    } finally {
      setLoading(false)
    }
  }, [rangeEnd, rangeStart])

  useEffect(() => {
    load()
  }, [load])

  const connectGoogle = async () => {
    setConnectingGoogle(true)
    setError(null)
    try {
      const res = await fetch('/api/google/connect', { method: 'POST' })
      if (!res.ok) throw new Error(await readApiError(res))
      const json = await res.json()
      if (json?.url) {
        window.location.href = String(json.url)
      } else {
        throw new Error('No OAuth URL returned')
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to start Google connection')
      setConnectingGoogle(false)
    }
  }

  const onCreate = async () => {
    setSaving(true)
    setError(null)
    try {
      const startIso = new Date(form.startAt).toISOString()
      const endIso = form.endAt ? new Date(form.endAt).toISOString() : undefined

      let branchId: string | null | undefined = null
      if (canChooseBranchScope && form.scope === 'BRANCH') {
        branchId = form.branchId || null
      }

      let recurrence: MeetingRecurrence | undefined
      if (form.recurrenceEnabled) {
        const until = form.recurrenceUntil ? new Date(form.recurrenceUntil).toISOString() : undefined

        if (form.recurrenceFrequency === 'MONTHLY') {
          recurrence = {
            frequency: 'MONTHLY',
            interval: Number(form.recurrenceInterval) || 1,
            byMonthDay: Number(form.recurrenceMonthDay) || 1,
            until,
          }
        } else if (form.recurrenceFrequency === 'WEEKLY') {
          recurrence = {
            frequency: 'WEEKLY',
            interval: Number(form.recurrenceInterval) || 1,
            byWeekday: form.recurrenceWeekdays,
            until,
          }
        } else {
          if (form.customMode === 'MONTHLY') {
            recurrence = {
              frequency: 'CUSTOM',
              interval: Number(form.recurrenceInterval) || 1,
              byMonthDay: Number(form.recurrenceMonthDay) || 1,
              until,
            }
          } else {
            recurrence = {
              frequency: 'CUSTOM',
              interval: Number(form.recurrenceInterval) || 1,
              byWeekday: form.recurrenceWeekdays,
              until,
            }
          }
        }
      }

      const res = await fetch('/api/meetings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          description: form.description || undefined,
          startAt: startIso,
          endAt: endIso,
          timezone: form.timezone || undefined,
          branchId,
          recurrence,
          platform: form.platform,
        }),
      })

      if (!res.ok) throw new Error(await readApiError(res))

      setShowCreate(false)
      setForm((p) => ({
        ...p,
        title: '',
        description: '',
        endAt: '',
        recurrenceEnabled: false,
      }))
      await load()
    } catch (e: any) {
      setError(e?.message || 'Failed to create meeting')
    } finally {
      setSaving(false)
    }
  }

  const openAttendance = async (o: MeetingOccurrence) => {
    setAttBusy(o.id)
    setError(null)
    try {
      // Reuse an existing session for this occurrence when one exists
      const start = new Date(o.startAt)
      const qs = new URLSearchParams({
        meetingId: String(o.seriesId),
        start: new Date(start.getTime() - 12 * 3600 * 1000).toISOString(),
        end: new Date(start.getTime() + 12 * 3600 * 1000).toISOString(),
      })
      const listRes = await fetch(`/api/attendance/sessions?${qs}`, { cache: 'no-store' })
      if (listRes.ok) {
        const j = await listRes.json().catch(() => null)
        const existing = (j?.sessions || []).find((s: any) => s.meeting?.id === o.seriesId || s.meetingId === o.seriesId)
        if (existing) {
          window.location.href = `/attendance?session=${existing.id}`
          return
        }
      }

      // Otherwise create the attendance session anchored to this meeting
      const hasVideo = !!(o.jitsi?.joinUrl || o.google?.meetUrl)
      const res = await fetch('/api/attendance/sessions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          meetingId: o.seriesId,
          branchId: o.branchId || null,
          title: o.title,
          type: 'MEETING',
          mode: hasVideo ? 'HYBRID' : 'OFFLINE',
          startAt: new Date(o.startAt).toISOString(),
          endAt: o.endAt ? new Date(o.endAt).toISOString() : null,
        }),
      })
      if (!res.ok) throw new Error(await readApiError(res))
      const created = await res.json().catch(() => null)
      window.location.href = created?.session?.id
        ? `/attendance?session=${created.session.id}`
        : '/attendance'
    } catch (e: any) {
      setError(e?.message || 'Failed to open attendance')
    } finally {
      setAttBusy(null)
    }
  }

  const onDelete = async (o: MeetingOccurrence) => {
    const ok = window.confirm('Delete this meeting? This will remove the series and its Google Calendar event (if linked).')
    if (!ok) return

    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/meetings/${String(o.seriesId)}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(await readApiError(res))
      await load()
    } catch (e: any) {
      setError(e?.message || 'Failed to delete meeting')
    } finally {
      setSaving(false)
    }
  }

  const openEdit = (o: MeetingOccurrence) => {
    const s = seriesById[String(o.seriesId)]
    if (!s) return

    setEditingMeetingId(String(o.seriesId))
    setShowCreate(true)

    const startLocal = new Date(s.startAt).toISOString().slice(0, 16)
    const endLocal = s.endAt ? new Date(s.endAt).toISOString().slice(0, 16) : ''

    const rec = s.recurrence
    const recEnabled = !!rec
    const recFreq = rec?.frequency || 'WEEKLY'
    const until = rec?.until ? new Date(rec.until).toISOString().slice(0, 10) : ''

    setForm((p) => ({
      ...p,
      title: s.title || '',
      description: s.description || '',
      startAt: startLocal,
      endAt: endLocal,
      timezone: s.timezone || '',
      scope: s.branchId ? 'BRANCH' : 'ALL',
      branchId: s.branchId || '',
      recurrenceEnabled: recEnabled,
      recurrenceFrequency: recFreq,
      recurrenceInterval: Number(rec?.interval || 1),
      recurrenceWeekdays:
        Array.isArray(rec?.byWeekday) && rec.byWeekday.length ? rec.byWeekday : [new Date(s.startAt).getDay()],
      recurrenceMonthDay: Number(rec?.byMonthDay || new Date(s.startAt).getDate()),
      recurrenceUntil: until,
      customMode: rec?.frequency === 'CUSTOM' ? (rec?.byMonthDay ? 'MONTHLY' : 'WEEKLY') : p.customMode,
    }))
  }

  const onSaveEdit = async () => {
    if (!editingMeetingId) return
    setSaving(true)
    setError(null)
    try {
      const startIso = new Date(form.startAt).toISOString()
      const endIso = form.endAt ? new Date(form.endAt).toISOString() : null

      let branchId: string | null | undefined = undefined
      if (canChooseBranchScope) {
        if (form.scope === 'BRANCH') branchId = form.branchId || null
        else branchId = null
      }

      let recurrence: MeetingRecurrence | null | undefined = undefined
      if (!form.recurrenceEnabled) {
        recurrence = null
      } else {
        const until = form.recurrenceUntil ? new Date(form.recurrenceUntil).toISOString() : undefined

        if (form.recurrenceFrequency === 'MONTHLY') {
          recurrence = {
            frequency: 'MONTHLY',
            interval: Number(form.recurrenceInterval) || 1,
            byMonthDay: Number(form.recurrenceMonthDay) || 1,
            until,
          }
        } else if (form.recurrenceFrequency === 'WEEKLY') {
          recurrence = {
            frequency: 'WEEKLY',
            interval: Number(form.recurrenceInterval) || 1,
            byWeekday: form.recurrenceWeekdays,
            until,
          }
        } else {
          if (form.customMode === 'MONTHLY') {
            recurrence = {
              frequency: 'CUSTOM',
              interval: Number(form.recurrenceInterval) || 1,
              byMonthDay: Number(form.recurrenceMonthDay) || 1,
              until,
            }
          } else {
            recurrence = {
              frequency: 'CUSTOM',
              interval: Number(form.recurrenceInterval) || 1,
              byWeekday: form.recurrenceWeekdays,
              until,
            }
          }
        }
      }

      const res = await fetch(`/api/meetings/${editingMeetingId}`,
        {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            title: form.title,
            description: form.description || undefined,
            startAt: startIso,
            endAt: endIso,
            timezone: form.timezone || undefined,
            branchId,
            recurrence,
          }),
        }
      )

      if (!res.ok) throw new Error(await readApiError(res))

      setShowCreate(false)
      setEditingMeetingId(null)
      await load()
    } catch (e: any) {
      setError(e?.message || 'Failed to update meeting')
    } finally {
      setSaving(false)
    }
  }

  const recurrenceSummary = (o: MeetingOccurrence) => {
    if (!o.id.includes(':')) return null
    return null
  }

  return (
    <div className="space-y-6">
      {canChooseBranchScope && (
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="font-semibold text-gray-900">Google Calendar</div>
              <div className="text-sm text-gray-600 mt-1">
                {googleStatus?.connected
                  ? `Connected${googleStatus?.calendarId ? ` (calendar: ${googleStatus.calendarId})` : ''}. New meetings will generate a Google Meet link.`
                  : 'Not connected. Connect the church Google account to auto-generate Meet links.'}
              </div>
            </div>
            <button
              type="button"
              disabled={connectingGoogle || !!googleStatus?.connected}
              onClick={connectGoogle}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-semibold disabled:opacity-60 disabled:hover:bg-primary-600"
            >
              {googleStatus?.connected ? 'Connected' : connectingGoogle ? 'Connecting...' : 'Connect Google'}
            </button>
          </div>
        </div>
      )}

      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Scheduled Meetings</h2>
          <p className="text-sm text-gray-600 mt-1">
            Upcoming meetings for your church{me?.branchId ? ' (filtered by branch scope)' : ''}.
          </p>
        </div>
        {canManageMeetings && (
          <button
            type="button"
            onClick={() => {
              setEditingMeetingId(null)
              setShowCreate(true)
            }}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-semibold"
          >
            + New Meeting
          </button>
        )}
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4">{error}</div>}

      <div className="bg-white rounded-xl border p-4">
        {loading ? (
          <div className="text-gray-600">Loading...</div>
        ) : occurrences.length === 0 ? (
          <div className="text-gray-600">No meetings scheduled in the next 60 days.</div>
        ) : (
          <div className="space-y-3">
            {occurrences.map((o) => (
              <div key={o.id} className="border rounded-lg p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-semibold text-gray-900">{o.title}</div>
                    <div className="text-sm text-gray-600 mt-1">
                      {new Date(o.startAt).toLocaleString()}
                      {o.endAt ? ` – ${new Date(o.endAt).toLocaleString()}` : ''}
                      {o.branchId ? ` • Branch: ${o.branchId}` : ' • All branches'}
                    </div>
                    {o.description && <div className="text-sm text-gray-700 mt-2">{o.description}</div>}
                  {o.jitsi?.joinUrl && (
                    <div className="text-sm mt-2">
                      <a className="text-primary-700 hover:underline font-semibold" href={`/api/meetings/${o.seriesId}/join`} target="_blank" rel="noreferrer">
                        → Join Video Meeting
                      </a>
                    </div>
                  )}
                  {o.google?.meetUrl && (
                    <div className="text-sm mt-1">
                      <a className="text-primary-700 hover:underline font-semibold" href={o.google.meetUrl} target="_blank" rel="noreferrer">
                        → Join Google Meet
                      </a>
                    </div>
                  )}
                  {!o.jitsi?.joinUrl && !o.google?.meetUrl && canManageMeetings && (
                    <div className="text-sm mt-2 text-gray-500">
                      No video link on this meeting
                    </div>
                  )}
                    {recurrenceSummary(o)}
                  </div>
                  {canManageMeetings && (
                    <div className="shrink-0 flex items-center gap-2">
                      <button
                        type="button"
                        disabled={attBusy === o.id}
                        onClick={() => openAttendance(o)}
                        className="px-3 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm font-semibold disabled:opacity-60"
                      >
                        {attBusy === o.id ? 'Opening…' : 'Take attendance'}
                      </button>
                      <button
                        type="button"
                        onClick={() => openEdit(o)}
                        className="px-3 py-2 bg-gray-100 text-gray-900 rounded-lg hover:bg-gray-200 text-sm font-semibold"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => onDelete(o)}
                        className="px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-semibold disabled:opacity-60"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => !saving && setShowCreate(false)} />
          <div className="relative bg-white w-full max-w-2xl mx-4 rounded-xl shadow-xl p-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <div className="text-lg font-semibold text-gray-900">{editingMeetingId ? 'Edit Meeting' : 'New Meeting'}</div>
                <div className="text-sm text-gray-600">{editingMeetingId ? 'Update meeting details.' : 'Create a one-time or recurring meeting.'}</div>
              </div>
              <button className="text-gray-500 hover:text-gray-700" onClick={() => !saving && setShowCreate(false)}>
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                  <input
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={form.title}
                    onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Timezone (optional)</label>
                  <input
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={form.timezone}
                    onChange={(e) => setForm((p) => ({ ...p, timezone: e.target.value }))}
                    placeholder="e.g. Africa/Lagos"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
                <input
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                />
              </div>

              {!editingMeetingId && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Video platform</label>
                  <select
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={form.platform}
                    onChange={(e) => setForm((p) => ({ ...p, platform: e.target.value as 'JITSI' | 'GOOGLE_MEET' | 'BOTH' }))}
                  >
                    <option value="JITSI">Built-in video (Jitsi) — unlimited duration</option>
                    <option value="GOOGLE_MEET" disabled={!googleStatus?.connected}>
                      Google Meet{googleStatus?.connected ? '' : ' (connect Google first)'}
                    </option>
                    <option value="BOTH" disabled={!googleStatus?.connected}>
                      Both{googleStatus?.connected ? '' : ' (connect Google first)'}
                    </option>
                  </select>
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start</label>
                  <input
                    type="datetime-local"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={form.startAt}
                    onChange={(e) => setForm((p) => ({ ...p, startAt: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End (optional)</label>
                  <input
                    type="datetime-local"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    value={form.endAt}
                    onChange={(e) => setForm((p) => ({ ...p, endAt: e.target.value }))}
                  />
                </div>
              </div>

              {canChooseBranchScope && (
                <div className="grid md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Scope</label>
                    <select
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      value={form.scope}
                      onChange={(e) => setForm((p) => ({ ...p, scope: e.target.value as any }))}
                    >
                      <option value="ALL">All branches</option>
                      <option value="BRANCH">Specific branch</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
                    <select
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      value={form.branchId}
                      disabled={form.scope !== 'BRANCH'}
                      onChange={(e) => setForm((p) => ({ ...p, branchId: e.target.value }))}
                    >
                      <option value="">Select branch</option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="border rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-gray-900">Recurring</div>
                    <div className="text-sm text-gray-600">Enable to create a recurring series.</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={form.recurrenceEnabled}
                    onChange={(e) => setForm((p) => ({ ...p, recurrenceEnabled: e.target.checked }))}
                  />
                </div>

                {form.recurrenceEnabled && (
                  <div className="mt-4 space-y-3">
                    <div className="grid md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
                        <select
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                          value={form.recurrenceFrequency}
                          onChange={(e) => setForm((p) => ({ ...p, recurrenceFrequency: e.target.value as any }))}
                        >
                          <option value="WEEKLY">Weekly</option>
                          <option value="MONTHLY">Monthly</option>
                          <option value="CUSTOM">Custom</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Interval</label>
                        <input
                          type="number"
                          min={1}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                          value={form.recurrenceInterval}
                          onChange={(e) => setForm((p) => ({ ...p, recurrenceInterval: Number(e.target.value) }))}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Until (optional)</label>
                        <input
                          type="date"
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                          value={form.recurrenceUntil}
                          onChange={(e) => setForm((p) => ({ ...p, recurrenceUntil: e.target.value }))}
                        />
                      </div>
                    </div>

                    {form.recurrenceFrequency === 'CUSTOM' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Custom mode</label>
                        <select
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                          value={form.customMode}
                          onChange={(e) => setForm((p) => ({ ...p, customMode: e.target.value as any }))}
                        >
                          <option value="WEEKLY">Weekly pattern</option>
                          <option value="MONTHLY">Monthly pattern</option>
                        </select>
                      </div>
                    )}

                    {(form.recurrenceFrequency === 'WEEKLY' || (form.recurrenceFrequency === 'CUSTOM' && form.customMode === 'WEEKLY')) && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Days of week</label>
                        <div className="flex flex-wrap gap-2">
                          {Array.from({ length: 7 }).map((_, i) => {
                            const checked = form.recurrenceWeekdays.includes(i)
                            return (
                              <button
                                key={i}
                                type="button"
                                className={`px-3 py-2 rounded-lg text-sm border ${checked ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-300'}`}
                                onClick={() => {
                                  setForm((p) => {
                                    const next = new Set(p.recurrenceWeekdays)
                                    if (next.has(i)) next.delete(i)
                                    else next.add(i)
                                    const arr = Array.from(next).sort((a, b) => a - b)
                                    return { ...p, recurrenceWeekdays: arr.length ? arr : [new Date().getDay()] }
                                  })
                                }}
                              >
                                {weekdayLabel(i)}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {(form.recurrenceFrequency === 'MONTHLY' || (form.recurrenceFrequency === 'CUSTOM' && form.customMode === 'MONTHLY')) && (
                      <div className="grid md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Day of month</label>
                          <input
                            type="number"
                            min={1}
                            max={31}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            value={form.recurrenceMonthDay}
                            onChange={(e) => setForm((p) => ({ ...p, recurrenceMonthDay: Number(e.target.value) }))}
                          />
                        </div>
                        <div className="text-sm text-gray-600 flex items-center">
                          Example: 1 = first day of month, 15 = middle.
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-6">
              <button
                onClick={() => !saving && setShowCreate(false)}
                className="px-4 py-2 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={editingMeetingId ? onSaveEdit : onCreate}
                disabled={saving || !form.title.trim()}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm disabled:opacity-60"
              >
                {saving ? (editingMeetingId ? 'Saving...' : 'Creating...') : editingMeetingId ? 'Save Changes' : 'Create Meeting'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
