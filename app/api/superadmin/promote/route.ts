import { NextResponse } from 'next/server'
import { guardApi } from '@/lib/api-guard'

export const dynamic = 'force-dynamic'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { UserService } from '@/lib/services/user-service'

/**
 * Promote Existing User to Superadmin
 * 
 * This endpoint promotes an existing user to SUPER_ADMIN role.
 * Only existing superadmins can promote other users.
 * 
 * Usage:
 * POST /api/superadmin/promote
 * Headers: { Authorization: "Bearer <token>" }
 * Body: {
 *   "userId": "user-id-to-promote"
 * }
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = (session.user as any)?.role
    if (userRole !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden. Only superadmins can promote users.' }, { status: 403 })
    }

    const body = await request.json()
    const { userId, email } = body

    if (!userId && !email) {
      return NextResponse.json(
        { error: 'Either userId or email is required' },
        { status: 400 }
      )
    }

    // Find user
    let user
    if (userId) {
      user = await UserService.findById(userId)
    } else if (email) {
      user = await UserService.findByEmail(email)
    }

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Check if already superadmin
    if (user.role === 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'User is already a superadmin' },
        { status: 400 }
      )
    }

    // Update user role to SUPER_ADMIN
    await UserService.update(user.id, { role: 'SUPER_ADMIN' } as any)

    const updatedUser = await UserService.findById(user.id)

    // Remove password from response
    const { password: _, ...userWithoutPassword } = updatedUser!

    return NextResponse.json({
      message: `User ${user.email} has been promoted to SUPER_ADMIN`,
      user: userWithoutPassword,
    })
  } catch (error: any) {
    console.error('Error promoting user to superadmin:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

