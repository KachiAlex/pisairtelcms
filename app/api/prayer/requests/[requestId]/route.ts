
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { getCurrentChurch } from '@/lib/church-context'
import { prisma } from '@/lib/prisma'

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ requestId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = (session.user as any).role
    if (!['ADMIN', 'SUPER_ADMIN', 'PASTOR'].includes(userRole)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const { requestId } = await params

    const existing = await prisma.prayerRequest.findUnique({
      where: { id: requestId },
      select: { id: true, churchId: true },
    })
    if (!existing) {
      return NextResponse.json({ error: 'Prayer request not found' }, { status: 404 })
    }

    // Tenant isolation: non-super-admins may only delete within their church
    if (userRole !== 'SUPER_ADMIN') {
      const church = await getCurrentChurch((session.user as any).id)
      if (!church || existing.churchId !== church.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    // Delete the request and its interactions (cascade-safe)
    await prisma.$transaction([
      prisma.prayerInteraction.deleteMany({ where: { prayerRequestId: requestId } }),
      prisma.prayerRequest.delete({ where: { id: requestId } }),
    ])

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting prayer request:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
