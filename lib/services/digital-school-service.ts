import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

export type DigitalCourseAccess = 'open' | 'request' | 'invite'
export type DigitalCourseStatus = 'draft' | 'published' | 'archived'
export type DigitalCourseEnrollmentStatus = 'active' | 'completed' | 'withdrawn'
export type DigitalExamStatus = 'draft' | 'published' | 'archived'
export type DigitalExamAttemptStatus = 'in_progress' | 'submitted' | 'graded'
export type DigitalCoursePricingType = 'free' | 'paid'
export type DigitalCoursePaymentGateway = 'flutterwave' | 'paystack'

export interface DigitalCoursePricing {
  type: DigitalCoursePricingType
  amount?: number
  currency?: string
  paymentGateway?: DigitalCoursePaymentGateway
}

export interface DigitalCourse {
  id: string
  churchId: string
  title: string
  summary?: string
  accessType: DigitalCourseAccess
  mentors: string[]
  estimatedHours?: number
  coverImageUrl?: string
  tags?: string[]
  status: DigitalCourseStatus
  pricing: DigitalCoursePricing
  certificateTheme?: CertificateTheme
  createdBy: string
  updatedBy: string
  createdAt: Date
  updatedAt: Date
}

export interface DigitalCourseInput {
  churchId: string
  title: string
  summary?: string
  accessType?: DigitalCourseAccess
  mentors?: string[]
  estimatedHours?: number
  coverImageUrl?: string
  tags?: string[]
  status?: DigitalCourseStatus
  pricing?: DigitalCoursePricing
  certificateTheme?: CertificateTheme
  createdBy: string
  updatedBy?: string
}

export type CertificateTemplate = 'classic' | 'modern' | 'minimal'

export interface CertificateTheme {
  template?: CertificateTemplate
  accentColor?: string
  secondaryColor?: string
  backgroundImageUrl?: string
  logoUrl?: string
  signatureText?: string
  sealText?: string
  issuedBy?: string
}

export interface DigitalCourseSection {
  id: string
  courseId: string
  title: string
  description?: string
  order: number
  estimatedHours?: number
  createdAt: Date
  updatedAt: Date
}

export interface DigitalCourseSectionInput {
  courseId: string
  title: string
  description?: string
  order?: number
  estimatedHours?: number
}

export type DigitalCourseModuleContentType = 'video' | 'audio' | 'text'

export interface DigitalCourseModule {
  id: string
  courseId: string
  sectionId: string
  title: string
  description?: string
  order: number
  estimatedMinutes?: number
  videoUrl?: string
  audioUrl?: string
  audioFileName?: string
  audioStoragePath?: string
  bookUrl?: string
  bookFileName?: string
  bookStoragePath?: string
  contentType?: DigitalCourseModuleContentType
  textContent?: string
  createdAt: Date
  updatedAt: Date
}

export interface DigitalCourseModuleInput {
  courseId: string
  sectionId: string
  title: string
  description?: string
  order?: number
  estimatedMinutes?: number
  videoUrl?: string
  audioUrl?: string
  audioFileName?: string
  audioStoragePath?: string
  bookUrl?: string
  bookFileName?: string
  bookStoragePath?: string
  contentType?: DigitalCourseModuleContentType
  textContent?: string
}

export interface DigitalCourseLesson {
  id: string
  courseId: string
  moduleId: string
  title: string
  description?: string
  videoUrl?: string
  audioUrl?: string
  attachmentUrls?: string[]
  transcript?: string
  order: number
  createdAt: Date
  updatedAt: Date
}

export interface DigitalCourseLessonInput {
  courseId: string
  moduleId: string
  title: string
  description?: string
  videoUrl?: string
  audioUrl?: string
  attachmentUrls?: string[]
  transcript?: string
  order?: number
}

export type AccessRequestStatus = 'pending' | 'approved' | 'declined' | 'more_info'

export interface DigitalCourseAccessRequest {
  id: string
  courseId: string
  userId: string
  reason?: string
  status: AccessRequestStatus
  reviewerId?: string
  reviewerNote?: string
  createdAt: Date
  updatedAt: Date
}

