
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth-options'
import { GivingService } from '@/lib/services/giving-service'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const limit = parseInt(searchParams.get('limit') || '50')

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
