import { prisma } from '@/lib/prisma'

export interface ChurchRole {
  id: string
  churchId: string
  name: string
  description?: string
  key?: string
  isDefault: boolean
  isProtected: boolean
  order: number
  createdAt: Date
  updatedAt: Date
}

export interface ChurchRoleInput {
  churchId: string
  name: string
  description?: string
}

const DEFAULT_ROLES: Array<Omit<ChurchRole, 'id' | 'churchId' | 'createdAt' | 'updatedAt'>> = [
  {
    name: 'Admin',
    description: 'Full administrative access with ability to manage everything.',
    key: 'ADMIN_DEFAULT',
    isDefault: true,
    isProtected: true,
    order: 0,
  },
  {
    name: 'Worker',
    description: 'Default worker role for all members.',
    key: 'WORKER_DEFAULT',
    isDefault: true,
    isProtected: true,
    order: 1,
  },
]

const toRole = (record: any): ChurchRole => ({
  id: record.id,
  churchId: record.churchId,
  name: record.name,
  description: record.description ?? undefined,
  key: record.key ?? undefined,
  isDefault: Boolean(record.isDefault),
  isProtected: Boolean(record.isProtected),
  order: typeof record.order === 'number' ? record.order : 99,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
})

export class RoleService {
  private static async ensureDefaultRoles(churchId: string) {
    const existing = await prisma.churchRole.findMany({
      where: { churchId, key: { in: DEFAULT_ROLES.map((r) => r.key!) } },
      select: { key: true },
    })
    const existingKeys = new Set(existing.map((r) => r.key))

    const missing = DEFAULT_ROLES.filter((r) => !existingKeys.has(r.key!))
    if (missing.length > 0) {
      await prisma.churchRole.createMany({
        data: missing.map((role) => ({
          churchId,
          name: role.name,
          description: role.description,
          key: role.key,
          isDefault: role.isDefault,
          isProtected: role.isProtected,
          order: role.order,
        })),
      })
    }
  }

  static async listByChurch(churchId: string): Promise<ChurchRole[]> {
    await this.ensureDefaultRoles(churchId)
    const records = await prisma.churchRole.findMany({
      where: { churchId },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
    })
    return records.map(toRole)
  }

  static async get(roleId: string): Promise<ChurchRole | null> {
    const record = await prisma.churchRole.findUnique({ where: { id: roleId } })
    return record ? toRole(record) : null
  }

  static async getDefaultWorkerRole(churchId: string): Promise<ChurchRole | null> {
    await this.ensureDefaultRoles(churchId)
    const record = await prisma.churchRole.findFirst({
      where: { churchId, key: 'WORKER_DEFAULT' },
    })
    return record ? toRole(record) : null
  }

  static async create(input: ChurchRoleInput): Promise<ChurchRole> {
    await this.ensureDefaultRoles(input.churchId)
    const record = await prisma.churchRole.create({
      data: {
        churchId: input.churchId,
        name: input.name,
        description: input.description ?? '',
        order: Date.now(),
      },
    })
    return toRole(record)
  }

  static async update(
    roleId: string,
    churchId: string,
    updates: Partial<Omit<ChurchRoleInput, 'churchId'>>,
  ): Promise<ChurchRole | null> {
    const existing = await prisma.churchRole.findUnique({ where: { id: roleId } })
    if (!existing) return null
    if (existing.churchId !== churchId) {
      throw new Error('Cannot edit role from another church')
    }
    if (existing.isProtected) {
      throw new Error('Cannot edit default roles')
    }

    const record = await prisma.churchRole.update({
      where: { id: roleId },
      data: {
        name: updates.name,
        description: updates.description,
      },
    })
    return toRole(record)
  }

  static async delete(roleId: string, churchId: string): Promise<void> {
    const existing = await prisma.churchRole.findUnique({ where: { id: roleId } })
    if (!existing) return
    if (existing.churchId !== churchId) {
      throw new Error('Cannot delete role from another church')
    }
    if (existing.isProtected) {
      throw new Error('Cannot delete default roles')
    }
    await prisma.churchRole.delete({ where: { id: roleId } })
  }
}
