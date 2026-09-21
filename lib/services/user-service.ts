import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import type { PayFrequencyOption } from './staff-level-service'

export interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  password: string
  role: string
  churchId: string | null
  branchId?: string
  churchRoleId?: string
  churchRoleName?: string
  designationId?: string
  designationName?: string
  profileImage?: string
  phone?: string
  dateOfBirth?: Date | string
  address?: string
  city?: string
  state?: string
  zipCode?: string
  country?: string
  bio?: string
  spiritualMaturity?: string
  employmentStatus?: string
  isStaff?: boolean
  isSuspended?: boolean
  staffLevelId?: string
  staffLevelName?: string
  customWage?: {
    amount: number
    currency: string
    payFrequency: PayFrequencyOption
  }
  parentId?: string | null
  spouseId?: string | null
  xp?: number
  level?: number
  lastLoginAt?: Date
  createdAt: Date
  updatedAt: Date
}

const PRISMA_FIELDS = new Set([
  'id', 'createdAt', 'updatedAt', 'password', 'email', 'firstName', 'lastName',
  'phone', 'profileImage', 'bio', 'dateOfBirth', 'address', 'city', 'state',
  'zipCode', 'country', 'role', 'spiritualMaturity', 'churchId', 'branchId',
  'parentId', 'spouseId',
  'isStaff', 'staffLevelId', 'staffLevelName', 'designationId', 'designationName',
  'employmentStatus', 'isSuspended', 'customWage',
  'xp', 'level', 'lastLoginAt', 'firestoreData'
])

export class UserService {
  /**
   * Merge a Prisma user record with any legacy firestoreData
   */
  private static fromPrisma(record: any): User {
    const { firestoreData, ...rest } = record
    const legacy = (firestoreData as Record<string, unknown>) || {}
    return { ...legacy, ...rest } as unknown as User
  }

