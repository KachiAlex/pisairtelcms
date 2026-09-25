export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { guardApi } from '@/lib/api-guard'
import { prisma } from '@/lib/prisma'

export async function GET(_request: Request, { params }: { params: { sessionId: string } }) {
  const guarded = await guardApi({ requireChurch: true })
  if (!guarded.ok) return guarded.response

  const session = await prisma.attendanceSession.findUnique({
    where: { id: params.sessionId },
    include: { meeting: { select: { id: true, title: true } } },
  })
  if (!session || session.churchId !== guarded.ctx.church!.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const checkInCount = await prisma.attendanceRecord.count({ where: { sessionId: session.id } })
  return NextResponse.json({ session: { ...session, checkInCount } })
}
