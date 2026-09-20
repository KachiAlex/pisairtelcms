export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { guardApi } from '@/lib/api-guard'
import { prisma } from '@/lib/prisma'
import { JitsiService } from '@/lib/services/jitsi-service'
import { StreamingPlatform, LivestreamPlatformStatus, LivestreamStatus } from '@prisma/client'
import { UserRole } from '@/types'
import crypto from 'crypto'

const MANAGE_ROLES: UserRole[] = ['ADMIN', 'SUPER_ADMIN', 'PASTOR', 'BRANCH_ADMIN', 'LEADER']

async function getLivestream(id: string, churchId: string) {
  return prisma.livestream.findFirst({
    where: { id, churchId },
    include: { platforms: true },
  })
}

async function ensureJitsiPlatform(livestream: any) {
  let platform = livestream.platforms.find((p: any) => p.platform === 'JITSI')
  if (platform?.platformId) return platform

  const streamPath = `lv-${crypto.randomBytes(8).toString('hex')}`
  const streamKey = crypto.randomBytes(24).toString('hex')
  const roomName = JitsiService.generateRoomName(livestream.id)

  if (platform) {
    platform = await prisma.livestreamPlatform.update({
      where: { id: platform.id },
      data: {
        platformId: streamPath,
        url: `/livestreams/${livestream.id}/watch`,
        error: null,
        settings: { ...(platform.settings as any || {}), roomName, streamPath, streamKey },
      },
    })
  } else {
    platform = await prisma.livestreamPlatform.create({
      data: {
        livestreamId: livestream.id,
        platform: 'JITSI',
        platformId: streamPath,
        url: `/livestreams/${livestream.id}/watch`,
        status: LivestreamPlatformStatus.PENDING,
        settings: { roomName, streamPath, streamKey },
      },
    })
  }
  return platform
}

// POST — mint publish credentials for the broadcast studio
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const guarded = await guardApi({ requireChurch: true, allowedRoles: MANAGE_ROLES })
  if (!guarded.ok) return guarded.response

  const { church, userId, role, session } = guarded.ctx
  const livestream = await getLivestream(params.id, church.id)
  if (!livestream) return NextResponse.json({ error: 'Livestream not found' }, { status: 404 })

  if (!JitsiService.isConfigured()) {
    return NextResponse.json({ error: 'Built-in broadcast is not configured' }, { status: 503 })
  }

  const platform = await ensureJitsiPlatform(livestream)
  const settings = (platform.settings as any) || {}
  const base = JitsiService.baseUrl
  const sessionUser = session?.user as any

  // Moderator JWTs for both the studio's receive-only connection and the
  // stage-room link the presenter opens in the Jitsi UI.
  const jwt = JitsiService.jwtEnabled
    ? await JitsiService.issueToken(settings.roomName, {
        id: userId,
        name: sessionUser?.name,
        email: sessionUser?.email,
      }, { moderator: true })
    : null
  const displayFragment = JitsiService.displayNameFragment(livestream.title)
  const stageJoinUrl = JitsiService.jwtEnabled && jwt
    ? `${base}/${settings.roomName}?jwt=${encodeURIComponent(jwt)}${displayFragment}`
    : `${base}/${settings.roomName}${displayFragment}`

  return NextResponse.json({
    roomName: settings.roomName,
    jitsiBase: base,
    jitsiXmppDomain: 'meet.jitsi',
    jwt,
    stageJoinUrl,
    whipUrl: `${base}/whip/${settings.streamPath}`,
    streamKey: settings.streamKey,
    streamPath: settings.streamPath,
    hlsPath: `/stream/${settings.streamPath}/index.m3u8`,
  })
}

// PATCH — { action: 'start' | 'stop' } flips broadcast status
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const guarded = await guardApi({ requireChurch: true, allowedRoles: MANAGE_ROLES })
  if (!guarded.ok) return guarded.response

  const { church } = guarded.ctx
  const livestream = await getLivestream(params.id, church.id)
  if (!livestream) return NextResponse.json({ error: 'Livestream not found' }, { status: 404 })

  const body = await request.json().catch(() => null)
  const action = String(body?.action || '')

  const jitsiPlatform = livestream.platforms.find((p) => p.platform === 'JITSI')
  if (!jitsiPlatform) {
    return NextResponse.json({ error: 'No built-in broadcast platform on this livestream' }, { status: 400 })
  }

  if (action === 'start') {
    await prisma.$transaction([
      prisma.livestreamPlatform.update({
        where: { id: jitsiPlatform.id },
        data: { status: LivestreamPlatformStatus.LIVE, error: null },
      }),
      prisma.livestream.update({
        where: { id: livestream.id },
        data: { status: LivestreamStatus.LIVE },
      }),
    ])
    return NextResponse.json({ status: 'LIVE' })
  }

  if (action === 'stop') {
    await prisma.$transaction([
      prisma.livestreamPlatform.update({
        where: { id: jitsiPlatform.id },
        data: { status: LivestreamPlatformStatus.ENDED },
      }),
      prisma.livestream.update({
        where: { id: livestream.id },
        data: { status: LivestreamStatus.ENDED, endAt: new Date() },
      }),
    ])
    return NextResponse.json({ status: 'ENDED' })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
