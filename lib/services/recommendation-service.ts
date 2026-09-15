import { prisma } from '@/lib/prisma'
import { DataAggregationService } from '@/lib/services/data-aggregation-service-postgres'
import { AnalyticsCacheService } from '@/lib/services/analytics-cache-service-postgres'

/**
 * Recommendation Types
 */
export type RecommendationType = 'attendance' | 'scheduling' | 'content' | 'engagement' | 'member'
export type ConfidenceLevel = 'low' | 'medium' | 'high' | 'very_high'
export type RecommendationStatus = 'pending' | 'accepted' | 'rejected' | 'implemented'

export interface Recommendation {
  id: string
  userId: string
  churchId: string
  type: RecommendationType
  title: string
  description: string
  reason: string // Why this recommendation was made
  confidence: ConfidenceLevel
  priority: number // 1-10, higher is more important
  suggestedAction: string // What user should do
  expectedImpact: string // What improvement to expect
  dataPoints: string[] // References to data supporting recommendation
  status: RecommendationStatus
  createdAt: Date
  updatedAt: Date
  actionTakenAt?: Date
  actionNotes?: string
  metrics?: Record<string, any> // Supporting metrics
}

export interface AttendancePrediction {
  eventId: string
  predictedAttendance: number
  actualAttendance?: number
  confidence: ConfidenceLevel
  trend: 'stable' | 'increasing' | 'decreasing'
  factors: Array<{
    name: string
    impact: number // -1 to 1
    description: string
  }>
  recommendations: string[]
}

export interface OptimalSchedule {
  dayOfWeek: string
  timeOfDay: string
  predictedAttendance: number
  confidence: ConfidenceLevel
  historicalData: {
    averageAttendance: number
    maxAttendance: number
    minAttendance: number
    consistencyScore: number // 0-100
  }
}

export interface EngagementRecommendation {
  memberId: string
  suggestedActions: Array<{
    action: string
    description: string
    expectedOutcome: string
    priority: 'low' | 'medium' | 'high'
  }>
  riskFactors: Array<{
    factor: string
    severity: 'low' | 'medium' | 'high'
    suggestion: string
  }>
  potentialLeaders: Array<{
    memberId: string
    role: string
    reasoning: string
    readinessScore: number // 0-100
  }>
}

/**
 * RecommendationService
 * Generates intelligent recommendations based on analytics
 */
export class RecommendationService {
  /**
   * Generate attendance prediction for an event
   * Now uses real historical data from DataAggregationService
   */
  static async predictEventAttendance(
    churchId: string,
    eventData: {
      eventType: string
      dayOfWeek: string
      timeOfDay: string
      historicalEvents?: Array<{ attendees: number; dayOfWeek: string; time: string }>
      specialFactors?: string[] // e.g., "holiday", "special_guest"
    }
  ): Promise<AttendancePrediction> {
    try {
      // Get real historical data from DataAggregationService
      const historicalEvents = await DataAggregationService.getHistoricalEvents(churchId, 90)
      
      // Convert to expected format
      const eventAttendances = historicalEvents.map((e) => ({
        attendees: e.actualAttendees,
        dayOfWeek: e.dayOfWeek,
        time: e.timeOfDay,
      }))

      // Use provided data as fallback if no historical data
      const eventsToAnalyze = eventAttendances.length > 0 ? eventAttendances : (eventData.historicalEvents || [])

      return await this.predictEventAttendanceFromData(
        churchId,
        eventData.dayOfWeek,
        eventData.timeOfDay,
        eventsToAnalyze,
        eventData.specialFactors || []
      )
    } catch (error) {
      console.error('Error predicting attendance:', error)
      // Fallback to calculation with provided data
      return await this.predictEventAttendanceFromData(
        churchId,
        eventData.dayOfWeek,
        eventData.timeOfDay,
        eventData.historicalEvents || [],
        eventData.specialFactors || []
      )
    }
  }

