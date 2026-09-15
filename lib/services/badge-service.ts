import { prisma } from '@/lib/prisma'

export interface Badge {
  id: string
  name: string
  description?: string
  type: string
  icon?: string
  xpReward: number
  createdAt: Date
  updatedAt: Date
}

export interface UserBadge {
  id: string
  userId: string
  badgeId: string
  earnedAt: Date
}

const BADGE_TYPES = [
  'PRAYER_STREAK',
  'READING_PLAN',
  'GIVING',
  'EVENT_ATTENDANCE',
  'SERVING',
  'EVANGELISM',
  'OTHER',
] as const

function toBadgeType(value: unknown): (typeof BADGE_TYPES)[number] {
  const v = String(value || '').toUpperCase()
  return (BADGE_TYPES as readonly string[]).includes(v)
    ? (v as (typeof BADGE_TYPES)[number])
    : 'OTHER'
}

function fromPrismaBadge(record: any): Badge {
  return {
    id: record.id,
    name: record.name,
    description: record.description ?? undefined,
    type: record.type,
    icon: record.icon ?? undefined,
    xpReward: record.xpReward ?? 0,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  }
}

export class BadgeService {
  static async findById(id: string): Promise<Badge | null> {
    const record = await prisma.badge.findUnique({ where: { id } })
    return record ? fromPrismaBadge(record) : null
  }

  static async findAll(type?: string): Promise<Badge[]> {
    const records = await prisma.badge.findMany({
      where: type ? { type: toBadgeType(type) } : undefined,
      orderBy: { createdAt: 'desc' },
    })
    return records.map(fromPrismaBadge)
  }

  static async create(data: Omit<Badge, 'id' | 'createdAt' | 'updatedAt'>): Promise<Badge> {
    const record = await prisma.badge.create({
      data: {
        name: data.name,
        description: data.description ?? null,
        type: toBadgeType(data.type),
        icon: data.icon ?? null,
        xpReward: data.xpReward || 0,
      },
    })
    return fromPrismaBadge(record)
  }
}

export class UserBadgeService {
  static async findByUser(userId: string): Promise<UserBadge[]> {
    const records = await prisma.userBadge.findMany({
      where: { userId },
      orderBy: { earnedAt: 'desc' },
    })
    return records.map((r) => ({
      id: r.id,
      userId: r.userId,
      badgeId: r.badgeId,
      earnedAt: r.earnedAt,
    }))
  }

  static async findByUserAndBadge(userId: string, badgeId: string): Promise<UserBadge | null> {
    const record = await prisma.userBadge.findUnique({
      where: { userId_badgeId: { userId, badgeId } },
    })
    return record
      ? { id: record.id, userId: record.userId, badgeId: record.badgeId, earnedAt: record.earnedAt }
      : null
  }

  static async create(userId: string, badgeId: string): Promise<UserBadge> {
    const record = await prisma.userBadge.upsert({
      where: { userId_badgeId: { userId, badgeId } },
      update: {},
      create: { userId, badgeId },
    })
    return {
      id: record.id,
      userId: record.userId,
      badgeId: record.badgeId,
      earnedAt: record.earnedAt,
    }
  }
}
