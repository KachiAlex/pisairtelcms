import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { LivestreamService } from '@/lib/services/livestream-service'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/livestreams/[id]/stop - Stop broadcasting
 * Requirements: 1.4
 * Property 4: Platform Failure Isolation
 */

export const runtime = 'nodejs'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, churchId: true, role: true },
    })

    if (!user?.churchId) {
      return NextResponse.json({ error: 'User not associated with a church' }, { status: 400 })
    }

    // Check permissions
    if (!['ADMIN', 'PASTOR', 'LEADER', 'SUPER_ADMIN'].includes(user.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Verify livestream belongs to user's church
    const livestream = await prisma.livestream.findUnique({
      where: { id: params.id },
      select: { churchId: true },
    })

    if (!livestream || livestream.churchId !== user.churchId) {
      return NextResponse.json({ error: 'Livestream not found' }, { status: 404 })
    }

    // Stop broadcasting
    const updated = await LivestreamService.stopBroadcasting(params.id)

    return NextResponse.json({
      success: true,
      data: updated,
      message: 'Broadcasting stopped on all platforms',
    })
  } catch (error) {
    console.error('Error stopping broadcast:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to stop broadcast' },
      { status: 500 }
    )
  }
}
