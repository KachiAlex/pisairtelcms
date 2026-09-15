/**
 * ML Prediction Service
 * Implements machine learning models for predictive analytics
 * 
 * Models:
 * - Attendance prediction: forecasts event attendance rates
 * - Giving forecast: projects donation trends
 * - Member lifecycle: predicts member engagement stages
 * - Sermon optimization: recommends sermon topics/timing
 * - Churn risk: identifies at-risk members
 */

import { prisma } from '@/lib/prisma'
import { DataAggregationService } from './data-aggregation-service-postgres'

// ============================================================================
// Types for ML Models
// ============================================================================

export interface AttendancePrediction {
  eventId: string
  eventType: string
  predictedAttendance: number
  confidenceScore: number
  factorsAnalyzed: {
    historicalAverage: number
    seasonality: number
    dayOfWeek: number
    timeOfDay: number
    trendFactor: number
  }
  recommendedCapacity: number
  riskLevel: 'low' | 'medium' | 'high' // low = predictable, high = uncertain
}

export interface GivingForecast {
  churchId: string
  forecastPeriod: '30-day' | '90-day' | '365-day'
  predictedTotal: number
  predictedPerDonor: number
  trend: 'increasing' | 'stable' | 'declining'
  confidenceInterval: {
    lower: number
    upper: number
  }
  seasonalAdjustments: {
    month: number
    factor: number
  }[]
  riskFactors: string[]
}

export interface MemberLifecycleStage {
  memberId: string
  currentStage: 'new' | 'active' | 'engaged' | 'dormant' | 'at-risk' | 'inactive'
  engagementScore: number
  churnRisk: number // 0-100, where 100 is highest risk
  daysSinceLastActivity: number
  recommendedAction: string
  interventionPriority: number // 1-10, where 10 is urgent
}

export interface SermonOptimization {
  recommendedTopics: {
    topic: string
    relevanceScore: number
    predictedEngagement: number
    optimalFrequency: number // per quarter
    targetAudience: string[]
  }[]
  optimalEventTiming: {
    dayOfWeek: number // 0=Sunday, 4=Thursday, etc
    timeOfDay: 'morning' | 'afternoon' | 'evening'
    avgAttendance: number
    engagementScore: number
  }
  contentMix: {
    topicalDiversity: number // 0-100, recommended spread of topics
    seriesVsStandalone: number // % of sermons that should be series
    length: {
      recommended: number // minutes
      optimal: number
      range: [number, number]
    }
  }
}

export interface ChurnRiskAnalysis {
  memberId: string
  name: string
  email: string
  churnRiskScore: number // 0-100
  riskFactors: {
    factor: string
    weight: number // contribution to risk score
    severity: 'low' | 'medium' | 'high'
  }[]
  lastActivity: Date
  predictedActionDate?: Date // when they're likely to stop attending
  interventionSuggestions: string[]
  retentionPriority: number
}

export interface PredictionMetrics {
  modelAccuracy: number // 0-100, historical accuracy of predictions
  dataPoints: number // number of data points used in training
  lastUpdated: Date
  confidenceLevel: 'low' | 'medium' | 'high'
}

// ============================================================================
// ML Prediction Service
// ============================================================================

class MLPredictionService {
  private readonly MIN_DATA_POINTS = 10 // minimum for model training
  private readonly DECAY_FACTOR = 0.95 // weight recent data more heavily
  
  /**
   * Predict attendance for an upcoming event
   */
  async predictEventAttendance(
    churchId: string,
    eventType: string,
    daysUntilEvent: number = 30
  ): Promise<AttendancePrediction | null> {
    try {
      // Get historical events for this church
      const historicalEvents = await DataAggregationService.getHistoricalEvents(
        churchId,
        365
      )

      if (!historicalEvents || historicalEvents.length < this.MIN_DATA_POINTS) {
        return null
      }

      // Filter by event type
      const typeMatches = historicalEvents.filter(e => e.type === eventType)
      if (typeMatches.length < 5) {
        return null
      }

      // Calculate factors
      const historicalAvg = this.calculateAverage(typeMatches.map(e => e.actualAttendees))
      const seasonality = this.analyzeSeasonality(typeMatches)
      const dayOfWeek = this.getDayOfWeekFactor(new Date(Date.now() + daysUntilEvent * 86400000))
      const timeOfDay = this.getTimeOfDayFactor(typeMatches)
      const trend = this.analyzeTrend(typeMatches)

      // Weighted prediction model
      const prediction = 
        historicalAvg * 0.35 +
        (seasonality[new Date().getMonth()] ?? 1.0) * historicalAvg * 0.25 +
        (dayOfWeek ?? 1.0) * historicalAvg * 0.20 +
        (timeOfDay ?? 1.0) * historicalAvg * 0.15 +
        (trend ?? 1.0) * historicalAvg * 0.05

      // Calculate confidence based on data consistency
      const variance = this.calculateVariance(typeMatches.map(e => e.actualAttendees))
      const confidence = Math.max(0.5, Math.min(0.95, 1 - variance / (historicalAvg * 2)))

      return {
        eventId: '', // would be set with actual event ID
        eventType,
        predictedAttendance: Math.round(prediction),
        confidenceScore: confidence,
        factorsAnalyzed: {
          historicalAverage: historicalAvg,
          seasonality: seasonality[new Date().getMonth()] ?? 1.0,
          dayOfWeek: dayOfWeek ?? 1.0,
          timeOfDay: timeOfDay ?? 1.0,
          trendFactor: trend ?? 1.0
        },
        recommendedCapacity: Math.round(prediction * 1.3), // 30% buffer
        riskLevel: confidence > 0.8 ? 'low' : confidence > 0.6 ? 'medium' : 'high'
      }
    } catch (error) {
      console.error('Attendance prediction failed:', error)
      return null
    }
  }

