
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth-options'
import { CheckInService } from '@/lib/services/checkin-service'
import { prisma } from '@/lib/prisma'
import { getCurrentChurch } from '@/lib/church-context'
import { generateQRCode } from '@/lib/qr-code'

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
    const { eventId, location, qrCode } = body

    // Event-scoped check-ins must target an event in the user's church
    if (eventId) {
      const event = await prisma.event.findUnique({ where: { id: eventId }, select: { churchId: true } })
      if (!event || event.churchId !== church.id) {
        return NextResponse.json({ error: 'Event not found' }, { status: 404 })
      }
    }

    // Generate QR code if not provided
    const checkInQRCode = qrCode || generateQRCode('CHECKIN')

    const checkIn = await CheckInService.create({
      userId,
      eventId: eventId || undefined,
      qrCode: checkInQRCode,
      location: location || undefined,
      checkedInAt: new Date(),
    })

    return NextResponse.json(checkIn, { status: 201 })
  } catch (error: any) {
    console.error('Error creating check-in:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get('eventId')

    let checkIns = await CheckInService.findByUser(userId, 50)

    // Filter by event if provided
    if (eventId) {
      checkIns = checkIns.filter(checkIn => checkIn.eventId === eventId)
    }

    // Add event info — single batched query instead of N+1
    const eventIds = [...new Set(checkIns.map((c) => c.eventId).filter(Boolean))] as string[]
    const events = eventIds.length
      ? await prisma.event.findMany({
          where: { id: { in: eventIds } },
          select: { id: true, title: true, startDate: true },
        })
      : []
    const eventMap = new Map(events.map((e) => [e.id, e]))

    const checkInsWithEvents = checkIns.map((checkIn) => {
      const event = checkIn.eventId ? eventMap.get(checkIn.eventId) : null
      return {
        ...checkIn,
        event: event ? {
          id: event.id,
          title: event.title,
          startDate: event.startDate,
        } : null,
      }
    })

    return NextResponse.json(checkInsWithEvents)
  } catch (error) {
    console.error('Error fetching check-ins:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
