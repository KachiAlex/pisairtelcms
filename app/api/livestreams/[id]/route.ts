import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { LivestreamService } from '@/lib/services/livestream-service'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/livestreams/[id] - Get livestream details
 * PATCH /api/livestreams/[id] - Update livestream
 * DELETE /api/livestreams/[id] - Delete livestream
 * Requirements: 1.1, 1.3, 6.1
 */

export const runtime = 'nodejs'

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

    const livestream = await LivestreamService.getLivestream(params.id)

    if (!livestream) {
      return NextResponse.json({ error: 'Livestream not found' }, { status: 404 })
    }

    // Tenant isolation: only same-church members (or superadmins) can read
    if (user?.role !== 'SUPER_ADMIN' && livestream.churchId !== user?.churchId) {
      return NextResponse.json({ error: 'Livestream not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: livestream,
    })
  } catch (error) {
    console.error('Error fetching livestream:', error)
    return NextResponse.json(
      { error: 'Failed to fetch livestream' },
      { status: 500 }
    )
  }
}

export async function PATCH(
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

    if (!livestream || (user.role !== 'SUPER_ADMIN' && livestream.churchId !== user.churchId)) {
      return NextResponse.json({ error: 'Livestream not found' }, { status: 404 })
    }

    const body = await request.json()

    // Update livestream
    const updated = await LivestreamService.updateLivestream(params.id, {
      title: body.title,
      description: body.description,
      thumbnail: body.thumbnail,
    })

    return NextResponse.json({
      success: true,
      data: updated,
      message: 'Livestream updated successfully',
    })
  } catch (error) {
    console.error('Error updating livestream:', error)
    return NextResponse.json(
      { error: 'Failed to update livestream' },
      { status: 500 }
    )
  }
}

export async function DELETE(
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
    if (!['ADMIN', 'PASTOR', 'SUPER_ADMIN'].includes(user.role)) {
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

    // Delete livestream
    await LivestreamService.deleteLivestream(params.id)

    return NextResponse.json({
      success: true,
      message: 'Livestream deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting livestream:', error)
    return NextResponse.json(
      { error: 'Failed to delete livestream' },
      { status: 500 }
    )
  }
}
