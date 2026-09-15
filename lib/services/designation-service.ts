import { prisma } from '@/lib/prisma'

export interface ChurchDesignation {
  id: string
  churchId: string
  name: string
  description?: string
  category?: 'Worker' | 'Leader' | 'Admin'
  key?: string
  isDefault?: boolean
  isProtected?: boolean
  createdAt: Date
  updatedAt: Date
}

export interface ChurchDesignationInput {
  churchId: string
  name: string
  description?: string
  category?: 'Worker' | 'Leader' | 'Admin'
}

const DEFAULT_DESIGNATIONS: Array<Omit<ChurchDesignation, 'id' | 'churchId' | 'createdAt' | 'updatedAt'>> = [
  {
    name: 'Worker',
    description: 'Default designation for workers',
    category: 'Worker',
    key: 'WORKER_DEFAULT',
    isDefault: true,
    isProtected: true,
  },
]

export class DesignationService {
  private static async ensureDefaults(churchId: string) {
    await Promise.all(
      DEFAULT_DESIGNATIONS.map(async (designation) => {
        const existing = await prisma.designation.findFirst({
          where: { churchId, key: designation.key },
        })
        if (!existing) {
          await prisma.designation.create({
            data: {
              churchId,
              name: designation.name,
              description: designation.description,
              category: designation.category,
              key: designation.key,
              isDefault: designation.isDefault ?? false,
              isProtected: designation.isProtected ?? false,
            },
          })
        }
      }),
    )
  }

  static async get(designationId: string): Promise<ChurchDesignation | null> {
    const record = await prisma.designation.findUnique({ where: { id: designationId } })
    return record as ChurchDesignation | null
  }

  static async listByChurch(churchId: string): Promise<ChurchDesignation[]> {
    await this.ensureDefaults(churchId)
    const records = await prisma.designation.findMany({
      where: { churchId },
      orderBy: { name: 'asc' },
    })
    return records as ChurchDesignation[]
  }

  static async create(input: ChurchDesignationInput): Promise<ChurchDesignation> {
    await this.ensureDefaults(input.churchId)
    const record = await prisma.designation.create({
      data: {
        churchId: input.churchId,
        name: input.name,
        description: input.description ?? '',
        category: input.category ?? 'Worker',
        key: null,
        isDefault: false,
        isProtected: false,
      },
    })
    return record as ChurchDesignation
  }

  static async update(
    designationId: string,
    churchId: string,
    updates: Partial<Omit<ChurchDesignationInput, 'churchId'>>,
  ): Promise<ChurchDesignation | null> {
    const existing = await prisma.designation.findUnique({ where: { id: designationId } })
    if (!existing) return null
    if (existing.churchId !== churchId) {
      throw new Error('Cannot edit designation from another church')
    }
    if (existing.isProtected) {
      throw new Error('Cannot edit default designation')
    }

    const record = await prisma.designation.update({
      where: { id: designationId },
      data: {
        ...(updates.name !== undefined ? { name: updates.name } : {}),
        ...(updates.description !== undefined ? { description: updates.description } : {}),
        ...(updates.category !== undefined ? { category: updates.category } : {}),
      },
    })
    return record as ChurchDesignation
  }

  static async delete(designationId: string, churchId: string): Promise<void> {
    const existing = await prisma.designation.findUnique({ where: { id: designationId } })
    if (!existing) return
    if (existing.churchId !== churchId) {
      throw new Error('Cannot delete designation from another church')
    }
    if (existing.isProtected) {
      throw new Error('Cannot delete default designation')
    }
    await prisma.designation.delete({ where: { id: designationId } })
  }
}