  /**
   * Internal method to predict attendance from event data
   */
  private static async predictEventAttendanceFromData(
    churchId: string,
    dayOfWeek: string,
    timeOfDay: string,
    historicalEvents: Array<{ attendees: number; dayOfWeek: string; time: string }>,
    specialFactors: string[]
  ): Promise<AttendancePrediction> {

    // Filter historical events by similar day/time
    const similarEvents = historicalEvents.filter(
      (e) =>
        e.dayOfWeek === dayOfWeek &&
        e.time === timeOfDay
    )

    if (similarEvents.length === 0) {
      // Fallback to all events of same day
      const dayEvents = historicalEvents.filter((e) => e.dayOfWeek === dayOfWeek)
      const avgAttendance = this.calculateAverage(dayEvents.map((e) => e.attendees))
      return this.buildPrediction('stable', avgAttendance, 'medium', historicalEvents, [])
    }

    // Calculate metrics
    const similarEventAttendees = similarEvents.map((e) => e.attendees)
    const predictedAttendance = this.calculateAverage(similarEventAttendees)
    const variance = this.calculateVariance(similarEventAttendees)
    const consistency = 100 - (variance / predictedAttendance) * 10

    // Determine confidence
    let confidence: ConfidenceLevel = 'low'
    if (similarEvents.length > 10) confidence = 'very_high'
    else if (similarEvents.length > 5) confidence = 'high'
    else if (similarEvents.length > 2) confidence = 'medium'
    else confidence = 'low'

    // Analyze trend
    const recentEvents = similarEvents.slice(-3)
    const recentAvg = this.calculateAverage(recentEvents.map((e) => e.attendees))
    const olderAvg =
      similarEvents.length > 3
        ? this.calculateAverage(similarEvents.slice(0, -3).map((e) => e.attendees))
        : recentAvg

    const trend: 'stable' | 'increasing' | 'decreasing' =
      recentAvg > olderAvg * 1.1 ? 'increasing' : recentAvg < olderAvg * 0.9 ? 'decreasing' : 'stable'

    // Generate factors
    const factors: Array<{ name: string; impact: number; description: string }> = [
      {
        name: 'Day of Week',
        impact: dayOfWeek === 'Sunday' ? 0.2 : 0,
        description: `${dayOfWeek} typically sees different attendance patterns`,
      },
      {
        name: 'Time of Day',
        impact: timeOfDay === 'morning' ? 0.15 : -0.1,
        description: 'Time of day affects attendance likelihood',
      },
    ]

    // Add special factors
    specialFactors.forEach((factor) => {
      if (factor === 'holiday') factors.push({
        name: 'Holiday',
        impact: -0.3,
        description: 'Holidays typically reduce attendance',
      })
      if (factor === 'special_guest')
        factors.push({
          name: 'Special Guest',
          impact: 0.25,
          description: 'Special guests increase attendance',
        })
    })

    return {
      eventId: `event_${Date.now()}`,
      predictedAttendance: Math.round(predictedAttendance),
      confidence,
      trend,
      factors,
      recommendations: this.generateAttendanceRecommendations(
        predictedAttendance,
        trend,
        consistency
      ),
    }
  }

  /**
   * Find optimal schedule for events
   * Now uses real historical data from DataAggregationService
   */
  static async findOptimalSchedule(
    churchId: string,
    historicalAttendance?: Array<{
      dayOfWeek: string
      timeOfDay: string
      attendance: number
    }>
  ): Promise<OptimalSchedule[]> {
    try {
      // Get real historical data from DataAggregationService
      const historicalEvents = await DataAggregationService.getHistoricalEvents(churchId, 90)
      
      // Convert to expected format
      const attendanceData = historicalEvents.map((e) => ({
        dayOfWeek: e.dayOfWeek,
        timeOfDay: e.timeOfDay,
        attendance: e.actualAttendees,
      }))

      // Use provided data as fallback if no real data
      const dataToUse = attendanceData.length > 0 ? attendanceData : (historicalAttendance || [])

      return this.findOptimalScheduleFromData(dataToUse)
    } catch (error) {
      console.error('Error finding optimal schedule:', error)
      // Fallback to calculation with provided data
      return this.findOptimalScheduleFromData(historicalAttendance || [])
    }
  }

