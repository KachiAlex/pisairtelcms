export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { AttendanceService } from '@/lib/services/attendance-service'
import { verifyLiveCode } from '@/lib/attendance-qr'
import { rateLimit, clientIp } from '@/lib/rate-limit'
import { prisma } from '@/lib/prisma'

async function resolveSession(sessionId: string, code: string) {
  const session = await prisma.attendanceSession.findUnique({
    where: { id: sessionId },
    include: { church: { select: { name: true } } },
  })
  if (!session?.qrToken || !verifyLiveCode(session.qrToken, code)) {
    return null
  }
  return session
}

function sessionSummary(session: any) {
  return {
    id: session.id,
    title: session.title,
    type: session.type,
    mode: session.mode,
    startAt: session.startAt,
    location: session.location,
    churchName: session.church?.name || null,
  }
}

async function currentUser() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return null
  const u = session.user as any
  return {
    id: u.id as string,
    name: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.name || u.email || 'Member',
  }
}

export async function GET(
  _request: Request,
  { params }: { params: { sessionId: string; code: string } },
) {
  const session = await resolveSession(params.sessionId, params.code)
  if (!session) {
    return NextResponse.json(
      { error: 'This code has expired — please scan the code currently on screen' },
      { status: 410 },
    )
  }

  const user = await currentUser()
  let alreadyCheckedIn = false
  if (user) {
    alreadyCheckedIn = !!(await AttendanceService.findRecordBySessionAndUser(session.id, user.id))
  }

  return NextResponse.json({
    session: sessionSummary(session),
    user: user ? { name: user.name } : null,
    alreadyCheckedIn,
  })
}

export async function POST(
  request: Request,
  { params }: { params: { sessionId: string; code: string } },
) {
  if (!rateLimit(`checkin:${clientIp(request)}`, 60, 10 * 60 * 1000)) {
    return NextResponse.json({ error: 'Too many attempts — try again shortly' }, { status: 429 })
  }

  const session = await resolveSession(params.sessionId, params.code)
  if (!session) {
    return NextResponse.json(
      { error: 'This code has expired — please scan the code currently on screen' },
      { status: 410 },
    )
  }

  const body = await request.json().catch(() => ({}))
  const user = await currentUser()

  const guestName = typeof body?.guestName === 'string' ? body.guestName.trim().slice(0, 120) : ''
  if (!user && !guestName) {
    return NextResponse.json({ error: 'Please enter your name to check in' }, { status: 400 })
  }

  const { record, alreadyCheckedIn } = await AttendanceService.qrCheckIn(session as any, {
    userId: user?.id,
    guestName: guestName || undefined,
    channel: typeof body?.channel === 'string' ? body.channel : undefined,
  })

  return NextResponse.json(
    {
      checkedIn: true,
      alreadyCheckedIn,
      record: { id: record.id, channel: record.channel, checkedInAt: record.checkedInAt },
      session: sessionSummary(session),
    },
    { status: alreadyCheckedIn ? 200 : 201 },
  )
}
