import { prisma } from '@/lib/prisma'
import type { BranchLevel } from '@/lib/services/branch-hierarchy'
export type { BranchLevel } from '@/lib/services/branch-hierarchy'

const DEFAULT_BRANCH_LEVEL: BranchLevel = 'BRANCH'

export interface Branch {
  id: string
  name: string
  slug: string
  churchId: string
  level: BranchLevel
  levelLabel?: string
  parentBranchId?: string | null
  address?: string
  city?: string
  state?: string
  zipCode?: string
  country?: string
  phone?: string
  email?: string
  description?: string
  adminId?: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface BranchAdmin {
  id: string
  branchId: string
  userId: string
  canManageMembers: boolean
  canManageEvents: boolean
  canManageGroups: boolean
  canManageGiving: boolean
  canManageSermons: boolean
  assignedAt: Date
  assignedBy?: string
}

const fromPrisma = (record: any): Branch => {
  const { firestoreData, ...rest } = record
  const legacy = (firestoreData as Record<string, unknown>) || {}
  return { ...legacy, ...rest } as Branch
}

const fromPrismaAdmin = (record: any): BranchAdmin => {
  const { firestoreData, ...rest } = record
  const legacy = (firestoreData as Record<string, unknown>) || {}
  return { ...legacy, ...rest } as BranchAdmin
}

export class BranchService {
  static async findById(id: string): Promise<Branch | null> {
    const record = await prisma.branch.findUnique({ where: { id } })
    if (!record) return null
    return fromPrisma(record)
  }

  static async findBySlug(churchId: string, slug: string): Promise<Branch | null> {
    const record = await prisma.branch.findFirst({
      where: { churchId, slug },
    })
    if (!record) return null
    return fromPrisma(record)
  }

  static async findByChurch(
    churchId: string,
    options?: {
      includeInactive?: boolean
      parentBranchId?: string | null
      level?: BranchLevel
    }
  ): Promise<Branch[]> {
    const includeInactive = options?.includeInactive === true

    const records = await prisma.branch.findMany({
      where: {
        churchId,
        isActive: includeInactive ? undefined : true,
        parentBranchId:
          options?.parentBranchId === undefined
            ? undefined
            : options.parentBranchId,
        level: options?.level as any,
      },
      orderBy: { createdAt: 'desc' },
    })

    return records.map(fromPrisma)
  }

  static async create(data: Omit<Branch, 'id' | 'createdAt' | 'updatedAt'>): Promise<Branch> {
    const { id, createdAt, updatedAt, ...rest } = data as any
    const record = await prisma.branch.create({
      data: {
        ...rest,
        level: (data.level ?? DEFAULT_BRANCH_LEVEL) as any,
        parentBranchId: data.parentBranchId ?? undefined,
        isActive: data.isActive ?? true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    })
    return fromPrisma(record)
  }

  static async update(id: string, data: Partial<Omit<Branch, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Branch> {
    const record = await prisma.branch.update({
      where: { id },
      data: {
        ...data,
        level: data.level as any,
        updatedAt: new Date(),
      },
    })
    return fromPrisma(record)
  }

  static async delete(id: string): Promise<void> {
    await prisma.branch.update({
      where: { id },
      data: { isActive: false, updatedAt: new Date() },
    })
  }
}

export class BranchAdminService {
  static async assignAdmin(data: Omit<BranchAdmin, 'id' | 'assignedAt'>): Promise<BranchAdmin> {
    const existing = await this.findByBranchAndUser(data.branchId, data.userId)
    if (existing) {
      return this.update(existing.id, data)
    }

    const record = await prisma.branchAdmin.create({
      data: {
        ...data,
        assignedAt: new Date(),
      },
    })
    return fromPrismaAdmin(record)
  }

  static async findByBranchAndUser(branchId: string, userId: string): Promise<BranchAdmin | null> {
    const record = await prisma.branchAdmin.findFirst({
      where: { branchId, userId },
    })
    if (!record) return null
    return fromPrismaAdmin(record)
  }

  static async findByBranch(branchId: string): Promise<BranchAdmin[]> {
    const records = await prisma.branchAdmin.findMany({ where: { branchId } })
    return records.map(fromPrismaAdmin)
  }

  static async findByBranchIds(
    branchIds: string[],
  ): Promise<Record<string, BranchAdmin[]>> {
    const result: Record<string, BranchAdmin[]> = {}
    const uniqueIds = Array.from(new Set(branchIds.filter((id): id is string => typeof id === 'string' && id.length > 0)))
    if (uniqueIds.length === 0) {
      return result
    }

    const records = await prisma.branchAdmin.findMany({
      where: { branchId: { in: uniqueIds } },
    })

    for (const r of records) {
      if (!result[r.branchId]) {
        result[r.branchId] = []
      }
      result[r.branchId].push(fromPrismaAdmin(r))
    }

    return result
  }

  static async findByUser(userId: string): Promise<BranchAdmin[]> {
    const records = await prisma.branchAdmin.findMany({ where: { userId } })
    return records.map(fromPrismaAdmin)
  }

  static async update(id: string, data: Partial<Omit<BranchAdmin, 'id' | 'assignedAt'>>): Promise<BranchAdmin> {
    const record = await prisma.branchAdmin.update({
      where: { id },
      data: data as any,
    })
    return fromPrismaAdmin(record)
  }

  static async removeAdmin(branchId: string, userId: string): Promise<void> {
    const admin = await this.findByBranchAndUser(branchId, userId)
    if (admin) {
      await prisma.branchAdmin.delete({ where: { id: admin.id } })
    }
  }
}

export function generateBranchSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

