import { prisma } from '@/lib/prisma'

export interface ChildrenCheckIn {
  id: string
  childId: string
  parentId: string
  qrCode: string
  checkedInAt: Date
  checkedOutAt?: Date
  createdAt: Date
}

export class ChildrenCheckInService {
  static async findActiveByChild(childId: string): Promise<ChildrenCheckIn | null> {
    const record = await prisma.childrenCheckIn.findFirst({
      where: { childId, checkedOutAt: null },
      orderBy: { checkedInAt: 'desc' },
    })
    return record as ChildrenCheckIn | null
  }

  static async findByChild(childId: string): Promise<ChildrenCheckIn[]> {
    const records = await prisma.childrenCheckIn.findMany({
      where: { childId },
      orderBy: { checkedInAt: 'desc' },
    })
    return records as ChildrenCheckIn[]
  }

  static async create(data: Omit<ChildrenCheckIn, 'id' | 'checkedInAt' | 'createdAt'>): Promise<ChildrenCheckIn> {
    const record = await prisma.childrenCheckIn.create({
      data: {
        childId: data.childId,
        parentId: data.parentId,
        qrCode: data.qrCode,
        checkedOutAt: data.checkedOutAt ?? null,
      },
    })
    return record as ChildrenCheckIn
  }

  static async checkout(id: string): Promise<ChildrenCheckIn> {
    const record = await prisma.childrenCheckIn.update({
      where: { id },
      data: { checkedOutAt: new Date() },
    })
    return record as ChildrenCheckIn
  }
}
