import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import type { MessageAttachment, MessageVoiceNote } from '@/lib/services/message-service'

export type UnitInteractionRule = {
  title: string
  description?: string
}

export interface UnitSettings {
  id: string
  churchId: string
  unitId: string
  allowMedia: boolean
  allowPolls: boolean
  allowShares: boolean
  pinnedRules?: string | null
  rules?: UnitInteractionRule[]
  createdAt: Date
  updatedAt: Date
}

export type UnitSettingsPatch = Partial<Pick<UnitSettings, 'allowMedia' | 'allowPolls' | 'allowShares' | 'pinnedRules' | 'rules'>>

const DEFAULT_UNIT_SETTINGS: Omit<UnitSettings, 'id' | 'unitId' | 'churchId' | 'createdAt' | 'updatedAt'> = {
  allowMedia: true,
  allowPolls: true,
  allowShares: true,
  pinnedRules: null,
  rules: [],
}

export interface UnitMessage {
  id: string
  unitId: string
  churchId: string
  userId: string
  content: string
  attachments?: MessageAttachment[]
  voiceNote?: MessageVoiceNote
  pinned?: boolean
  metadata?: {
    replyToMessageId?: string
  }
  createdAt: Date
  updatedAt: Date
}

export interface CreateUnitMessageInput {
  unitId: string
  churchId: string
  userId: string
  content: string
  attachments?: MessageAttachment[]
  voiceNote?: MessageVoiceNote
  metadata?: UnitMessage['metadata']
}

export interface UnitPollOption {
  id: string
  label: string
  votes: number
}

export interface UnitPoll {
  id: string
  unitId: string
  churchId: string
  question: string
  description?: string
  options: UnitPollOption[]
  allowMultiple: boolean
  allowComments: boolean
  status: 'OPEN' | 'CLOSED'
  createdByUserId: string
  closesAt?: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface CreateUnitPollInput {
  unitId: string
  churchId: string
  question: string
  description?: string
  options: Array<{ label: string }>
  allowMultiple?: boolean
  allowComments?: boolean
  createdByUserId: string
  closesAt?: Date | null
}

export type UnitPollVote = {
  id: string
  unitId: string
  pollId: string
  userId: string
  optionIds: string[]
  createdAt: Date
}

const toUnitSettings = (record: any): UnitSettings => ({
  ...DEFAULT_UNIT_SETTINGS,
  ...record,
  rules: (record.rules as UnitInteractionRule[]) ?? [],
})

const toUnitMessage = (record: any): UnitMessage => ({
  ...record,
  attachments: (record.attachments as MessageAttachment[]) ?? undefined,
  voiceNote: (record.voiceNote as MessageVoiceNote) ?? undefined,
  metadata: (record.metadata as UnitMessage['metadata']) ?? undefined,
})

const toUnitPoll = (record: any): UnitPoll => ({
  ...record,
  description: record.description ?? undefined,
  options: Array.isArray(record.options) ? record.options : [],
  status: record.status as 'OPEN' | 'CLOSED',
})

export class UnitSettingsService {
  static async get(unitId: string): Promise<UnitSettings | null> {
    const record = await prisma.unitSettings.findUnique({ where: { unitId } })
    return record ? toUnitSettings(record) : null
  }

  static async getOrCreate(churchId: string, unitId: string): Promise<UnitSettings> {
    const record = await prisma.unitSettings.upsert({
      where: { unitId },
      create: {
        churchId,
        unitId,
        ...DEFAULT_UNIT_SETTINGS,
        rules: [] as Prisma.InputJsonValue,
      },
      update: {},
    })
    return toUnitSettings(record)
  }

  static async update(unitId: string, patch: UnitSettingsPatch): Promise<UnitSettings> {
    const record = await prisma.unitSettings.update({
      where: { unitId },
      data: {
        ...(patch.allowMedia !== undefined ? { allowMedia: patch.allowMedia } : {}),
        ...(patch.allowPolls !== undefined ? { allowPolls: patch.allowPolls } : {}),
        ...(patch.allowShares !== undefined ? { allowShares: patch.allowShares } : {}),
        ...(patch.pinnedRules !== undefined ? { pinnedRules: patch.pinnedRules } : {}),
        ...(patch.rules !== undefined ? { rules: patch.rules as Prisma.InputJsonValue } : {}),
      },
    })
    return toUnitSettings(record)
  }
}

export class UnitMessageService {
  static async create(input: CreateUnitMessageInput): Promise<UnitMessage> {
    const record = await prisma.unitMessage.create({
      data: {
        unitId: input.unitId,
        churchId: input.churchId,
        userId: input.userId,
        content: input.content,
        attachments: (input.attachments ?? Prisma.JsonNull) as unknown as Prisma.InputJsonValue,
        voiceNote: (input.voiceNote ?? Prisma.JsonNull) as unknown as Prisma.InputJsonValue,
        metadata: input.metadata as Prisma.InputJsonValue,
        pinned: false,
      },
    })
    return toUnitMessage(record)
  }

