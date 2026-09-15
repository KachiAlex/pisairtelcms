import { prisma } from '@/lib/prisma'
import crypto from 'crypto'

export interface Unit {
  id: string
  churchId: string
  typeId?: string
  /** Legacy alias for typeId (Firestore field name). */
  unitTypeId?: string
  name: string
  description?: string | null
  leaderId?: string | null
  headUserId?: string | null
  branchId?: string | null
  permissions?: { invitePolicy?: string } & Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

export interface UnitMembership {
  id: string
  unitId: string
  userId: string
  churchId?: string | null
  unitTypeId?: string | null
  role: string
  joinedAt: Date
  createdAt: Date
}

export interface UnitInvite {
  id: string
  unitId: string
  churchId?: string | null
  unitTypeId?: string | null
  email?: string | null
  invitedUserId?: string | null
  invitedByUserId?: string | null
  role?: string
  token?: string | null
  expiresAt?: Date | null
  status: string
  respondedAt?: Date | null
  createdAt: Date
}

const mapUnit = (record: any): Unit => ({
  ...(record as Unit),
  unitTypeId: record.typeId,
  headUserId: record.leaderId,
  permissions: (record.permissions as Unit['permissions']) ?? undefined,
})

export class UnitService {
  static async create(data: Omit<Unit, 'id' | 'createdAt' | 'updatedAt'> & { unitTypeId?: string; headUserId?: string }): Promise<Unit> {
    const typeId = data.unitTypeId || data.typeId
    if (!typeId) throw new Error('unitTypeId is required')
    const record = await prisma.unit.create({
      data: {
        churchId: data.churchId,
        typeId,
        name: data.name,
        description: data.description ?? null,
        leaderId: data.headUserId || data.leaderId || null,
        branchId: data.branchId ?? null,
        permissions: (data.permissions as any) ?? undefined,
      },
    })
    return mapUnit(record)
  }

  static async findById(id: string): Promise<Unit | null> {
    const record = await prisma.unit.findUnique({ where: { id } })
    if (!record) return null
    return mapUnit(record)
  }

  static async findByChurch(churchId: string, limit: number = 200): Promise<Unit[]> {
    const records = await prisma.unit.findMany({
      where: { churchId },
      take: limit,
      orderBy: { createdAt: 'desc' },
    })
    return records.map(mapUnit)
  }

  static async findByUnitType(churchId: string, unitTypeId: string, limit: number = 200): Promise<Unit[]> {
    const records = await prisma.unit.findMany({
      where: { churchId, typeId: unitTypeId },
      take: limit,
      orderBy: { createdAt: 'desc' },
    })
    return records.map(mapUnit)
  }

  static async update(
    id: string,
    patch: Partial<Pick<Unit, 'name' | 'description' | 'leaderId' | 'branchId' | 'permissions'>> & { headUserId?: string }
  ): Promise<Unit> {
    const data: any = {
      name: patch.name,
      description: patch.description,
      leaderId: patch.headUserId || patch.leaderId,
      branchId: patch.branchId,
    }
    if (patch.permissions !== undefined) data.permissions = patch.permissions
    const record = await prisma.unit.update({
      where: { id },
      data,
    })
    return mapUnit(record)
  }
}

export class UnitMembershipService {
  static async findByUserAndUnit(userId: string, unitId: string): Promise<UnitMembership | null> {
    const record = await prisma.unitMembership.findUnique({
      where: { unitId_userId: { unitId, userId } },
    })
    return record as unknown as UnitMembership | null
  }

  static async findByUserAndUnitType(userId: string, unitTypeId: string, limit: number = 50): Promise<UnitMembership[]> {
    const records = await prisma.unitMembership.findMany({
      where: { userId, unit: { typeId: unitTypeId } },
      take: limit,
      orderBy: { joinedAt: 'desc' },
    })
    return records as unknown as UnitMembership[]
  }

  static async findByUser(userId: string, limit: number = 200): Promise<UnitMembership[]> {
    const records = await prisma.unitMembership.findMany({
      where: { userId },
      take: limit,
      orderBy: { joinedAt: 'desc' },
    })
    return records as unknown as UnitMembership[]
  }

  static async findByUnit(unitId: string, limit: number = 200): Promise<UnitMembership[]> {
    const records = await prisma.unitMembership.findMany({
      where: { unitId },
      take: limit,
      orderBy: { joinedAt: 'desc' },
    })
    return records as unknown as UnitMembership[]
  }

  static async create(data: Omit<UnitMembership, 'id' | 'joinedAt' | 'createdAt'>): Promise<UnitMembership> {
    const record = await prisma.unitMembership.create({
      data: {
        unitId: data.unitId,
        userId: data.userId,
        churchId: data.churchId ?? null,
        unitTypeId: data.unitTypeId ?? null,
        role: (data.role as any) || 'MEMBER',
      },
    })
    return record as unknown as UnitMembership
  }

  static async findById(id: string): Promise<UnitMembership | null> {
    const record = await prisma.unitMembership.findUnique({ where: { id } })
    if (!record) return null
    return record as unknown as UnitMembership
  }

  static async updateRole(id: string, role: string): Promise<UnitMembership> {
    const record = await prisma.unitMembership.update({
      where: { id },
      data: { role },
    })
    return record as unknown as UnitMembership
  }

  static async delete(id: string): Promise<void> {
    await prisma.unitMembership.delete({ where: { id } })
  }
}

export class UnitInviteService {
  static async findById(id: string): Promise<UnitInvite | null> {
    const record = await prisma.unitInvite.findUnique({ where: { id } })
    if (!record) return null
    return record as unknown as UnitInvite
  }

  static async findByToken(token: string): Promise<UnitInvite | null> {
    const record = await prisma.unitInvite.findUnique({ where: { token } })
    if (!record) return null
    return record as unknown as UnitInvite
  }

  static async findPendingByUser(churchId: string, userId: string, limit: number = 100): Promise<UnitInvite[]> {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } })

    const records = await prisma.unitInvite.findMany({
      where: {
        status: 'PENDING',
        churchId,
        OR: [
          { invitedUserId: userId },
          ...(user?.email ? [{ email: user.email }] : []),
        ],
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
    })
    return records as unknown as UnitInvite[]
  }

  static async create(data: Omit<UnitInvite, 'id' | 'createdAt' | 'status' | 'respondedAt'>): Promise<UnitInvite> {
    const record = await prisma.unitInvite.create({
      data: {
        unitId: data.unitId,
        churchId: data.churchId ?? null,
        unitTypeId: data.unitTypeId ?? null,
        email: data.email ?? null,
        invitedUserId: data.invitedUserId ?? null,
        invitedByUserId: data.invitedByUserId ?? null,
        role: (data.role as any) || 'MEMBER',
        token: data.token || crypto.randomBytes(24).toString('hex'),
        expiresAt: data.expiresAt ?? null,
        status: 'PENDING',
      },
    })
    return record as unknown as UnitInvite
  }

  static async updateStatus(id: string, status: string): Promise<UnitInvite> {
    const record = await prisma.unitInvite.update({
      where: { id },
      data: { status, respondedAt: new Date() },
    })
    return record as unknown as UnitInvite
  }
}
