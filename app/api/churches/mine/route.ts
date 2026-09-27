export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { UserService } from '@/lib/services/user-service'
import { ChurchService } from '@/lib/services/church-service'
import { ChurchMembershipService } from '@/lib/services/church-membership-service'
import { getCurrentChurchId } from '@/lib/church-context'

/** GET /api/churches/mine — churches the signed-in user belongs to. */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id as string
    const memberships = await ChurchMembershipService.findByUser(userId)
    const user = await UserService.findById(userId)
    const activeChurchId = await getCurrentChurchId(userId)

    const byChurch = new Map<string, any>()
    for (const m of memberships) {
      if (m.church) {
        byChurch.set(m.church.id, {
          id: m.church.id,
          name: m.church.name,
          slug: m.church.slug,
          logo: m.church.logo,
          role: m.role,
        })
      }
    }

    // Legacy gap: active church with no membership row still appears.
    if (user?.churchId && !byChurch.has(user.churchId)) {
      const church = await ChurchService.findById(user.churchId)
      if (church) {
        byChurch.set(church.id, {
          id: church.id,
          name: church.name,
          slug: (church as any).slug,
          logo: (church as any).logo,
          role: user.role,
        })
      }
    }

    return NextResponse.json({
      activeChurchId,
      churches: Array.from(byChurch.values()),
    })
  } catch (error) {
    console.error('Error listing user churches:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