  static async listByUnit(unitId: string, limit: number = 100): Promise<UnitMessage[]> {
    const records = await prisma.unitMessage.findMany({
      where: { unitId },
      orderBy: { createdAt: 'asc' },
      take: limit,
    })
    return records.map(toUnitMessage)
  }

  static async updateMessage(unitId: string, messageId: string, patch: Partial<Pick<UnitMessage, 'content' | 'pinned'>>): Promise<UnitMessage> {
    const existing = await prisma.unitMessage.findUnique({ where: { id: messageId } })
    if (!existing || existing.unitId !== unitId) {
      throw new Error('Message does not belong to unit')
    }
    const record = await prisma.unitMessage.update({
      where: { id: messageId },
      data: {
        ...(patch.content !== undefined ? { content: patch.content } : {}),
        ...(patch.pinned !== undefined ? { pinned: patch.pinned } : {}),
      },
    })
    return toUnitMessage(record)
  }
}

export class UnitPollService {
  static async findById(id: string): Promise<UnitPoll | null> {
    const record = await prisma.unitPoll.findUnique({ where: { id } })
    return record ? toUnitPoll(record) : null
  }

  static async create(input: CreateUnitPollInput): Promise<UnitPoll> {
    const record = await prisma.unitPoll.create({
      data: {
        unitId: input.unitId,
        churchId: input.churchId,
        question: input.question,
        description: input.description || null,
        options: input.options.map((option, idx) => ({
          id: `${idx + 1}`,
          label: option.label,
          votes: 0,
        })) as Prisma.InputJsonValue,
        allowMultiple: input.allowMultiple ?? false,
        allowComments: input.allowComments ?? false,
        status: 'OPEN',
        createdByUserId: input.createdByUserId,
        closesAt: input.closesAt ?? null,
      },
    })
    return toUnitPoll(record)
  }

  static async findByUnit(unitId: string, limit: number = 50): Promise<UnitPoll[]> {
    const records = await prisma.unitPoll.findMany({
      where: { unitId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
    return records.map(toUnitPoll)
  }

  static async vote(pollId: string, userId: string, optionIds: string[]): Promise<UnitPoll> {
    const pollRecord = await prisma.unitPoll.findUnique({ where: { id: pollId } })
    if (!pollRecord) throw new Error('Poll not found')
    const poll = toUnitPoll(pollRecord)
    if (poll.status === 'CLOSED') throw new Error('Poll is closed')

    const dedupedOptionIds = Array.from(new Set(optionIds))
    if (!poll.allowMultiple && dedupedOptionIds.length > 1) {
      throw new Error('Multiple selections are not allowed')
    }

    const validOptions = poll.options.map((opt) => opt.id)
    if (!dedupedOptionIds.every((id) => validOptions.includes(id))) {
      throw new Error('Invalid option selection')
    }

    const existingVote = await prisma.unitPollVote.findUnique({
      where: { pollId_userId: { pollId, userId } },
    })
    if (existingVote) {
      throw new Error('You have already voted on this poll')
    }

    // Record vote + update counts atomically
    const [updatedPoll] = await prisma.$transaction([
      prisma.unitPoll.update({
        where: { id: pollId },
        data: {
          options: poll.options.map((opt) => ({
            ...opt,
            votes: dedupedOptionIds.includes(opt.id) ? opt.votes + 1 : opt.votes,
          })) as Prisma.InputJsonValue,
        },
      }),
      prisma.unitPollVote.create({
        data: {
          pollId,
          unitId: poll.unitId,
          userId,
          optionIds: dedupedOptionIds,
        },
      }),
    ])

    return toUnitPoll(updatedPoll)
  }

  static async close(pollId: string): Promise<UnitPoll> {
    const record = await prisma.unitPoll.update({
      where: { id: pollId },
      data: { status: 'CLOSED' },
    })
    return toUnitPoll(record)
  }
}
