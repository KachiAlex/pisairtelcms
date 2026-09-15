
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { getCurrentChurch } from '@/lib/church-context'
import { generateQRCode } from '@/lib/qr-code'
import { UserService } from '@/lib/services/user-service'
import { ChildrenCheckInService } from '@/lib/services/children-service'

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
    const { childId, action } = body // action: 'checkin' or 'checkout'

    if (!childId || !action) {
      return NextResponse.json(
        { error: 'Child ID and action are required' },
        { status: 400 }
      )
    }

    // Verify child belongs to parent — staff roles may check in any child
    // in the church (check-in desk scenario)
    const child = await UserService.findById(childId)
    const userRole = (session.user as any).role
    const isStaffCheckIn = ['ADMIN', 'SUPER_ADMIN', 'PASTOR', 'BRANCH_ADMIN', 'LEADER'].includes(userRole)

    if (!child || child.churchId !== church.id || (child.parentId !== userId && !isStaffCheckIn)) {
      return NextResponse.json(
        { error: 'Child not found or access denied' },
        { status: 404 }
      )
    }

    if (action === 'checkin') {
      // Check if already checked in
      const existing = await ChildrenCheckInService.findActiveByChild(childId)

      if (existing) {
        return NextResponse.json(
          { error: 'Child is already checked in' },
          { status: 400 }
        )
      }

      const qrCode = generateQRCode(`CHILD-${childId}`)
      const checkIn = await ChildrenCheckInService.create({
        childId,
        parentId: userId,
        qrCode,
      })

      // Get parent info
      const parent = await UserService.findById(userId)
      const checkInWithParent = {
        ...checkIn,
        parent: parent ? {
          firstName: parent.firstName,
          lastName: parent.lastName,
          phone: parent.phone,
        } : null,
      }

      return NextResponse.json(checkInWithParent, { status: 201 })
    } else if (action === 'checkout') {
      // Find active check-in
      const activeCheckIn = await ChildrenCheckInService.findActiveByChild(childId)

      if (!activeCheckIn) {
        return NextResponse.json(
          { error: 'No active check-in found' },
          { status: 400 }
        )
      }

      // Checkout
      const updated = await ChildrenCheckInService.checkout(activeCheckIn.id)

      return NextResponse.json(updated)
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    )
  } catch (error: any) {
    console.error('Error processing children check-in:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
