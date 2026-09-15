
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { PrayerRequestService } from '@/lib/services/prayer-service'
import { getCurrentChurch } from '@/lib/church-context'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const church = await getCurrentChurch(userId)

    if (!church) {
      return NextResponse.json(
        { error: 'No church selected' },
        { status: 400 }
      )
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    // Get prayer requests
    const requests = await PrayerRequestService.findByChurch(church.id, {
      status: status || undefined,
      limit: 50,
    })

    // Batch-fetch users and current user's "Prayed" interactions
    const requestIds = requests.map((r) => r.id)
    const userIds = [...new Set(requests.filter((r) => !r.isAnonymous).map((r) => r.userId))]

    const [users, myInteractions] = await Promise.all([
      userIds.length > 0
        ? prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, firstName: true, lastName: true, profileImage: true },
          })
        : Promise.resolve([]),
      requestIds.length > 0
        ? prisma.prayerInteraction.findMany({
            where: { userId, prayerRequestId: { in: requestIds }, type: 'Prayed' },
            select: { prayerRequestId: true },
          })
        : Promise.resolve([]),
    ])

    const userMap = new Map(users.map((u) => [u.id, u]))
    const prayedSet = new Set(myInteractions.map((i) => i.prayerRequestId))

    const requestsWithDetails = requests.map((request) => {
      const user = userMap.get(request.userId)
      return {
        ...request,
        user: user && !request.isAnonymous ? {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          profileImage: user.profileImage,
        } : null,
        hasPrayed: prayedSet.has(request.id),
        _count: {
          interactions: request.prayerCount,
        },
      }
    })

    return NextResponse.json(requestsWithDetails)
  } catch (error) {
    console.error('Error fetching prayer requests:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const church = await getCurrentChurch(userId)

    if (!church) {
      return NextResponse.json(
        { error: 'No church selected' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { title, content, isAnonymous } = body

    if (!title || !content) {
      return NextResponse.json(
        { error: 'Title and content are required' },
        { status: 400 }
      )
    }

    const prayerRequest = await PrayerRequestService.create({
      userId,
      churchId: church.id,
      title,
      content,
      isAnonymous: isAnonymous || false,
      status: 'ACTIVE',
    })

    // Get user data
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, firstName: true, lastName: true, profileImage: true },
    })

    return NextResponse.json({
      ...prayerRequest,
      user: user && !prayerRequest.isAnonymous ? {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        profileImage: user.profileImage,
      } : null,
      _count: {
        interactions: 0,
      },
    }, { status: 201 })
  } catch (error: any) {
    console.error('Error creating prayer request:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
