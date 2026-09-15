'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

declare global {
  interface Window {
    JitsiMeetJS?: any
  }
}

type BroadcastCreds = {
  roomName: string
  jitsiBase: string
  jitsiXmppDomain: string
  whipUrl: string
  streamKey: string
  streamPath: string
  hlsPath: string
}

type Phase = 'idle' | 'preparing' | 'joining' | 'publishing' | 'live' | 'ended' | 'error'

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve()
    const el = document.createElement('script')
    el.src = src
    el.onload = () => resolve()
    el.onerror = () => reject(new Error(`Failed to load ${src}`))
    document.head.appendChild(el)
  })
}

export default function BroadcastStudio({ livestreamId, title }: { livestreamId: string; title: string }) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [participantCount, setParticipantCount] = useState(0)
  const [creds, setCreds] = useState<BroadcastCreds | null>(null)

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const rafRef = useRef<number>(0)
  const videoElsRef = useRef<Map<string, HTMLVideoElement>>(new Map())
  const audioCtxRef = useRef<AudioContext | null>(null)
  const audioDestRef = useRef<MediaStreamAudioDestinationNode | null>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const conferenceRef = useRef<any>(null)
  const connectionRef = useRef<any>(null)
  const stoppedRef = useRef(false)

  const setBroadcastStatus = useCallback(async (action: 'start' | 'stop') => {
    await fetch(`/api/livestreams/${livestreamId}/broadcast`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action }),
    }).catch(() => undefined)
  }, [livestreamId])

  const drawLoop = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const videos = [...videoElsRef.current.values()].filter(
      (v) => v.readyState >= 2 && v.videoWidth > 0
    )
    ctx.fillStyle = '#111827'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    if (videos.length > 0) {
      const cols = Math.ceil(Math.sqrt(videos.length))
      const rows = Math.ceil(videos.length / cols)
      const cw = canvas.width / cols
      const ch = canvas.height / rows
      videos.forEach((v, i) => {
        const x = (i % cols) * cw
        const y = Math.floor(i / cols) * ch
        // letterbox fit
        const scale = Math.min(cw / v.videoWidth, ch / v.videoHeight)
        const w = v.videoWidth * scale
        const h = v.videoHeight * scale
        ctx.drawImage(v, x + (cw - w) / 2, y + (ch - h) / 2, w, h)
      })
    } else {
      ctx.fillStyle = '#9ca3af'
      ctx.font = '28px sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('Waiting for participants…', canvas.width / 2, canvas.height / 2)
    }

    rafRef.current = requestAnimationFrame(drawLoop)
  }, [])

  const cleanup = useCallback(async () => {
    stoppedRef.current = true
    cancelAnimationFrame(rafRef.current)
    try { pcRef.current?.close() } catch {}
    try { await conferenceRef.current?.leave() } catch {}
    try { connectionRef.current?.disconnect() } catch {}
    try { await audioCtxRef.current?.close() } catch {}
    pcRef.current = null
    conferenceRef.current = null
    connectionRef.current = null
    videoElsRef.current.clear()
  }, [])

  useEffect(() => {
    return () => { void cleanup() }
  }, [cleanup])

  const start = useCallback(async () => {
    setError(null)
    setPhase('preparing')
    stoppedRef.current = false

    try {
      const res = await fetch(`/api/livestreams/${livestreamId}/broadcast`, { method: 'POST' })
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'Failed to get broadcast credentials')
      const c: BroadcastCreds = await res.json()
      setCreds(c)

      await loadScript(`${c.jitsiBase}/libs/lib-jitsi-meet.min.js`)
      const JitsiMeetJS = window.JitsiMeetJS
      if (!JitsiMeetJS) throw new Error('Jitsi library failed to load')

      // --- Jitsi: join as a receive-only participant ---
      setPhase('joining')
      const host = new URL(c.jitsiBase).host
      JitsiMeetJS.init({ disableAudioLevels: true })
      JitsiMeetJS.setLogLevel(JitsiMeetJS.logLevels?.ERROR ?? 'error')

      const connection = new JitsiMeetJS.JitsiConnection(null, null, {
        hosts: {
          domain: c.jitsiXmppDomain,
          muc: `muc.${c.jitsiXmppDomain}`,
        },
        serviceUrl: `wss://${host}/xmpp-websocket`,
        websocket: `wss://${host}/xmpp-websocket`,
        bosh: `https://${host}/http-bind`,
        openBridgeChannel: 'websocket',
      })
      connectionRef.current = connection

      await new Promise<void>((resolve, reject) => {
        connection.addEventListener(JitsiMeetJS.events.connection.CONNECTION_ESTABLISHED, resolve)
        connection.addEventListener(JitsiMeetJS.events.connection.CONNECTION_FAILED, () =>
          reject(new Error('Could not connect to the video server'))
        )
        connection.connect()
      })

      const audioCtx = new AudioContext()
      audioCtxRef.current = audioCtx
      const audioDest = audioCtx.createMediaStreamDestination()
      audioDestRef.current = audioDest

      const canvas = canvasRef.current!
      canvas.width = 1280
      canvas.height = 720
      rafRef.current = requestAnimationFrame(drawLoop)

      const conference = connection.initJitsiConference(c.roomName, {
        openBridgeChannel: 'websocket',
        startSilent: true,
      })
      conferenceRef.current = conference

      const onTrackAdded = (track: any) => {
        if (track.isLocal?.()) return
        const id = `${track.getParticipantId?.() || 'p'}-${track.getId?.() || Math.random()}`
        if (track.isVideoTrack?.()) {
          const el = document.createElement('video')
          el.autoplay = true
          el.muted = true
          el.playsInline = true
          track.attach(el)
          videoElsRef.current.set(id, el)
        } else if (track.isAudioTrack?.()) {
          try {
            const mediaTrack: MediaStreamTrack | undefined = track.getTrack?.() || track.track
            if (mediaTrack) {
              const src = audioCtx.createMediaStreamSource(new MediaStream([mediaTrack]))
              src.connect(audioDest)
            }
          } catch {}
        }
        setParticipantCount((n) => n + 1)
      }
      conference.on(JitsiMeetJS.events.conference.TRACK_ADDED, onTrackAdded)
      conference.on(JitsiMeetJS.events.conference.TRACK_REMOVED, (track: any) => {
        const id = `${track.getParticipantId?.() || 'p'}-${track.getId?.() || ''}`
        const el = videoElsRef.current.get(id)
        if (el) {
          try { track.detach(el) } catch {}
          videoElsRef.current.delete(id)
        }
        setParticipantCount((n) => Math.max(0, n - 1))
      })

      await new Promise<void>((resolve, reject) => {
        conference.on(JitsiMeetJS.events.conference.CONFERENCE_JOINED, resolve)
        conference.on(JitsiMeetJS.events.conference.CONFERENCE_FAILED, () =>
          reject(new Error('Failed to join the broadcast room'))
        )
        conference.join()
      })
      try { conference.setDisplayName?.('Broadcast') } catch {}

      // --- WHIP publish to MediaMTX ---
      setPhase('publishing')
      const canvasStream = canvas.captureStream(25)
      const outStream = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...audioDest.stream.getAudioTracks(),
      ])

      const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] })
      pcRef.current = pc

      const videoTx = pc.addTransceiver(outStream.getVideoTracks()[0], { direction: 'sendonly' })
      const audioTx = pc.addTransceiver(outStream.getAudioTracks()[0], { direction: 'sendonly' })

      // Prefer H.264 so the HLS output plays everywhere (incl. Safari)
      try {
        const vCaps = RTCRtpSender.getCapabilities('video')
        const h264 = vCaps?.codecs.filter((cd) => /H264/i.test(cd.mimeType)) ?? []
        if (h264.length) videoTx.setCodecPreferences(h264)
        const aCaps = RTCRtpSender.getCapabilities('audio')
        const opus = aCaps?.codecs.filter((cd) => /opus/i.test(cd.mimeType)) ?? []
        if (opus.length) audioTx.setCodecPreferences(opus)
      } catch {}

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === 'complete') return resolve()
        const onChange = () => { if (pc.iceGatheringState === 'complete') { pc.removeEventListener('icegatheringstatechange', onChange); resolve() } }
        pc.addEventListener('icegatheringstatechange', onChange)
        setTimeout(resolve, 5000)
      })

      const whipRes = await fetch(c.whipUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/sdp',
          authorization: `Basic ${btoa(`studio:${c.streamKey}`)}`,
        },
        body: pc.localDescription!.sdp!,
      })
      if (!whipRes.ok) throw new Error(`Broadcast server rejected the stream (${whipRes.status})`)
      const answerSdp = await whipRes.text()
      await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp })

      setPhase('live')
      await setBroadcastStatus('start')
    } catch (e: any) {
      setError(e?.message || 'Broadcast failed to start')
      setPhase('error')
      await cleanup()
    }
  }, [livestreamId, drawLoop, cleanup, setBroadcastStatus])

  const stop = useCallback(async () => {
    await cleanup()
    setPhase('ended')
    await setBroadcastStatus('stop')
  }, [cleanup, setBroadcastStatus])

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Broadcast Studio</h1>
          <p className="text-sm text-gray-600">{title}</p>
        </div>
        {phase === 'live' && (
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-100 text-red-700 text-sm font-semibold">
            <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" /> LIVE
          </span>
        )}
      </div>

      {error && <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>}

      <canvas ref={canvasRef} className="w-full rounded-xl bg-gray-900 aspect-video" />

      <div className="flex items-center gap-3">
        {(phase === 'idle' || phase === 'error' || phase === 'ended') && (
          <button
            type="button"
            onClick={start}
            className="px-4 py-2 bg-primary-700 text-white rounded-lg font-semibold hover:bg-primary-800"
          >
            {phase === 'ended' ? 'Restart Broadcast' : 'Go Live'}
          </button>
        )}
        {phase === 'live' && (
          <button
            type="button"
            onClick={stop}
            className="px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700"
          >
            End Broadcast
          </button>
        )}
        {(phase === 'preparing' || phase === 'joining' || phase === 'publishing') && (
          <div className="text-sm text-gray-600">
            {phase === 'preparing' && 'Preparing…'}
            {phase === 'joining' && 'Joining broadcast room…'}
            {phase === 'publishing' && 'Publishing stream…'}
          </div>
        )}
        {creds && (
          <a
            className="text-sm text-primary-700 hover:underline font-medium"
            href={`${creds.jitsiBase}/${creds.roomName}`}
            target="_blank"
            rel="noreferrer"
          >
            Open stage room ↗
          </a>
        )}
      </div>

      <div className="text-sm text-gray-500">
        {phase === 'live'
          ? `Broadcasting to ${participantCount || 'your'} stage participant(s). Share the watch link with your congregation.`
          : 'Go Live joins the Jitsi stage room, composites it here in your browser, and publishes it to the built-in stream. Keep this tab open while broadcasting.'}
      </div>
    </div>
  )
}