export interface DigitalCourseAccessRequestInput {
  courseId: string
  userId: string
  reason?: string
}

export interface DigitalCourseEnrollment {
  id: string
  courseId: string
  userId: string
  churchId: string
  status: DigitalCourseEnrollmentStatus
  progressPercent: number
  moduleProgress: Record<string, number>
  badgeIssuedAt?: Date
  certificateUrl?: string
  certificateStoragePath?: string
  certificateIssuedAt?: Date
  createdAt: Date
  updatedAt: Date
}

export interface DigitalCourseEnrollmentInput {
  courseId: string
  churchId: string
  userId: string
}

export interface DigitalCourseExam {
  id: string
  courseId: string
  sectionId: string
  moduleId?: string
  title: string
  description?: string
  timeLimitMinutes?: number
  questionCount: number
  status: DigitalExamStatus
  uploadMetadata?: {
    source?: string
    originalFileName?: string
    fileUrl?: string
    storagePath?: string
  }
  retakePolicy?: {
    maxAttempts?: number | null
    cooldownHours?: number | null
  }
  createdBy: string
  updatedBy: string
  createdAt: Date
  updatedAt: Date
}

export interface DigitalCourseExamInput {
  courseId: string
  sectionId: string
  moduleId?: string
  title: string
  description?: string
  timeLimitMinutes?: number
  status?: DigitalExamStatus
  uploadMetadata?: {
    source?: string
    originalFileName?: string
    fileUrl?: string
    storagePath?: string
  }
  retakePolicy?: {
    maxAttempts?: number | null
    cooldownHours?: number | null
  }
  createdBy: string
  updatedBy?: string
}

export interface DigitalExamQuestion {
  id: string
  examId: string
  courseId: string
  moduleId?: string
  question: string
  options: string[]
  correctOption: number
  explanation?: string
  weight?: number
  durationSeconds?: number
  createdAt: Date
  updatedAt: Date
}

export interface DigitalExamQuestionInput {
  examId: string
  courseId: string
  moduleId?: string
  question: string
  options: string[]
  correctOption: number
  explanation?: string
  weight?: number
  durationSeconds?: number
}

export interface DigitalExamAttempt {
  id: string
  examId: string
  courseId: string
  userId: string
  status: DigitalExamAttemptStatus
  score?: number
  totalQuestions?: number
  startedAt: Date
  submittedAt?: Date
  responses: Array<{
    questionId: string
    answerIndex: number
    correct: boolean
  }>
  createdAt: Date
  updatedAt: Date
}

export interface DigitalExamAttemptInput {
  examId: string
  courseId: string
  userId: string
}

const omitUndefined = <T extends Record<string, any>>(data: T) =>
  Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined))

const DEFAULT_CURRENCY = 'NGN'

function normalizePricing(pricing?: DigitalCoursePricing | null): DigitalCoursePricing {
  if (!pricing || pricing.type === 'free') {
    return { type: 'free' }
  }

  return {
    type: 'paid',
    amount: typeof pricing.amount === 'number' ? pricing.amount : 0,
    currency: pricing.currency || DEFAULT_CURRENCY,
    paymentGateway: pricing.paymentGateway || 'flutterwave',
  }
}

function normalizeRetakePolicy(retakePolicy?: DigitalCourseExamInput['retakePolicy'] | null) {
  if (!retakePolicy) return null
  return {
    maxAttempts: typeof retakePolicy.maxAttempts === 'number' ? retakePolicy.maxAttempts : null,
    cooldownHours: typeof retakePolicy.cooldownHours === 'number' ? retakePolicy.cooldownHours : null,
  }
}

export class DigitalCourseEnrollmentService {
  static async get(enrollmentId: string): Promise<DigitalCourseEnrollment | null> {
    const record = await prisma.digitalCourseEnrollment.findUnique({ where: { id: enrollmentId } })
    return record ? this.fromRecord(record) : null
  }

  static async enroll(input: DigitalCourseEnrollmentInput): Promise<DigitalCourseEnrollment> {
    const record = await prisma.digitalCourseEnrollment.upsert({
      where: { courseId_userId: { courseId: input.courseId, userId: input.userId } },
      create: {
        courseId: input.courseId,
        churchId: input.churchId,
        userId: input.userId,
        status: 'active',
        progressPercent: 0,
        moduleProgress: {},
      },
      update: {},
    })
    return this.fromRecord(record)
  }

