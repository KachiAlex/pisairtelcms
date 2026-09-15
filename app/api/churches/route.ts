
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { ChurchService } from '@/lib/services/church-service'
import { UserService } from '@/lib/services/user-service'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const role = (session.user as any)?.role

    if (role === 'SUPER_ADMIN') {
      const churches = await prisma.church.findMany({
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          slug: true,
          logo: true,
          city: true,
          state: true,
          country: true,
        },
      })

      return NextResponse.json(churches)
    }

    const userId = (session.user as any)?.id
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await UserService.findById(userId)
    if (!user?.churchId) {
      return NextResponse.json([])
    }

    const church = await ChurchService.findById(user.churchId)
    if (!church) {
      return NextResponse.json([])
    }

    return NextResponse.json([
      {
        id: church.id,
        name: church.name,
        slug: church.slug,
        logo: (church as any).logo,
        city: church.city,
        state: (church as any).state,
        country: church.country,
      },
    ])
  } catch (error) {
    console.error('Error fetching churches:', error)
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

    const role = (session.user as any)?.role
    if (role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Only platform administrators can create churches' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { name, slug, description, address, city, state, zipCode, country } = body

    if (!name || !slug) {
      return NextResponse.json(
        { error: 'Name and slug are required' },
        { status: 400 }
      )
    }

    // Check if slug already exists
    const existing = await prisma.church.findUnique({ where: { slug } })
    if (existing) {
      return NextResponse.json(
        { error: 'Church with this slug already exists' },
        { status: 400 }
      )
    }

    const church = await ChurchService.create({
      name,
      slug,
      description,
      address,
      city,
      state,
      zipCode,
      country,
    })

    return NextResponse.json(church, { status: 201 })
  } catch (error) {
    console.error('Error creating church:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
