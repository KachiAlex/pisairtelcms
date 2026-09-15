import { prisma } from '@/lib/prisma'

export interface SermonView {
  id: string
  userId: string
  sermonId: string
  watchedDuration: number
  completed: boolean
  createdAt: Date
  updatedAt: Date
}

export interface SermonDownload {
  id: string
  userId: string
  sermonId: string
  downloadedAt: Date
}

export class SermonViewService {
  static async findByUserAndSermon(userId: string, sermonId: string): Promise<SermonView | null> {
    const record = await prisma.sermonView.findFirst({
      where: { userId, sermonId },
    })
    return (record as SermonView) ?? null
  }

  static async upsert(userId: string, sermonId: string, watchedDuration: number, completed: boolean): Promise<SermonView> {
    const existing = await this.findByUserAndSermon(userId, sermonId)

    if (existing) {
      const record = await prisma.sermonView.update({
        where: { id: existing.id },
        data: { watchedDuration, completed },
      })
      return record as SermonView
    }

    const [record] = await prisma.$transaction([
      prisma.sermonView.create({
        data: { userId, sermonId, watchedDuration, completed },
      }),
      prisma.sermon.update({
        where: { id: sermonId },
        data: { viewsCount: { increment: 1 } },
      }),
    ])
    return record as SermonView
  }

  static async findByUser(userId: string): Promise<SermonView[]> {
    const records = await prisma.sermonView.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    })
    return records as SermonView[]
  }
}

export class SermonDownloadService {
  static async findByUserAndSermon(userId: string, sermonId: string): Promise<SermonDownload | null> {
    const record = await prisma.sermonDownload.findFirst({
      where: { userId, sermonId },
    })
    return (record as SermonDownload) ?? null
  }

  static async create(userId: string, sermonId: string): Promise<SermonDownload> {
    // Check if already downloaded
    const existing = await this.findByUserAndSermon(userId, sermonId)
    if (existing) {
      return existing
    }

    const [record] = await prisma.$transaction([
      prisma.sermonDownload.create({
        data: { userId, sermonId },
      }),
      prisma.sermon.update({
        where: { id: sermonId },
        data: { downloadsCount: { increment: 1 } },
      }),
    ])

    return record as SermonDownload
  }
}
