'use client'

import { useState } from 'react'
import { StreamingPlatform } from '@/lib/types/streaming'

interface LivestreamFormData {
  title: string
  description: string
  startAt: string
  platforms: StreamingPlatform[]
  youtubeSettings: {
    title?: string
    description?: string
    thumbnail?: string
  }
  facebookSettings: {
    title?: string
    description?: string
  }
  instagramSettings: {
    title?: string
  }
  restreamSettings: {
    title?: string
    description?: string
  }
}

interface LivestreamCreatorProps {
  onSuccess?: (livestreamId: string) => void
  onError?: (error: string) => void
}

export default function LivestreamCreator({ onSuccess, onError }: LivestreamCreatorProps) {
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState<LivestreamFormData>({
    title: '',
    description: '',
    startAt: '',
    platforms: [],
    youtubeSettings: {
      title: '',
      description: '',
    },
    facebookSettings: {
      title: '',
      description: '',
    },
    instagramSettings: {
      title: '',
    },
    restreamSettings: {
      title: '',
      description: '',
    },
  })

  const platforms = [
    { id: StreamingPlatform.JITSI, label: 'Built-in (Jitsi)', icon: '🛰️' },
    { id: StreamingPlatform.RESTREAM, label: 'Restream', icon: '🔄' },
    { id: StreamingPlatform.YOUTUBE, label: 'YouTube', icon: '▶️' },
    { id: StreamingPlatform.FACEBOOK, label: 'Facebook', icon: 'f' },
    { id: StreamingPlatform.INSTAGRAM, label: 'Instagram', icon: '📷' },
  ]

  const togglePlatform = (platform: StreamingPlatform) => {
    setForm((prev) => ({
      ...prev,
      platforms: prev.platforms.includes(platform)
        ? prev.platforms.filter((p) => p !== platform)
        : [...prev.platforms, platform],
    }))
  }

  const getPlatformSettings = (platform: StreamingPlatform) => {
    let settings:
      | LivestreamFormData['youtubeSettings']
      | LivestreamFormData['facebookSettings']
      | LivestreamFormData['instagramSettings']
      | LivestreamFormData['restreamSettings']
      | undefined

    switch (platform) {
      case StreamingPlatform.YOUTUBE:
        settings = form.youtubeSettings
        break
      case StreamingPlatform.FACEBOOK:
        settings = form.facebookSettings
        break
      case StreamingPlatform.INSTAGRAM:
        settings = form.instagramSettings
        break
      case StreamingPlatform.RESTREAM:
        settings = form.restreamSettings
        break
      default:
        settings = undefined
    }

    if (!settings) {
      return undefined
    }

    const hasValue = Object.values(settings).some((value) => {
      if (typeof value === 'string') {
        return value.trim().length > 0
      }
      return value !== undefined && value !== null
    })

    return hasValue ? settings : undefined
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!form.title.trim()) {
      onError?.('Title is required')
      return
    }

    if (form.platforms.length === 0) {
      onError?.('Select at least one platform')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/livestreams', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          startAt: form.startAt ? new Date(form.startAt).toISOString() : undefined,
          platforms: form.platforms.map((platform) => ({
            platform,
            settings: getPlatformSettings(platform),
          })),
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to create livestream')
      }

      const data = await response.json()
      const livestream = data?.data || data
      if (livestream?.id) {
        onSuccess?.(livestream.id)
      } else {
        onSuccess?.('')
      }

      // Reset form
      setForm({
        title: '',
        description: '',
        startAt: '',
        platforms: [],
        youtubeSettings: { title: '', description: '' },
        facebookSettings: { title: '', description: '' },
        instagramSettings: { title: '' },
        restreamSettings: { title: '', description: '' },
      })
    } catch (error: any) {
      onError?.(error.message || 'Failed to create livestream')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-2xl">
      <h2 className="text-2xl font-bold mb-6">Create New Livestream</h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Basic Information</h3>

          <div>
            <label htmlFor="livestream-title" className="block text-sm font-medium text-gray-700 mb-2">
              Livestream Title *
            </label>
            <input
              type="text"
              id="livestream-title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g., Sunday Service - January 5, 2025"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          <div>
            <label htmlFor="livestream-start" className="block text-sm font-medium text-gray-700 mb-2">
              Start Time
            </label>
            <input
              type="datetime-local"
              id="livestream-start"
              value={form.startAt}
              onChange={(e) => setForm({ ...form, startAt: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor="livestream-description" className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              id="livestream-description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Add details about this livestream..."
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Platform Selection */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Select Platforms *</h3>
          <p className="text-sm text-gray-600">
            Choose which platforms to broadcast to. Your livestream will be available on all selected platforms.
          </p>

          <div className="grid grid-cols-2 gap-3">
            {platforms.map((platform) => (
              <button
                key={platform.id}
                type="button"
                onClick={() => togglePlatform(platform.id)}
                className={`p-4 rounded-lg border-2 transition-all ${
                  form.platforms.includes(platform.id)
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-300 bg-white hover:border-gray-400'
                }`}
              >
                <div className="text-2xl mb-2">{platform.icon}</div>
                <div className="font-medium text-gray-900">{platform.label}</div>
                {form.platforms.includes(platform.id) && (
                  <div className="text-xs text-blue-600 mt-1">✓ Selected</div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Platform-Specific Settings */}
        {form.platforms.length > 0 && (
          <div className="space-y-4 border-t pt-6">
            <h3 className="text-lg font-semibold text-gray-900">Platform-Specific Settings</h3>

            {form.platforms.includes(StreamingPlatform.YOUTUBE) && (
              <div className="bg-red-50 p-4 rounded-lg space-y-3">
                <h4 className="font-medium text-gray-900">YouTube Settings</h4>
                <input
                  type="text"
                  value={form.youtubeSettings?.title || ''}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      youtubeSettings: {
                        ...form.youtubeSettings,
                        title: e.target.value,
                      },
                    })
                  }
                  placeholder="YouTube title (optional)"
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                />
                <textarea
                  value={form.youtubeSettings?.description || ''}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      youtubeSettings: {
                        ...form.youtubeSettings,
                        description: e.target.value,
                      },
                    })
                  }
                  placeholder="YouTube description (optional)"
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                />
              </div>
            )}

            {form.platforms.includes(StreamingPlatform.FACEBOOK) && (
              <div className="bg-blue-50 p-4 rounded-lg space-y-3">
                <h4 className="font-medium text-gray-900">Facebook Settings</h4>
                <input
                  type="text"
                  value={form.facebookSettings?.title || ''}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      facebookSettings: {
                        ...form.facebookSettings,
                        title: e.target.value,
                      },
                    })
                  }
                  placeholder="Facebook title (optional)"
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                />
                <textarea
                  value={form.facebookSettings?.description || ''}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      facebookSettings: {
                        ...form.facebookSettings,
                        description: e.target.value,
                      },
                    })
                  }
                  placeholder="Facebook description (optional)"
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                />
              </div>
            )}

            {form.platforms.includes(StreamingPlatform.INSTAGRAM) && (
              <div className="bg-pink-50 p-4 rounded-lg space-y-3">
                <h4 className="font-medium text-gray-900">Instagram Settings</h4>
                <input
                  type="text"
                  value={form.instagramSettings?.title || ''}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      instagramSettings: {
                        ...form.instagramSettings,
                        title: e.target.value,
                      },
                    })
                  }
                  placeholder="Instagram title (optional)"
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                />
              </div>
            )}

            {form.platforms.includes(StreamingPlatform.RESTREAM) && (
              <div className="bg-purple-50 p-4 rounded-lg space-y-3">
                <h4 className="font-medium text-gray-900">Restream Settings</h4>
                <input
                  type="text"
                  value={form.restreamSettings?.title || ''}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      restreamSettings: {
                        ...form.restreamSettings,
                        title: e.target.value,
                      },
                    })
                  }
                  placeholder="Restream title (optional)"
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                />
                <textarea
                  value={form.restreamSettings?.description || ''}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      restreamSettings: {
                        ...form.restreamSettings,
                        description: e.target.value,
                      },
                    })
                  }
                  placeholder="Restream description (optional)"
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                />
              </div>
            )}
          </div>
        )}

        {/* Submit Button */}
        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Creating Livestream...' : 'Create Livestream'}
          </button>
        </div>
      </form>
    </div>
  )
}
