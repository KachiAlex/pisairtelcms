'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import LivestreamCreator from '@/components/LivestreamCreator'
import {
  LivestreamData,
  LivestreamPlatformStatus,
  StreamingPlatform,
} from '@/lib/types/streaming'

type ExternalLivestreamConfig = {
  enabled: boolean
  platform: StreamingPlatform
  url?: string
  title?: string
  description?: string
  scheduledAt?: string
}

type DisplayedPlatform = {
  platform: StreamingPlatform
  url: string
  source: 'managed' | 'external'
}

const PLATFORM_META: Record<
  StreamingPlatform,
  { label: string; icon: string; accent: string }
> = {
  [StreamingPlatform.RESTREAM]: { label: 'Restream', icon: '🔄', accent: 'bg-purple-100 text-purple-800' },
  [StreamingPlatform.ZOOM]: { label: 'Zoom', icon: '📹', accent: 'bg-blue-100 text-blue-800' },
  [StreamingPlatform.GOOGLE_MEET]: { label: 'Google Meet', icon: '🎥', accent: 'bg-emerald-100 text-emerald-800' },
  [StreamingPlatform.TEAMS]: { label: 'Microsoft Teams', icon: '👥', accent: 'bg-indigo-100 text-indigo-800' },
  [StreamingPlatform.JITSI]: { label: 'Jitsi', icon: '🛰️', accent: 'bg-cyan-100 text-cyan-800' },
  [StreamingPlatform.INSTAGRAM]: { label: 'Instagram', icon: '📷', accent: 'bg-pink-100 text-pink-800' },
  [StreamingPlatform.YOUTUBE]: { label: 'YouTube', icon: '▶️', accent: 'bg-red-100 text-red-800' },
  [StreamingPlatform.FACEBOOK]: { label: 'Facebook', icon: 'f', accent: 'bg-blue-100 text-blue-800' },
}

const STATUS_META: Record<LivestreamPlatformStatus, string> = {
  [LivestreamPlatformStatus.PENDING]: 'bg-amber-50 text-amber-700',
  [LivestreamPlatformStatus.LIVE]: 'bg-green-50 text-green-700',
  [LivestreamPlatformStatus.ENDED]: 'bg-gray-100 text-gray-600',
  [LivestreamPlatformStatus.FAILED]: 'bg-red-50 text-red-700',
}

const getYouTubeEmbedUrl = (url: string) => {
  const trimmed = url.trim()

  const idFromEmbed = trimmed.match(/youtube\.com\/embed\/([^?&/]+)/i)?.[1]
  if (idFromEmbed) return `https://www.youtube.com/embed/${idFromEmbed}`

  const idFromWatch = trimmed.match(/[?&]v=([^?&/]+)/i)?.[1]
  if (idFromWatch) return `https://www.youtube.com/embed/${idFromWatch}`

  const idFromShort = trimmed.match(/youtu\.be\/([^?&/]+)/i)?.[1]
  if (idFromShort) return `https://www.youtube.com/embed/${idFromShort}`

  return trimmed
}

const getFacebookEmbedUrl = (url: string) => {
  const u = encodeURIComponent(url.trim())
  return `https://www.facebook.com/plugins/video.php?href=${u}&show_text=false&width=1280`
}