  /**
   * Internal method to find optimal schedule from data
   */
  private static findOptimalScheduleFromData(
    historicalAttendance: Array<{
      dayOfWeek: string
      timeOfDay: string
      attendance: number
    }>
  ): OptimalSchedule[] {
    const grouped = this.groupByDayAndTime(historicalAttendance)
    const schedules: OptimalSchedule[] = []

    for (const [key, events] of Object.entries(grouped)) {
      const attendees = events.map((e) => e.attendance)
      const [dayOfWeek, timeOfDay] = key.split('_')

      const avgAttendance = this.calculateAverage(attendees)
      const variance = this.calculateVariance(attendees)
      const consistency = Math.max(0, 100 - (variance / avgAttendance) * 10)

      schedules.push({
        dayOfWeek,
        timeOfDay,
        predictedAttendance: Math.round(avgAttendance),
        confidence: consistency > 80 ? 'high' : consistency > 60 ? 'medium' : 'low',
        historicalData: {
          averageAttendance: Math.round(avgAttendance),
          maxAttendance: Math.max(...attendees),
          minAttendance: Math.min(...attendees),
          consistencyScore: Math.round(consistency),
        },
      })
    }

    // Sort by predicted attendance (descending)
    return schedules.sort((a, b) => b.predictedAttendance - a.predictedAttendance)
  }

  /**
   * Generate engagement recommendations for members
   * Now uses real member data from DataAggregationService
   */
  static async generateMemberEngagementRecommendations(
    churchId: string,
    memberData?: Array<{
      memberId: string
      attendanceRate: number
      contributionAmount: number
      volunteerHours: number
      leadershipExperience: number
      engagementScore: number
    }>
  ): Promise<Map<string, EngagementRecommendation>> {
    try {
      // Get real member data from DataAggregationService
      const realMemberData = await DataAggregationService.getMemberEngagementData(churchId)
      
      // Convert to expected format
      const memberDataToUse = realMemberData.map((member) => ({
        memberId: member.id,
        attendanceRate: Math.min(member.eventAttendance / 10, 1), // Normalize
        contributionAmount: 0, // Would need separate calculation
        volunteerHours: member.volunteered ? 10 : 0, // Binary to hours
        leadershipExperience: member.roles.includes('leader') ? 5 : 0,
        engagementScore: member.engagementScore,
      }))

      // Use provided data as fallback
      const dataToUse = memberDataToUse.length > 0 ? memberDataToUse : (memberData || [])

      return this.generateEngagementFromData(dataToUse)
    } catch (error) {
      console.error('Error generating engagement recommendations:', error)
      // Fallback to calculation with provided data
      return this.generateEngagementFromData(memberData || [])
    }
  }

  /**
   * Internal method to generate engagement recommendations from data
   */
  private static generateEngagementFromData(
    memberData: Array<{
      memberId: string
      attendanceRate: number
      contributionAmount: number
      volunteerHours: number
      leadershipExperience: number
      engagementScore: number
    }>
  ): Map<string, EngagementRecommendation> {
    const recommendations = new Map<string, EngagementRecommendation>()

    for (const member of memberData) {
      const riskFactors: Array<{
        factor: string
        severity: 'low' | 'medium' | 'high'
        suggestion: string
      }> = []

      // Identify risk factors
      if (member.attendanceRate < 0.5)
        riskFactors.push({
          factor: 'Low Attendance',
          severity: 'high',
          suggestion: 'Reach out with personal invitation to next event',
        })

      if (member.engagementScore < 30)
        riskFactors.push({
          factor: 'Low Engagement',
          severity: 'high',
          suggestion: 'Invite to small group or volunteer opportunity',
        })

      if (member.volunteerHours === 0)
        riskFactors.push({
          factor: 'No Volunteer Activity',
          severity: 'medium',
          suggestion: 'Share upcoming volunteer opportunities',
        })

      // Generate suggested actions
      const suggestedActions: Array<{
        action: string
        description: string
        expectedOutcome: string
        priority: 'low' | 'medium' | 'high'
      }> = []

      if (member.attendanceRate < 0.75)
        suggestedActions.push({
          action: 'Personal Outreach',
          description: 'Send personalized message about upcoming events',
          expectedOutcome: 'Increase attendance by 20%',
          priority: 'high',
        })

      if (member.volunteerHours < 5)
        suggestedActions.push({
          action: 'Volunteer Matching',
          description: 'Identify and suggest volunteer roles matching skills',
          expectedOutcome: 'Increase engagement and belonging',
          priority: 'medium',
        })

      if (member.engagementScore > 75 && member.leadershipExperience > 0)
        suggestedActions.push({
          action: 'Leadership Development',
          description: 'Invite to leadership training or mentoring role',
          expectedOutcome: 'Develop future church leaders',
          priority: 'high',
        })

      // Identify potential leaders
      const potentialLeaders: Array<{
        memberId: string
        role: string
        reasoning: string
        readinessScore: number
      }> = []

      if (
        member.engagementScore > 70 &&
        member.attendanceRate > 0.8 &&
        member.volunteerHours > 10
      ) {
        potentialLeaders.push({
          memberId: member.memberId,
          role: 'Small Group Leader',
          reasoning: 'High engagement, consistent attendance, volunteer experience',
          readinessScore: Math.min(100, (member.engagementScore * 1.2 + member.leadershipExperience * 10) / 2),
        })
      }

      recommendations.set(member.memberId, {
        memberId: member.memberId,
        suggestedActions,
        riskFactors,
        potentialLeaders,
      })
    }

    return recommendations
  }