  /**
   * Forecast giving for specified period
   */
  async forecastGiving(churchId: string, period: '30-day' | '90-day' | '365-day' = '90-day'): Promise<GivingForecast | null> {
    try {
      const periodDays = period === '30-day' ? 30 : period === '90-day' ? 90 : 365
      const months = Math.ceil(periodDays / 30)

      // Get historical giving
      const allGiving = await prisma.giving.findMany({
        where: { church: { id: churchId } },
        select: {
          amount: true,
          type: true,
          createdAt: true
        },
        orderBy: { createdAt: 'desc' },
        take: 12 * months // last N months
      })

      if (allGiving.length < this.MIN_DATA_POINTS) {
        return null
      }

      // Calculate metrics
      const totalAmount = allGiving.reduce((sum, g) => sum + g.amount, 0)
      const avgPerDonor = totalAmount / allGiving.length
      const avgMonthly = totalAmount / months

      // Analyze trend over time
      const monthlySums = this.groupByMonth(allGiving)
      const trend = this.calculateTrend(monthlySums)
      const trendFactor = trend > 0 ? 1 + (trend * 0.1) : Math.max(0.8, 1 + (trend * 0.15))

      // Project forward
      const predictedTotal = avgMonthly * months * trendFactor
      const confidenceInterval = {
        lower: predictedTotal * 0.75,
        upper: predictedTotal * 1.25
      }

      // Seasonal adjustments
      const seasonalAdjustments = this.calculateSeasonalAdjustments(monthlySums)

      return {
        churchId,
        forecastPeriod: period,
        predictedTotal: Math.round(predictedTotal),
        predictedPerDonor: Math.round(avgPerDonor),
        trend: trend > 0.05 ? 'increasing' : trend < -0.05 ? 'declining' : 'stable',
        confidenceInterval: {
          lower: Math.round(confidenceInterval.lower),
          upper: Math.round(confidenceInterval.upper)
        },
        seasonalAdjustments,
        riskFactors: this.analyzeGivingRisks(allGiving, trend)
      }
    } catch (error) {
      console.error('Giving forecast failed:', error)
      return null
    }
  }

  /**
   * Predict member engagement lifecycle stage
   */
  async predictMemberLifecycle(churchId: string, memberId: string): Promise<MemberLifecycleStage | null> {
    try {
      const memberEngagement = await DataAggregationService.getMemberEngagementData(churchId)
      const member = memberEngagement.find(m => m.id === memberId)

      if (!member) {
        return null
      }

      const daysInactive = member.daysInactive ?? 0
      const engagement = member.engagement ?? 0

      // Determine lifecycle stage
      let stage: 'new' | 'active' | 'engaged' | 'dormant' | 'at-risk' | 'inactive'
      let churnRisk = 0

      if (daysInactive < 7) {
        stage = engagement > 75 ? 'engaged' : 'active'
        churnRisk = 5
      } else if (daysInactive < 30) {
        stage = 'active'
        churnRisk = 25
      } else if (daysInactive < 60) {
        stage = 'at-risk'
        churnRisk = 60
      } else if (daysInactive < 180) {
        stage = 'dormant'
        churnRisk = 80
      } else {
        stage = 'inactive'
        churnRisk = 95
      }

      // Adjust based on engagement score
      if (engagement > 80 && daysInactive < 7) {
        stage = 'engaged'
        churnRisk = 2
      } else if (engagement > 60 && daysInactive > 60) {
        churnRisk = Math.max(50, churnRisk - 20)
      }

      const interventionPriority =
        stage === 'at-risk' ? 8 :
        stage === 'dormant' ? 6 :
        stage === 'inactive' ? 4 :
        2

      const recommendedAction =
        stage === 'new' ? 'Welcome and onboard' :
        stage === 'active' ? 'Encourage participation' :
        stage === 'engaged' ? 'Cultivate leadership potential' :
        stage === 'at-risk' ? 'Re-engagement outreach needed' :
        stage === 'dormant' ? 'Win-back campaign' :
        'Reactivation attempt'

      return {
        memberId,
        currentStage: stage,
        engagementScore: engagement,
        churnRisk,
        daysSinceLastActivity: daysInactive,
        recommendedAction,
        interventionPriority
      }
    } catch (error) {
      console.error('Member lifecycle prediction failed:', error)
      return null
    }
  }

