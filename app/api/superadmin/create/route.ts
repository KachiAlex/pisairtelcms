
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { UserService } from '@/lib/services/user-service'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(String(a))
  const bb = Buffer.from(String(b))
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb)
}

function getBearerToken(req: Request): string | null {
  const auth = req.headers.get('authorization') || req.headers.get('Authorization')
  if (!auth) return null
  const match = auth.match(/^Bearer\s+(.+)$/i)
  return match ? match[1] : null
}

/**
 * Create Superadmin Account
 *
 * Requires the SUPERADMIN_BOOTSTRAP_TOKEN bearer token — the same gate as
 * /api/superadmin/bootstrap. With the env var unset (default), this endpoint
 * is inert and returns 500.
 *
 * Usage:
 * POST /api/superadmin/create
 * Authorization: Bearer <SUPERADMIN_BOOTSTRAP_TOKEN>
 * Body: {
 *   "email": "admin@pi-cms.com",
 *   "password": "secure-password",
 *   "firstName": "Super",
 *   "lastName": "Admin"
 * }
 */
export async function POST(request: Request) {
  try {
    const expected = (process.env.SUPERADMIN_BOOTSTRAP_TOKEN || '').trim()
    if (!expected) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
    }

    const provided = getBearerToken(request)
    if (!provided || !safeEqual(provided, expected)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { email, password, firstName, lastName } = body

    // Validate input
    if (!email || !password || !firstName || !lastName) {
      return NextResponse.json(
        { error: 'Missing required fields: email, password, firstName, lastName' },
        { status: 400 }
      )
    }

    // Check if user already exists
    const existingUser = await UserService.findByEmail(email)
    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 400 }
      )
    }

    // Check if superadmin already exists
    const superAdmin = await prisma.user.findFirst({
      where: { role: 'SUPER_ADMIN' },
      select: { id: true },
    })

    if (superAdmin) {
      return NextResponse.json(
        { 
          error: 'Superadmin already exists. Use /api/superadmin/promote to promote an existing user.',
          warning: 'Only one superadmin should exist for security reasons.'
        },
        { status: 400 }
      )
    }

    // Create superadmin user
    // Note: SUPER_ADMIN users don't need a churchId (they manage all churches)
    const superadmin = await UserService.create({
      email,
      password,
      firstName,
      lastName,
      role: 'SUPER_ADMIN',
      churchId: null, // Superadmin doesn't belong to a specific church
    })

    // Remove password from response
    const { password: _, ...userWithoutPassword } = superadmin

    return NextResponse.json(
      {
        message: 'Superadmin account created successfully',
        user: userWithoutPassword,
        access: {
          portal: '/superadmin',
          loginUrl: '/auth/login',
          email: email,
        },
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Error creating superadmin:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