  /**
   * Generate content recommendations
   * Now uses real content data from DataAggregationService
   */
  static async generateContentRecommendations(
    churchId: string,
    churchData?: {
      topTopics: string[]
      missedTopics: string[]
      memberInterests: string[]
      upcomingEvents: string[]
      seasonalContext: string
    }
  ): Promise<Array<{ topic: string; reason: string; priority: number }>> {
    try {
      // Get real analytics data from cache
      const cachedAnalytics = await AnalyticsCacheService.getAnalytics(churchId)
      
      // Extract topics and build recommendations
      const topTopics = cachedAnalytics?.snapshot?.topTopics || []
      
      const recommendations: Array<{ topic: string; reason: string; priority: number }> = []

      // Recommend popular topics
      topTopics.forEach((topic, index) => {
        recommendations.push({
          topic: topic.topic,
          reason: `Consistently high engagement with ${topic.topic}`,
          priority: 10 - index,
        })
      })

      // Add seasonal recommendations
      const season = this.getCurrentSeason()
      const seasonalTopics = this.getSeasonalRecommendations(season)
      recommendations.push(...seasonalTopics)

      return recommendations.sort((a, b) => b.priority - a.priority)
    } catch (error) {
      console.error('Error generating content recommendations:', error)
      // Fallback to calculation with provided data
      return this.generateContentFromData(churchData || {})
    }
  }

  /**
   * Internal method to generate content recommendations from data
   */
  private static generateContentFromData(
    churchData: {
      topTopics?: string[]
      missedTopics?: string[]
      memberInterests?: string[]
      upcomingEvents?: string[]
      seasonalContext?: string
    }
  ): Array<{ topic: string; reason: string; priority: number }> {
    const recommendations: Array<{ topic: string; reason: string; priority: number }> = []

    // Recommend popular topics
    const topTopics = churchData.topTopics || []
    topTopics.forEach((topic, index) => {
      recommendations.push({
        topic,
        reason: `Consistently high engagement with ${topic}`,
        priority: 10 - index,
      })
    })

    // Recommend underexplored topics
    const missedTopics = churchData.missedTopics || []
    missedTopics.forEach((topic, index) => {
      recommendations.push({
        topic,
        reason: `${topic} not covered recently, member interest evident`,
        priority: 8 - index,
      })
    })

    // Add seasonal recommendations
    const season = this.getCurrentSeason()
    const seasonalTopics = this.getSeasonalRecommendations(season)
    recommendations.push(...seasonalTopics)

    return recommendations.sort((a, b) => b.priority - a.priority)
  }

  /**
   * Create a recommendation record
   */
  static async createRecommendation(
    userId: string,
    churchId: string,
    recommendation: Omit<Recommendation, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'userId' | 'churchId'>
  ): Promise<Recommendation> {
    const id = `rec_${Date.now()}_${Math.random().toString(36).substring(7)}`

    const record: Recommendation = {
      id,
      userId,
      churchId,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...recommendation,
    }

    await prisma.recommendation.create({
      data: {
        id: record.id,
        userId: record.userId,
        churchId: record.churchId,
        type: record.type,
        title: record.title,
        description: record.description,
        reason: record.reason,
        confidence: record.confidence,
        priority: record.priority,
        suggestedAction: record.suggestedAction,
        expectedImpact: record.expectedImpact,
        dataPoints: record.dataPoints ?? [],
        status: record.status,
        actionNotes: record.actionNotes ?? null,
        metrics: record.metrics ?? undefined,
      },
    })

    return record
  }

  /**
   * Update recommendation status
   */
  static async updateRecommendationStatus(
    id: string,
    status: RecommendationStatus,
    actionNotes?: string
  ): Promise<void> {
    await prisma.recommendation.update({
      where: { id },
      data: {
        status,
        actionNotes: actionNotes ?? null,
        actionTakenAt: status === 'implemented' ? new Date() : null,
      },
    })
  }

