import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { LivestreamService } from '@/lib/services/livestream-service'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/livestreams/[id]/platforms - Get platform links for members
 * Requirements: 5.1, 5.2, 5.3
 * Property 5: Member Platform Access
 */

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, churchId: true, role: true },
    })

    const livestream = await prisma.livestream.findUnique({
      where: { id: params.id },
      select: { churchId: true },
    })

    if (!livestream || (user?.role !== 'SUPER_ADMIN' && livestream.churchId !== user?.churchId)) {
      return NextResponse.json({ error: 'Livestream not found' }, { status: 404 })
    }

    const links = await LivestreamService.getPlatformLinks(params.id)

    return NextResponse.json({
      success: true,
      data: links,
    })
  } catch (error) {
    console.error('Error fetching platform links:', error)
    return NextResponse.json(
      { error: 'Failed to fetch platform links' },
      { status: 500 }
    )
  }
}
