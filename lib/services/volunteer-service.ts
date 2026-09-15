import { prisma } from '@/lib/prisma'

export interface VolunteerShift {
  id: string
  userId: string
  departmentId?: string
  role: string
  startTime: Date
  endTime?: Date
  status: string
  createdAt: Date
  updatedAt: Date
}

export interface Task {
  id: string
  userId: string
  title: string
  description?: string
  departmentId?: string
  dueDate?: Date
  priority: string
  status: string
  createdAt: Date
  updatedAt: Date
}

function shiftFromPrisma(record: any): VolunteerShift {
  return {
    id: record.id,
    userId: record.userId,
    departmentId: record.departmentId ?? undefined,
    role: record.role ?? '',
    startTime: record.startTime,
    endTime: record.endTime ?? undefined,
    status: record.status ?? 'Scheduled',
    createdAt: record.createdAt,
    updatedAt: record.updatedAt ?? record.createdAt,
  }
}

function taskFromPrisma(record: any): Task {
  return {
    id: record.id,
    userId: record.userId,
    title: record.title,
    description: record.description ?? undefined,
    departmentId: record.departmentId ?? undefined,
    dueDate: record.dueDate ?? undefined,
    priority: record.priority ?? 'Medium',
    status: record.status ?? 'Pending',
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  }
}

export class VolunteerShiftService {
  static async findByChurch(churchId: string, startDate?: Date, endDate?: Date): Promise<VolunteerShift[]> {
    // Single query via the user relation — no per-user loop
    const records = await prisma.volunteerShift.findMany({
      where: {
        user: { churchId },
        ...(startDate ? { startTime: { gte: startDate } } : {}),
        ...(endDate ? { startTime: { lte: endDate } } : {}),
      },
      orderBy: { startTime: 'asc' },
    })
    return records.map(shiftFromPrisma)
  }

  static async create(data: Omit<VolunteerShift, 'id' | 'createdAt' | 'updatedAt'>): Promise<VolunteerShift> {
    const record = await prisma.volunteerShift.create({
      data: {
        userId: data.userId,
        departmentId: data.departmentId ?? null,
        role: data.role,
        startTime: data.startTime instanceof Date ? data.startTime : new Date(data.startTime),
        endTime: data.endTime
          ? data.endTime instanceof Date
            ? data.endTime
            : new Date(data.endTime)
          : null,
        status: data.status || 'Scheduled',
      },
    })
    return shiftFromPrisma(record)
  }
}

export class TaskService {
  static async findByChurch(churchId: string, status?: string, userId?: string): Promise<Task[]> {
    // Single query via the user relation — no per-user loop
    const records = await prisma.task.findMany({
      where: {
        ...(userId ? { userId } : { user: { churchId } }),
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: 'desc' },
    })
    return records.map(taskFromPrisma)
  }

  static async create(data: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Promise<Task> {
    const record = await prisma.task.create({
      data: {
        userId: data.userId,
        title: data.title,
        description: data.description ?? null,
        departmentId: data.departmentId ?? null,
        dueDate: data.dueDate
          ? data.dueDate instanceof Date
            ? data.dueDate
            : new Date(data.dueDate)
          : null,
        priority: data.priority || 'Medium',
        status: data.status || 'Pending',
      },
    })
    return taskFromPrisma(record)
  }
}
