
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth-options'
import { GivingService } from '@/lib/services/giving-service'
import { prisma } from '@/lib/prisma'
import { PermissionGrantService } from '@/lib/services/permission-grant-service'
import { getCurrentChurchId } from '@/lib/church-context'

const MANAGER_ROLES = ['ADMIN', 'PASTOR', 'BRANCH_ADMIN', 'SUPER_ADMIN']

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const callerId = (session.user as any).id
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const limit = parseInt(searchParams.get('limit') || '50')

    // Managers (or manage_giving grant holders) may read another user's history
    let userId = callerId
    const requestedUserId = searchParams.get('userId')
    if (requestedUserId && requestedUserId !== callerId) {
      const role = (session.user as any).role as string
      let allowed = MANAGER_ROLES.includes(role)
      if (!allowed) {
        const churchId = await getCurrentChurchId(callerId)
        if (churchId) {
          allowed = await PermissionGrantService.hasAnyGrant(callerId, churchId, ['manage_giving'])
        }
      }
      if (!allowed) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      userId = requestedUserId
    }

    // Get giving records
    let giving = await GivingService.findByUser(userId, limit)

    // Filter by type if provided
    if (type) {
      giving = giving.filter(g => g.type === type)
    }

    // Get project data — one batched query instead of N+1
    const projectIds = [...new Set(giving.map((g) => g.projectId).filter(Boolean))] as string[]
    const projects = projectIds.length
      ? await prisma.project.findMany({
          where: { id: { in: projectIds } },
          select: { id: true, name: true },
        })
      : []
    const projectMap = new Map(projects.map((p) => [p.id, p]))

    const givingWithProjects = giving.map((g) => ({
      ...g,
      project: g.projectId && projectMap.has(g.projectId)
        ? { id: g.projectId, name: projectMap.get(g.projectId)!.name }
        : null,
    }))

    // Get summary
    const totalAmount = await GivingService.getTotalByUser(userId)
    const streak = await GivingService.getGivingStreak(userId)

    return NextResponse.json({
      giving: givingWithProjects,
      summary: {
        totalAmount,
        totalDonations: giving.length,
        streak,
      },
    })
  } catch (error) {
    console.error('Error fetching giving history:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
