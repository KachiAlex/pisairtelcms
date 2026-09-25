'use client'

import { useState } from 'react'

type SessionInfo = {
  id: string
  title: string
  type: string
  mode: string
  startAt: string
  location?: string | null
  churchName?: string | null
  meetingTitle?: string | null
  joinUrl?: string | null
}

export default function CheckInClient({
  session,
  postUrl,
  userName,
  alreadyCheckedIn,
}: {
  session: SessionInfo
  postUrl: string
  userName: string | null
  alreadyCheckedIn: boolean
}) {
  const [state, setState] = useState<'idle' | 'checking' | 'done'>(alreadyCheckedIn ? 'done' : 'idle')
  const [wasAlready, setWasAlready] = useState(alreadyCheckedIn)
  const [guestName, setGuestName] = useState('')
  const [channel, setChannel] = useState<'OFFLINE' | 'ONLINE'>('ONLINE')
  const [error, setError] = useState<string | null>(null)

  const isHybrid = session.mode === 'HYBRID'

  async function submit() {
    if (!userName && !guestName.trim()) {
      setError('Please enter your name')
      return
    }
    setState('checking')
    setError(null)
    try {
      const res = await fetch(postUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          guestName: userName ? undefined : guestName.trim(),
          channel: isHybrid ? channel : undefined,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || 'Check-in failed')
      setWasAlready(!!json?.alreadyCheckedIn)
      setState('done')
    } catch (e: any) {
      setError(e?.message || 'Check-in failed')
      setState('idle')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-600 via-purple-600 to-fuchsia-600 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 text-center">
        <div className="text-xs font-semibold tracking-widest text-indigo-600 uppercase">
          {session.churchName || 'Church attendance'}
        </div>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">{session.title}</h1>
        <p className="mt-1 text-sm text-gray-500">
          {new Date(session.startAt).toLocaleString()}
          {session.location ? ` • ${session.location}` : ''}
        </p>
        {session.meetingTitle && (
          <p className="mt-1 text-xs font-medium text-indigo-600">Part of: {session.meetingTitle}</p>
        )}

        {state === 'done' ? (
          <div className="mt-8">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <svg className="h-9 w-9 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="mt-4 text-lg font-semibold text-gray-900">
              {wasAlready ? 'You were already counted' : "You're counted!"}
            </p>
            <p className="mt-1 text-sm text-gray-500">Welcome to {session.title}.</p>
            {session.joinUrl && (
              <a
                href={session.joinUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-block rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                Join the meeting online →
              </a>
            )}
          </div>
        ) : (
          <div className="mt-8 space-y-4">
            {isHybrid && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setChannel('OFFLINE')}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium ${channel === 'OFFLINE' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-300 text-gray-600'}`}
                >
                  I'm here in person
                </button>
                <button
                  onClick={() => setChannel('ONLINE')}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium ${channel === 'ONLINE' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-300 text-gray-600'}`}
                >
                  I'm joining online
                </button>
              </div>
            )}

            {userName ? (
              <p className="text-sm text-gray-600">
                Signed in as <span className="font-semibold text-gray-900">{userName}</span>
              </p>
            ) : (
              <div className="text-left">
                <label className="text-xs font-semibold text-gray-600">Your name</label>
                <input
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                  placeholder="Full name"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  maxLength={120}
                />
              </div>
            )}

            {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

            <button
              onClick={submit}
              disabled={state === 'checking'}
              className="w-full rounded-lg bg-indigo-600 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {state === 'checking' ? 'Checking in…' : userName ? `Check in as ${userName}` : 'Check in'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