export default function LivestreamHub({ isAdmin }: { isAdmin: boolean }) {
  const [livestreams, setLivestreams] = useState<LivestreamData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreator, setShowCreator] = useState(false)
  const [creatorError, setCreatorError] = useState<string | null>(null)

  const [externalConfig, setExternalConfig] = useState<ExternalLivestreamConfig | null>(null)
  const [showExternalEditor, setShowExternalEditor] = useState(false)
  const [externalSaving, setExternalSaving] = useState(false)
  const [externalPlatform, setExternalPlatform] = useState<StreamingPlatform>(StreamingPlatform.YOUTUBE)
  const [externalEnabled, setExternalEnabled] = useState(true)
  const [externalUrl, setExternalUrl] = useState('')
  const [externalTitle, setExternalTitle] = useState('')
  const [externalDescription, setExternalDescription] = useState('')
  const [externalScheduledAt, setExternalScheduledAt] = useState('')

  const loadLivestreams = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/livestreams')
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || 'Failed to load livestreams')
      }
      const payload = await res.json()
      setLivestreams(Array.isArray(payload?.data) ? payload.data : payload)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load livestreams')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadExternalConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/livestream', { cache: 'no-store' })
      if (!res.ok) {
        setExternalConfig(null)
        return
      }
      const data = (await res.json()) as ExternalLivestreamConfig | null
      setExternalConfig(data)
    } catch {
      setExternalConfig(null)
    }
  }, [])

  useEffect(() => {
    loadLivestreams()
  }, [loadLivestreams])

  useEffect(() => {
    loadExternalConfig()
  }, [loadExternalConfig])

  const activeLivestream = useMemo(() => {
    if (!livestreams.length) return null
    return (
      livestreams.find((ls) => ls.status === 'LIVE') ??
      livestreams.find((ls) => ls.status === 'SCHEDULED') ??
      livestreams[0]
    )
  }, [livestreams])

  const primaryPlatform = useMemo(() => {
    if (!activeLivestream?.platforms) return null
    const platforms = activeLivestream.platforms
    return (
      platforms.find((p) => p.url && p.platform === StreamingPlatform.YOUTUBE) ??
      platforms.find((p) => p.url && p.platform === StreamingPlatform.FACEBOOK) ??
      platforms.find((p) => p.url)
    )
  }, [activeLivestream])

  const externalPrimary = useMemo(() => {
    if (!externalConfig?.enabled) return null
    if (!externalConfig.url) return null
    return {
      platform: externalConfig.platform,
      url: externalConfig.url,
      title: externalConfig.title,
      description: externalConfig.description,
      scheduledAt: externalConfig.scheduledAt,
    }
  }, [externalConfig])

  const displayedPlatform = useMemo<DisplayedPlatform | null>(() => {
    if (primaryPlatform?.url) return { platform: primaryPlatform.platform, url: primaryPlatform.url, source: 'managed' }
    if (externalPrimary?.url) return { platform: externalPrimary.platform, url: externalPrimary.url, source: 'external' }
    return null
  }, [primaryPlatform, externalPrimary])

  const embedUrl = useMemo(() => {
    if (!displayedPlatform?.url) return null
    if (displayedPlatform.platform === StreamingPlatform.YOUTUBE) return getYouTubeEmbedUrl(displayedPlatform.url)
    if (displayedPlatform.platform === StreamingPlatform.FACEBOOK) return getFacebookEmbedUrl(displayedPlatform.url)
    return null
  }, [displayedPlatform])

  const displayedTitle = useMemo(() => {
    if (activeLivestream) return activeLivestream.title
    return externalPrimary?.title || 'Livestream'
  }, [activeLivestream, externalPrimary])

  const displayedDescription = useMemo(() => {
    if (activeLivestream) return activeLivestream.description
    return externalPrimary?.description
  }, [activeLivestream, externalPrimary])

  const displayedStartAtText = useMemo(() => {
    if (activeLivestream?.startAt) return new Date(activeLivestream.startAt).toLocaleString()
    if (externalPrimary?.scheduledAt) {
      const dt = new Date(externalPrimary.scheduledAt)
      if (!Number.isNaN(dt.getTime())) return dt.toLocaleString()
    }
    return null
  }, [activeLivestream, externalPrimary])

  const openExternalEditor = () => {
    setCreatorError(null)
    setExternalEnabled(externalConfig?.enabled ?? true)
    setExternalPlatform(externalConfig?.platform ?? StreamingPlatform.YOUTUBE)
    setExternalUrl(externalConfig?.url ?? '')
    setExternalTitle(externalConfig?.title ?? '')
    setExternalDescription(externalConfig?.description ?? '')
    setExternalScheduledAt(externalConfig?.scheduledAt ? externalConfig.scheduledAt.slice(0, 16) : '')
    setShowExternalEditor(true)
  }

  const saveExternal = async () => {
    setExternalSaving(true)
    setCreatorError(null)
    try {
      const res = await fetch('/api/livestream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: externalEnabled,
          platform: externalPlatform,
          url: externalUrl,
          title: externalTitle || undefined,
          description: externalDescription || undefined,
          scheduledAt: externalScheduledAt ? new Date(externalScheduledAt).toISOString() : undefined,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to save external stream')
      }
      setExternalConfig(data)
      setShowExternalEditor(false)
    } catch (err) {
      setCreatorError(err instanceof Error ? err.message : 'Failed to save external stream')
    } finally {
      setExternalSaving(false)
    }
  }

  const statusText = useMemo(() => {
    if (!activeLivestream) return 'No livestream scheduled.'
    if (activeLivestream.status === 'LIVE') return 'Live now'
    if (activeLivestream.status === 'SCHEDULED') return 'Upcoming livestream'
    return 'Previous livestream'
  }, [activeLivestream])

  const displayStatusText = useMemo(() => {
    if (activeLivestream) return statusText
    if (externalPrimary) return 'External livestream'
    return 'No livestream scheduled.'
  }, [activeLivestream, externalPrimary, statusText])

  const handleCreatorSuccess = (livestreamId: string) => {
    setShowCreator(false)
    setCreatorError(null)
    if (livestreamId) {
      loadLivestreams()
    }
  }

  const handleCreatorError = (message: string) => {
    setCreatorError(message)
  }

  if (loading) {
    return <div className="container mx-auto px-4 py-8">Loading livestreams...</div>
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">Livestream</h1>
          <p className="text-gray-600">
            Watch live services or join from your preferred platform. We support YouTube, Facebook, Instagram, Restream, and more.
          </p>
        </div>
        {isAdmin && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={openExternalEditor}
              className="px-4 py-2 border rounded-lg hover:bg-gray-50 font-medium"
            >
              Set External Stream URL
            </button>
            <button
              onClick={() => setShowCreator(true)}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium"
            >
              + Schedule Multi-Platform Stream
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {activeLivestream || externalPrimary ? (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-6 border-b">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-sm text-gray-500">{displayStatusText}</div>
                <div className="text-2xl font-semibold text-gray-900 mt-1">{displayedTitle}</div>
                {displayedDescription && (
                  <p className="text-gray-600 mt-2 max-w-2xl">{displayedDescription}</p>
                )}
                <div className="text-sm text-gray-500 mt-2">
                  {displayedStartAtText ? `Starts ${displayedStartAtText}` : 'Start time TBA'}
                </div>
                {displayedPlatform?.url && displayedPlatform.platform === StreamingPlatform.JITSI ? (
                  <a
                    href={displayedPlatform.url}
                    className="inline-flex items-center gap-2 text-primary-600 hover:underline mt-3 text-sm font-medium"
                  >
                    Watch here — built-in broadcast
                  </a>
                ) : displayedPlatform?.url && (
                  <a
                    href={displayedPlatform.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 text-primary-600 hover:underline mt-3 text-sm font-medium"
                  >
                    Open on {PLATFORM_META[displayedPlatform.platform].label}
                    <span aria-hidden="true">↗</span>
                  </a>
                )}
                {isAdmin && activeLivestream?.platforms?.some((p) => p.platform === StreamingPlatform.JITSI) && (
                  <a
                    href={`/livestreams/${activeLivestream.id}/broadcast`}
                    className="inline-flex items-center gap-2 mt-3 ml-4 px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700"
                  >
                    ● Broadcast Studio
                  </a>
                )}
              </div>
              {activeLivestream?.platforms && activeLivestream.platforms.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {activeLivestream.platforms.map((platform) => (
                    <div
                      key={platform.id || `${activeLivestream.id}-${platform.platform}`}
                      className={`px-3 py-2 rounded-lg border text-sm ${PLATFORM_META[platform.platform].accent}`}
                    >
                      <div className="font-semibold flex items-center gap-2">
                        <span>{PLATFORM_META[platform.platform].icon}</span>
                        <span>{PLATFORM_META[platform.platform].label}</span>
                      </div>
                      <div className={`mt-1 inline-flex px-2 py-0.5 rounded-full text-xs ${STATUS_META[platform.status]}`}>
                        {platform.status.charAt(0) + platform.status.slice(1).toLowerCase()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="p-6">
            {embedUrl ? (
              <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                <iframe
                  className="absolute top-0 left-0 w-full h-full rounded-lg"
                  src={embedUrl}
                  title="Livestream"
                  allow="autoplay; encrypted-media; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : (
              <div className="w-full h-96 bg-gray-900 flex items-center justify-center text-white rounded-lg">
                <p className="text-lg">Live video will appear here when the stream starts.</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow p-10 text-center text-gray-500">
          No livestreams scheduled yet. Check back soon!
        </div>
      )}

      {livestreams.length > 0 && (
        <div className="mt-8 bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Recent Livestreams</h2>
          <div className="space-y-4">
            {livestreams.map((ls) => (
              <div
                key={ls.id}
                className="flex flex-wrap items-center justify-between border border-gray-100 rounded-lg p-4 gap-4"
              >
                <div>
                  <div className="font-semibold text-gray-900">{ls.title}</div>
                  <div className="text-sm text-gray-500">
                    {ls.startAt ? new Date(ls.startAt).toLocaleString() : 'Start time TBA'}
                  </div>
                  {ls.description && <div className="text-sm text-gray-600 mt-1 max-w-2xl">{ls.description}</div>}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {ls.platforms?.map((platform) => (
                    <a
                      key={platform.id || `${ls.id}-${platform.platform}`}
                      href={platform.url || '#'}
                      target={platform.url ? '_blank' : undefined}
                      rel="noreferrer"
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
                        PLATFORM_META[platform.platform].accent
                      } ${platform.url ? 'hover:opacity-80 transition' : 'opacity-60 cursor-not-allowed'}`}
                    >
                      {PLATFORM_META[platform.platform].label}
                      {platform.url ? ' ↗' : ''}
                    </a>
                  ))}
                  <div className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                    {ls.status}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isAdmin && showCreator && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowCreator(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">Schedule Multi-Platform Livestream</h3>
                <p className="text-sm text-gray-600">Select one or more platforms and customize each stream.</p>
              </div>
              <button
                className="text-gray-500 hover:text-gray-700 text-xl"
                onClick={() => setShowCreator(false)}
                aria-label="Close livestream creator"
              >
                ×
              </button>
            </div>
            {creatorError && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 text-red-700 px-4 py-2 text-sm">
                {creatorError}
              </div>
            )}
            <LivestreamCreator onSuccess={handleCreatorSuccess} onError={handleCreatorError} />
          </div>
        </div>
      )}

      {isAdmin && showExternalEditor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowExternalEditor(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">External Livestream Link</h3>
                <p className="text-sm text-gray-600">
                  Start your livestream in YouTube/Facebook/OBS/StreamYard, then paste the public URL here.
                </p>
              </div>
              <button
                className="text-gray-500 hover:text-gray-700 text-xl"
                onClick={() => setShowExternalEditor(false)}
                aria-label="Close external livestream editor"
              >
                ×
              </button>
            </div>

            {creatorError && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 text-red-700 px-4 py-2 text-sm">
                {creatorError}
              </div>
            )}

            <div className="space-y-4">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={externalEnabled}
                  onChange={(e) => setExternalEnabled(e.target.checked)}
                />
                Enabled
              </label>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Platform</label>
                <select
                  value={externalPlatform}
                  onChange={(e) => setExternalPlatform(e.target.value as StreamingPlatform)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                >
                  <option value={StreamingPlatform.YOUTUBE}>YouTube</option>
                  <option value={StreamingPlatform.FACEBOOK}>Facebook</option>
                  <option value={StreamingPlatform.INSTAGRAM}>Instagram</option>
                  <option value={StreamingPlatform.RESTREAM}>Restream</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Livestream URL</label>
                <input
                  type="url"
                  value={externalUrl}
                  onChange={(e) => setExternalUrl(e.target.value)}
                  placeholder="https://youtube.com/watch?v=..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Title (optional)</label>
                <input
                  type="text"
                  value={externalTitle}
                  onChange={(e) => setExternalTitle(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description (optional)</label>
                <textarea
                  value={externalDescription}
                  onChange={(e) => setExternalDescription(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Scheduled time (optional)</label>
                <input
                  type="datetime-local"
                  value={externalScheduledAt}
                  onChange={(e) => setExternalScheduledAt(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setShowExternalEditor(false)}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                  type="button"
                >
                  Cancel
                </button>
                <button
                  onClick={saveExternal}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                  disabled={externalSaving}
                  type="button"
                >
                  {externalSaving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