  static async listByCourse(courseId: string): Promise<DigitalCourseEnrollment[]> {
    const records = await prisma.digitalCourseEnrollment.findMany({
      where: { courseId },
      orderBy: { createdAt: 'desc' },
    })
    return records.map((r) => this.fromRecord(r))
  }

  static async listByUser(userId: string): Promise<DigitalCourseEnrollment[]> {
    const records = await prisma.digitalCourseEnrollment.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })
    return records.map((r) => this.fromRecord(r))
  }

  static async findByUserAndCourse(userId: string, courseId: string): Promise<DigitalCourseEnrollment | null> {
    const record = await prisma.digitalCourseEnrollment.findUnique({
      where: { courseId_userId: { courseId, userId } },
    })
    return record ? this.fromRecord(record) : null
  }

  static async updateProgress(
    enrollmentId: string,
    progressPercent?: number,
    moduleProgress?: Record<string, number>,
    status?: DigitalCourseEnrollmentStatus,
    badgeIssuedAt?: Date,
    certificate?: {
      url?: string | null
      storagePath?: string | null
      issuedAt?: Date | null
    },
  ): Promise<DigitalCourseEnrollment | null> {
    const existing = await prisma.digitalCourseEnrollment.findUnique({ where: { id: enrollmentId } })
    if (!existing) return null

    const updatePayload: Prisma.DigitalCourseEnrollmentUpdateInput = {}

    if (typeof progressPercent === 'number') updatePayload.progressPercent = progressPercent
    if (moduleProgress) updatePayload.moduleProgress = moduleProgress
    if (status) updatePayload.status = status
    if (badgeIssuedAt) updatePayload.badgeIssuedAt = badgeIssuedAt
    if (certificate) {
      if ('url' in certificate) updatePayload.certificateUrl = certificate.url ?? null
      if ('storagePath' in certificate) updatePayload.certificateStoragePath = certificate.storagePath ?? null
      if ('issuedAt' in certificate) updatePayload.certificateIssuedAt = certificate.issuedAt ?? null
    }

    const record = await prisma.digitalCourseEnrollment.update({
      where: { id: enrollmentId },
      data: updatePayload,
    })
    return this.fromRecord(record)
  }

  private static fromRecord(record: any): DigitalCourseEnrollment {
    return {
      id: record.id,
      courseId: record.courseId,
      churchId: record.churchId,
      userId: record.userId,
      status: record.status,
      progressPercent: record.progressPercent ?? 0,
      moduleProgress: (record.moduleProgress as Record<string, number>) || {},
      badgeIssuedAt: record.badgeIssuedAt ?? undefined,
      certificateUrl: record.certificateUrl || undefined,
      certificateStoragePath: record.certificateStoragePath || undefined,
      certificateIssuedAt: record.certificateIssuedAt ?? undefined,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    }
  }
}

export class DigitalCourseExamService {
  static async listByCourse(courseId: string): Promise<DigitalCourseExam[]> {
    const records = await prisma.digitalCourseExam.findMany({
      where: { courseId },
      orderBy: { createdAt: 'desc' },
    })
    return records.map((r) => this.fromRecord(r))
  }

  static async listBySection(sectionId: string): Promise<DigitalCourseExam[]> {
    const records = await prisma.digitalCourseExam.findMany({
      where: { sectionId },
      orderBy: { createdAt: 'desc' },
    })
    return records.map((r) => this.fromRecord(r))
  }

  static async get(examId: string): Promise<DigitalCourseExam | null> {
    const record = await prisma.digitalCourseExam.findUnique({ where: { id: examId } })
    return record ? this.fromRecord(record) : null
  }

