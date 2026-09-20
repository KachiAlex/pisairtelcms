'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'

interface UploadProgress {
  audio?: number
  thumbnail?: number
}

export default function SermonUploadForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({})
  
  // Form fields
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [speaker, setSpeaker] = useState('')
  const [category, setCategory] = useState('')
  const [tags, setTags] = useState('')
  
  // URLs
  const [videoUrl, setVideoUrl] = useState('')
  const [audioUrl, setAudioUrl] = useState('')
  const [thumbnailUrl, setThumbnailUrl] = useState('')
  
  // Files
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null)
  
  const [mediaType, setMediaType] = useState<'video' | 'audio' | 'both'>('both')
  const [duration, setDuration] = useState('')

  const audioFileRef = useRef<HTMLInputElement>(null)
  const thumbnailFileRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = async (
    file: File,
    type: 'audio' | 'thumbnail'
  ): Promise<string> => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('type', type)

    const response = await fetch('/api/sermons/upload', {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Upload failed')
    }

    const data = await response.json()
    return data.url
  }

  const parseMediaUrl = (url: string): {
    type: 'youtube' | 'vimeo' | 'telegram' | 'direct'
    embedUrl?: string
  } => {
    // YouTube
    const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i
    const youtubeMatch = url.match(youtubeRegex)
    if (youtubeMatch) {
      const videoId = youtubeMatch[1]
      return {
        type: 'youtube',
        embedUrl: `https://www.youtube.com/embed/${videoId}`,
      }
    }

    // Vimeo
    const vimeoRegex = /vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/([^\/]*)\/videos\/|album\/(\d+)\/video\/|)(\d+)(?:$|\/|\?)/
    const vimeoMatch = url.match(vimeoRegex)
    if (vimeoMatch) {
      const videoId = vimeoMatch[3]
      return {
        type: 'vimeo',
        embedUrl: `https://player.vimeo.com/video/${videoId}`,
      }
    }

    // Telegram
    if (url.includes('t.me/') || url.includes('telegram.')) {
      // Private/internal Telegram links (t.me/c/<id>/<postId>) cannot be embedded publicly
      if (/t\.me\/c\/\d+\/\d+/.test(url)) {
        return {
          type: 'telegram',
        }
      }
      return {
        type: 'telegram',
        embedUrl: url,
      }
    }

    // Direct URL
    return {
      type: 'direct',
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      let finalVideoUrl = videoUrl
      let finalAudioUrl = audioUrl
      let finalThumbnailUrl = thumbnailUrl

      if (finalVideoUrl) {
        const parsed = parseMediaUrl(finalVideoUrl)
        if (parsed.type === 'telegram' && !parsed.embedUrl) {
          throw new Error(
            'This Telegram link cannot be embedded (t.me/c/...). Please copy the public link in the format t.me/<channel>/<postId>.'
          )
        }
        if (parsed.embedUrl) {
          finalVideoUrl = parsed.embedUrl
        }
      }

      if (!finalVideoUrl && !audioFile && !finalAudioUrl) {
        throw new Error('Please provide at least a video embed link or an audio source.')
      }

      if (audioFile) {
        setUploadProgress((prev) => ({ ...prev, audio: 0 }))
        finalAudioUrl = await handleFileUpload(audioFile, 'audio')
        setUploadProgress((prev) => ({ ...prev, audio: 100 }))
      }

      if (thumbnailFile) {
        setUploadProgress((prev) => ({ ...prev, thumbnail: 0 }))
        finalThumbnailUrl = await handleFileUpload(thumbnailFile, 'thumbnail')
        setUploadProgress((prev) => ({ ...prev, thumbnail: 100 }))
      }

      // Create sermon
      const response = await fetch('/api/sermons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          speaker,
          videoUrl: finalVideoUrl || undefined,
          audioUrl: finalAudioUrl || undefined,
          thumbnailUrl: finalThumbnailUrl || undefined,
          duration: duration ? parseInt(duration) * 60 : undefined, // Convert minutes to seconds
          category: category || undefined,
          tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create sermon')
      }

      const sermon = await response.json()
      alert('Sermon uploaded successfully!')
      router.push('/sermons')
    } catch (error: any) {
      console.error('Error uploading sermon:', error)
      alert(error.message || 'Failed to upload sermon')
    } finally {
      setLoading(false)
      setUploadProgress({})
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Info */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Sermon Details</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              placeholder="Enter sermon title"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Speaker *
            </label>
            <input
              type="text"
              required
              value={speaker}
              onChange={(e) => setSpeaker(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              placeholder="Pastor name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              placeholder="Sermon description, key points, scripture references..."
            />
            <p className="text-xs text-gray-500 mt-1">
              Detailed description helps AI generate better summaries
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Select category</option>
                <option value="Sunday Service">Sunday Service</option>
                <option value="Bible Study">Bible Study</option>
                <option value="Prayer Meeting">Prayer Meeting</option>
                <option value="Special Event">Special Event</option>
                <option value="Youth Service">Youth Service</option>
                <option value="Testimony">Testimony</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Duration (minutes)
              </label>
              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                placeholder="e.g., 45"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tags (comma-separated)
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              placeholder="e.g., faith, prayer, healing"
            />
          </div>
        </div>
      </div>

      {/* Media Upload */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Video Embed URL
            </label>
            <input
              type="url"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              placeholder="YouTube, Vimeo, Telegram, or direct streaming link"
            />
            <p className="text-xs text-gray-500 mt-1">
              Videos must be provided via embed links (YouTube, Vimeo, Telegram, or publicly accessible MP4/WebM URLs).
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900">Audio Upload</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Audio File (MP3, WAV, M4A)
                </label>
                <input
                  ref={audioFileRef}
                  type="file"
                  accept="audio/*"
                  onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
                {audioFile && (
                  <p className="text-sm text-gray-600 mt-1">
                    Selected: {audioFile.name} ({(audioFile.size / (1024 * 1024)).toFixed(2)} MB)
                  </p>
                )}
                {uploadProgress.audio !== undefined && (
                  <div className="mt-2">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-primary-600 h-2 rounded-full transition-all"
                        style={{ width: `${uploadProgress.audio}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">
                      Uploading audio: {uploadProgress.audio}%
                    </p>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Audio URL (optional)
                </label>
                <input
                  type="url"
                  value={audioUrl}
                  onChange={(e) => setAudioUrl(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  placeholder="Direct audio link (MP3, WAV, etc.)"
                />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900">Thumbnail (optional)</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Thumbnail Image (JPG, PNG, WebP, GIF, SVG)
                </label>
                <input
                  ref={thumbnailFileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
                  onChange={(e) => setThumbnailFile(e.target.files?.[0] || null)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
                {thumbnailFile && (
                  <p className="text-sm text-gray-600 mt-1">
                    Selected: {thumbnailFile.name} ({(thumbnailFile.size / 1024).toFixed(2)} KB)
                  </p>
                )}
                {uploadProgress.thumbnail !== undefined && (
                  <div className="mt-2">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-primary-600 h-2 rounded-full transition-all"
                        style={{ width: `${uploadProgress.thumbnail}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">
                      Uploading thumbnail: {uploadProgress.thumbnail}%
                    </p>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Thumbnail URL (optional)
                </label>
                <input
                  type="url"
                  value={thumbnailUrl}
                  onChange={(e) => setThumbnailUrl(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  placeholder="Sermon thumbnail image"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
          <p className="text-sm text-blue-800">
            <strong>Tip:</strong> A sermon needs at least one media source — a video embed link (YouTube, Vimeo, Telegram, or direct MP4/WebM) <em>or</em> an audio file/URL. Thumbnails are optional (up to 5MB).
          </p>
        </div>
      </div>

      {/* Submit Button */}
      <div className="flex justify-end gap-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
          disabled={loading}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading || !title || !speaker || (!videoUrl && !audioFile && !audioUrl)}
          className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Uploading...' : 'Upload Sermon'}
        </button>
      </div>
    </form>
  )
}

