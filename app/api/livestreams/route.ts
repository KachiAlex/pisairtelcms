import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { LivestreamService } from '@/lib/services/livestream-service'
import { StreamingPlatform, LivestreamStatus } from '@/lib/types/streaming'
import { prisma } from '@/lib/prisma'
import { getCurrentChurchId } from '@/lib/church-context'
import { UserRole } from '@/types'

/**
 * GET /api/livestreams - List livestreams
 * POST /api/livestreams - Create livestream
 * Requirements: 1.1, 1.2, 6.1, 6.2
 */

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sessionUser = session.user as { id?: string; email?: string; role?: UserRole; churchId?: string }

    // Attempt to hydrate user from database (prefer ID, fallback to email)
    let dbUser =
      sessionUser.id
        ? await prisma.user.findUnique({
            where: { id: sessionUser.id },
            select: { id: true, churchId: true, role: true },
          })
        : null

    if (!dbUser && sessionUser.email) {
      dbUser = await prisma.user.findUnique({
        where: { email: sessionUser.email },
        select: { id: true, churchId: true, role: true },
      })
    }

    const resolvedUser = dbUser || (sessionUser.id ? { id: sessionUser.id, churchId: sessionUser.churchId, role: sessionUser.role } : null)

    if (!resolvedUser?.id) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    let churchId: string | null = resolvedUser.churchId || sessionUser.churchId || null
    if (!churchId) {
      churchId = await getCurrentChurchId(resolvedUser.id)
    }

    if (!churchId) {
      return NextResponse.json({ error: 'No church selected' }, { status: 400 })
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status') as LivestreamStatus | null

    // Get livestreams
    const livestreams = await LivestreamService.getLivestreams(churchId, status || undefined)

    return NextResponse.json({
      success: true,
      data: livestreams,
    })
  } catch (error) {
    console.error('Error fetching livestreams:', error)
    return NextResponse.json(
      { error: 'Failed to fetch livestreams' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sessionUser = session.user as { id?: string; email?: string; role?: UserRole; churchId?: string }

    // Hydrate user info
    let dbUser =
      sessionUser.id
        ? await prisma.user.findUnique({
            where: { id: sessionUser.id },
            select: { id: true, churchId: true, role: true },
          })
        : null

    if (!dbUser && sessionUser.email) {
      dbUser = await prisma.user.findUnique({
        where: { email: sessionUser.email },
        select: { id: true, churchId: true, role: true },
      })
    }

    const resolvedUser = dbUser || (sessionUser.id ? { id: sessionUser.id, churchId: sessionUser.churchId, role: sessionUser.role } : null)

    if (!resolvedUser?.id) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    let churchId: string | null = resolvedUser.churchId || sessionUser.churchId || null
    if (!churchId) {
      churchId = await getCurrentChurchId(resolvedUser.id)
    }

    if (!churchId) {
      return NextResponse.json({ error: 'No church selected' }, { status: 400 })
    }

    // Check permissions (only admins and pastors can create livestreams)
    const role = (resolvedUser.role || sessionUser.role) as UserRole | undefined
    if (!role || !['ADMIN', 'PASTOR', 'LEADER', 'SUPER_ADMIN'].includes(role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()

    // Validate required fields
    if (!body.title || !body.platforms || body.platforms.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: title, platforms' },
        { status: 400 }
      )
    }

    if (body.startAt) {
      const parsedDate = new Date(body.startAt)
      if (Number.isNaN(parsedDate.getTime())) {
        return NextResponse.json({ error: 'Invalid startAt date' }, { status: 400 })
      }
    }

    // Validate platforms payload (expects array of { platform, settings? })
    if (!Array.isArray(body.platforms)) {
      return NextResponse.json({ error: 'Platforms must be an array' }, { status: 400 })
    }

    const validPlatforms = Object.values(StreamingPlatform)
    for (const platformEntry of body.platforms) {
      if (!platformEntry?.platform || !validPlatforms.includes(platformEntry.platform)) {
        return NextResponse.json({ error: `Invalid platform: ${platformEntry?.platform}` }, { status: 400 })
      }
      if (platformEntry.settings && typeof platformEntry.settings !== 'object') {
        return NextResponse.json(
          { error: `Invalid settings for platform: ${platformEntry.platform}` },
          { status: 400 }
        )
      }
    }

    // Create livestream
    const livestream = await LivestreamService.createLivestream(
      churchId,
      resolvedUser.id,
      {
        title: body.title,
        description: body.description,
        thumbnail: body.thumbnail,
        startAt: body.startAt ? new Date(body.startAt) : undefined,
        platforms: body.platforms,
      }
    )

    return NextResponse.json(
      {
        success: true,
        data: livestream,
        message: 'Livestream created successfully',
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error creating livestream:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create livestream' },
      { status: 500 }
    )
  }
}
