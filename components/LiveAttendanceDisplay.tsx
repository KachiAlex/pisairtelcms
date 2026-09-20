'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'

type LivePayload = {
  checkInUrl: string
  live: { code: string; expiresIn: number; url: string }
}

type RecordItem = {
  id: string
  userId?: string
  guestName?: string
  channel: string
  checkedInAt: string
  user?: { firstName?: string; lastName?: string } | null
}

function recordName(r: RecordItem): string {
  if (r.user) return [r.user.firstName, r.user.lastName].filter(Boolean).join(' ') || 'Member'
  return r.guestName || 'Guest'
}

export default function LiveAttendanceDisplay({ sessionId }: { sessionId: string }) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [expiresIn, setExpiresIn] = useState(0)
  const [count, setCount] = useState(0)
  const [recent, setRecent] = useState<RecordItem[]>([])
  const [title, setTitle] = useState('')
  const [error, setError] = useState<string | null>(null)
  const seenIds = useRef<Set<string>>(new Set())

  const refreshCode = useCallback(async () => {
    try {
      const res = await fetch(`/api/attendance/sessions/${sessionId}/qr?live=1`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load QR')
      const json: LivePayload = await res.json()
      const dataUrl = await QRCode.toDataURL(json.live.url, {
        width: 560,
        margin: 2,
        color: { dark: '#111827', light: '#ffffff' },
      })
      setQrDataUrl(dataUrl)
      setExpiresIn(json.live.expiresIn)
      setError(null)
    } catch (e: any) {
      setError(e?.message || 'Failed to load')
    }
  }, [sessionId])

  const refreshRecords = useCallback(async () => {
    try {
      const res = await fetch(`/api/attendance/sessions/${sessionId}/records`, { cache: 'no-store' })
      if (!res.ok) return
      const json = await res.json()
      const records: RecordItem[] = json.records || []
      setCount(records.length)
      const fresh = records.filter((r) => !seenIds.current.has(r.id))
      if (fresh.length && seenIds.current.size) {
        setRecent((prev) => [...fresh.reverse(), ...prev].slice(0, 6))
      } else if (!seenIds.current.size) {
        setRecent(records.slice(0, 6))
      }
      records.forEach((r) => seenIds.current.add(r.id))
    } catch {
      // transient — keep displaying
    }
  }, [sessionId])

  useEffect(() => {
    // Session title for the header
    fetch('/api/attendance/sessions', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const s = (j?.sessions || []).find((x: any) => x.id === sessionId)
        if (s) setTitle(s.title)
      })
      .catch(() => {})

    refreshCode()
    refreshRecords()
    const codeTimer = setInterval(refreshCode, 15_000)
    const recordTimer = setInterval(refreshRecords, 5_000)
    return () => {
      clearInterval(codeTimer)
      clearInterval(recordTimer)
    }
  }, [sessionId, refreshCode, refreshRecords])

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gray-950 p-8 text-white">
      <div className="text-center">
        <div className="text-sm font-semibold tracking-widest text-indigo-400 uppercase">Scan to check in</div>
        <h1 className="mt-2 text-4xl font-bold">{title || 'Attendance check-in'}</h1>
      </div>

      <div className="mt-8 rounded-3xl bg-white p-6 shadow-2xl">
        {qrDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qrDataUrl} alt="Check-in QR code" className="h-[380px] w-[380px]" />
        ) : (
          <div className="flex h-[380px] w-[380px] items-center justify-center text-gray-400">
            {error || 'Loading…'}
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center gap-3 text-sm text-gray-400">
        <span className="inline-block h-2 w-2 rounded-full bg-green-400 animate-pulse" />
        Code refreshes automatically
      </div>

      <div className="mt-8 flex items-center gap-8">
        <div className="text-center">
          <div className="text-5xl font-bold text-green-400">{count}</div>
          <div className="mt-1 text-sm text-gray-400">checked in</div>
        </div>
        {recent.length > 0 && (
          <div className="border-l border-gray-800 pl-8">
            <div className="text-xs font-semibold tracking-wider text-gray-500 uppercase">Just arrived</div>
            <div className="mt-2 space-y-1">
              {recent.slice(0, 5).map((r) => (
                <div key={r.id} className="text-sm text-gray-300">
                  ✓ {recordName(r)}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
