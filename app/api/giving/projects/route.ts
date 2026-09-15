
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth-options'
import { ProjectService } from '@/lib/services/giving-service'
import { prisma } from '@/lib/prisma'
import { getCurrentChurch } from '@/lib/church-context'

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

    const projects = await ProjectService.findByChurch(church.id)

    // Batch giving counts per project (no N+1)
    const projectIds = projects.map((p) => p.id)
    const givingCounts = projectIds.length > 0
      ? await prisma.giving.groupBy({
          by: ['projectId'],
          where: { projectId: { in: projectIds } },
          _count: { _all: true },
        })
      : []
    const countMap = new Map(givingCounts.map((g) => [g.projectId, g._count._all]))

    const projectsWithProgress = projects.map((project) => {
      const progress = project.goalAmount > 0
        ? (project.currentAmount / project.goalAmount) * 100
        : 0

      return {
        ...project,
        progress: Math.min(progress, 100),
        remainingAmount: Math.max(0, project.goalAmount - project.currentAmount),
        _count: {
          giving: countMap.get(project.id) || 0,
        },
      }
    })

    return NextResponse.json(projectsWithProgress)
  } catch (error) {
    console.error('Error fetching projects:', error)
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

    const userRole = (session.user as any).role
    if (!['ADMIN', 'SUPER_ADMIN', 'PASTOR'].includes(userRole)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
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
    const {
      name,
      description,
      currency,
      goalAmount,
      imageUrl,
      startDate,
      endDate,
    } = body

    if (!name || !goalAmount) {
      return NextResponse.json(
        { error: 'Name and goal amount are required' },
        { status: 400 }
      )
    }

    const project = await ProjectService.create({
      name,
      description,
      currency: currency || undefined,
      goalAmount: parseFloat(goalAmount),
      churchId: church.id,
      imageUrl: imageUrl || undefined,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      status: 'Active',
    })

    return NextResponse.json(project, { status: 201 })
  } catch (error: any) {
    console.error('Error creating project:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
