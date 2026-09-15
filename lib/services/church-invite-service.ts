import { prisma } from '@/lib/prisma'
import crypto from 'crypto'
import { UserRole } from '@/types'

export type ChurchInviteStatus = 'ACTIVE' | 'REVOKED' | 'USED'

export type ChurchInvitePurpose = 'MEMBER_SIGNUP' | 'BRANCH_ADMIN_SIGNUP'

export interface ChurchInvite {
  id: string
  churchId: string
  createdByUserId: string
  purpose: ChurchInvitePurpose
  tokenHash: string
  status: ChurchInviteStatus
  branchId?: string | null
  targetRole?: UserRole
  expiresAt?: Date
  createdAt: Date
  updatedAt: Date
  revokedAt?: Date
  usedAt?: Date
  usedByUserId?: string
}

export function hashInviteToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export function generateInviteToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

export class ChurchInviteService {
  static async findById(id: string): Promise<ChurchInvite | null> {
    const record = await prisma.churchInvite.findUnique({ where: { id } })
    return record as ChurchInvite | null
  }

  static async findActiveByChurch(
    churchId: string,
    purpose: ChurchInvitePurpose,
    options: { branchId?: string | null } = {},
  ): Promise<ChurchInvite | null> {
    const record = await prisma.churchInvite.findFirst({
      where: {
        churchId,
        purpose,
        status: 'ACTIVE',
        ...(options.branchId !== undefined ? { branchId: options.branchId } : {}),
      },
    })
    return record as ChurchInvite | null
  }

  static async findByTokenHash(tokenHash: string): Promise<ChurchInvite | null> {
    const record = await prisma.churchInvite.findFirst({ where: { tokenHash } })
    return record as ChurchInvite | null
  }

  static async createActive(params: {
    churchId: string
    createdByUserId: string
    purpose: ChurchInvitePurpose
    branchId?: string | null
    expiresAt?: Date
    targetRole?: UserRole
  }): Promise<{ invite: ChurchInvite; token: string }> {
    const token = generateInviteToken()
    const tokenHash = hashInviteToken(token)

    const invite = await prisma.churchInvite.create({
      data: {
        churchId: params.churchId,
        createdByUserId: params.createdByUserId,
        purpose: params.purpose,
        tokenHash,
        status: 'ACTIVE',
        branchId: params.branchId ?? null,
        targetRole: params.targetRole ?? null,
        expiresAt: params.expiresAt ?? null,
      },
    })

    return { invite: invite as ChurchInvite, token }
  }

  static async revoke(id: string): Promise<ChurchInvite> {
    const record = await prisma.churchInvite.update({
      where: { id },
      data: { status: 'REVOKED', revokedAt: new Date() },
    })
    return record as ChurchInvite
  }

  static async markUsed(id: string, usedByUserId: string): Promise<ChurchInvite> {
    const record = await prisma.churchInvite.update({
      where: { id },
      data: { status: 'USED', usedByUserId, usedAt: new Date() },
    })
    return record as ChurchInvite
  }
}
