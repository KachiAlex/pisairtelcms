import { prisma } from '@/lib/prisma'

export interface Sermon {
  id: string
  churchId: string
  title: string
  description?: string
  speaker: string
  videoUrl?: string
  audioUrl?: string
  thumbnailUrl?: string
  duration?: number
  category?: string
  tags: string[]
  topics: string[]
  aiSummary?: string
  searchKeywords?: string[]
  viewsCount?: number
  downloadsCount?: number
  publishedAt: Date
  createdAt: Date
  updatedAt: Date
}

const fromPrisma = (record: any): Sermon => {
  const { firestoreData, ...rest } = record
  const legacy = (firestoreData as Record<string, unknown>) || {}
  return { ...legacy, ...rest } as Sermon
}

export class SermonService {
  private static buildSearchKeywords(input: {
    title?: string
    description?: string
    speaker?: string
    tags?: string[]
    topics?: string[]
    category?: string
  }): string[] {
    const raw = [
      input.title,
      input.description,
      input.speaker,
      input.category,
      ...(input.tags || []),
      ...(input.topics || []),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

    const tokens = raw
      .split(/[^a-z0-9]+/)
      .map((t) => t.trim())
      .filter((t) => t.length >= 2)

    return Array.from(new Set(tokens)).slice(0, 100)
  }

  static async findById(id: string): Promise<Sermon | null> {
    const record = await prisma.sermon.findUnique({ where: { id } })
    if (!record) return null
    return fromPrisma(record)
  }

  static async create(data: Omit<Sermon, 'id' | 'createdAt' | 'updatedAt' | 'publishedAt'>): Promise<Sermon> {
    const record = await prisma.sermon.create({
      data: {
        ...data,
        tags: data.tags || [],
        topics: data.topics || [],
        searchKeywords: this.buildSearchKeywords({
          title: (data as any).title,
          description: (data as any).description,
          speaker: (data as any).speaker,
          tags: (data as any).tags || [],
          topics: (data as any).topics || [],
          category: (data as any).category,
        }),
        viewsCount: (data as any).viewsCount ?? 0,
        downloadsCount: (data as any).downloadsCount ?? 0,
        publishedAt: new Date(),
        createdAt: new Date(),
      } as any,
    })
    return fromPrisma(record)
  }

  static async findByChurch(
    churchId: string,
    options?: {
      category?: string
      search?: string
      tag?: string
      limit?: number
      lastDocId?: string
    }
  ): Promise<Sermon[]> {
    const searchTokens = options?.search && !options?.tag
      ? this.buildSearchKeywords({ title: options.search }).slice(0, 10)
      : []

    const records = await prisma.sermon.findMany({
      where: {
        churchId,
        category: options?.category || undefined,
        tags: options?.tag ? { has: options.tag } : undefined,
        searchKeywords: searchTokens.length > 0 ? { hasSome: searchTokens } : undefined,
      },
      orderBy: { createdAt: 'desc' },
      take: options?.limit || 20,
      skip: options?.lastDocId ? 1 : undefined,
      cursor: options?.lastDocId ? { id: options.lastDocId } : undefined,
    })

    return records.map(fromPrisma)
  }

  static async update(id: string, data: Partial<Sermon>): Promise<Sermon> {
    const { id: _, createdAt, updatedAt, ...updateData } = data as any

    if (
      updateData.title !== undefined ||
      updateData.description !== undefined ||
      updateData.speaker !== undefined ||
      updateData.category !== undefined ||
      updateData.tags !== undefined ||
      updateData.topics !== undefined
    ) {
      const existing = await this.findById(id)
      updateData.searchKeywords = this.buildSearchKeywords({
        title: updateData.title ?? existing?.title,
        description: updateData.description ?? existing?.description,
        speaker: updateData.speaker ?? existing?.speaker,
        category: updateData.category ?? existing?.category,
        tags: updateData.tags ?? existing?.tags,
        topics: updateData.topics ?? existing?.topics,
      })
    }

    const record = await prisma.sermon.update({
      where: { id },
      data: { ...updateData } as any,
    })
    return fromPrisma(record)
  }

  static async delete(id: string): Promise<void> {
    await prisma.sermon.delete({ where: { id } })
  }
}

