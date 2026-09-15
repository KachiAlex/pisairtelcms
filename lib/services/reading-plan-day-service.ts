import { prisma } from '@/lib/prisma'

export interface ReadingPlanDay {
  id: string
  planId: string
  dayNumber: number
  title: string
  summary?: string
  passageId: string
  bibleVersionId: string
  devotionalText?: string
  prayerFocus?: string
  resourceIds?: string[]
  createdAt: Date
  updatedAt: Date
}

export interface ReadingPlanResource {
  id: string
  planId?: string
  planIds?: string[]
  title: string
  description?: string
  author?: string
  categoryId?: string
  tags?: string[]
  type: 'book' | 'pdf' | 'audio' | 'video' | 'link'
  fileUrl?: string
  fileName?: string
  filePath?: string
  contentType?: string
  size?: number
  createdBy: string
  createdAt: Date
  updatedAt: Date
  metadata?: Record<string, any>
}

export interface ReadingResourceCategory {
  id: string
  name: string
  description?: string
  color?: string
  icon?: string
  createdAt: Date
  updatedAt: Date
}

function dayFromPrisma(record: any): ReadingPlanDay {
  return {
    id: record.id,
    planId: record.planId,
    dayNumber: record.dayNumber,
    title: record.title,
    summary: record.summary ?? undefined,
    passageId: record.passageId,
    bibleVersionId: record.bibleVersionId,
    devotionalText: record.devotionalText ?? undefined,
    prayerFocus: record.prayerFocus ?? undefined,
    resourceIds: record.resourceIds ?? [],
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  }
}

function resourceFromPrisma(record: any): ReadingPlanResource {
  const legacy = (record.firestoreData as Record<string, unknown>) || {}
  return {
    id: record.id,
    planId: record.planIds?.[0] ?? (legacy.planId as string | undefined),
    planIds: record.planIds ?? [],
    title: record.title,
    description: record.description ?? undefined,
    author: record.author ?? undefined,
    categoryId: record.categoryId ?? undefined,
    tags: record.tags ?? [],
    type: record.type,
    fileUrl: record.fileUrl ?? undefined,
    fileName: record.fileName ?? undefined,
    filePath: record.filePath ?? undefined,
    contentType: record.contentType ?? undefined,
    size: record.size ?? undefined,
    createdBy: record.createdBy,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    metadata: (record.metadata as Record<string, any>) ?? undefined,
  }
}

export class ReadingPlanDayService {
  static async findByPlanAndDay(planId: string, dayNumber: number): Promise<ReadingPlanDay | null> {
    const record = await prisma.readingPlanDay.findUnique({
      where: { planId_dayNumber: { planId, dayNumber } },
    })
    return record ? dayFromPrisma(record) : null
  }

  static async upsert(data: {
    planId: string
    dayNumber: number
    title: string
    summary?: string
    passageId: string
    bibleVersionId: string
    devotionalText?: string
    prayerFocus?: string
    resourceIds?: string[]
  }): Promise<ReadingPlanDay> {
    const record = await prisma.readingPlanDay.upsert({
      where: { planId_dayNumber: { planId: data.planId, dayNumber: data.dayNumber } },
      update: {
        title: data.title,
        summary: data.summary ?? null,
        passageId: data.passageId,
        bibleVersionId: data.bibleVersionId,
        devotionalText: data.devotionalText ?? null,
        prayerFocus: data.prayerFocus ?? null,
        resourceIds: data.resourceIds ?? [],
      },
      create: {
        planId: data.planId,
        dayNumber: data.dayNumber,
        title: data.title,
        summary: data.summary ?? null,
        passageId: data.passageId,
        bibleVersionId: data.bibleVersionId,
        devotionalText: data.devotionalText ?? null,
        prayerFocus: data.prayerFocus ?? null,
        resourceIds: data.resourceIds ?? [],
      },
    })
    return dayFromPrisma(record)
  }

  static async update(
    id: string,
    data: Partial<Omit<ReadingPlanDay, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<ReadingPlanDay | null> {
    const existing = await prisma.readingPlanDay.findUnique({ where: { id } })
    if (!existing) return null
    const record = await prisma.readingPlanDay.update({
      where: { id },
      data: {
        ...(data.planId !== undefined ? { planId: data.planId } : {}),
        ...(data.dayNumber !== undefined ? { dayNumber: data.dayNumber } : {}),
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.summary !== undefined ? { summary: data.summary ?? null } : {}),
        ...(data.passageId !== undefined ? { passageId: data.passageId } : {}),
        ...(data.bibleVersionId !== undefined ? { bibleVersionId: data.bibleVersionId } : {}),
        ...(data.devotionalText !== undefined ? { devotionalText: data.devotionalText ?? null } : {}),
        ...(data.prayerFocus !== undefined ? { prayerFocus: data.prayerFocus ?? null } : {}),
        ...(data.resourceIds !== undefined ? { resourceIds: data.resourceIds } : {}),
      },
    })
    return dayFromPrisma(record)
  }

  static async delete(id: string): Promise<void> {
    await prisma.readingPlanDay.delete({ where: { id } }).catch(() => {})
  }
}

export class ReadingResourceCategoryService {
  static async findById(id: string): Promise<ReadingResourceCategory | null> {
    const record = await prisma.readingResourceCategory.findUnique({ where: { id } })
    if (!record) return null
    return {
      ...record,
      description: record.description ?? undefined,
      color: record.color ?? undefined,
      icon: record.icon ?? undefined,
    }
  }

