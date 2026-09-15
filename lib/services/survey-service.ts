import { prisma } from '@/lib/prisma'
import type {
  Survey,
  SurveyQuestion,
  SurveySection,
  TargetAudience,
  SurveyResponse,
  SurveyTemplate,
  CreateSurveyRequest,
  SubmitSurveyResponseRequest,
  SurveyFilters,
  SurveySortOptions,
  SurveyPermissions,
  SurveyStatus,
  TargetAudienceType,
  SurveyAnalytics,
  SurveyInsights,
  SurveyQuestionAnalytics,
  SurveyResponseBreakdown,
} from '@/types/survey'

export class SurveyService {
  /**
   * Create a new survey
   */
  static async createSurvey(
    churchId: string,
    createdBy: string,
    data: CreateSurveyRequest,
    intent: 'draft' | 'publish' = 'draft'
  ): Promise<Survey> {
    const sectionsInput =
      data.sections && data.sections.length > 0
        ? data.sections
        : [
            {
              id: 'default-section',
              title: 'Section 1',
              description: '',
              order: 0
            }
          ]

    const createdSurvey = await prisma.$transaction(async (tx) => {
      const createdSurvey = await tx.survey.create({
        data: {
          churchId,
          createdBy,
          title: data.title,
          description: data.description,
          isAnonymous: data.settings.isAnonymous,
          allowMultipleResponses: data.settings.allowMultipleResponses,
          deadline: data.settings.deadline,
          targetAudienceType: data.settings.targetAudienceType,
          targetBranchIds: data.settings.targetBranchIds || [],
          targetGroupIds: data.settings.targetGroupIds || [],
          targetUserIds: data.settings.targetUserIds || [],
          sendOnPublish: data.settings.sendOnPublish,
          sendReminders: data.settings.sendReminders,
          reminderDays: data.settings.reminderDays,
          meetingId: data.settings.meetingId,
          status: intent === 'publish' ? 'ACTIVE' : 'DRAFT',
          publishedAt: intent === 'publish' ? new Date() : undefined
        }
      })

      const sectionIdMap = new Map<string, string>()
      const orderedSections = sectionsInput
        .slice()
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

      for (let index = 0; index < orderedSections.length; index += 1) {
        const section = orderedSections[index]
        const createdSection = await tx.surveySection.create({
          data: {
            surveyId: createdSurvey.id,
            title: section.title || `Section ${index + 1}`,
            description: section.description || '',
            order: section.order ?? index
          }
        })
        if (section.id) {
          sectionIdMap.set(section.id, createdSection.id)
        } else {
          sectionIdMap.set(`__generated_section_${index}`, createdSection.id)
        }
      }

      const fallbackSectionId =
        sectionIdMap.get(sectionsInput[0]?.id || 'default-section') ||
        Array.from(sectionIdMap.values())[0]

      await Promise.all(
        data.questions.map((question: any, index: number) =>
          tx.surveyQuestion.create({
            data: {
              surveyId: createdSurvey.id,
              sectionId: question.sectionId
                ? sectionIdMap.get(question.sectionId) ?? fallbackSectionId
                : fallbackSectionId,
              type: question.type,
              title: question.title,
              description: question.description,
              required: question.required,
              order: index,
              options: question.options ?? undefined,
              minRating: question.minRating,
              maxRating: question.maxRating,
              ratingLabels: question.ratingLabels ?? undefined
            }
          })
        )
      )

      return createdSurvey
    })

    const survey = await prisma.survey.findUnique({
      where: { id: createdSurvey.id },
      include: {
        sections: {
          orderBy: { order: 'asc' }
        },
        questions: {
          orderBy: { order: 'asc' }
        },
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    })

    if (!survey) {
      throw new Error('Failed to hydrate survey after creation')
    }

    return this.transformSurveyFromPrisma(survey)
  }

  /**
   * Get survey by ID
   */
  static async getSurveyById(surveyId: string, userId?: string): Promise<Survey | null> {
    const survey = await prisma.survey.findUnique({
      where: { id: surveyId },
      include: {
        sections: {
          orderBy: { order: 'asc' }
        },
        questions: {
          orderBy: { order: 'asc' }
        },
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        responses: userId
          ? {
              where: { userId },
              include: {
                questionResponses: true
              }
            }
          : false
      }
    })

    if (!survey) return null
    return this.transformSurveyFromPrisma(survey)
  }

  /**
   * Get surveys for a user (filtered by permissions and target audience)
   */
  static async getSurveysForUser(
    userId: string,
    churchId: string,
    filters?: SurveyFilters,
    sort?: SurveySortOptions
  ): Promise<Survey[]> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        groups: {
          select: { groupId: true }
        }
      }
    })

    if (!user) return []

    const userGroupIds = user.groups.map((g: { groupId: string }) => g.groupId)

    const whereClause: any = {
      churchId,
      status: filters?.status ? { in: filters.status } : { in: ['ACTIVE'] },
      OR: [
        { targetAudienceType: 'ALL' },
        {
          targetAudienceType: 'BRANCH',
          targetBranchIds: { has: user.branchId }
        },
        {
          targetAudienceType: 'GROUP',
          targetGroupIds: { hasSome: userGroupIds }
        },
        {
          targetAudienceType: 'CUSTOM',
          targetUserIds: { has: userId }
        }
      ]
    }

    if (filters?.createdBy?.length) {
      whereClause.createdBy = { in: filters.createdBy }
    }

    if (filters?.dateRange) {
      whereClause.createdAt = {
        gte: filters.dateRange.start,
        lte: filters.dateRange.end
      }
    }

    const orderBy: any = {}
    if (sort?.field) {
      orderBy[sort.field] = sort.direction
    } else {
      orderBy.createdAt = 'desc'
    }

    const surveys = await prisma.survey.findMany({
      where: whereClause,
      orderBy,
      include: {
        sections: {
          orderBy: { order: 'asc' }
        },
        questions: {
          orderBy: { order: 'asc' }
        },
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        _count: {
          select: { responses: true }
        }
      }
    })

    return surveys.map((survey: any) => this.transformSurveyFromPrisma(survey))
  }

  /**
   * Get surveys created by a user
   */
  static async getSurveysByCreator(
    creatorId: string,
    churchId: string,
    filters?: SurveyFilters
  ): Promise<Survey[]> {
    const whereClause: any = {
      churchId,
      createdBy: creatorId
    }

    if (filters?.status?.length) {
      whereClause.status = { in: filters.status }
    }

    if (filters?.dateRange) {
      whereClause.createdAt = {
        gte: filters.dateRange.start,
        lte: filters.dateRange.end
      }
    }

    const surveys = await prisma.survey.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      include: {
        sections: {
          orderBy: { order: 'asc' }
        },
        questions: {
          orderBy: { order: 'asc' }
        },
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        _count: {
          select: { responses: true }
        }
      }
    })

    return surveys.map((survey: any) => this.transformSurveyFromPrisma(survey))
  }

  /**
   * Update survey
   */
  static async updateSurvey(
    surveyId: string,
    userId: string,
    data: Partial<CreateSurveyRequest>
  ): Promise<Survey | null> {
    // Check if user can edit this survey
    const existingSurvey = await prisma.survey.findUnique({
      where: { id: surveyId },
      select: { createdBy: true, status: true }
    })

    if (!existingSurvey || existingSurvey.createdBy !== userId) {
      throw new Error('Unauthorized to edit this survey')
    }

    if (existingSurvey.status === 'ACTIVE') {
      throw new Error('Cannot edit active survey')
    }

    const updateData: any = {}
    
    if (data.title) updateData.title = data.title
    if (data.description !== undefined) updateData.description = data.description
    
    if (data.settings) {
      if (data.settings.isAnonymous !== undefined) updateData.isAnonymous = data.settings.isAnonymous
      if (data.settings.allowMultipleResponses !== undefined) updateData.allowMultipleResponses = data.settings.allowMultipleResponses
      if (data.settings.deadline !== undefined) updateData.deadline = data.settings.deadline
      if (data.settings.targetAudienceType) updateData.targetAudienceType = data.settings.targetAudienceType
      if (data.settings.targetBranchIds) updateData.targetBranchIds = data.settings.targetBranchIds
      if (data.settings.targetGroupIds) updateData.targetGroupIds = data.settings.targetGroupIds
      if (data.settings.targetUserIds) updateData.targetUserIds = data.settings.targetUserIds
      if (data.settings.sendOnPublish !== undefined) updateData.sendOnPublish = data.settings.sendOnPublish
      if (data.settings.sendReminders !== undefined) updateData.sendReminders = data.settings.sendReminders
      if (data.settings.reminderDays) updateData.reminderDays = data.settings.reminderDays
      if (data.settings.meetingId !== undefined) updateData.meetingId = data.settings.meetingId
    }

    const survey = await prisma.survey.update({
      where: { id: surveyId },
      data: updateData,
      include: {
        sections: {
          orderBy: { order: 'asc' }
        },
        questions: {
          orderBy: { order: 'asc' }
        },
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    })

    return this.transformSurveyFromPrisma(survey)
  }

  /**
   * Publish survey (change status to ACTIVE)
   */
  static async publishSurvey(surveyId: string, userId: string): Promise<Survey | null> {
    const survey = await prisma.survey.findUnique({
      where: { id: surveyId },
      select: { createdBy: true, status: true }
    })

    if (!survey || survey.createdBy !== userId) {
      throw new Error('Unauthorized to publish this survey')
    }

    if (survey.status !== 'DRAFT') {
      throw new Error('Only draft surveys can be published')
    }

    const updatedSurvey = await prisma.survey.update({
      where: { id: surveyId },
      data: {
        status: 'ACTIVE',
        publishedAt: new Date()
      },
      include: {
        sections: {
          orderBy: { order: 'asc' }
        },
        questions: {
          orderBy: { order: 'asc' }
        },
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    })

    return this.transformSurveyFromPrisma(updatedSurvey)
  }

  /**
   * Close survey (change status to CLOSED)
   */
  static async closeSurvey(surveyId: string, userId: string): Promise<Survey | null> {
    const survey = await prisma.survey.findUnique({
      where: { id: surveyId },
      select: { createdBy: true, status: true }
    })

    if (!survey || survey.createdBy !== userId) {
      throw new Error('Unauthorized to close this survey')
    }

    if (survey.status !== 'ACTIVE') {
      throw new Error('Only active surveys can be closed')
    }

    const updatedSurvey = await prisma.survey.update({
      where: { id: surveyId },
      data: {
        status: 'CLOSED',
        closedAt: new Date()
      },
      include: {
        sections: {
          orderBy: { order: 'asc' }
        },
        questions: {
          orderBy: { order: 'asc' }
        },
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    })

    return this.transformSurveyFromPrisma(updatedSurvey)
  }

  /**
   * Submit survey response
   */
  static async submitResponse(
    surveyId: string,
    userId: string | null,
    data: SubmitSurveyResponseRequest,
    ipAddress?: string,
    userAgent?: string
  ): Promise<SurveyResponse> {
    const survey = await prisma.survey.findUnique({
      where: { id: surveyId },
      include: {
        sections: true,
        questions: true,
        responses: userId ? { where: { userId } } : false
      }
    })

    if (!survey) {
      throw new Error('Survey not found')
    }

    if (survey.status !== 'ACTIVE') {
      throw new Error('Survey is not active')
    }

    if (survey.deadline && new Date() > survey.deadline) {
      throw new Error('Survey deadline has passed')
    }

    // Authenticated users must belong to the survey's church and target audience
    if (userId) {
      const allowed = await this.canUserAccessSurvey(surveyId, userId)
      const respondent = await prisma.user.findUnique({ where: { id: userId }, select: { churchId: true } })
      if (!respondent || respondent.churchId !== survey.churchId || !allowed) {
        throw new Error('You do not have access to this survey')
      }
    }

    // Check for duplicate responses
    if (!survey.allowMultipleResponses && userId && survey.responses && survey.responses.length > 0) {
      throw new Error('You have already responded to this survey')
    }

    // Anonymous submissions: dedupe by IP when multiple responses are disallowed
    if (!survey.allowMultipleResponses && !userId && ipAddress && ipAddress !== 'unknown') {
      const existingFromIp = await prisma.surveyResponse.findFirst({
        where: { surveyId, ipAddress },
        select: { id: true }
      })
      if (existingFromIp) {
        throw new Error('A response has already been submitted from this network')
      }
    }

    // Validate required questions
    const requiredQuestions = survey.questions.filter((q: any) => q.required)
    for (const question of requiredQuestions) {
      const response = data.responses.find(r => r.questionId === question.id)
      if (!response || response.value === null || response.value === undefined || response.value === '') {
        throw new Error(`Response required for question: ${question.title}`)
      }
    }

    const response = await prisma.surveyResponse.create({
      data: {
        surveyId,
        userId: survey.isAnonymous ? null : userId,
        ipAddress,
        userAgent,
        questionResponses: {
          create: data.responses.map((r: any) => ({
            questionId: r.questionId,
            value: r.value,
            textValue: r.textValue
          }))
        }
      },
      include: {
        questionResponses: {
          include: {
            question: true
          }
        }
      }
    })

    return this.transformResponseFromPrisma(response)
  }

  /**
   * Get survey responses (for analytics)
   */
  static async getSurveyResponses(
    surveyId: string,
    userId: string
  ): Promise<SurveyResponse[]> {
    // Check if user can view responses
    const survey = await prisma.survey.findUnique({
      where: { id: surveyId },
      select: { createdBy: true, churchId: true }
    })

    if (!survey || survey.createdBy !== userId) {
      throw new Error('Unauthorized to view survey responses')
    }

    const responses = await prisma.surveyResponse.findMany({
      where: { surveyId },
      include: {
        questionResponses: {
          include: {
            question: true
          }
        },
        user: survey ? {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        } : false
      },
      orderBy: { submittedAt: 'desc' }
    })

    return responses.map((response: any) => this.transformResponseFromPrisma(response))
  }

  /**
   * Delete survey
   */
  static async deleteSurvey(surveyId: string, userId: string): Promise<void> {
    const survey = await prisma.survey.findUnique({
      where: { id: surveyId },
      select: { createdBy: true, status: true }
    })

    if (!survey || survey.createdBy !== userId) {
      throw new Error('Unauthorized to delete this survey')
    }

    if (survey.status === 'ACTIVE') {
      throw new Error('Cannot delete active survey. Close it first.')
    }

    await prisma.survey.delete({
      where: { id: surveyId }
    })
  }

  /**
   * Check if user can access survey
   */
  static async canUserAccessSurvey(surveyId: string, userId: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        groups: {
          select: { groupId: true }
        }
      }
    })

    if (!user) return false

    const survey = await prisma.survey.findUnique({
      where: { id: surveyId },
      select: {
        status: true,
        churchId: true,
        targetAudienceType: true,
        targetBranchIds: true,
        targetGroupIds: true,
        targetUserIds: true
      }
    })

    if (!survey || survey.status !== 'ACTIVE') return false

    // Tenant isolation: a survey is only accessible within its own church
    if (survey.churchId !== user.churchId) return false

    return this.isUserInTargetAudience(survey, user)
  }

  /**
   * Get user permissions for surveys
   */
  static getUserPermissions(userRole: string): SurveyPermissions {
    const canCreate = ['ADMIN', 'SUPER_ADMIN', 'PASTOR', 'BRANCH_ADMIN', 'LEADER'].includes(userRole)
    const canManageAll = ['ADMIN', 'SUPER_ADMIN', 'PASTOR'].includes(userRole)

    return {
      canCreate,
      canEdit: canCreate,
      canDelete: canCreate,
      canViewResults: canCreate,
      canExportResults: canCreate,
      canManageTemplates: canManageAll
    }
  }

  /**
   * Check if user can submit response to survey
   */
  canUserSubmitResponse(survey: Survey, userId: string, existingResponses: SurveyResponse[]): boolean {
    // Check if survey is active
    if (survey.status !== 'ACTIVE') {
      return false
    }

    // Check if survey has deadline and it has passed
    if (survey.deadline && new Date() > survey.deadline) {
      return false
    }

    // If multiple responses are allowed, user can always submit
    if (survey.allowMultipleResponses) {
      return true
    }

    // For non-anonymous surveys, check if user already has a response
    if (!survey.isAnonymous) {
      const userHasResponse = existingResponses.some(response => response.userId === userId)
      return !userHasResponse
    }

    // For anonymous surveys, we can't prevent duplicates by user ID
    // This would typically be handled by IP address or session tracking
    return true
  }

  /**
   * Check if IP address can submit response (for anonymous surveys)
   */
  canSubmitResponseByIp(survey: Survey, ipAddress: string, existingResponses: SurveyResponse[]): boolean {
    // Check if survey is active
    if (survey.status !== 'ACTIVE') {
      return false
    }

    // If multiple responses are allowed, IP can always submit
    if (survey.allowMultipleResponses) {
      return true
    }

    // Check if IP already has a response
    const ipHasResponse = existingResponses.some(response => response.ipAddress === ipAddress)
    return !ipHasResponse
  }

  /**
   * Helper: Check if user is in target audience
   */
  private static isUserInTargetAudience(survey: any, user: any): boolean {
    const userGroupIds = user.groups?.map((g: any) => g.groupId) || []

    switch (survey.targetAudienceType) {
      case 'ALL':
        return true
      case 'BRANCH':
        return survey.targetBranchIds.includes(user.branchId)
      case 'GROUP':
        return survey.targetGroupIds.some((groupId: string) => userGroupIds.includes(groupId))
      case 'CUSTOM':
        return survey.targetUserIds.includes(user.id)
      default:
        return false
    }
  }

  /**
   * Get surveys linked to a specific meeting
   */
  static async getSurveysByMeeting(
    meetingId: string,
    churchId: string
  ): Promise<Survey[]> {
    const surveys = await prisma.survey.findMany({
      where: {
        churchId,
        meetingId
      },
      orderBy: { createdAt: 'desc' },
      include: {
        sections: {
          orderBy: { order: 'asc' }
        },
        questions: {
          orderBy: { order: 'asc' }
        },
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        _count: {
          select: { responses: true }
        }
      }
    })

    return surveys.map((survey: any) => this.transformSurveyFromPrisma(survey))
  }

  static async getSurveyInsights(
    surveyId: string,
    requesterId: string,
    requesterRole: string
  ): Promise<SurveyInsights> {
    const canManageAll = ['ADMIN', 'SUPER_ADMIN', 'PASTOR'].includes(requesterRole)

    const surveyRecord = await prisma.survey.findUnique({
      where: { id: surveyId },
      include: {
        sections: {
          orderBy: { order: 'asc' }
        },
        questions: {
          orderBy: { order: 'asc' }
        },
        creator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        responses: {
          orderBy: { submittedAt: 'desc' },
          include: {
            questionResponses: {
              include: {
                question: true
              }
            },
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
              }
            }
          }
        },
        _count: {
          select: { responses: true }
        }
      }
    })

    if (!surveyRecord) {
      throw new Error('Survey not found')
    }

    // Tenant isolation: privileged roles still cannot cross churches
    if (requesterRole !== 'SUPER_ADMIN') {
      const requester = await prisma.user.findUnique({
        where: { id: requesterId },
        select: { churchId: true }
      })
      if (!requester || requester.churchId !== surveyRecord.churchId) {
        throw new Error('Survey not found')
      }
    }

    if (!canManageAll && surveyRecord.createdBy !== requesterId) {
      throw new Error('Unauthorized to view survey insights')
    }

    const survey = this.transformSurveyFromPrisma(surveyRecord)
    const responses = surveyRecord.responses.map((response: any) =>
      this.transformResponseFromPrisma(response)
    )
    const analytics = this.buildSurveyAnalytics(survey, responses)

    return {
      survey,
      analytics,
      responses
    }
  }

  private static transformSurveyFromPrisma(record: any): Survey {
    const sections: SurveySection[] | undefined = record.sections
      ? record.sections.map((section: any) => ({
          id: section.id,
          surveyId: section.surveyId,
          title: section.title,
          description: section.description ?? undefined,
          order: section.order,
          createdAt: section.createdAt ?? undefined,
          updatedAt: section.updatedAt ?? undefined
        }))
      : undefined

    const questions: SurveyQuestion[] = (record.questions ?? []).map((question: any) => ({
      id: question.id,
      surveyId: question.surveyId,
      sectionId: question.sectionId ?? undefined,
      type: question.type,
      title: question.title,
      description: question.description ?? undefined,
      required: question.required,
      order: question.order,
      options: this.normalizeQuestionOptions(question.options),
      allowMultiple: question.allowMultiple ?? undefined,
      minRating: question.minRating ?? undefined,
      maxRating: question.maxRating ?? undefined,
      ratingLabels: question.ratingLabels ?? undefined,
      responses: question.responses
        ? question.responses.map((qr: any) => ({
            id: qr.id,
            responseId: qr.responseId,
            questionId: qr.questionId,
            value: qr.value,
            textValue: qr.textValue ?? undefined
          }))
        : undefined,
      createdAt: question.createdAt ?? undefined,
      updatedAt: question.updatedAt ?? undefined
    }))

    const targetAudience: TargetAudience = {
      type: record.targetAudienceType,
      branchIds: record.targetBranchIds ?? [],
      groupIds: record.targetGroupIds ?? [],
      userIds: record.targetUserIds ?? []
    }

    return {
      id: record.id,
      churchId: record.churchId,
      branchId: record.branchId ?? undefined,
      createdBy: record.createdBy,
      title: record.title,
      description: record.description ?? undefined,
      status: record.status,
      isAnonymous: record.isAnonymous,
      allowMultipleResponses: record.allowMultipleResponses,
      deadline: record.deadline ?? undefined,
      targetAudience,
      targetAudienceType: record.targetAudienceType,
      targetBranchIds: record.targetBranchIds ?? [],
      targetGroupIds: record.targetGroupIds ?? [],
      targetUserIds: record.targetUserIds ?? [],
      sendOnPublish: record.sendOnPublish,
      sendReminders: record.sendReminders,
      reminderDays: record.reminderDays ?? [],
      meetingId: record.meetingId ?? undefined,
      questions,
      sections,
      responses: record.responses
        ? record.responses.map((response: any) => this.transformResponseFromPrisma(response))
        : undefined,
      responseCount:
        typeof record._count?.responses === 'number'
          ? record._count.responses
          : record.responses?.length ?? 0,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      publishedAt: record.publishedAt ?? undefined,
      closedAt: record.closedAt ?? undefined
    }
  }

  private static transformResponseFromPrisma(response: any): SurveyResponse {
    return {
      id: response.id,
      surveyId: response.surveyId,
      userId: response.userId ?? undefined,
      ipAddress: response.ipAddress ?? undefined,
      userAgent: response.userAgent ?? undefined,
      submittedAt: response.submittedAt,
      questionResponses: response.questionResponses
        ? response.questionResponses.map((qr: any) => ({
            id: qr.id,
            responseId: qr.responseId,
            questionId: qr.questionId,
            value: qr.value,
            textValue: qr.textValue ?? undefined,
            question: qr.question
              ? {
                  id: qr.question.id,
                  title: qr.question.title,
                  type: qr.question.type,
                  options: this.normalizeQuestionOptions(qr.question.options),
                  minRating: qr.question.minRating ?? undefined,
                  maxRating: qr.question.maxRating ?? undefined,
                  ratingLabels: qr.question.ratingLabels ?? undefined,
                  allowMultiple: qr.question.allowMultiple ?? undefined
                }
              : undefined
          }))
        : [],
      user: response.user
        ? {
            id: response.user.id,
            firstName: response.user.firstName ?? undefined,
            lastName: response.user.lastName ?? undefined,
            email: response.user.email ?? undefined
          }
        : undefined
    }
  }

  private static normalizeQuestionOptions(options?: any): string[] | undefined {
    if (!options) return undefined
    if (!Array.isArray(options)) return undefined

    const normalized = options
      .map(option => {
        if (typeof option === 'string') return option
        if (option && typeof option === 'object' && 'text' in option) {
          return String((option as any).text ?? '')
        }
        return ''
      })
      .map(option => option.trim())
      .filter(Boolean)

    return normalized.length ? normalized : undefined
  }

  private static buildSurveyAnalytics(
    survey: Survey,
    responses: SurveyResponse[]
  ): SurveyAnalytics {
    const totalResponses = responses.length
    const uniqueRespondents = new Set(
      responses.map(response => response.userId || response.ipAddress || response.id)
    ).size

    const timestamps = responses.map(response => new Date(response.submittedAt).getTime())
    const firstResponseAt = timestamps.length ? new Date(Math.min(...timestamps)) : undefined
    const lastResponseAt = timestamps.length ? new Date(Math.max(...timestamps)) : undefined

    const responseTrendMap = new Map<string, number>()
    responses.forEach(response => {
      const dayKey = new Date(response.submittedAt).toISOString().slice(0, 10)
      responseTrendMap.set(dayKey, (responseTrendMap.get(dayKey) || 0) + 1)
    })

    const responseTrend = Array.from(responseTrendMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, count]) => ({ date, count }))

    const targetSize = this.estimateTargetAudienceSize(survey)
    const completionRate =
      targetSize && targetSize > 0
        ? Math.min(100, (uniqueRespondents / targetSize) * 100)
        : totalResponses > 0
          ? 100
          : 0

    const questionAnalytics: SurveyQuestionAnalytics[] = survey.questions.map(question => {
      const breakdown: SurveyResponseBreakdown = {}
      let totalQuestionResponses = 0

      if (question.type === 'MULTIPLE_CHOICE') {
        const optionCounts: Record<string, number> = {}
        const options = this.normalizeQuestionOptions(question.options) || []
        options.forEach(option => {
          optionCounts[option] = 0
        })

        responses.forEach(response => {
          const answer = response.questionResponses.find(qr => qr.questionId === question.id)
          if (!answer || answer.value === undefined || answer.value === null) {
            return
          }
          totalQuestionResponses += 1
          if (Array.isArray(answer.value)) {
            answer.value.forEach((val: any) => {
              const key = String(val)
              optionCounts[key] = (optionCounts[key] || 0) + 1
            })
          } else {
            const key = String(answer.value)
            optionCounts[key] = (optionCounts[key] || 0) + 1
          }
        })

        breakdown.optionCounts = optionCounts
      } else if (question.type === 'RATING') {
        const distribution: Record<number, number> = {}
        let ratingSum = 0
        let ratingCount = 0

        responses.forEach(response => {
          const answer = response.questionResponses.find(qr => qr.questionId === question.id)
          if (!answer || typeof answer.value !== 'number') {
            return
          }
          totalQuestionResponses += 1
          ratingCount += 1
          ratingSum += answer.value
          distribution[answer.value] = (distribution[answer.value] || 0) + 1
        })

        breakdown.ratingDistribution = distribution
        if (ratingCount > 0) {
          breakdown.averageRating = ratingSum / ratingCount
        }
      } else if (question.type === 'YES_NO') {
        let yesCount = 0
        let noCount = 0

        responses.forEach(response => {
          const answer = response.questionResponses.find(qr => qr.questionId === question.id)
          if (!answer || typeof answer.value !== 'boolean') {
            return
          }
          totalQuestionResponses += 1
          if (answer.value) {
            yesCount += 1
          } else {
            noCount += 1
          }
        })

        breakdown.yesCount = yesCount
        breakdown.noCount = noCount
      } else if (question.type === 'TEXT') {
        const texts: string[] = []

        responses.forEach(response => {
          const answer = response.questionResponses.find(qr => qr.questionId === question.id)
          if (!answer) {
            return
          }
          const asString =
            typeof answer.value === 'string'
              ? answer.value
              : typeof answer.textValue === 'string'
                ? answer.textValue
                : null
          if (asString && asString.trim().length > 0) {
            totalQuestionResponses += 1
            if (texts.length < 50) {
              texts.push(asString.trim())
            }
          }
        })

        breakdown.textResponses = texts
      }

      return {
        questionId: question.id,
        questionTitle: question.title,
        questionType: question.type,
        totalResponses: totalQuestionResponses,
        responseBreakdown: breakdown
      }
    })

    return {
      surveyId: survey.id,
      totalResponses,
      completionRate,
      uniqueRespondents,
      firstResponseAt,
      lastResponseAt,
      responseTrend,
      questionAnalytics
    }
  }

  private static estimateTargetAudienceSize(survey: Survey): number | null {
    if (survey.targetAudienceType === 'CUSTOM') {
      const customCount = survey.targetUserIds?.length || survey.targetAudience?.roleIds?.length || 0
      return customCount > 0 ? customCount : null
    }

    if (survey.targetAudienceType === 'GROUP') {
      const groupCount = survey.targetGroupIds?.length || survey.targetAudience?.groupIds?.length || 0
      return groupCount > 0 ? groupCount * 10 : null
    }

    if (survey.targetAudienceType === 'BRANCH') {
      const branchCount =
        survey.targetBranchIds?.length || survey.targetAudience?.branchIds?.length || 0
      return branchCount > 0 ? branchCount * 50 : null
    }

    return null
  }
}