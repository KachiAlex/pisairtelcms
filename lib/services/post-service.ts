import { prisma } from '@/lib/prisma'

export interface Post {
  id: string
  userId: string
  churchId: string
  content: string
  type: string
  imageUrl?: string
  images?: string[]
  likes: number
  commentsCount: number
  createdAt: Date
  updatedAt: Date
}

const withCounts = {
  _count: { select: { likes: true, comments: true } },
} as const

const fromPrisma = (record: any): Post => {
  const { firestoreData, _count, ...rest } = record
  const legacy = (firestoreData as Record<string, unknown>) || {}
  const images = Array.isArray(rest.images) ? rest.images : []
  return {
    ...legacy,
    ...rest,
    imageUrl: rest.imageUrl ?? images[0],
    likes: _count?.likes ?? (typeof legacy.likes === 'number' ? legacy.likes : 0),
    commentsCount: _count?.comments ?? 0,
  } as Post
}

export class PostService {
  static async findById(id: string): Promise<Post | null> {
    const record = await prisma.post.findUnique({ where: { id }, include: withCounts })
    if (!record) return null
    return fromPrisma(record)
  }

  static async create(data: Omit<Post, 'id' | 'createdAt' | 'updatedAt' | 'likes' | 'commentsCount'>): Promise<Post> {
    const { imageUrl, images, ...rest } = data as any
    const record = await prisma.post.create({
      data: {
        ...rest,
        images: images ?? (imageUrl ? [imageUrl] : []),
      },
      include: withCounts,
    })
    return fromPrisma(record)
  }

  static async findByChurch(churchId: string, limit: number = 20, lastDocId?: string): Promise<Post[]> {
    const records = await prisma.post.findMany({
      where: { churchId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: lastDocId ? 1 : undefined,
      cursor: lastDocId ? { id: lastDocId } : undefined,
      include: withCounts,
    })
    return records.map(fromPrisma)
  }

  static async findByUser(userId: string, limit: number = 20): Promise<Post[]> {
    const records = await prisma.post.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: withCounts,
    })
    return records.map(fromPrisma)
  }

  /**
   * Toggle a like for a user on a post. Returns the new liked state.
   */
  static async toggleLike(postId: string, userId: string): Promise<{ liked: boolean; likes: number }> {
    const existing = await prisma.postLike.findUnique({
      where: { userId_postId: { userId, postId } },
    })

    if (existing) {
      await prisma.postLike.delete({ where: { id: existing.id } })
    } else {
      await prisma.postLike.create({ data: { userId, postId } })
    }

    const likes = await prisma.postLike.count({ where: { postId } })
    return { liked: !existing, likes }
  }

  static async countByChurch(churchId: string): Promise<number> {
    return prisma.post.count({ where: { churchId } })
  }

  static async delete(id: string): Promise<void> {
    await prisma.post.delete({ where: { id } })
  }
}
