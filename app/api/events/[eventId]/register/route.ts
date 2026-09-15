
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth-options'
import { EventService } from '@/lib/services/event-service'
import { EventRegistrationService } from '@/lib/services/event-registration-service'
import { UserService } from '@/lib/services/user-service'
import { randomBytes } from 'crypto'

export async function POST(
  request: Request,
  { params }: { params: { eventId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const { eventId } = params

    // Get event — must belong to the user's church
    const event = await EventService.findById(eventId)
    const userChurchId = (session.user as any).churchId
    if (!event || (event.churchId !== userChurchId && (session.user as any).role !== 'SUPER_ADMIN')) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      )
    }

    // Check if already registered
    const existing = await EventRegistrationService.findByUserAndEvent(userId, eventId)
    if (existing) {
      return NextResponse.json(
        { error: 'Already registered for this event' },
        { status: 400 }
      )
    }

    // Check if event is full
    const registrationCount = await EventRegistrationService.countByEvent(eventId)
    if (event.maxAttendees && registrationCount >= event.maxAttendees) {
      return NextResponse.json(
        { error: 'Event is full' },
        { status: 400 }
      )
    }

    // Generate ticket number and QR code
    const randomId = randomBytes(4).toString('hex').toUpperCase()
    const ticketNumber = `TKT-${Date.now()}-${randomId}`
    const qrCode = `${eventId}-${userId}-${ticketNumber}`

    const registration = await EventRegistrationService.create({
      userId,
      eventId,
      ticketNumber,
      qrCode,
      status: 'REGISTERED',
    })

    // Get user data
    const user = await UserService.findById(userId)

    return NextResponse.json({
      ...registration,
      event: {
        title: event.title,
        startDate: event.startDate,
        location: event.location,
      },
      user: user ? {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
      } : null,
    }, { status: 201 })
  } catch (error: any) {
    console.error('Error registering for event:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
