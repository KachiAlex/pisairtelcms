import { prisma } from '@/lib/prisma'

export type UnitTypeJoinPolicy = 'INVITE_ONLY' | 'OPEN' | 'REQUEST' | string
export type UnitTypeCreationPolicy = 'ADMIN_ONLY' | 'LEADERS' | 'ANYONE' | string

export interface UnitType {
  id: string
  churchId: string
  name: string
  description?: string | null
  icon?: string | null
  color?: string | null
  allowMultiplePerUser: boolean
  joinPolicy: UnitTypeJoinPolicy
  creationPolicy: UnitTypeCreationPolicy
  createdAt: Date
  updatedAt: Date
}

export class UnitTypeService {
  static async create(data: Omit<UnitType, 'id' | 'createdAt' | 'updatedAt'>): Promise<UnitType> {
    const record = await prisma.unitType.create({
      data: {
        churchId: data.churchId,
        name: data.name,
        description: data.description ?? null,
        icon: data.icon ?? null,
        color: data.color ?? null,
        allowMultiplePerUser: data.allowMultiplePerUser ?? false,
        joinPolicy: data.joinPolicy ?? 'INVITE_ONLY',
        creationPolicy: data.creationPolicy ?? 'ADMIN_ONLY',
      },
    })
    return record as unknown as UnitType
  }

  static async findById(id: string): Promise<UnitType | null> {
    const record = await prisma.unitType.findUnique({ where: { id } })
    if (!record) return null
    return record as unknown as UnitType
  }

  static async findByChurch(churchId: string, limit: number = 200): Promise<UnitType[]> {
    const records = await prisma.unitType.findMany({
      where: { churchId },
      take: limit,
      orderBy: { name: 'asc' },
    })
    return records as unknown as UnitType[]
  }

  static async update(
    id: string,
    patch: Partial<Pick<UnitType, 'name' | 'description' | 'icon' | 'color' | 'allowMultiplePerUser' | 'joinPolicy' | 'creationPolicy'>>
  ): Promise<UnitType> {
    const record = await prisma.unitType.update({
      where: { id },
      data: patch as any,
    })
    return record as unknown as UnitType
  }
}
