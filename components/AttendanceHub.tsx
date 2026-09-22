'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

type Branch = {
  id: string
  name: string
}

type AttendanceSession = {
  id: string
  branchId?: string
  title: string
  type: string
  mode: string
  startAt: string
  location?: string
  notes?: string
  headcount?: any
  checkInCount?: number
  meeting?: { id: string; title: string } | null
}

type AttendanceRecord = {
  id: string
  userId?: string
  guestName?: string
  channel: string
  checkedInAt: string
  user?: { firstName?: string; lastName?: string } | null
}

type QrPayload = {
  checkInUrl: string
  qrPngDataUrl: string
}

type MeetingOption = {
  seriesId: string
  title: string
  startAt: string
  occurrenceKey?: string
}

export default function AttendanceHub({ isManager }: { isManager: boolean }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [branches, setBranches] = useState<Branch[]>([])
  const [didInitBranch, setDidInitBranch] = useState(false)

  const [branchId, setBranchId] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')

  const [sessions, setSessions] = useState<AttendanceSession[]>([])
  const [selectedSession, setSelectedSession] = useState<AttendanceSession | null>(null)
  const [records, setRecords] = useState<AttendanceRecord[]>([])

  const [creating, setCreating] = useState(false)
  const [meetingOptions, setMeetingOptions] = useState<MeetingOption[]>([])
  const [meetingPick, setMeetingPick] = useState('')
  const [createForm, setCreateForm] = useState({
    title: '',
    type: 'SERVICE',
    mode: 'OFFLINE',
    startAt: new Date().toISOString().slice(0, 16),
    location: '',
    notes: '',
    meetingId: '',
  })

  const [headcountSaving, setHeadcountSaving] = useState(false)
  const [headcount, setHeadcount] = useState({ total: '', men: '', women: '', children: '', firstTimers: '' })

  const [checkInSaving, setCheckInSaving] = useState(false)
  const [checkInForm, setCheckInForm] = useState({ userId: '', guestName: '', channel: 'OFFLINE' })

  const [qrSession, setQrSession] = useState<AttendanceSession | null>(null)
  const [qrData, setQrData] = useState<QrPayload | null>(null)
  const [qrBusy, setQrBusy] = useState(false)
  const [qrCopied, setQrCopied] = useState(false)

  const queryString = useMemo(() => {
    const qs = new URLSearchParams()
    if (branchId.trim()) qs.set('branchId', branchId.trim())
    if (start) qs.set('start', new Date(start).toISOString())
    if (end) qs.set('end', new Date(end).toISOString())
    const s = qs.toString()
    return s ? `?${s}` : ''
  }, [branchId, start, end])

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

  const loadBranchesAndDefault = useCallback(async () => {
    try {
      const userRes = await fetch('/api/users/me', { cache: 'no-store' })
      if (!userRes.ok) return
      const user = await userRes.json()
      const churchId = user?.churchId as string | null | undefined
      const userBranchId = user?.branchId as string | null | undefined
      if (!churchId) return

      const res = await fetch(`/api/churches/${churchId}/branches`, { cache: 'no-store' })
      if (!res.ok) return
      const json = await res.json()
      setBranches((json || []).map((b: any) => ({ id: b.id, name: b.name })))

      if (!didInitBranch) {
        setBranchId(userBranchId || '')
        setDidInitBranch(true)
      }
    } catch {
      // ignore
    }
  }, [didInitBranch])

  const loadSessions = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/attendance/sessions${queryString}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(await readApiError(res))
      const json = await res.json()
      const list: AttendanceSession[] = json.sessions || []
      setSessions(list)

      // Deep link: /attendance?session={id} auto-selects the session
      const wanted = new URLSearchParams(window.location.search).get('session')
      if (wanted) {
        const found = list.find((s) => s.id === wanted)
        if (found) {
          setSelectedSession(found)
          setHeadcount({
            total: found.headcount?.total?.toString?.() || '',
            men: found.headcount?.men?.toString?.() || '',
            women: found.headcount?.women?.toString?.() || '',
            children: found.headcount?.children?.toString?.() || '',
            firstTimers: found.headcount?.firstTimers?.toString?.() || '',
          })
          loadRecords(found.id)
        }
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [queryString])

  async function loadRecords(sessionId: string) {
    setError(null)
    try {
      const res = await fetch(`/api/attendance/sessions/${sessionId}/records`, { cache: 'no-store' })
      if (!res.ok) throw new Error(await readApiError(res))
      const json = await res.json()
      setRecords(json.records || [])
    } catch (e: any) {
      setError(e?.message || 'Failed to load records')
    }
  }

  useEffect(() => {
    loadBranchesAndDefault()
  }, [loadBranchesAndDefault])

  // Upcoming meetings for the session-anchor picker (managers only)
  useEffect(() => {
    if (!isManager) return
    fetch('/api/meetings', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const occurrences = (j?.occurrences || []) as any[]
        setMeetingOptions(
          occurrences.map((o) => ({
            seriesId: o.seriesId,
            title: o.title,
            startAt: o.startAt,
            occurrenceKey: o.id,
          })),
        )
      })
      .catch(() => {})
  }, [isManager])

  useEffect(() => {
    loadSessions()
  }, [loadSessions])

  // Members should be able to view sessions and check in.
  // Only managers can create sessions and update headcount.

  async function createSession() {
    setCreating(true)
    setError(null)
    try {
      const res = await fetch('/api/attendance/sessions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          branchId: branchId.trim() || null,
          title: createForm.title,
          type: createForm.type,
          mode: createForm.mode,
          startAt: new Date(createForm.startAt).toISOString(),
          location: createForm.location || null,
          notes: createForm.notes || null,
          meetingId: createForm.meetingId || null,
        }),
      })
      if (!res.ok) throw new Error(await readApiError(res))
      setCreateForm((p) => ({ ...p, title: '', location: '', notes: '' }))
      await loadSessions()
    } catch (e: any) {
      setError(e?.message || 'Failed')
    } finally {
      setCreating(false)
    }
  }

  async function saveHeadcount() {
    if (!selectedSession) return
    setHeadcountSaving(true)
    setError(null)
    try {
      const payload: any = {}
      for (const k of Object.keys(headcount) as (keyof typeof headcount)[]) {
        const v = headcount[k]
        if (v !== '') payload[k] = Number(v)
      }

      const res = await fetch(`/api/attendance/sessions/${selectedSession.id}/headcount`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ headcount: payload }),
      })
      if (!res.ok) throw new Error(await readApiError(res))
      const json = await res.json()

      const updated = json.session
      setSelectedSession((prev) => (prev ? { ...prev, headcount: updated.headcount } : prev))
      await loadSessions()
    } catch (e: any) {
      setError(e?.message || 'Failed')
    } finally {
      setHeadcountSaving(false)
    }
  }

  async function checkIn() {
    if (!selectedSession) return
    setCheckInSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/attendance/sessions/${selectedSession.id}/check-in`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          userId: checkInForm.userId || null,
          guestName: checkInForm.guestName || null,
          channel: checkInForm.channel,
        }),
      })
      if (!res.ok) throw new Error(await readApiError(res))
      setCheckInForm((p) => ({ ...p, userId: '', guestName: '' }))
      await loadRecords(selectedSession.id)
      await loadSessions()
    } catch (e: any) {
      setError(e?.message || 'Failed')
    } finally {
      setCheckInSaving(false)
    }
  }

  async function openQr(s: AttendanceSession) {
    setQrSession(s)
    setQrData(null)
    setQrCopied(false)
    setQrBusy(true)
    try {
      const res = await fetch(`/api/attendance/sessions/${s.id}/qr`, { cache: 'no-store' })
      if (!res.ok) throw new Error(await readApiError(res))
      setQrData(await res.json())
    } catch (e: any) {
      setError(e?.message || 'Failed to load QR code')
      setQrSession(null)
    } finally {
      setQrBusy(false)
    }
  }

  async function regenerateQr() {
    if (!qrSession) return
    setQrBusy(true)
    try {
      const res = await fetch(`/api/attendance/sessions/${qrSession.id}/qr`, { method: 'POST' })
      if (!res.ok) throw new Error(await readApiError(res))
      setQrData(await res.json())
      setQrCopied(false)
    } catch (e: any) {
      setError(e?.message || 'Failed to regenerate')
    } finally {
      setQrBusy(false)
    }
  }

  function copyQrUrl() {
    if (!qrData) return
    navigator.clipboard?.writeText(qrData.checkInUrl).catch(() => {})
    setQrCopied(true)
    setTimeout(() => setQrCopied(false), 2000)
  }

  function printQr() {
    if (!qrData || !qrSession) return
    const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(
      `<!doctype html><html><head><title>Check-in QR — ${esc(qrSession.title)}</title>` +
        `<style>body{font-family:system-ui,sans-serif;text-align:center;padding:48px}img{width:340px;height:340px}p{color:#555}</style></head><body>` +
        `<h1>${esc(qrSession.title)}</h1><p>Scan this code to check in</p>` +
        `<img src="${qrData.qrPngDataUrl}" alt="Check-in QR"/>` +
        `<p style="font-size:12px;word-break:break-all">${esc(qrData.checkInUrl)}</p>` +
        `<script>window.onload=function(){window.print()}<\/script></body></html>`,
    )
    w.document.close()
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Attendance</h1>
        <p className="text-gray-600 mt-1">View sessions and check in.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border p-4">
          <label className="text-xs font-semibold text-gray-600">Branch (optional)</label>
          <select className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            <option value="">All branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <label className="text-xs font-semibold text-gray-600">Start (optional)</label>
          <input type="date" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div className="bg-white rounded-xl border p-4">
          <label className="text-xs font-semibold text-gray-600">End (optional)</label>
          <input type="date" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {isManager && (
          <div className="bg-white rounded-xl border p-5 space-y-3">
            <h2 className="text-lg font-semibold">Create Session</h2>
            {meetingOptions.length > 0 && (
              <div>
                <label className="text-xs font-semibold text-gray-600">Link to meeting (optional)</label>
                <select
                  className="mt-1 w-full border rounded-lg px-3 py-2 text-sm"
                  value={meetingPick}
                  onChange={(e) => {
                    setMeetingPick(e.target.value)
                    const idx = Number(e.target.value)
                    const opt = meetingOptions[idx]
                    if (opt) {
                      setCreateForm((p) => ({
                        ...p,
                        meetingId: opt.seriesId,
                        title: p.title || opt.title,
                        type: 'MEETING',
                        startAt: new Date(opt.startAt).toISOString().slice(0, 16),
                      }))
                    } else {
                      setCreateForm((p) => ({ ...p, meetingId: '' }))
                    }
                  }}
                >
                  <option value="">Standalone session — no meeting</option>
                  {meetingOptions.map((m, i) => (
                    <option key={`${m.seriesId}:${m.startAt}`} value={i}>
                      {m.title} — {new Date(m.startAt).toLocaleString()}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="text-xs font-semibold text-gray-600">Title</label>
              <input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={createForm.title} onChange={(e) => setCreateForm((p) => ({ ...p, title: e.target.value }))} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-600">Type</label>
                <select className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={createForm.type} onChange={(e) => setCreateForm((p) => ({ ...p, type: e.target.value }))}>
                  <option value="SERVICE">SERVICE</option>
                  <option value="MEETING">MEETING</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">Mode</label>
                <select className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={createForm.mode} onChange={(e) => setCreateForm((p) => ({ ...p, mode: e.target.value }))}>
                  <option value="OFFLINE">OFFLINE</option>
                  <option value="ONLINE">ONLINE</option>
                  <option value="HYBRID">HYBRID</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600">Start at</label>
              <input type="datetime-local" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={createForm.startAt} onChange={(e) => setCreateForm((p) => ({ ...p, startAt: e.target.value }))} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-600">Location (optional)</label>
                <input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={createForm.location} onChange={(e) => setCreateForm((p) => ({ ...p, location: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">Notes (optional)</label>
                <input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={createForm.notes} onChange={(e) => setCreateForm((p) => ({ ...p, notes: e.target.value }))} />
              </div>
            </div>
            <button disabled={creating} onClick={createSession} className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold text-sm disabled:opacity-60">
              {creating ? 'Creating...' : 'Create'}
            </button>
          </div>
        )}

        <div className="bg-white rounded-xl border p-5">
          <h2 className="text-lg font-semibold mb-3">Sessions</h2>
          {loading ? (
            <div className="text-gray-600">Loading...</div>
          ) : (
            <div className="space-y-2 max-h-[420px] overflow-auto">
              {sessions.length === 0 ? (
                <div className="text-gray-600">No sessions for this filter.</div>
              ) : (
                sessions.map((s) => (
                  <div
                    key={s.id}
                    className={`w-full border rounded-lg p-3 hover:bg-gray-50 ${selectedSession?.id === s.id ? 'border-blue-400 bg-blue-50/30' : ''}`}
                  >
                    <button
                      onClick={async () => {
                        setSelectedSession(s)
                        setHeadcount({
                          total: s.headcount?.total?.toString?.() || '',
                          men: s.headcount?.men?.toString?.() || '',
                          women: s.headcount?.women?.toString?.() || '',
                          children: s.headcount?.children?.toString?.() || '',
                          firstTimers: s.headcount?.firstTimers?.toString?.() || '',
                        })
                        await loadRecords(s.id)
                      }}
                      className="w-full text-left"
                    >
                      <div className="text-sm font-semibold">{s.title}</div>
                      <div className="text-xs text-gray-600">{new Date(s.startAt).toLocaleString()} • {s.type} • {s.mode} {s.branchId ? `• Branch: ${s.branchId}` : ''}</div>
                      {s.meeting && (
                        <div className="text-xs text-indigo-600 mt-0.5">Meeting: {s.meeting.title}</div>
                      )}
                      <div className="text-xs text-gray-600 mt-1">Check-ins: {s.checkInCount ?? 0}</div>
                    </button>
                    {isManager && (
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={() => openQr(s)}
                          className="px-3 py-1.5 rounded-lg border border-gray-300 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                        >
                          QR Code
                        </button>
                        <a
                          href={`/attendance/live/${s.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 rounded-lg border border-indigo-300 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
                        >
                          Live Display
                        </a>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {selectedSession && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {isManager && (
            <div className="bg-white rounded-xl border p-5 space-y-3">
              <h2 className="text-lg font-semibold">Headcount</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(['total','men','women','children','firstTimers'] as const).map((k) => (
                  <div key={k}>
                    <label className="text-xs font-semibold text-gray-600">{k}</label>
                    <input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={headcount[k]} onChange={(e) => setHeadcount((p) => ({ ...p, [k]: e.target.value }))} />
                  </div>
                ))}
              </div>
              <button disabled={headcountSaving} onClick={saveHeadcount} className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold text-sm disabled:opacity-60">
                {headcountSaving ? 'Saving...' : 'Save Headcount'}
              </button>
            </div>
          )}

          <div className="bg-white rounded-xl border p-5 space-y-3">
            <h2 className="text-lg font-semibold">Member / Guest Check-in</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-600">User ID (optional)</label>
                <input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={checkInForm.userId} onChange={(e) => setCheckInForm((p) => ({ ...p, userId: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">Guest name (optional)</label>
                <input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={checkInForm.guestName} onChange={(e) => setCheckInForm((p) => ({ ...p, guestName: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">Channel</label>
                <select className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={checkInForm.channel} onChange={(e) => setCheckInForm((p) => ({ ...p, channel: e.target.value }))}>
                  <option value="OFFLINE">OFFLINE</option>
                  <option value="ONLINE">ONLINE</option>
                </select>
              </div>
            </div>
            <button disabled={checkInSaving} onClick={checkIn} className="px-4 py-2 rounded-lg bg-green-600 text-white font-semibold text-sm disabled:opacity-60">
              {checkInSaving ? 'Checking in...' : 'Check in'}
            </button>

            <div className="pt-3">
              <h3 className="text-sm font-semibold">Records</h3>
              <div className="space-y-2 max-h-[260px] overflow-auto mt-2">
                {records.length === 0 ? (
                  <div className="text-gray-600 text-sm">No records yet.</div>
                ) : (
                  records.map((r) => (
                    <div key={r.id} className="border rounded-lg p-3">
                      <div className="text-sm font-semibold">
                        {r.user ? [r.user.firstName, r.user.lastName].filter(Boolean).join(' ') : `Guest: ${r.guestName || 'Unknown'}`}
                      </div>
                      <div className="text-xs text-gray-600">{new Date(r.checkedInAt).toLocaleString()} • {r.channel}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {qrSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setQrSession(null)}>
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold">{qrSession.title}</h2>
                <p className="text-xs text-gray-500 mt-0.5">Scan to check in — print for the entrance or share the link</p>
              </div>
              <button onClick={() => setQrSession(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
            </div>

            <div className="mt-4 flex justify-center">
              {qrBusy && !qrData ? (
                <div className="h-64 w-64 flex items-center justify-center text-gray-400">Generating…</div>
              ) : qrData ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrData.qrPngDataUrl} alt="Check-in QR code" className="h-64 w-64 rounded-lg border" />
              ) : null}
            </div>

            {qrData && (
              <div className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600 break-all text-center">
                {qrData.checkInUrl}
              </div>
            )}

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button onClick={copyQrUrl} disabled={!qrData} className="px-3 py-2 rounded-lg border text-sm font-semibold hover:bg-gray-50 disabled:opacity-50">
                {qrCopied ? 'Copied!' : 'Copy link'}
              </button>
              <a
                href={qrData?.qrPngDataUrl}
                download={`checkin-qr-${qrSession.id}.png`}
                className={`px-3 py-2 rounded-lg border text-sm font-semibold text-center hover:bg-gray-50 ${!qrData ? 'opacity-50 pointer-events-none' : ''}`}
              >
                Download PNG
              </a>
              <button onClick={printQr} disabled={!qrData} className="px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
                Print
              </button>
              <a
                href={`/attendance/live/${qrSession.id}`}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold text-center hover:bg-indigo-700"
              >
                Live Display
              </a>
            </div>

            <button
              onClick={regenerateQr}
              disabled={qrBusy}
              className="mt-3 w-full px-3 py-2 rounded-lg border border-red-300 text-red-600 text-xs font-semibold hover:bg-red-50 disabled:opacity-50"
            >
              {qrBusy ? 'Working…' : 'Regenerate code (invalidates printed QRs)'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