  static async create(input: DigitalCourseExamInput): Promise<DigitalCourseExam> {
    const record = await prisma.digitalCourseExam.create({
      data: {
        courseId: input.courseId,
        sectionId: input.sectionId,
        moduleId: input.moduleId ?? null,
        title: input.title,
        description: input.description ?? '',
        timeLimitMinutes: input.timeLimitMinutes ?? null,
        questionCount: 0,
        status: input.status ?? 'draft',
        uploadMetadata: (input.uploadMetadata ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        retakePolicy: normalizeRetakePolicy(input.retakePolicy) as Prisma.InputJsonValue,
        createdBy: input.createdBy,
        updatedBy: input.updatedBy ?? input.createdBy,
      },
    })
    return this.fromRecord(record)
  }

  static async update(
    examId: string,
    data: Partial<Omit<DigitalCourseExamInput, 'courseId'>>,
  ): Promise<DigitalCourseExam | null> {
    const existing = await prisma.digitalCourseExam.findUnique({ where: { id: examId } })
    if (!existing) return null

    const { retakePolicy, ...rest } = data
    const record = await prisma.digitalCourseExam.update({
      where: { id: examId },
      data: {
        ...(omitUndefined(rest) as Prisma.DigitalCourseExamUpdateInput),
        ...(retakePolicy !== undefined
          ? { retakePolicy: normalizeRetakePolicy(retakePolicy) as Prisma.InputJsonValue }
          : {}),
        updatedBy: data.updatedBy ?? existing.updatedBy,
      },
    })
    return this.fromRecord(record)
  }

  static async delete(examId: string): Promise<void> {
    await prisma.digitalCourseExam.delete({ where: { id: examId } })
  }

  static async incrementQuestionCount(examId: string, delta: number) {
    await prisma.digitalCourseExam.update({
      where: { id: examId },
      data: { questionCount: { increment: delta } },
    })
  }

  private static fromRecord(record: any): DigitalCourseExam {
    return {
      id: record.id,
      courseId: record.courseId,
      sectionId: record.sectionId,
      moduleId: record.moduleId || undefined,
      title: record.title,
      description: record.description || undefined,
      timeLimitMinutes: record.timeLimitMinutes ?? undefined,
      questionCount: record.questionCount || 0,
      status: record.status ?? 'draft',
      uploadMetadata: (record.uploadMetadata as DigitalCourseExam['uploadMetadata']) || undefined,
      retakePolicy: (record.retakePolicy as DigitalCourseExam['retakePolicy']) || undefined,
      createdBy: record.createdBy,
      updatedBy: record.updatedBy,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    }
  }
}

export class DigitalExamQuestionService {
  static async get(questionId: string): Promise<DigitalExamQuestion | null> {
    const record = await prisma.digitalExamQuestion.findUnique({ where: { id: questionId } })
    return record ? this.fromRecord(record) : null
  }

  static async listByExam(examId: string): Promise<DigitalExamQuestion[]> {
    const records = await prisma.digitalExamQuestion.findMany({
      where: { examId },
      orderBy: { createdAt: 'asc' },
    })
    return records.map((r) => this.fromRecord(r))
  }

  static async create(input: DigitalExamQuestionInput): Promise<DigitalExamQuestion> {
    const [record] = await prisma.$transaction([
      prisma.digitalExamQuestion.create({
        data: {
          examId: input.examId,
          courseId: input.courseId,
          moduleId: input.moduleId ?? null,
          question: input.question,
          options: input.options,
          correctOption: input.correctOption,
          explanation: input.explanation ?? '',
          weight: input.weight ?? 1,
          durationSeconds: input.durationSeconds ?? null,
        },
      }),
      prisma.digitalCourseExam.update({
        where: { id: input.examId },
        data: { questionCount: { increment: 1 } },
      }),
    ])
    return this.fromRecord(record)
  }

  static async update(
    questionId: string,
    data: Partial<Omit<DigitalExamQuestionInput, 'examId' | 'courseId'>>,
  ): Promise<DigitalExamQuestion | null> {
    const existing = await prisma.digitalExamQuestion.findUnique({ where: { id: questionId } })
    if (!existing) return null

    const record = await prisma.digitalExamQuestion.update({
      where: { id: questionId },
      data: omitUndefined(data) as Prisma.DigitalExamQuestionUpdateInput,
    })
    return this.fromRecord(record)
  }

