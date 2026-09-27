
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { setCurrentChurchId, getCurrentChurchId } from '@/lib/church-context'
import { UserService } from '@/lib/services/user-service'
import { ChurchService } from '@/lib/services/church-service'
import { ChurchMembershipService } from '@/lib/services/church-membership-service'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { churchId } = body

    if (!churchId) {
      return NextResponse.json(
        { error: 'Church ID is required' },
        { status: 400 }
      )
    }

    const userId = (session.user as any).id

    // Verify user has access to this church
    const user = await UserService.findById(userId)

    // Check if user is member of this church or has access
    const church = await ChurchService.findById(churchId)

    if (!church) {
      return NextResponse.json(
        { error: 'Church not found' },
        { status: 404 }
      )
    }

    // Access = active-church pointer, a membership row, or super admin.
    const userRole = (session.user as any).role
    const membership = await ChurchMembershipService.findByUserAndChurch(userId, churchId)
    const allowed = userRole === 'SUPER_ADMIN' || user?.churchId === churchId || !!membership
    if (!allowed) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    await setCurrentChurchId(churchId)

    // Activate the target church's per-church role/branch on the user so the
    // session reflects tenant-local permissions. Super admins have no tenant
    // membership — leave their pointers untouched.
    if (membership) {
      await UserService.update(userId, {
        churchId,
        role: membership.role as any,
        branchId: membership.branchId,
      })
    } else if (userRole !== 'SUPER_ADMIN' && user?.churchId === churchId) {
      // Legacy membership gap — backfill so the switcher keeps working.
      await ChurchMembershipService.attach({
        userId,
        churchId,
        role: (user?.role as any) ?? 'MEMBER',
        branchId: user?.branchId ?? null,
      })
    }

    return NextResponse.json({ success: true, churchId })
  } catch (error) {
    console.error('Error switching church:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const churchId = await getCurrentChurchId(userId)

    if (!churchId) {
      return NextResponse.json({ churchId: null })
    }

    const church = await ChurchService.findById(churchId)

    return NextResponse.json({ 
      churchId, 
      church: church ? {
        id: church.id,
        name: church.name,
        slug: church.slug,
        logo: church.logo,
      } : null
    })
  } catch (error) {
    console.error('Error getting current church:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
