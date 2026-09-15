
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth-options'
import { EventRegistrationService, EventAttendanceService } from '@/lib/services/event-registration-service'
import { EventService } from '@/lib/services/event-service'
import { UserService } from '@/lib/services/user-service'
import { requirePermissionMiddleware } from '@/lib/middleware/rbac'

export async function POST(
  request: Request,
  { params }: { params: { eventId: string } }
) {
  try {
    const { error: permError } = await requirePermissionMiddleware('manage_events')
    if (permError) {
      return permError
    }

    const session = await getServerSession(authOptions)
    const { eventId } = params

    // Tenant isolation: the event must belong to the operator's church
    const targetEvent = await EventService.findById(eventId)
    if (!targetEvent || ((session?.user as any)?.role !== 'SUPER_ADMIN' && targetEvent.churchId !== (session?.user as any)?.churchId)) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }
    const body = await request.json()
    const { qrCode, userId } = body

    if (!qrCode && !userId) {
      return NextResponse.json(
        { error: 'QR code or user ID is required' },
        { status: 400 }
      )
    }

    // Find registration
    let registration
    if (qrCode) {
      registration = await EventRegistrationService.findByQrCode(eventId, qrCode)
    } else {
      registration = await EventRegistrationService.findByUserAndEvent(userId, eventId)
    }

    if (!registration) {
      return NextResponse.json(
        { error: 'Registration not found' },
        { status: 404 }
      )
    }

    // Get user info
    const user = await UserService.findById(registration.userId)
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Check if already checked in
    const existingAttendance = await EventAttendanceService.findByUserAndEvent(registration.userId, eventId)

    if (existingAttendance) {
      return NextResponse.json(
        { error: 'Already checked in', attendance: existingAttendance },
        { status: 400 }
      )
    }

    // Get event info
    const event = await EventService.findById(eventId)
    if (!event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      )
    }

    // Create attendance record
    const attendance = await EventAttendanceService.create({
      userId: registration.userId,
      eventId,
    })

    // Update registration status
    await EventRegistrationService.updateStatus(registration.id, 'Attended')

    return NextResponse.json({
      success: true,
      attendance: {
        ...attendance,
        user: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
        },
        event: {
          title: event.title,
          startDate: event.startDate,
        },
      },
    })
  } catch (error: any) {
    console.error('Error checking in:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