  static async listAll(): Promise<ReadingResourceCategory[]> {
    const records = await prisma.readingResourceCategory.findMany({
      orderBy: { createdAt: 'desc' },
    })
    return records.map((r) => ({
      ...r,
      description: r.description ?? undefined,
      color: r.color ?? undefined,
      icon: r.icon ?? undefined,
    }))
  }

  static async create(data: Omit<ReadingResourceCategory, 'id' | 'createdAt' | 'updatedAt'>) {
    const record = await prisma.readingResourceCategory.create({
      data: {
        name: data.name,
        description: data.description ?? null,
        color: data.color ?? null,
        icon: data.icon ?? null,
      },
    })
    return {
      ...record,
      description: record.description ?? undefined,
      color: record.color ?? undefined,
      icon: record.icon ?? undefined,
    }
  }

  static async update(
    id: string,
    data: Partial<Omit<ReadingResourceCategory, 'id' | 'createdAt' | 'updatedAt'>>
  ) {
    const existing = await prisma.readingResourceCategory.findUnique({ where: { id } })
    if (!existing) return null
    const record = await prisma.readingResourceCategory.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description ?? null } : {}),
        ...(data.color !== undefined ? { color: data.color ?? null } : {}),
        ...(data.icon !== undefined ? { icon: data.icon ?? null } : {}),
      },
    })
    return {
      ...record,
      description: record.description ?? undefined,
      color: record.color ?? undefined,
      icon: record.icon ?? undefined,
    }
  }

  static async delete(id: string) {
    await prisma.readingResourceCategory.delete({ where: { id } }).catch(() => {})
  }
}

export class ReadingPlanResourceService {
  static async create(
    data: Omit<ReadingPlanResource, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<ReadingPlanResource> {
    const record = await prisma.readingPlanResource.create({
      data: {
        planIds: data.planIds || (data.planId ? [data.planId] : []),
        title: data.title,
        description: data.description ?? null,
        author: data.author ?? null,
        categoryId: data.categoryId ?? null,
        tags: data.tags ?? [],
        type: data.type,
        fileUrl: data.fileUrl ?? null,
        fileName: data.fileName ?? null,
        filePath: data.filePath ?? null,
        contentType: data.contentType ?? null,
        size: data.size ?? null,
        createdBy: data.createdBy,
        metadata: data.metadata ?? undefined,
      },
    })
    return resourceFromPrisma(record)
  }

  static async findById(id: string): Promise<ReadingPlanResource | null> {
    const record = await prisma.readingPlanResource.findUnique({ where: { id } })
    return record ? resourceFromPrisma(record) : null
  }

  static async findMany(ids: string[]): Promise<ReadingPlanResource[]> {
    if (!ids || ids.length === 0) return []
    const records = await prisma.readingPlanResource.findMany({
      where: { id: { in: ids } },
    })
    return records.map(resourceFromPrisma)
  }

  static async listByPlan(planId: string): Promise<ReadingPlanResource[]> {
    const records = await prisma.readingPlanResource.findMany({
      where: {
        OR: [
          { planIds: { has: planId } },
          { firestoreData: { path: ['planId'], equals: planId } },
        ],
      },
      orderBy: { createdAt: 'desc' },
    })
    return records.map(resourceFromPrisma)
  }

  static async listAll(options: {
    categoryId?: string
    search?: string
    limit?: number
    cursor?: string
  } = {}): Promise<{ resources: ReadingPlanResource[]; nextCursor: string | null }> {
    const limit = options.limit || 20
    const where: any = {}

    if (options.categoryId) {
      where.categoryId = options.categoryId
    }

    if (options.search) {
      const search = options.search
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { author: { contains: search, mode: 'insensitive' } },
      ]
    }

    const records = await prisma.readingPlanResource.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
    })

    const nextCursor = records.length === limit ? records[records.length - 1].id : null
    return { resources: records.map(resourceFromPrisma), nextCursor }
  }

  static async update(
    id: string,
    data: Partial<Omit<ReadingPlanResource, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<ReadingPlanResource | null> {
    const existing = await prisma.readingPlanResource.findUnique({ where: { id } })
    if (!existing) return null
    const record = await prisma.readingPlanResource.update({
      where: { id },
      data: {
        ...(data.planIds !== undefined ? { planIds: data.planIds } : {}),
        ...(data.planId !== undefined ? { planIds: data.planId ? [data.planId] : [] } : {}),
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.description !== undefined ? { description: data.description ?? null } : {}),
        ...(data.author !== undefined ? { author: data.author ?? null } : {}),
        ...(data.categoryId !== undefined ? { categoryId: data.categoryId ?? null } : {}),
        ...(data.tags !== undefined ? { tags: data.tags } : {}),
        ...(data.type !== undefined ? { type: data.type } : {}),
        ...(data.fileUrl !== undefined ? { fileUrl: data.fileUrl ?? null } : {}),
        ...(data.fileName !== undefined ? { fileName: data.fileName ?? null } : {}),
        ...(data.filePath !== undefined ? { filePath: data.filePath ?? null } : {}),
        ...(data.contentType !== undefined ? { contentType: data.contentType ?? null } : {}),
        ...(data.size !== undefined ? { size: data.size ?? null } : {}),
        ...(data.metadata !== undefined ? { metadata: data.metadata ?? undefined } : {}),
      },
    })
    return resourceFromPrisma(record)
  }

  static async delete(id: string): Promise<void> {
    await prisma.readingPlanResource.delete({ where: { id } }).catch(() => {})
  }
}