  static async delete(questionId: string): Promise<boolean> {
    const existing = await prisma.digitalExamQuestion.findUnique({ where: { id: questionId } })
    if (!existing) return false

    await prisma.$transaction([
      prisma.digitalExamQuestion.delete({ where: { id: questionId } }),
      prisma.digitalCourseExam.update({
        where: { id: existing.examId },
        data: { questionCount: { decrement: 1 } },
      }),
    ])
    return true
  }

  private static fromRecord(record: any): DigitalExamQuestion {
    return {
      id: record.id,
      examId: record.examId,
      courseId: record.courseId,
      moduleId: record.moduleId || undefined,
      question: record.question,
      options: record.options || [],
      correctOption: record.correctOption,
      explanation: record.explanation || undefined,
      weight: record.weight ?? 1,
      durationSeconds: record.durationSeconds ?? undefined,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    }
  }
}

export class DigitalExamAttemptService {
  static async get(attemptId: string): Promise<DigitalExamAttempt | null> {
    const record = await prisma.digitalExamAttempt.findUnique({ where: { id: attemptId } })
    return record ? this.fromRecord(record) : null
  }

  static async listByExam(examId: string): Promise<DigitalExamAttempt[]> {
    const records = await prisma.digitalExamAttempt.findMany({
      where: { examId },
      orderBy: { createdAt: 'desc' },
    })
    return records.map((r) => this.fromRecord(r))
  }

  static async listByUser(userId: string): Promise<DigitalExamAttempt[]> {
    const records = await prisma.digitalExamAttempt.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })
    return records.map((r) => this.fromRecord(r))
  }

  static async listByExams(examIds: string[]): Promise<DigitalExamAttempt[]> {
    if (examIds.length === 0) return []
    const records = await prisma.digitalExamAttempt.findMany({
      where: { examId: { in: examIds } },
      orderBy: { createdAt: 'desc' },
    })
    return records.map((r) => this.fromRecord(r))
  }

  static async start(input: DigitalExamAttemptInput): Promise<DigitalExamAttempt> {
    const record = await prisma.digitalExamAttempt.create({
      data: {
        examId: input.examId,
        courseId: input.courseId,
        userId: input.userId,
        status: 'in_progress',
        responses: [],
      },
    })
    return this.fromRecord(record)
  }

  static async submit(
    attemptId: string,
    responses: Array<{ questionId: string; answerIndex: number }>,
  ): Promise<DigitalExamAttempt | null> {
    const existing = await prisma.digitalExamAttempt.findUnique({ where: { id: attemptId } })
    if (!existing) return null

    const questions = await DigitalExamQuestionService.listByExam(existing.examId)

    const gradedResponses = responses.map((response) => {
      const question = questions.find((q) => q.id === response.questionId)
      const correct = question ? question.correctOption === response.answerIndex : false
      return {
        questionId: response.questionId,
        answerIndex: response.answerIndex,
        correct,
      }
    })

    const totalQuestions = questions.length
    const correctCount = gradedResponses.filter((r) => r.correct).length
    const score = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0

    const record = await prisma.digitalExamAttempt.update({
      where: { id: attemptId },
      data: {
        status: 'submitted',
        score,
        totalQuestions,
        responses: gradedResponses,
        submittedAt: new Date(),
      },
    })
    return this.fromRecord(record)
  }

  private static fromRecord(record: any): DigitalExamAttempt {
    return {
      id: record.id,
      examId: record.examId,
      courseId: record.courseId,
      userId: record.userId,
      status: record.status,
      score: typeof record.score === 'number' ? record.score : undefined,
      totalQuestions: typeof record.totalQuestions === 'number' ? record.totalQuestions : undefined,
      startedAt: record.startedAt,
      submittedAt: record.submittedAt ?? undefined,
      responses: (record.responses as DigitalExamAttempt['responses']) || [],
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    }
  }
}

