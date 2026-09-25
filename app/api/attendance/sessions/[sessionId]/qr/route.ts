export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import QRCode from 'qrcode'
import { guardApi } from '@/lib/api-guard'
import { AttendanceService } from '@/lib/services/attendance-service'
import { UserService } from '@/lib/services/user-service'
import { currentLiveCode } from '@/lib/attendance-qr'

async function loadAuthorizedSession(sessionId: string) {
  const guarded = await guardApi({
    requireChurch: true,
    allowedRoles: ['ADMIN', 'SUPER_ADMIN', 'BRANCH_ADMIN', 'PASTOR'],
  })
  if (!guarded.ok) return { error: guarded.response }
  const { church, userId, role } = guarded.ctx
  const user = await UserService.findById(userId)

  const session = await AttendanceService.findSessionById(sessionId)
  if (!session || session.churchId !== church.id) {
    return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
  }
  if (role === 'BRANCH_ADMIN') {
    const myBranch = (user as any)?.branchId || null
    if (session.branchId && myBranch && session.branchId !== myBranch) {
      return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
    }
  }
  return { session }
}

/**
 * Canonical public origin for QR links. request.url reflects whatever
 * host the admin browsed (IP:port, internal hostname) — phones can't
 * reach those, so always prefer the configured public URL.
 */
function publicOrigin(request: Request): string {
  const configured = process.env.APP_PUBLIC_URL || process.env.NEXTAUTH_URL
  if (configured) return configured.replace(/\/$/, '')
  const proto = request.headers.get('x-forwarded-proto') || 'https'
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host')
  return host ? `${proto}://${host}` : new URL(request.url).origin
}

function buildPayload(sessionId: string, qrToken: string, origin: string, qrPngDataUrl?: string) {
  const checkInUrl = `${origin}/checkin/${qrToken}`
  const live = currentLiveCode(qrToken)
  return {
    sessionId,
    checkInUrl,
    qrPngDataUrl,
    live: {
      code: live.code,
      expiresIn: live.expiresIn,
      url: `${origin}/checkin/live/${sessionId}/${live.code}`,
    },
  }
}

export async function GET(request: Request, { params }: { params: { sessionId: string } }) {
  const result = await loadAuthorizedSession(params.sessionId)
  if (result.error) return result.error

  const qrToken = await AttendanceService.ensureQrToken(params.sessionId)
  if (!qrToken) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const origin = publicOrigin(request)
  const { searchParams } = new URL(request.url)

  // Lightweight mode for the rotating kiosk display — no PNG rendering.
  if (searchParams.get('live') === '1') {
    return NextResponse.json(buildPayload(params.sessionId, qrToken, origin))
  }

  const qrPngDataUrl = await QRCode.toDataURL(`${origin}/checkin/${qrToken}`, {
    width: 640,
    margin: 2,
    color: { dark: '#111827', light: '#ffffff' },
  })
  return NextResponse.json(buildPayload(params.sessionId, qrToken, origin, qrPngDataUrl))
}

/** POST — regenerate the token, invalidating previously printed codes. */
export async function POST(request: Request, { params }: { params: { sessionId: string } }) {
  const result = await loadAuthorizedSession(params.sessionId)
  if (result.error) return result.error

  const qrToken = await AttendanceService.regenerateQrToken(params.sessionId)
  const origin = publicOrigin(request)
  const qrPngDataUrl = await QRCode.toDataURL(`${origin}/checkin/${qrToken}`, {
    width: 640,
    margin: 2,
    color: { dark: '#111827', light: '#ffffff' },
  })
  return NextResponse.json(buildPayload(params.sessionId, qrToken, origin, qrPngDataUrl))
}