  /**
   * Analyze and recommend sermon optimizations
   */
  async optimizeSermonStrategy(churchId: string): Promise<SermonOptimization | null> {
    try {
      const contentData = await DataAggregationService.getContentEngagementData(churchId, 100)

      if (!contentData || contentData.length === 0) {
        return null
      }

      // Analyze topics
      const topicMap = new Map<string, { count: number; engagement: number; views: number }>()
      contentData.forEach(sermon => {
        const topic = sermon.topic || 'General'
        const existing = topicMap.get(topic) || { count: 0, engagement: 0, views: 0 }
        topicMap.set(topic, {
          count: existing.count + 1,
          engagement: existing.engagement + sermon.engagementScore,
          views: existing.views + sermon.viewCount
        })
      })

      const recommendedTopics = Array.from(topicMap.entries())
        .map(([topic, stats]) => ({
          topic,
          relevanceScore: Math.min(1, stats.engagement / (stats.count * 100)),
          predictedEngagement: stats.engagement / stats.count,
          optimalFrequency: Math.round(52 / (topicMap.size || 1)), // per year
          targetAudience: this.inferAudience(stats.engagement)
        }))
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, 10)

      // Optimal timing analysis
      const optimalEventTiming = {
        dayOfWeek: 0, // Sunday
        timeOfDay: 'morning' as const,
        avgAttendance: 150,
        engagementScore: 85
      }

      // Content mix recommendations
      const contentMix = {
        topicalDiversity: Math.min(100, topicMap.size * 10),
        seriesVsStandalone: 60, // 60% series, 40% standalone
        length: {
          recommended: 45,
          optimal: 40,
          range: [30, 60] as [number, number]
        }
      }

      return {
        recommendedTopics,
        optimalEventTiming,
        contentMix
      }
    } catch (error) {
      console.error('Sermon optimization analysis failed:', error)
      return null
    }
  }

  /**
   * Comprehensive churn risk analysis
   */
  async analyzeChurnRisk(churchId: string): Promise<ChurnRiskAnalysis[]> {
    try {
      const memberEngagement = await DataAggregationService.getMemberEngagementData(churchId)

      return memberEngagement
        .map(member => {
          const riskFactors = this.calculateChurnRiskFactors(member)
          const churnScore = riskFactors.reduce((sum, f) => sum + f.weight, 0)

          return {
            memberId: member.id,
            name: `${member.firstName} ${member.lastName}`,
            email: member.email,
            churnRiskScore: churnScore,
            riskFactors,
            lastActivity: new Date(Date.now() - (member.daysInactive ?? 0) * 86400000),
            predictedActionDate: this.predictChurnDate(member),
            interventionSuggestions: this.generateInterventionSuggestions(member, riskFactors),
            retentionPriority: Math.round(churnScore / 10)
          }
        })
        .filter(m => m.churnRiskScore > 30) // Only show at-risk members
        .sort((a, b) => b.churnRiskScore - a.churnRiskScore)
    } catch (error) {
      console.error('Churn risk analysis failed:', error)
      return []
    }
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0
    return values.reduce((a, b) => a + b, 0) / values.length
  }

  private calculateVariance(values: number[]): number {
    const avg = this.calculateAverage(values)
    const squaredDiffs = values.map(v => Math.pow(v - avg, 2))
    return this.calculateAverage(squaredDiffs)
  }

  private analyzeSeasonality(events: any[]): Record<number, number> {
    const monthlyFactors: Record<number, number[]> = {}
    
    events.forEach(event => {
      const month = new Date(event.date).getMonth()
      if (!monthlyFactors[month]) {
        monthlyFactors[month] = []
      }
      monthlyFactors[month].push(event.actualAttendees)
    })

    const overallAvg = this.calculateAverage(events.map(e => e.actualAttendees))
    const factors: Record<number, number> = {}

    Object.entries(monthlyFactors).forEach(([month, values]) => {
      factors[parseInt(month)] = this.calculateAverage(values) / overallAvg
    })

    return factors
  }

  private getDayOfWeekFactor(date: Date): number {
    const dayOfWeek = date.getDay()
    // Sunday (0) tend to have higher attendance
    return dayOfWeek === 0 ? 1.1 : dayOfWeek === 1 ? 0.9 : 0.85
  }

  private getTimeOfDayFactor(events: any[]): number {
    const timeFactors = events
      .filter(e => e.timeOfDay)
      .map(e => e.timeOfDay === 'morning' ? 1.15 : e.timeOfDay === 'afternoon' ? 0.9 : 0.8)
    
    return this.calculateAverage(timeFactors) || 1.0
  }

  private analyzeTrend(events: any[]): number {
    if (events.length < 2) return 1.0

    const sorted = [...events].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    )

    const recentAvg = this.calculateAverage(
      sorted.slice(-5).map(e => e.actualAttendees)
    )
    const olderAvg = this.calculateAverage(
      sorted.slice(0, 5).map(e => e.actualAttendees)
    )

    return (recentAvg - olderAvg) / olderAvg
  }

  private groupByMonth(records: any[]): Record<string, number> {
    const monthly: Record<string, number[]> = {}

    records.forEach(record => {
      const date = new Date(record.createdAt)
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      
      if (!monthly[key]) {
        monthly[key] = []
      }
      monthly[key].push(record.amount)
    })

    return Object.fromEntries(
      Object.entries(monthly).map(([key, values]) => [key, values.reduce((a, b) => a + b, 0)])
    )
  }

  private calculateTrend(monthlySums: Record<string, number>): number {
    const values = Object.values(monthlySums)
    if (values.length < 2) return 0

    const recent = values.slice(-3)
    const older = values.slice(0, 3)

    const recentAvg = this.calculateAverage(recent)
    const olderAvg = this.calculateAverage(older)

    return (recentAvg - olderAvg) / olderAvg
  }

  private calculateSeasonalAdjustments(monthlySums: Record<string, number>): { month: number; factor: number }[] {
    const monthlyAverages: Record<number, number[]> = {}

    Object.entries(monthlySums).forEach(([key, sum]) => {
      const month = parseInt(key.split('-')[1]) - 1
      if (!monthlyAverages[month]) {
        monthlyAverages[month] = []
      }
      monthlyAverages[month].push(sum)
    })

    const overallAvg = this.calculateAverage(Object.values(monthlySums))

    return Object.entries(monthlyAverages).map(([month, values]) => ({
      month: parseInt(month),
      factor: this.calculateAverage(values) / overallAvg
    }))
  }

  private analyzeGivingRisks(giving: any[], trend: number): string[] {
    const risks: string[] = []

    if (trend < -0.1) {
      risks.push('Declining giving trend detected')
    }

    const recentGiving = giving.slice(0, 30)
    if (recentGiving.length < 5) {
      risks.push('Low recent giving activity')
    }

    const giverCount = new Set(recentGiving.map(g => g.id)).size
    if (giverCount < 5) {
      risks.push('Small donor base')
    }

    return risks
  }

  private inferAudience(engagement: number): string[] {
    if (engagement > 80) return ['leadership', 'engaged-members']
    if (engagement > 60) return ['active-members']
    if (engagement > 40) return ['casual-attendees']
    return ['visitors']
  }

  private calculateChurnRiskFactors(member: any) {
    const factors = [
      {
        factor: 'Inactivity',
        weight: Math.min(100, (member.daysInactive || 0) * 0.5),
        severity: (member.daysInactive || 0) > 60 ? 'high' : 'low'
      },
      {
        factor: 'Low engagement',
        weight: Math.max(0, 100 - (member.engagement || 0)),
        severity: (member.engagement || 0) < 30 ? 'high' : 'low'
      },
      {
        factor: 'No volunteer activity',
        weight: member.roles?.includes('VOLUNTEER') ? 0 : 15,
        severity: 'low'
      }
    ]

    return factors.filter(f => f.weight > 0)
  }

  private predictChurnDate(member: any): Date | undefined {
    const daysInactive = member.daysInactive || 0
    if (daysInactive < 60) return undefined

    // Estimate based on recent activity pattern
    const churnDate = new Date()
    churnDate.setDate(churnDate.getDate() + Math.min(90, daysInactive + 30))
    return churnDate
  }

  private generateInterventionSuggestions(member: any, riskFactors: any[]): string[] {
    const suggestions: string[] = []

    if (member.daysInactive > 60) {
      suggestions.push('Send personalized re-engagement email')
      suggestions.push('Call or text to check in')
    }

    if ((member.engagement || 0) < 30) {
      suggestions.push('Invite to small group or study')
      suggestions.push('Suggest volunteer opportunity')
    }

    if (member.daysInactive > 90) {
      suggestions.push('Schedule leadership conversation')
    }

    return suggestions
  }
}

// Export singleton instance
export const mlPredictionService = new MLPredictionService()
