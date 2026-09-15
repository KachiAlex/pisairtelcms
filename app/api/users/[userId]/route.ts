
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth-options'
import { UserService } from '@/lib/services/user-service'
import { getCurrentChurch } from '@/lib/church-context'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { DesignationService } from '@/lib/services/designation-service'
import { canManageUser } from '@/lib/permissions'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const currentUserId = (session.user as any).id
    const userRole = (session.user as any).role

    // Users can view their own profile, privileged roles can view others
    if (userId !== currentUserId && !['ADMIN', 'SUPER_ADMIN', 'PASTOR'].includes(userRole)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const user = await UserService.findById(userId)

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Tenant isolation: non-self lookups must stay within the actor's church
    if (userId !== currentUserId && userRole !== 'SUPER_ADMIN') {
      const church = await getCurrentChurch(currentUserId)
      if (!church || user.churchId !== church.id) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        )
      }
    }

    // Get counts
    const [departmentsCount, groupsCount, badgesCount, prayerRequestsCount, sermonsWatchedCount, givingCount, eventsAttendedCount] = await Promise.all([
      prisma.departmentMembership.count({ where: { userId } }),
      prisma.groupMembership.count({ where: { userId } }),
      prisma.userBadge.count({ where: { userId } }),
      prisma.prayerRequest.count({ where: { userId } }),
      prisma.sermonView.count({ where: { userId } }),
      prisma.giving.count({ where: { userId } }),
      prisma.eventAttendance.count({ where: { userId } }),
    ])

    // Remove password
    const { password, ...userWithoutPassword } = user

    return NextResponse.json({
      ...userWithoutPassword,
      _count: {
        departments: departmentsCount,
        groups: groupsCount,
        badges: badgesCount,
        prayerRequests: prayerRequestsCount,
        sermonsWatched: sermonsWatchedCount,
        giving: givingCount,
        eventsAttended: eventsAttendedCount,
      },
    })
  } catch (error) {
    console.error('Error fetching user:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const currentUserId = (session.user as any).id
    const userRole = (session.user as any).role

    // Users can edit their own profile (except role), privileged roles can edit others
    if (userId !== currentUserId && !['ADMIN', 'SUPER_ADMIN', 'PASTOR'].includes(userRole)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    // Tenant isolation: non-self updates must stay within the actor's church.
    // This covers every field path below (basic fields, role, suspension, etc.)
    if (userId !== currentUserId && userRole !== 'SUPER_ADMIN') {
      const scopeChurch = await getCurrentChurch(currentUserId)
      const scopeTarget = await UserService.findById(userId)
      if (!scopeChurch || !scopeTarget || scopeTarget.churchId !== scopeChurch.id) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        )
      }
    }

    const body = await request.json()
    const {
      firstName,
      lastName,
      phone,
      bio,
      dateOfBirth,
      address,
      city,
      state,
      zipCode,
      country,
      spiritualMaturity,
      role,
      profileImage,
      password,
      isStaff,
      staffLevelId,
      customWage,
      customWageAmount,
      customWageCurrency,
      customWagePayFrequency,
      designationId,
      isSuspended,
      employmentStatus,
      parentId,
      spouseId,
    } = body

    const updateData: any = {}
    if (firstName !== undefined) updateData.firstName = firstName
    if (lastName !== undefined) updateData.lastName = lastName
    if (phone !== undefined) updateData.phone = phone
    if (bio !== undefined) updateData.bio = bio
    if (dateOfBirth !== undefined) updateData.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null
    if (address !== undefined) updateData.address = address
    if (city !== undefined) updateData.city = city
    if (state !== undefined) updateData.state = state
    if (zipCode !== undefined) updateData.zipCode = zipCode
    if (country !== undefined) updateData.country = country
    if (spiritualMaturity !== undefined) updateData.spiritualMaturity = spiritualMaturity
    if (profileImage !== undefined) updateData.profileImage = profileImage
    if (employmentStatus !== undefined) updateData.employmentStatus = employmentStatus

    // Only privileged users can change roles, and must respect hierarchy
    const privilegedRoles = ['ADMIN', 'SUPER_ADMIN', 'PASTOR', 'BRANCH_ADMIN']

    if (role !== undefined && privilegedRoles.includes(userRole)) {
      // Validate that the current user can assign this role
      if (!canManageUser(userRole as any, role as any)) {
        return NextResponse.json(
          { error: `You don't have permission to assign the ${role} role` },
          { status: 403 }
        )
      }
      // Also require permission over the target's current role (prevents
      // e.g. a PASTOR demoting an ADMIN)
      const roleTarget = await UserService.findById(userId)
      if (roleTarget && !canManageUser(userRole as any, roleTarget.role as any)) {
        return NextResponse.json(
          { error: `You don't have permission to manage ${roleTarget.role} users` },
          { status: 403 }
        )
      }
      updateData.role = role
    }

    let cachedChurch: Awaited<ReturnType<typeof getCurrentChurch>> | null = null
    let cachedTargetUser: Awaited<ReturnType<typeof UserService.findById>> | null = null

    const resolveChurchContext = async () => {
      if (!cachedChurch) {
        cachedChurch = await getCurrentChurch(currentUserId)
      }
      if (!cachedChurch) {
        return { error: NextResponse.json({ error: 'No church selected' }, { status: 400 }) }
      }
      if (!cachedTargetUser) {
        cachedTargetUser = await UserService.findById(userId)
      }
      if (!cachedTargetUser || cachedTargetUser.churchId !== cachedChurch.id) {
        return { error: NextResponse.json({ error: 'User not found' }, { status: 404 }) }
      }
      return { church: cachedChurch, targetUser: cachedTargetUser }
    }

    const normalizeCustomWage = () => {
      const payload = customWage || {
        amount: customWageAmount,
        currency: customWageCurrency,
        payFrequency: customWagePayFrequency,
      }
      if (!payload || typeof payload !== 'object') {
        throw new Error('Custom wage must include amount, currency, and pay frequency')
      }
      const amount = typeof payload.amount === 'number' ? payload.amount : Number(payload.amount)
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error('Custom wage amount must be greater than 0')
      }
      const currency = String(payload.currency ?? '').trim().toUpperCase()
      if (!/^[A-Z]{3}$/.test(currency)) {
        throw new Error('Custom wage currency must be a 3-letter ISO code')
      }
      const payFrequency = String(payload.payFrequency ?? '').toLowerCase()
      const validFrequencies = ['weekly', 'biweekly', 'monthly', 'annual']
      if (!validFrequencies.includes(payFrequency)) {
        throw new Error('Custom wage pay frequency is invalid')
      }
      return { amount, currency, payFrequency }
    }

    if (isStaff !== undefined || staffLevelId !== undefined || customWage !== undefined || customWageAmount !== undefined) {
      const context = await resolveChurchContext()
      if ('error' in context) {
        return context.error
      }
      const { church, targetUser } = context

      const staffFlag = isStaff !== undefined ? Boolean(isStaff) : Boolean(targetUser.isStaff)
      updateData.isStaff = staffFlag

      if (staffFlag) {
        const levelId = staffLevelId ?? targetUser.staffLevelId
        if (!levelId) {
          return NextResponse.json({ error: 'Staff level is required for staff members' }, { status: 400 })
        }
        const { StaffLevelService } = await import('@/lib/services/staff-level-service')
        const staffLevel = await StaffLevelService.get(church.id, levelId)
        if (!staffLevel) {
          return NextResponse.json({ error: 'Invalid staff level' }, { status: 400 })
        }
        updateData.staffLevelId = levelId
        updateData.staffLevelName = staffLevel.name

        if (customWage !== undefined || customWageAmount !== undefined) {
          try {
            updateData.customWage = normalizeCustomWage()
          } catch (err: any) {
            return NextResponse.json({ error: err.message }, { status: 400 })
          }
        }
      } else {
        updateData.staffLevelId = null
        updateData.staffLevelName = null
        updateData.customWage = null
      }
    }

    if (designationId !== undefined) {
      if (!privilegedRoles.includes(userRole)) {
        return NextResponse.json({ error: 'Insufficient permissions to assign designations' }, { status: 403 })
      }
      const context = await resolveChurchContext()
      if ('error' in context) {
        return context.error
      }
      if (designationId === null || designationId === '') {
        updateData.designationId = null
        updateData.designationName = null
      } else {
        const designation = await DesignationService.get(designationId)
        if (!designation || designation.churchId !== context.church.id) {
          return NextResponse.json({ error: 'Invalid designation' }, { status: 400 })
        }
        updateData.designationId = designation.id
        updateData.designationName = designation.name
      }
    }

    if (typeof isSuspended === 'boolean') {
      if (!privilegedRoles.includes(userRole)) {
        return NextResponse.json({ error: 'Insufficient permissions to update suspension status' }, { status: 403 })
      }
      const context = await resolveChurchContext()
      if ('error' in context) {
        return context.error
      }
      updateData.isSuspended = isSuspended
    }

    // Family relationships
    let previousSpouseId: string | null = null
    if (parentId !== undefined || spouseId !== undefined) {
      const context = await resolveChurchContext()
      if ('error' in context) {
        return context.error
      }
      previousSpouseId = context.targetUser.spouseId ?? null

      const resolveRelative = async (relativeId: string | null, label: string) => {
        if (relativeId === null || relativeId === '') return null
        if (relativeId === userId) {
          throw new Error(`A user cannot be their own ${label}`)
        }
        const relative = await UserService.findById(relativeId)
        if (!relative || relative.churchId !== context.church.id) {
          throw new Error(`Invalid ${label}: user not found in this church`)
        }
        return relativeId
      }

      if (parentId !== undefined) {
        try {
          const resolvedParentId = await resolveRelative(parentId, 'parent')
          if (resolvedParentId) {
            // Prevent circular ancestry
            let cursor: string | null | undefined = resolvedParentId
            let hops = 0
            while (cursor && hops < 25) {
              if (cursor === userId) {
                return NextResponse.json(
                  { error: 'Cannot set parent: this would create a circular family relationship' },
                  { status: 400 }
                )
              }
              const ancestor: Awaited<ReturnType<typeof UserService.findById>> =
                await UserService.findById(cursor)
              cursor = ancestor?.parentId ?? null
              hops += 1
            }
          }
          updateData.parentId = resolvedParentId
        } catch (err: any) {
          return NextResponse.json({ error: err.message }, { status: 400 })
        }
      }

      if (spouseId !== undefined) {
        try {
          const resolvedSpouseId = await resolveRelative(spouseId, 'spouse')
          if (resolvedSpouseId) {
            const spouse = await UserService.findById(resolvedSpouseId)
            if (spouse?.spouseId && spouse.spouseId !== userId) {
              return NextResponse.json(
                { error: 'That user is already linked to a different spouse' },
                { status: 400 }
              )
            }
          }
          updateData.spouseId = resolvedSpouseId
        } catch (err: any) {
          return NextResponse.json({ error: err.message }, { status: 400 })
        }
      }
    }

    // Handle password change
    if (password) {
      if (userId !== currentUserId) {
        return NextResponse.json(
          { error: 'Cannot change another user\'s password' },
          { status: 403 }
        )
      }
      updateData.password = password
    }

    const updatedUser = await UserService.update(userId, updateData)

    // Maintain reciprocal spouse links (spouseId is unique/1:1)
    if (spouseId !== undefined) {
      const newSpouseId = (updateData.spouseId as string | null) ?? null
      const oldSpouseId = previousSpouseId
      try {
        if (oldSpouseId && oldSpouseId !== newSpouseId) {
          const oldSpouse = await UserService.findById(oldSpouseId)
          if (oldSpouse?.spouseId === userId) {
            await UserService.update(oldSpouseId, { spouseId: null })
          }
        }
        if (newSpouseId) {
          const newSpouse = await UserService.findById(newSpouseId)
          if (newSpouse && newSpouse.spouseId !== userId) {
            await UserService.update(newSpouseId, { spouseId: userId })
          }
        }
      } catch (err) {
        console.error('Failed to maintain reciprocal spouse link:', err)
      }
    }

    // Remove password from response
    const { password: _, ...userWithoutPassword } = updatedUser

    return NextResponse.json({
      id: userWithoutPassword.id,
      email: userWithoutPassword.email,
      firstName: userWithoutPassword.firstName,
      lastName: userWithoutPassword.lastName,
      role: userWithoutPassword.role,
      profileImage: userWithoutPassword.profileImage,
    })
  } catch (error: any) {
    console.error('Error updating user:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const currentUserId = (session.user as any).id
    const userRole = (session.user as any).role

    if (!['ADMIN', 'SUPER_ADMIN', 'PASTOR'].includes(userRole)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    if (userId === currentUserId) {
      return NextResponse.json({ error: 'You cannot delete your own account' }, { status: 400 })
    }

    const church = await getCurrentChurch(currentUserId)
    if (!church) {
      return NextResponse.json({ error: 'No church selected' }, { status: 400 })
    }

    const targetUser = await UserService.findById(userId)
    if (!targetUser || targetUser.churchId !== church.id) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (targetUser.role === 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Cannot delete super admin accounts' }, { status: 403 })
    }

    // Actor must be able to manage the target's role
    if (!canManageUser(userRole as any, targetUser.role as any)) {
      return NextResponse.json(
        { error: `You don't have permission to delete ${targetUser.role} users` },
        { status: 403 }
      )
    }

    await UserService.deleteWithRelations(userId)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting user:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
