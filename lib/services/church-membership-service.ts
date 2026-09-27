import { prisma } from '@/lib/prisma'
import type { UserRole } from '@/types'

export interface ChurchMembership {
  id: string
  userId: string
  churchId: string
  branchId: string | null
  role: UserRole
  createdAt: Date
  updatedAt: Date
}

/**
 * Multi-tenant membership: a user may belong to many churches.
 * `User.churchId` remains the ACTIVE church pointer; this table is the
 * complete set of churches the user belongs to, with per-church role/branch.
 */
export class ChurchMembershipService {
  static async findByUserAndChurch(userId: string, churchId: string): Promise<ChurchMembership | null> {
    const record = await prisma.churchMembership.findUnique({
      where: { userId_churchId: { userId, churchId } },
    })
    return (record as ChurchMembership | null) ?? null
  }

  static async findByUser(userId: string): Promise<Array<ChurchMembership & { church: any }>> {
    const records = await prisma.churchMembership.findMany({
      where: { userId },
      include: { church: { select: { id: true, name: true, slug: true, logo: true } } },
      orderBy: { createdAt: 'asc' },
    })
    return records as any
  }

  static async isMember(userId: string, churchId: string): Promise<boolean> {
    const count = await prisma.churchMembership.count({
      where: { userId, churchId },
    })
    return count > 0
  }

  /** Idempotent — creates or updates the per-church role/branch. */
  static async attach(params: {
    userId: string
    churchId: string
    role?: UserRole
    branchId?: string | null
  }): Promise<ChurchMembership> {
    const { userId, churchId, role, branchId } = params
    const record = await prisma.churchMembership.upsert({
      where: { userId_churchId: { userId, churchId } },
      create: {
        userId,
        churchId,
        role: (role ?? 'MEMBER') as any,
        branchId: branchId ?? null,
      },
      update: {
        ...(role !== undefined ? { role: role as any } : {}),
        ...(branchId !== undefined ? { branchId } : {}),
      },
    })
    return record as ChurchMembership
  }

  static async detach(userId: string, churchId: string): Promise<void> {
    await prisma.churchMembership.deleteMany({ where: { userId, churchId } })
  }
}
