export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { guardApi } from '@/lib/api-guard'
import { prisma } from '@/lib/prisma'
import { JitsiService } from '@/lib/services/jitsi-service'
import { UserRole } from '@/types'

const MODERATOR_ROLES: UserRole[] = ['ADMIN', 'SUPER_ADMIN', 'PASTOR', 'BRANCH_ADMIN', 'LEADER', 'STAFF']

// GET — mint a room-bound Jitsi JWT and redirect to the join URL.
// Keeps tenancy enforcement server-side: bare room links stay unusable
// once the instance runs in secure-domain mode.
export async function GET(_request: Request, { params }: { params: { meetingId: string } }) {
  const guarded = await guardApi({ requireChurch: true })
  if (!guarded.ok) return guarded.response

  const { church, userId, role, session } = guarded.ctx
  const meeting = await prisma.meeting.findFirst({
    where: { id: params.meetingId, churchId: church.id },
    select: { id: true, jitsi: true },
  })

  const roomName = (meeting?.jitsi as any)?.roomName
  if (!meeting || !roomName) {
    return NextResponse.json({ error: 'No Jitsi room for this meeting' }, { status: 404 })
  }

  const user = session?.user as any
  const moderator = !!role && MODERATOR_ROLES.includes(role)

  const url = await JitsiService.getAuthedJoinUrl(roomName, {
    id: userId,
    name: user?.name,
    email: user?.email,
  }, { moderator })

  return NextResponse.redirect(url)
}
