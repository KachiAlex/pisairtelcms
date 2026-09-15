
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { UserService } from '@/lib/services/user-service'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id

    const user = await UserService.findById(userId)

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Remove password from response
    const { password, ...userWithoutPassword } = user

    return NextResponse.json({
      id: userWithoutPassword.id,
      email: userWithoutPassword.email,
      firstName: userWithoutPassword.firstName,
      lastName: userWithoutPassword.lastName,
      phone: userWithoutPassword.phone,
      role: userWithoutPassword.role,
      churchId: (userWithoutPassword as any).churchId || null,
      branchId: (userWithoutPassword as any).branchId || null,
      spiritualMaturity: (userWithoutPassword as any).spiritualMaturity,
      profileImage: userWithoutPassword.profileImage,
      bio: (userWithoutPassword as any).bio,
      spouseId: userWithoutPassword.spouseId || null,
      parentId: userWithoutPassword.parentId || null,
      xp: userWithoutPassword.xp || 0,
      level: userWithoutPassword.level || 1,
      createdAt: userWithoutPassword.createdAt,
    })
  } catch (error) {
    console.error('Error fetching user:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/users/me
 * Update current user's branch preference
 */
export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const body = await request.json()
    const { branchId } = body

    // Update user's branch preference
    await UserService.update(userId, {
      branchId: branchId || null,
    })

    const updatedUser = await UserService.findById(userId)
    if (!updatedUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Remove password from response
    const { password, ...userWithoutPassword } = updatedUser

    return NextResponse.json({
      id: userWithoutPassword.id,
      email: userWithoutPassword.email,
      firstName: userWithoutPassword.firstName,
      lastName: userWithoutPassword.lastName,
      phone: userWithoutPassword.phone,
      role: userWithoutPassword.role,
      churchId: (userWithoutPassword as any).churchId || null,
      branchId: (userWithoutPassword as any).branchId || null,
      spiritualMaturity: (userWithoutPassword as any).spiritualMaturity,
      profileImage: userWithoutPassword.profileImage,
      bio: (userWithoutPassword as any).bio,
      xp: userWithoutPassword.xp || 0,
      level: userWithoutPassword.level || 1,
      createdAt: userWithoutPassword.createdAt,
    })
  } catch (error) {
    console.error('Error updating user:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
