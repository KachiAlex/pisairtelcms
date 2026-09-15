'use client'

import { useEffect, useRef, useState } from 'react'
import Hls from 'hls.js'

export default function LivestreamWatcher({
  livestreamId,
  title,
  status,
  streamPath,
  mediaBase,
}: {
  livestreamId: string
  title: string
  status: string
  streamPath: string | null
  mediaBase: string
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [liveStatus, setLiveStatus] = useState(status)
  const [playerError, setPlayerError] = useState<string | null>(null)
  const hlsRef = useRef<Hls | null>(null)

  // Poll livestream status while waiting
  useEffect(() => {
    if (liveStatus === 'LIVE' || !streamPath) return
    const t = setInterval(async () => {
      const res = await fetch(`/api/livestreams/${livestreamId}`, { cache: 'no-store' }).catch(() => null)
      if (res?.ok) {
        const json = await res.json().catch(() => null)
        const s = json?.livestream?.status || json?.status
        if (s) setLiveStatus(s)
      }
    }, 8000)
    return () => clearInterval(t)
  }, [liveStatus, streamPath, livestreamId])

  // Attach HLS when live
  useEffect(() => {
    if (liveStatus !== 'LIVE' || !streamPath || !videoRef.current) return
    const src = `${mediaBase}/stream/${streamPath}/index.m3u8`

    const attach = () => {
      if (Hls.isSupported()) {
        const hls = new Hls({ lowLatencyMode: true, liveSyncDurationCount: 3 })
        hlsRef.current = hls
        hls.on(Hls.Events.ERROR, (_e, data) => {
          if (data.fatal) {
            // Stream may not exist yet — retry
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
              setTimeout(() => hls.startLoad(), 4000)
            } else {
              setPlayerError('Playback error')
            }
          }
        })
        hls.loadSource(src)
        hls.attachMedia(videoRef.current!)
      } else if (videoRef.current!.canPlayType('application/vnd.apple.mpegurl')) {
        videoRef.current!.src = src
      } else {
        setPlayerError('This browser cannot play the livestream')
      }
    }
    attach()
    return () => { hlsRef.current?.destroy(); hlsRef.current = null }
  }, [liveStatus, streamPath, mediaBase])

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        {liveStatus === 'LIVE' && (
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-100 text-red-700 text-sm font-semibold">
            <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" /> LIVE
          </span>
        )}
      </div>

      {!streamPath ? (
        <div className="p-6 rounded-xl bg-gray-50 text-gray-600 text-sm">
          This livestream does not have a built-in broadcast platform.
        </div>
      ) : liveStatus === 'LIVE' ? (
        <>
          {playerError && <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">{playerError}</div>}
          <video ref={videoRef} controls autoPlay muted className="w-full rounded-xl bg-gray-900 aspect-video" />
        </>
      ) : (
        <div className="p-10 rounded-xl bg-gray-900 text-center text-gray-300">
          {liveStatus === 'ENDED' ? 'This livestream has ended.' : 'Waiting for the broadcast to start…'}
        </div>
      )}
    </div>
  )
}