export class DigitalCourseService {
  static async list(churchId: string, limit: number = 50): Promise<DigitalCourse[]> {
    const records = await prisma.digitalCourse.findMany({
      where: { churchId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
    return records.map((r) => this.fromRecord(r))
  }

  static async get(courseId: string): Promise<DigitalCourse | null> {
    const record = await prisma.digitalCourse.findUnique({ where: { id: courseId } })
    return record ? this.fromRecord(record) : null
  }

  static async create(input: DigitalCourseInput): Promise<DigitalCourse> {
    const record = await prisma.digitalCourse.create({
      data: {
        churchId: input.churchId,
        title: input.title,
        summary: input.summary ?? '',
        accessType: input.accessType ?? 'open',
        mentors: input.mentors ?? [],
        estimatedHours: input.estimatedHours ?? null,
        coverImageUrl: input.coverImageUrl ?? null,
        tags: input.tags ?? [],
        status: input.status ?? 'draft',
        pricing: normalizePricing(input.pricing) as unknown as Prisma.InputJsonValue,
        certificateTheme: (input.certificateTheme ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        createdBy: input.createdBy,
        updatedBy: input.updatedBy ?? input.createdBy,
      },
    })
    return this.fromRecord(record)
  }

  static async update(courseId: string, data: Partial<DigitalCourseInput>): Promise<DigitalCourse | null> {
    const existing = await prisma.digitalCourse.findUnique({ where: { id: courseId } })
    if (!existing) return null

    const { pricing, certificateTheme, churchId: _c, createdBy: _cb, ...rest } = data
    const record = await prisma.digitalCourse.update({
      where: { id: courseId },
      data: {
        ...(omitUndefined(rest) as Prisma.DigitalCourseUpdateInput),
        ...(pricing !== undefined ? { pricing: normalizePricing(pricing) as unknown as Prisma.InputJsonValue } : {}),
        ...(certificateTheme !== undefined
          ? { certificateTheme: (certificateTheme ?? Prisma.JsonNull) as Prisma.InputJsonValue }
          : {}),
        updatedBy: data.updatedBy ?? existing.updatedBy,
      },
    })
    return this.fromRecord(record)
  }

  static async delete(courseId: string): Promise<void> {
    await prisma.digitalCourse.delete({ where: { id: courseId } })
  }

  private static fromRecord(record: any): DigitalCourse {
    return {
      id: record.id,
      churchId: record.churchId,
      title: record.title,
      summary: record.summary || undefined,
      accessType: record.accessType,
      mentors: record.mentors || [],
      estimatedHours: record.estimatedHours ?? undefined,
      coverImageUrl: record.coverImageUrl || undefined,
      tags: record.tags || [],
      status: record.status ?? 'draft',
      pricing: normalizePricing(record.pricing as DigitalCoursePricing),
      certificateTheme: (record.certificateTheme as CertificateTheme) || undefined,
      createdBy: record.createdBy,
      updatedBy: record.updatedBy,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    }
  }
}

export class DigitalCourseSectionService {
  static async listByCourse(courseId: string): Promise<DigitalCourseSection[]> {
    const records = await prisma.digitalCourseSection.findMany({
      where: { courseId },
      orderBy: { order: 'asc' },
    })
    return records.map((r) => this.fromRecord(r))
  }

  static async get(sectionId: string): Promise<DigitalCourseSection | null> {
    const record = await prisma.digitalCourseSection.findUnique({ where: { id: sectionId } })
    return record ? this.fromRecord(record) : null
  }

  static async create(input: DigitalCourseSectionInput): Promise<DigitalCourseSection> {
    const existingCount = await prisma.digitalCourseSection.count({
      where: { courseId: input.courseId },
    })
    const record = await prisma.digitalCourseSection.create({
      data: {
        courseId: input.courseId,
        title: input.title,
        description: input.description ?? '',
        order: input.order ?? existingCount + 1,
        estimatedHours: input.estimatedHours ?? null,
      },
    })
    return this.fromRecord(record)
  }

  static async update(
    sectionId: string,
    data: Partial<Omit<DigitalCourseSectionInput, 'courseId'>>,
  ): Promise<DigitalCourseSection | null> {
    const existing = await prisma.digitalCourseSection.findUnique({ where: { id: sectionId } })
    if (!existing) return null

    const record = await prisma.digitalCourseSection.update({
      where: { id: sectionId },
      data: omitUndefined(data) as Prisma.DigitalCourseSectionUpdateInput,
    })
    return this.fromRecord(record)
  }

  static async delete(sectionId: string): Promise<void> {
    await prisma.digitalCourseSection.delete({ where: { id: sectionId } })
  }

  private static fromRecord(record: any): DigitalCourseSection {
    return {
      id: record.id,
      courseId: record.courseId,
      title: record.title,
      description: record.description || undefined,
      order: record.order,
      estimatedHours: record.estimatedHours ?? undefined,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    }
  }
}

export class DigitalCourseModuleService {
  static async listByCourse(courseId: string): Promise<DigitalCourseModule[]> {
    const records = await prisma.digitalCourseModule.findMany({
      where: { courseId },
      orderBy: { order: 'asc' },
    })
    return records.map((r) => this.fromRecord(r))
  }

  static async listBySection(sectionId: string): Promise<DigitalCourseModule[]> {
    const records = await prisma.digitalCourseModule.findMany({
      where: { sectionId },
      orderBy: { order: 'asc' },
    })
    return records.map((r) => this.fromRecord(r))
  }

  static async get(moduleId: string): Promise<DigitalCourseModule | null> {
    const record = await prisma.digitalCourseModule.findUnique({ where: { id: moduleId } })
    return record ? this.fromRecord(record) : null
  }

  static async create(input: DigitalCourseModuleInput): Promise<DigitalCourseModule> {
    const existingCount = await prisma.digitalCourseModule.count({
      where: { sectionId: input.sectionId },
    })
    const record = await prisma.digitalCourseModule.create({
      data: {
        courseId: input.courseId,
        sectionId: input.sectionId,
        title: input.title,
        description: input.description ?? '',
        order: input.order ?? existingCount + 1,
        estimatedMinutes: input.estimatedMinutes ?? null,
        videoUrl: input.videoUrl ?? null,
        audioUrl: input.audioUrl ?? null,
        audioFileName: input.audioFileName ?? null,
        audioStoragePath: input.audioStoragePath ?? null,
        bookUrl: input.bookUrl ?? null,
        bookFileName: input.bookFileName ?? null,
        bookStoragePath: input.bookStoragePath ?? null,
        contentType: input.contentType ?? 'video',
        textContent: input.textContent ?? '',
      },
    })
    return this.fromRecord(record)
  }

  static async update(
    moduleId: string,
    data: Partial<Omit<DigitalCourseModuleInput, 'courseId'>>,
  ): Promise<DigitalCourseModule | null> {
    const existing = await prisma.digitalCourseModule.findUnique({ where: { id: moduleId } })
    if (!existing) return null

    const record = await prisma.digitalCourseModule.update({
      where: { id: moduleId },
      data: omitUndefined(data) as Prisma.DigitalCourseModuleUpdateInput,
    })
    return this.fromRecord(record)
  }

  static async delete(moduleId: string): Promise<void> {
    await prisma.digitalCourseModule.delete({ where: { id: moduleId } })
  }

  private static fromRecord(record: any): DigitalCourseModule {
    return {
      id: record.id,
      courseId: record.courseId,
      sectionId: record.sectionId,
      title: record.title,
      description: record.description || undefined,
      order: record.order,
      estimatedMinutes: record.estimatedMinutes ?? undefined,
      videoUrl: record.videoUrl || undefined,
      audioUrl: record.audioUrl || undefined,
      audioFileName: record.audioFileName || undefined,
      audioStoragePath: record.audioStoragePath || undefined,
      bookUrl: record.bookUrl || undefined,
      bookFileName: record.bookFileName || undefined,
      bookStoragePath: record.bookStoragePath || undefined,
      contentType: (record.contentType as DigitalCourseModuleContentType) || 'video',
      textContent: record.textContent || undefined,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    }
  }
}

export class DigitalCourseLessonService {
  static async listByModule(moduleId: string): Promise<DigitalCourseLesson[]> {
    const records = await prisma.digitalCourseLesson.findMany({
      where: { moduleId },
      orderBy: { order: 'asc' },
    })
    return records.map((r) => this.fromRecord(r))
  }

  static async get(lessonId: string): Promise<DigitalCourseLesson | null> {
    const record = await prisma.digitalCourseLesson.findUnique({ where: { id: lessonId } })
    return record ? this.fromRecord(record) : null
  }

  static async create(input: DigitalCourseLessonInput): Promise<DigitalCourseLesson> {
    const existingCount = await prisma.digitalCourseLesson.count({
      where: { moduleId: input.moduleId },
    })
    const record = await prisma.digitalCourseLesson.create({
      data: {
        courseId: input.courseId,
        moduleId: input.moduleId,
        title: input.title,
        description: input.description ?? '',
        videoUrl: input.videoUrl ?? null,
        audioUrl: input.audioUrl ?? null,
        attachmentUrls: input.attachmentUrls ?? [],
        transcript: input.transcript ?? '',
        order: input.order ?? existingCount + 1,
      },
    })
    return this.fromRecord(record)
  }

  static async update(
    lessonId: string,
    data: Partial<Omit<DigitalCourseLessonInput, 'courseId'>>,
  ): Promise<DigitalCourseLesson | null> {
    const existing = await prisma.digitalCourseLesson.findUnique({ where: { id: lessonId } })
    if (!existing) return null

    const record = await prisma.digitalCourseLesson.update({
      where: { id: lessonId },
      data: omitUndefined(data) as Prisma.DigitalCourseLessonUpdateInput,
    })
    return this.fromRecord(record)
  }

  static async delete(lessonId: string): Promise<void> {
    await prisma.digitalCourseLesson.delete({ where: { id: lessonId } })
  }

  private static fromRecord(record: any): DigitalCourseLesson {
    return {
      id: record.id,
      courseId: record.courseId,
      moduleId: record.moduleId,
      title: record.title,
      description: record.description || undefined,
      videoUrl: record.videoUrl || undefined,
      audioUrl: record.audioUrl || undefined,
      attachmentUrls: record.attachmentUrls || [],
      transcript: record.transcript || undefined,
      order: record.order,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    }
  }
}

export class DigitalCourseAccessRequestService {
  static async get(id: string): Promise<DigitalCourseAccessRequest | null> {
    const record = await prisma.digitalCourseAccessRequest.findUnique({ where: { id } })
    return record ? this.fromRecord(record) : null
  }

  static async listByCourse(
    courseId: string,
    status?: AccessRequestStatus,
  ): Promise<DigitalCourseAccessRequest[]> {
    const records = await prisma.digitalCourseAccessRequest.findMany({
      where: { courseId, ...(status ? { status } : {}) },
      orderBy: { createdAt: 'desc' },
    })
    return records.map((r) => this.fromRecord(r))
  }

  static async listPending(courseId: string): Promise<DigitalCourseAccessRequest[]> {
    return this.listByCourse(courseId, 'pending')
  }

  static async listByUser(userId: string): Promise<DigitalCourseAccessRequest[]> {
    const records = await prisma.digitalCourseAccessRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })
    return records.map((r) => this.fromRecord(r))
  }

  static async submit(input: DigitalCourseAccessRequestInput): Promise<DigitalCourseAccessRequest> {
    const record = await prisma.digitalCourseAccessRequest.create({
      data: {
        courseId: input.courseId,
        userId: input.userId,
        reason: input.reason ?? '',
        status: 'pending',
      },
    })
    return this.fromRecord(record)
  }

  static async updateStatus(
    id: string,
    status: AccessRequestStatus,
    reviewerId: string,
    reviewerNote?: string,
  ): Promise<DigitalCourseAccessRequest | null> {
    const existing = await prisma.digitalCourseAccessRequest.findUnique({ where: { id } })
    if (!existing) return null

    const record = await prisma.digitalCourseAccessRequest.update({
      where: { id },
      data: {
        status,
        reviewerId,
        reviewerNote: reviewerNote ?? null,
      },
    })
    return this.fromRecord(record)
  }

  private static fromRecord(record: any): DigitalCourseAccessRequest {
    return {
      id: record.id,
      courseId: record.courseId,
      userId: record.userId,
      reason: record.reason || undefined,
      status: record.status,
      reviewerId: record.reviewerId || undefined,
      reviewerNote: record.reviewerNote || undefined,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    }
  }
}
