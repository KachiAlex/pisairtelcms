
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { getCurrentChurch } from '@/lib/church-context'
import { prisma } from '@/lib/prisma'

const PRIVILEGED_ROLES = ['ADMIN', 'SUPER_ADMIN', 'PASTOR', 'BRANCH_ADMIN']

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const sessionRole = (session.user as any).role as string | undefined
    const church = await getCurrentChurch(userId)

    if (!church) {
      return NextResponse.json(
        { error: 'No church selected' },
        { status: 400 }
      )
    }

    const { searchParams } = new URL(request.url)
    const familyIdParam = searchParams.get('familyId')

    // Restrict to own family unless caller is privileged
    let familyId = userId
    if (familyIdParam && familyIdParam !== userId) {
      if (!PRIVILEGED_ROLES.includes(sessionRole || '')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      familyId = familyIdParam
    }

    // Targeted family query instead of scanning all church users
    const familyMembers = await prisma.user.findMany({
      where: {
        churchId: church.id,
        OR: [
          { id: familyId },
          { parentId: familyId },
          { spouseId: familyId },
          { firestoreData: { path: ['parentId'], equals: familyId } },
          { firestoreData: { path: ['spouseId'], equals: familyId } },
        ],
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        profileImage: true,
        role: true,
      },
    })

    const memberIds = familyMembers.map((m) => m.id)

    // Batch all progress + prayer counts in two queries (no N+1)
    const [allProgress, prayerCounts] = await Promise.all([
      prisma.readingPlanProgress.findMany({
        where: { userId: { in: memberIds } },
        include: { readingPlan: { select: { id: true, title: true, duration: true } } },
      }),
      prisma.prayerRequest.groupBy({
        by: ['userId'],
        where: { userId: { in: memberIds } },
        _count: { _all: true },
      }),
    ])

    const prayerCountByUser = new Map(prayerCounts.map((c) => [c.userId, c._count._all]))
    const progressByUser = new Map<string, typeof allProgress>()
    for (const p of allProgress) {
      const list = progressByUser.get(p.userId) || []
      list.push(p)
      progressByUser.set(p.userId, list)
    }

    const family = familyMembers.map((member) => {
      const progress = progressByUser.get(member.id) || []
      const activePlans = progress
        .filter((p) => !p.completed)
        .map((p) => ({
          id: p.readingPlan.id,
          title: p.readingPlan.title,
          duration: p.readingPlan.duration,
        }))
      const completedCount = progress.filter((p) => p.completed).length

      return {
        id: member.id,
        firstName: member.firstName,
        lastName: member.lastName,
        profileImage: member.profileImage,
        role: member.role,
        readingPlans: activePlans,
        _count: {
          prayerRequests: prayerCountByUser.get(member.id) || 0,
          readingPlans: completedCount,
        },
      }
    })

    return NextResponse.json({
      family,
      stats: {
        totalMembers: family.length,
        activePlans: family.reduce((sum, m) => sum + m.readingPlans.length, 0),
        completedPlans: family.reduce((sum, m) => sum + m._count.readingPlans, 0),
        totalPrayerRequests: family.reduce((sum, m) => sum + m._count.prayerRequests, 0),
      },
    })
  } catch (error) {
    console.error('Error fetching family devotion:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
