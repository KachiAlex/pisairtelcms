
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { UserService } from '@/lib/services/user-service'
import { prisma } from '@/lib/prisma'

/**
 * Create Superadmin Account
 * 
 * This endpoint creates a superadmin user account.
 * IMPORTANT: This should be protected in production or only run once during initial setup.
 * 
 * Usage:
 * POST /api/superadmin/create
 * Body: {
 *   "email": "admin@pi-cms.com",
 *   "password": "secure-password",
 *   "firstName": "Super",
 *   "lastName": "Admin"
 * }
 */
export async function POST(request: Request) {
  try {
    // In production, you might want to add additional security checks here
    // For example, check for a secret token or only allow from specific IPs
    
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
      churchId: '', // Superadmin doesn't belong to a specific church
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
