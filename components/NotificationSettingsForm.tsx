'use client'

import { useEffect, useState } from 'react'

interface Prefs {
  channels: { email: boolean; inApp: boolean; push: boolean }
  quietHours: { enabled: boolean; startTime: string; endTime: string }
  categories: Record<string, boolean>
  emailDigestFrequency: string
}

const CATEGORY_LABELS: { key: string; label: string }[] = [
  { key: 'announcements', label: 'New announcements' },
  { key: 'eventReminders', label: 'Event reminders' },
  { key: 'prayerUpdates', label: 'Prayer request updates' },
  { key: 'weeklyDigest', label: 'Weekly digest' },
  { key: 'liveStreams', label: 'Live stream notifications' },
  { key: 'givingReceipts', label: 'Giving receipts & confirmations' },
]

export function NotificationSettingsForm() {
  const [prefs, setPrefs] = useState<Prefs | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/notifications/preferences')
      .then(r => r.json())
      .then(d => setPrefs(d.preferences))
      .catch(() => setError('Failed to load preferences'))
  }, [])

  const save = async (updated: Prefs) => {
    setPrefs(updated)
    setSaving(true)
    setSaved(false)
    try {
      const res = await fetch('/api/notifications/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      })
      if (!res.ok) throw new Error()
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      setError('Failed to save preferences')
    } finally {
      setSaving(false)
    }
  }

  if (error && !prefs) return <p className="text-sm text-red-600">{error}</p>
  if (!prefs) return <div className="animate-pulse h-40 bg-gray-100 rounded" />

  const toggle = (path: 'channels' | 'categories', key: string) =>
    save({ ...prefs, [path]: { ...prefs[path], [key]: !prefs[path][key as keyof typeof prefs.channels] } })

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-4">Email Notifications</h3>
        <div className="space-y-3">
          {CATEGORY_LABELS.slice(0, 4).map(({ key, label }) => (
            <label key={key} className="flex items-center">
              <input
                type="checkbox"
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                checked={!!prefs.categories[key]}
                onChange={() => toggle('categories', key)}
              />
              <span className="ml-2 text-sm text-gray-700">{label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="border-t pt-6">
        <h3 className="text-lg font-medium mb-4">Push &amp; In-App Notifications</h3>
        <div className="space-y-3">
          {CATEGORY_LABELS.slice(4).map(({ key, label }) => (
            <label key={key} className="flex items-center">
              <input
                type="checkbox"
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                checked={!!prefs.categories[key]}
                onChange={() => toggle('categories', key)}
              />
              <span className="ml-2 text-sm text-gray-700">{label}</span>
            </label>
          ))}
          <label className="flex items-center">
            <input
              type="checkbox"
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              checked={prefs.channels.inApp}
              onChange={() => toggle('channels', 'inApp')}
            />
            <span className="ml-2 text-sm text-gray-700">In-app notification center</span>
          </label>
        </div>
      </div>

      <div className="border-t pt-6">
        <h3 className="text-lg font-medium mb-4">Quiet Hours</h3>
        <label className="flex items-center mb-3">
          <input
            type="checkbox"
            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            checked={prefs.quietHours.enabled}
            onChange={() => save({ ...prefs, quietHours: { ...prefs.quietHours, enabled: !prefs.quietHours.enabled } })}
          />
          <span className="ml-2 text-sm text-gray-700">Mute notifications during quiet hours</span>
        </label>
        {prefs.quietHours.enabled && (
          <div className="flex items-center space-x-3 ml-6">
            <input
              type="time"
              value={prefs.quietHours.startTime}
              onChange={e => save({ ...prefs, quietHours: { ...prefs.quietHours, startTime: e.target.value } })}
              className="rounded border-gray-300 text-sm px-2 py-1"
            />
            <span className="text-sm text-gray-500">to</span>
            <input
              type="time"
              value={prefs.quietHours.endTime}
              onChange={e => save({ ...prefs, quietHours: { ...prefs.quietHours, endTime: e.target.value } })}
              className="rounded border-gray-300 text-sm px-2 py-1"
            />
          </div>
        )}
      </div>

      <div className="flex items-center space-x-3 text-sm">
        {saving && <span className="text-gray-500">Saving…</span>}
        {saved && <span className="text-green-600">Preferences saved</span>}
        {error && <span className="text-red-600">{error}</span>}
      </div>
    </div>
  )
}
