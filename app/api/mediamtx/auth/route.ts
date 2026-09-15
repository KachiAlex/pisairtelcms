export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(String(a))
  const bb = Buffer.from(String(b))
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb)
}

// MediaMTX HTTP auth hook — authorizes WHIP/RTMP publishes by stream key.
// Read/playback actions are excluded in mediamtx.yml and never reach this route.
export async function POST(request: Request) {
  let body: any
  try {
    body = await request.json()
  } catch {
    return new NextResponse(null, { status: 401 })
  }

  const action = String(body?.action || '')
  const path = String(body?.path || '')
  const password = String(body?.password || '')

  if (action !== 'publish' || !path.startsWith('lv-') || !password) {
    return new NextResponse(null, { status: 401 })
  }

  const platform = await prisma.livestreamPlatform.findFirst({
    where: { platform: 'JITSI', platformId: path },
    select: { settings: true },
  })

  const streamKey = (platform?.settings as any)?.streamKey
  if (!streamKey || !safeEqual(streamKey, password)) {
    return new NextResponse(null, { status: 401 })
  }

  return new NextResponse(null, { status: 200 })
}
