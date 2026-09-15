
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { getCurrentChurch } from '@/lib/church-context'
import { GroupService } from '@/lib/services/group-service'
import { prisma } from '@/lib/prisma'

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371 // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

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
    const latitude = parseFloat(searchParams.get('latitude') || '0')
    const longitude = parseFloat(searchParams.get('longitude') || '0')
    const maxDistance = parseFloat(searchParams.get('maxDistance') || '10') // km

    if (!latitude || !longitude) {
      return NextResponse.json(
        { error: 'Latitude and longitude are required' },
        { status: 400 }
      )
    }

    // Get all groups for the church
    const groups = await GroupService.findByChurch(church.id)
    const groupsWithLocation = groups.filter(g => g.latitude && g.longitude)

    // Batch-fetch member counts and departments (no N+1)
    const groupIds = groupsWithLocation.map((g) => g.id)
    const departmentIds = [...new Set(groupsWithLocation.map((g) => g.departmentId).filter(Boolean))] as string[]

    const [memberCounts, departments] = await Promise.all([
      groupIds.length > 0
        ? prisma.groupMembership.groupBy({
            by: ['groupId'],
            where: { groupId: { in: groupIds } },
            _count: { _all: true },
          })
        : Promise.resolve([]),
      departmentIds.length > 0
        ? prisma.department.findMany({
            where: { id: { in: departmentIds } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
    ])

    const countMap = new Map(memberCounts.map((m) => [m.groupId, m._count._all]))
    const deptMap = new Map(departments.map((d) => [d.id, d]))

    // Calculate distances and filter
    const groupsWithDistance = groupsWithLocation.map((group) => {
      const distance = calculateDistance(
        latitude,
        longitude,
        group.latitude!,
        group.longitude!
      )

      const dept = group.departmentId ? deptMap.get(group.departmentId) : null

      return {
        ...group,
        distance: Math.round(distance * 10) / 10, // Round to 1 decimal
        _count: {
          members: countMap.get(group.id) || 0,
        },
        department: dept ? { id: dept.id, name: dept.name } : null,
      }
    })
    const groupsWithDistanceFiltered = groupsWithDistance
      .filter((g) => g.distance <= maxDistance)
      .sort((a, b) => a.distance - b.distance)

    return NextResponse.json(groupsWithDistanceFiltered)
  } catch (error) {
    console.error('Error finding nearby groups:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