  /**
   * Build firestoreData object from input fields that are not Prisma columns
   */
  private static buildLegacyData(data: any, extra: any = {}): any {
    const result: any = { ...extra }
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && !PRISMA_FIELDS.has(key) && !['id', 'createdAt', 'updatedAt', 'password'].includes(key)) {
        result[key] = value
      }
    }
    if (Object.keys(result).length === 0) return undefined
    return result
  }

  /**
   * Find user by ID
   */
  static async findById(id: string): Promise<User | null> {
    const record = await prisma.user.findUnique({ where: { id } })
    if (!record) return null
    return this.fromPrisma(record)
  }

  /**
   * Find user by email within a specific church (tenant)
   */
  static async findByEmailInChurch(email: string, churchId: string): Promise<User | null> {
    const record = await prisma.user.findFirst({
      where: { email: email.trim().toLowerCase(), churchId },
    })
    if (!record) return null
    return this.fromPrisma(record)
  }

  /**
   * Find user by email
   */
  static async findByEmail(email: string): Promise<User | null> {
    const record = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } })
    if (!record) return null
    return this.fromPrisma(record)
  }

  /**
   * Create user
   */
  static async create(data: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    const password = data.password ? await bcrypt.hash(data.password, 10) : ''
    const record = await prisma.user.create({
      data: {
        email: data.email.trim().toLowerCase(),
        password,
        firstName: data.firstName || 'Unknown',
        lastName: data.lastName || 'User',
        phone: data.phone,
        profileImage: data.profileImage,
        bio: data.bio,
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
        address: data.address,
        city: data.city,
        state: data.state,
        zipCode: data.zipCode,
        country: data.country,
        role: data.role as any,
        spiritualMaturity: data.spiritualMaturity as any,
        churchId: data.churchId,
        branchId: data.branchId,
        parentId: data.parentId || null,
        spouseId: data.spouseId || null,
        isStaff: data.isStaff ?? false,
        staffLevelId: data.staffLevelId || null,
        staffLevelName: data.staffLevelName || null,
        designationId: data.designationId || null,
        designationName: data.designationName || null,
        employmentStatus: data.employmentStatus || null,
        isSuspended: data.isSuspended ?? false,
        customWage: data.customWage ?? undefined,
        xp: data.xp || 0,
        level: data.level || 1,
        firestoreData: this.buildLegacyData(data),
      },
    })
    return this.fromPrisma(record)
  }

  /**
   * Update user
   */
  static async update(id: string, data: Partial<Omit<User, 'id' | 'createdAt' | 'updatedAt'>>): Promise<User> {
    const current = await prisma.user.findUnique({ where: { id }, select: { firestoreData: true } })
    const currentLegacy = ((current?.firestoreData as Record<string, unknown>) || {})

    const updateData: any = {
      updatedAt: new Date(),
    }

    if (data.email !== undefined) updateData.email = data.email.trim().toLowerCase()
    if (data.firstName !== undefined) updateData.firstName = data.firstName
    if (data.lastName !== undefined) updateData.lastName = data.lastName
    if (data.phone !== undefined) updateData.phone = data.phone
    if (data.profileImage !== undefined) updateData.profileImage = data.profileImage
    if (data.bio !== undefined) updateData.bio = data.bio
    if (data.dateOfBirth !== undefined) updateData.dateOfBirth = data.dateOfBirth ? new Date(data.dateOfBirth) : undefined
    if (data.address !== undefined) updateData.address = data.address
    if (data.city !== undefined) updateData.city = data.city
    if (data.state !== undefined) updateData.state = data.state
    if (data.zipCode !== undefined) updateData.zipCode = data.zipCode
    if (data.country !== undefined) updateData.country = data.country
    if (data.role !== undefined) updateData.role = data.role as any
    if (data.spiritualMaturity !== undefined) updateData.spiritualMaturity = data.spiritualMaturity as any
    if (data.churchId !== undefined) updateData.churchId = data.churchId
    if (data.branchId !== undefined) updateData.branchId = data.branchId
    if (data.parentId !== undefined) updateData.parentId = data.parentId || null
    if (data.spouseId !== undefined) updateData.spouseId = data.spouseId || null
    if (data.isStaff !== undefined) updateData.isStaff = data.isStaff
    if (data.staffLevelId !== undefined) updateData.staffLevelId = data.staffLevelId || null
    if (data.staffLevelName !== undefined) updateData.staffLevelName = data.staffLevelName || null
    if (data.designationId !== undefined) updateData.designationId = data.designationId || null
    if (data.designationName !== undefined) updateData.designationName = data.designationName || null
    if (data.employmentStatus !== undefined) updateData.employmentStatus = data.employmentStatus || null
    if (data.isSuspended !== undefined) updateData.isSuspended = data.isSuspended
    if (data.customWage !== undefined) updateData.customWage = data.customWage
    if (data.xp !== undefined) updateData.xp = data.xp
    if (data.level !== undefined) updateData.level = data.level
    if (data.lastLoginAt !== undefined) updateData.lastLoginAt = data.lastLoginAt

    if (data.password) {
      updateData.password = await bcrypt.hash(data.password, 10)
    }

    const newLegacy = this.buildLegacyData(data)
    if (newLegacy !== undefined || Object.keys(currentLegacy).length > 0) {
      updateData.firestoreData = { ...currentLegacy, ...newLegacy }
    }

    const record = await prisma.user.update({ where: { id }, data: updateData })
    return this.fromPrisma(record)
  }

  /**
   * Delete user
   */
  static async delete(id: string): Promise<void> {
    await prisma.user.delete({ where: { id } })
  }

  /**
   * Delete user and clean up all associated records in PostgreSQL
   * (salaries, payroll records, check-ins, badges, messages, etc.)
   */
  static async deleteWithRelations(id: string): Promise<void> {
    // Records with required FK references that must be removed first
    const deleteTargets: Array<[string, string]> = [
      ['branchAdmin', 'userId'],
      ['departmentMembership', 'userId'],
      ['groupMembership', 'userId'],
      ['unitMembership', 'userId'],
      ['readingPlanProgress', 'userId'],
      ['aICoachingSession', 'userId'],
      ['readingCoachSession', 'userId'],
      ['readingCoachNudge', 'userId'],
      ['followUp', 'userId'],
      ['post', 'userId'],
      ['postLike', 'userId'],
      ['comment', 'userId'],
      ['testimony', 'userId'],
      ['prayerRequest', 'userId'],
      ['prayerInteraction', 'userId'],
      ['sermonView', 'userId'],
      ['sermonDownload', 'userId'],
      ['giving', 'userId'],
      ['eventRegistration', 'userId'],
      ['eventAttendance', 'userId'],
      ['checkIn', 'userId'],
      ['childrenCheckIn', 'childId'],
      ['childrenCheckIn', 'parentId'],
      ['message', 'senderId'],
      ['message', 'receiverId'],
      ['groupMessage', 'userId'],
      ['userBadge', 'userId'],
      ['volunteerShift', 'userId'],
      ['task', 'userId'],
      ['userSalary', 'userId'],
      ['payrollRecord', 'userId'],
      ['mentorAssignment', 'mentorId'],
      ['mentorAssignment', 'menteeId'],
      ['invitationForm', 'createdBy'],
      ['invitationLink', 'createdBy'],
      ['readingPlanNewsletter', 'createdBy'],
      ['survey', 'createdBy'],
      ['livestream', 'createdBy'],
      ['meeting', 'createdBy'],
      ['attendanceSession', 'createdBy'],
      ['accountingIncome', 'createdBy'],
      ['accountingExpense', 'createdBy'],
    ]

    // Optional FK references that should be nulled rather than deleted
    const nullifyTargets: Array<[string, string]> = [
      ['unit', 'leaderId'],
      ['registrationSubmission', 'reviewedBy'],
      ['registrationSubmission', 'createdUserId'],
      ['attendanceRecord', 'userId'],
      ['surveyResponse', 'userId'],
    ]

    for (const [model, field] of deleteTargets) {
      try {
        await (prisma as any)[model].deleteMany({ where: { [field]: id } })
      } catch (error) {
        console.error(`Failed to clean up ${model}.${field} for user ${id}:`, error)
      }
    }

    for (const [model, field] of nullifyTargets) {
      try {
        await (prisma as any)[model].updateMany({ where: { [field]: id }, data: { [field]: null } })
      } catch (error) {
        console.error(`Failed to nullify ${model}.${field} for user ${id}:`, error)
      }
    }

    // Unlink family relationships so the delete doesn't violate FK constraints
    try {
      await prisma.user.updateMany({ where: { parentId: id }, data: { parentId: null } })
      await prisma.user.updateMany({ where: { spouseId: id }, data: { spouseId: null } })
    } catch (error) {
      console.error(`Failed to unlink family relations for user ${id}:`, error)
    }

    await this.delete(id)
  }

  /**
   * Find users by church
   */
  static async findByChurch(churchId: string, limit?: number): Promise<User[]> {
    const records = await prisma.user.findMany({
      where: { churchId },
      take: limit || undefined,
      orderBy: { createdAt: 'desc' },
    })
    return records.map((record) => this.fromPrisma(record))
  }

  /**
   * Query users by church with database-level filtering and pagination.
   * JSON-legacy fields (isStaff, designationId) are filtered in memory;
   * when they are active the full matching set is fetched for a correct total.
   */
  static async queryByChurch(
    churchId: string,
    options: {
      branchId?: string | null
      role?: string | null
      roles?: string[] | null
      search?: string | null
      isStaff?: boolean | null
      designationId?: string | null
      parentId?: string | null
      page?: number
      limit?: number
    } = {}
  ): Promise<{ users: User[]; total: number }> {
    const where: any = { churchId }
    const and: any[] = []

    if (options.branchId) {
      where.branchId = options.branchId
    }

    if (options.roles && options.roles.length > 0) {
      where.role = { in: options.roles }
    } else if (options.role) {
      where.role = options.role
    }

    if (options.parentId) {
      // parentId lives in a real column for new writes; legacy rows store it in firestoreData
      and.push({
        OR: [
          { parentId: options.parentId },
          { firestoreData: { path: ['parentId'], equals: options.parentId } },
        ],
      })
    }

    if (options.isStaff !== undefined && options.isStaff !== null) {
      and.push({
        OR: [
          { isStaff: options.isStaff },
          { firestoreData: { path: ['isStaff'], equals: options.isStaff } },
        ],
      })
    }

    if (options.designationId) {
      and.push({
        OR: [
          { designationId: options.designationId },
          { firestoreData: { path: ['designationId'], equals: options.designationId } },
        ],
      })
    }

    const search = options.search?.trim()
    if (search) {
      and.push({
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      })
    }

    if (and.length > 0) {
      where.AND = and
    }

    const page = options.page && options.page > 0 ? options.page : 1
    const limit = options.limit && options.limit > 0 ? options.limit : undefined

    const [records, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: limit ? (page - 1) * limit : undefined,
        take: limit,
      }),
      prisma.user.count({ where }),
    ])
    return { users: records.map((record) => this.fromPrisma(record)), total }
  }

  /**
   * Search users
   */
  static async search(churchId: string, searchTerm: string): Promise<User[]> {
    const search = searchTerm.trim()
    if (!search) return this.findByChurch(churchId)
    const { users } = await this.queryByChurch(churchId, { search })
    return users
  }

  /**
   * Update last login
   */
  static async updateLastLogin(id: string): Promise<void> {
    await prisma.user.update({
      where: { id },
      data: { lastLoginAt: new Date() },
    })
  }

  /**
   * Add XP
   */
  static async addXP(id: string, amount: number): Promise<void> {
    const user = await this.findById(id)
    if (!user) return

    const newXP = (user.xp || 0) + amount
    const newLevel = Math.floor(Math.sqrt(newXP / 100)) + 1

    await prisma.user.update({
      where: { id },
      data: { xp: newXP, level: newLevel, updatedAt: new Date() },
    })
  }
}

