
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { UserService } from '@/lib/services/user-service'
import { canManageUser } from '@/lib/permissions'
import { checkUsageLimit } from '@/lib/subscription'
import { guardApi } from '@/lib/api-guard'
import { DesignationService } from '@/lib/services/designation-service'
import { StaffLevelService, STAFF_PAY_FREQUENCIES } from '@/lib/services/staff-level-service'

const isValidCurrency = (value: unknown) => typeof value === 'string' && /^[A-Z]{3}$/.test(value.trim())
const isValidAmount = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value > 0

const normalizeCustomWage = (input: any) => {
  if (!input || typeof input !== 'object') {
    throw new Error('Custom wage must include amount, currency, and payFrequency')
  }
  const amount = typeof input.amount === 'number' ? input.amount : Number(input.amount)
  if (!isValidAmount(amount)) {
    throw new Error('Custom wage amount must be greater than 0')
  }
  const currency = String(input.currency ?? '').trim().toUpperCase()
  if (!isValidCurrency(currency)) {
    throw new Error('Custom wage currency must be a 3-letter ISO code')
  }
  const payFrequency = String(input.payFrequency ?? '').toLowerCase()
  if (!STAFF_PAY_FREQUENCIES.includes(payFrequency as any)) {
    throw new Error('Custom wage pay frequency is invalid')
  }
  return {
    amount,
    currency,
    payFrequency,
  }
}

export async function GET(request: Request) {
  try {
    const guarded = await guardApi({ requireChurch: true })
    if (!guarded.ok) return guarded.response

    const { userId, church, role } = guarded.ctx

    if (role === 'MEMBER') {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const roleFilter = searchParams.get('role')
    const rolesParam = searchParams.get('roles')
    const designationFilter = searchParams.get('designationId')
    const search = searchParams.get('search')
    const branchId = searchParams.get('branchId')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1') || 1)
    const limit = Math.max(1, parseInt(searchParams.get('limit') || '20') || 20)
    const staffFilter = searchParams.get('isStaff')

    const VALID_ROLES = new Set([
      'VISITOR', 'MEMBER', 'VOLUNTEER', 'LEADER', 'BRANCH_ADMIN', 'PASTOR', 'ADMIN', 'SUPER_ADMIN',
    ])
    const roles = rolesParam
      ? rolesParam.split(',').map((r) => r.trim().toUpperCase()).filter((r) => VALID_ROLES.has(r))
      : null
    const normalizedRoleFilter = roleFilter && VALID_ROLES.has(roleFilter.toUpperCase())
      ? roleFilter.toUpperCase()
      : null

    const { users, total } = await UserService.queryByChurch(church.id, {
      branchId,
      role: normalizedRoleFilter,
      roles,
      search,
      designationId: designationFilter,
      isStaff: staffFilter === 'true' ? true : staffFilter === 'false' ? false : null,
      page,
      limit,
    })

    // Remove password from response
    const usersWithoutPassword = users.map(({ password, ...user }) => user)

    return NextResponse.json({
      users: usersWithoutPassword,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const guarded = await guardApi({ requireChurch: true })
    if (!guarded.ok) return guarded.response

    const { session, userId, church } = guarded.ctx
    const userRole = (session.user as any).role

    // Check if user has permission to create users (ADMIN, PASTOR, or SUPER_ADMIN)
    if (!['ADMIN', 'PASTOR', 'SUPER_ADMIN'].includes(userRole)) {
      return NextResponse.json(
        { error: 'Insufficient permissions to create users' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const {
      firstName,
      lastName,
      email,
      phone,
      password,
      role: newUserRole,
      branchId,
      address,
      dateOfBirth,
      employmentStatus,
      designationId,
      isStaff,
      staffLevelId,
      customWage,
    } = body

    // Validate input
    if (!firstName || !lastName || !email || !password) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Check if user already exists within this church
    const existingUser = await UserService.findByEmailInChurch(email, church.id)
    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists in this tenant' },
        { status: 400 }
      )
    }

    // Check usage limits (max users)
    const usageCheck = await checkUsageLimit(church.id, 'maxUsers')
    if (!usageCheck.allowed && usageCheck.limit) {
      return NextResponse.json(
        { 
          error: `User limit reached. Maximum ${usageCheck.limit} users allowed on your plan.`,
          limit: usageCheck.limit,
          current: usageCheck.current
        },
        { status: 403 }
      )
    }

    // Determine role - admins can create any role except SUPER_ADMIN
    const STORABLE_ROLES = ['VISITOR', 'MEMBER', 'VOLUNTEER', 'LEADER', 'PASTOR', 'BRANCH_ADMIN', 'ADMIN']
    let finalRole = newUserRole || 'MEMBER'
    if (finalRole === 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Cannot create super admin users' },
        { status: 403 }
      )
    }
    if (!STORABLE_ROLES.includes(finalRole)) {
      return NextResponse.json(
        { error: `Invalid role: ${finalRole}` },
        { status: 400 }
      )
    }

    // Check if user has permission to create this role
    if (!canManageUser(userRole as any, finalRole as any)) {
      return NextResponse.json(
        { error: `Insufficient permissions to create ${finalRole} users` },
        { status: 403 }
      )
    }

    let designationName: string | undefined
    if (designationId) {
      const designation = await DesignationService.get(designationId)
      if (!designation || designation.churchId !== church.id) {
        return NextResponse.json({ error: 'Invalid designation' }, { status: 400 })
      }
      designationName = designation.name
    }

    let normalizedStaffLevelId: string | null = null
    let normalizedStaffLevelName: string | undefined
    let normalizedCustomWage: { amount: number; currency: string; payFrequency: string } | null = null
    const isStaffFlag = Boolean(isStaff)

    if (isStaffFlag) {
      if (!staffLevelId) {
        return NextResponse.json({ error: 'Staff level is required for staff members' }, { status: 400 })
      }
      const staffLevel = await StaffLevelService.get(church.id, staffLevelId)
      if (!staffLevel) {
        return NextResponse.json({ error: 'Invalid staff level' }, { status: 400 })
      }
      normalizedStaffLevelId = staffLevel.id
      normalizedStaffLevelName = staffLevel.name

      if (customWage) {
        try {
          normalizedCustomWage = normalizeCustomWage(customWage)
        } catch (err: any) {
          return NextResponse.json({ error: err.message }, { status: 400 })
        }
      }
    } else {
      normalizedStaffLevelId = null
      normalizedStaffLevelName = undefined
      normalizedCustomWage = null
    }

    // Create user
    const user = await UserService.create({
      firstName,
      lastName,
      email,
      phone: phone || undefined,
      password,
      role: finalRole,
      churchId: church.id,
      branchId: branchId || undefined,
      address: address || undefined,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
      employmentStatus: employmentStatus || undefined,
      designationId: designationId || undefined,
      designationName,
      isStaff: isStaffFlag,
      staffLevelId: normalizedStaffLevelId || undefined,
      staffLevelName: normalizedStaffLevelName,
      customWage: normalizedCustomWage,
    } as any)

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user

    return NextResponse.json(
      { 
        user: userWithoutPassword, 
        message: 'User created successfully' 
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error creating user:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