  /**
   * Get recommendations for user
   */
  static async getRecommendations(
    userId: string,
    churchId: string,
    status?: RecommendationStatus
  ): Promise<Recommendation[]> {
    const records = await prisma.recommendation.findMany({
      where: {
        userId,
        churchId,
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: 'desc' },
    })

    return records.map((record) => ({
      ...record,
      type: record.type as RecommendationType,
      confidence: record.confidence as ConfidenceLevel,
      status: record.status as RecommendationStatus,
      dataPoints: record.dataPoints ?? [],
      actionNotes: record.actionNotes ?? undefined,
      actionTakenAt: record.actionTakenAt ?? undefined,
      metrics: (record.metrics as Record<string, any>) ?? undefined,
    }))
  }

  // Helper methods

  private static calculateAverage(values: number[]): number {
    if (values.length === 0) return 0
    return values.reduce((a, b) => a + b, 0) / values.length
  }

  private static calculateVariance(values: number[]): number {
    if (values.length === 0) return 0
    const avg = this.calculateAverage(values)
    const squaredDiffs = values.map((v) => Math.pow(v - avg, 2))
    return this.calculateAverage(squaredDiffs)
  }

  private static groupByDayAndTime(
    data: Array<{ dayOfWeek: string; timeOfDay: string; attendance: number }>
  ): Record<string, Array<{ attendance: number }>> {
    const grouped: Record<string, Array<{ attendance: number }>> = {}

    data.forEach((item) => {
      const key = `${item.dayOfWeek}_${item.timeOfDay}`
      if (!grouped[key]) grouped[key] = []
      grouped[key].push({ attendance: item.attendance })
    })

    return grouped
  }

  private static buildPrediction(
    trend: 'stable' | 'increasing' | 'decreasing',
    attendance: number,
    confidence: ConfidenceLevel,
    allEvents: Array<{ attendees: number }>,
    factors: Array<{ name: string; impact: number; description: string }>
  ): AttendancePrediction {
    const avgAttendance = this.calculateAverage(allEvents.map((e) => e.attendees))
    const variance = this.calculateVariance(allEvents.map((e) => e.attendees))
    const consistency =
      avgAttendance > 0 ? Math.max(0, 100 - (variance / avgAttendance) * 10) : 0

    return {
      eventId: `event_${Date.now()}`,
      predictedAttendance: Math.round(attendance),
      confidence,
      trend,
      factors,
      recommendations: this.generateAttendanceRecommendations(
        attendance,
        trend,
        consistency
      ),
    }
  }

  private static generateAttendanceRecommendations(
    attendance: number,
    trend: string,
    consistency: number
  ): string[] {
    const recommendations: string[] = []

    if (attendance < 20)
      recommendations.push('Consider promoting this event more actively')
    if (trend === 'decreasing')
      recommendations.push('Declining trend detected - address attendance barriers')
    if (consistency < 50)
      recommendations.push('Attendance is inconsistent - ensure regular communication')

    return recommendations
  }

  private static getCurrentSeason(): string {
    const month = new Date().getMonth()
    if (month >= 2 && month <= 4) return 'spring'
    if (month >= 5 && month <= 7) return 'summer'
    if (month >= 8 && month <= 10) return 'fall'
    return 'winter'
  }

  private static getSeasonalRecommendations(
    season: string
  ): Array<{ topic: string; reason: string; priority: number }> {
    const seasonalTopics: Record<string, Array<{ topic: string; reason: string; priority: number }>> = {
      spring: [
        {
          topic: 'New Beginnings',
          reason: 'Spring is season of renewal and fresh starts',
          priority: 8,
        },
      ],
      summer: [
        {
          topic: 'Faith in Nature',
          reason: 'Summer invites outdoor activities and nature appreciation',
          priority: 7,
        },
      ],
      fall: [
        {
          topic: 'Gratitude & Harvest',
          reason: 'Fall naturally connects to thanksgiving themes',
          priority: 8,
        },
      ],
      winter: [
        {
          topic: 'Hope & Light',
          reason: 'Winter themes of darkness make hope especially relevant',
          priority: 9,
        },
        {
          topic: 'Community & Gathering',
          reason: 'Winter encourages indoor gatherings and community',
          priority: 8,
        },
      ],
    }

    return seasonalTopics[season] || []
  }
}
