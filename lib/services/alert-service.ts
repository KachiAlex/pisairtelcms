import { prisma } from '@/lib/prisma'
import { NotificationService } from './notification-service'

/**
 * Alert Types and Interfaces
 */
export type MetricType = 'meetings' | 'attendance' | 'livestream' | 'engagement' | 'members'
export type AlertCondition = 'below' | 'above' | 'equals' | 'changes'
export type AlertFrequency = 'realtime' | 'hourly' | 'daily' | 'weekly'

export interface AlertRule {
  id: string
  userId: string
  churchId: string
  name: string
  metric: MetricType
  condition: AlertCondition
  threshold: number
  frequency: AlertFrequency
  enabled: boolean
  notifyVia: {
    email: boolean
    inApp: boolean
    push: boolean
  }
  createdAt: Date
  updatedAt: Date
  lastTriggeredAt?: Date
  metadata?: Record<string, any>
}

export interface AlertRuleCreate {
  name: string
  metric: MetricType
  condition: AlertCondition
  threshold: number
  frequency: AlertFrequency
  notifyVia?: {
    email?: boolean
    inApp?: boolean
    push?: boolean
  }
}

export interface MetricSnapshot {
  userId: string
  churchId: string
  metric: MetricType
  value: number
  previousValue: number
  timestamp: Date
  trend: 'up' | 'down' | 'stable'
}

/**
 * AlertService
 * Manages alert rules and threshold monitoring (PostgreSQL-backed)
 */
export class AlertService {
  private static toAlertRule(record: any): AlertRule {
    return {
      ...record,
      lastTriggeredAt: record.lastTriggeredAt ?? undefined,
      metadata: (record.metadata as Record<string, any>) ?? undefined,
    }
  }

  /**
   * Create alert rule
   */
  static async createAlertRule(
    userId: string,
    churchId: string,
    rule: AlertRuleCreate
  ): Promise<AlertRule> {
    const record = await prisma.alertRule.create({
      data: {
        userId,
        churchId,
        name: rule.name,
        metric: rule.metric,
        condition: rule.condition,
        threshold: rule.threshold,
        frequency: rule.frequency,
        enabled: true,
        notifyVia: {
          email: rule.notifyVia?.email ?? true,
          inApp: rule.notifyVia?.inApp ?? true,
          push: rule.notifyVia?.push ?? false,
        },
      },
    })

    return this.toAlertRule(record)
  }

  /**
   * Get alert rules for user
   */
  static async getAlertRules(userId: string, churchId: string): Promise<AlertRule[]> {
    const records = await prisma.alertRule.findMany({
      where: { userId, churchId },
      orderBy: { createdAt: 'desc' },
    })
    return records.map((r) => this.toAlertRule(r))
  }

  /**
   * Update alert rule (scoped to owner). Returns whether a rule was updated.
   */
  static async updateAlertRule(
    ruleId: string,
    updates: Partial<Omit<AlertRule, 'id' | 'userId' | 'churchId' | 'createdAt'>>,
    userId?: string
  ): Promise<boolean> {
    const { metadata, ...rest } = updates
    const result = await prisma.alertRule.updateMany({
      where: { id: ruleId, ...(userId ? { userId } : {}) },
      data: {
        ...rest,
        ...(metadata !== undefined ? { metadata } : {}),
      },
    })
    return result.count > 0
  }

  /**
   * Delete alert rule (scoped to owner). Returns whether a rule was deleted.
   */
  static async deleteAlertRule(ruleId: string, userId?: string): Promise<boolean> {
    const result = await prisma.alertRule.deleteMany({
      where: { id: ruleId, ...(userId ? { userId } : {}) },
    })
    return result.count > 0
  }

  /**
   * Enable/disable alert rule (scoped to owner)
   */
  static async toggleAlertRule(ruleId: string, enabled: boolean, userId?: string): Promise<boolean> {
    const result = await prisma.alertRule.updateMany({
      where: { id: ruleId, ...(userId ? { userId } : {}) },
      data: { enabled },
    })
    return result.count > 0
  }

  /**
   * Check metric against rules and trigger notifications
   */
  static async checkMetricThresholds(userId: string, churchId: string, metricSnapshot: Omit<MetricSnapshot, 'userId' | 'churchId' | 'timestamp'>): Promise<void> {
    const rules = await this.getAlertRules(userId, churchId)
    const matchingRules = rules.filter((r) => r.enabled && r.metric === metricSnapshot.metric)

    for (const rule of matchingRules) {
      const triggered = this.evaluateRule(rule, metricSnapshot.value, metricSnapshot.previousValue)

      if (triggered) {
        // Update last triggered time
        await this.updateAlertRule(rule.id, {
          lastTriggeredAt: new Date(),
        })

        // Send notification
        await this.sendAlertNotification(userId, churchId, rule, metricSnapshot)
      }
    }
  }

  /**
   * Evaluate if rule condition is met
   */
  private static evaluateRule(rule: AlertRule, currentValue: number, previousValue: number): boolean {
    switch (rule.condition) {
      case 'below':
        return currentValue < rule.threshold
      case 'above':
        return currentValue > rule.threshold
      case 'equals':
        return currentValue === rule.threshold
      case 'changes':
        return currentValue !== previousValue
      default:
        return false
    }
  }

  /**
   * Send alert notification
   */
  private static async sendAlertNotification(
    userId: string,
    churchId: string,
    rule: AlertRule,
    metricSnapshot: Omit<MetricSnapshot, 'userId' | 'churchId' | 'timestamp'>
  ): Promise<void> {
    const message = this.buildAlertMessage(rule, metricSnapshot)

    await NotificationService.sendNotification({
      userId,
      churchId,
      title: `Alert: ${rule.name}`,
      message,
      type: 'WARNING',
      icon: 'alert-circle',
      metadata: {
        alertRuleId: rule.id,
        metric: rule.metric,
        currentValue: metricSnapshot.value,
        threshold: rule.threshold,
        condition: rule.condition,
      },
    })
  }

  /**
   * Build alert message
   */
  private static buildAlertMessage(
    rule: AlertRule,
    metricSnapshot: Omit<MetricSnapshot, 'userId' | 'churchId' | 'timestamp'>
  ): string {
    const metricLabel = this.getMetricLabel(rule.metric)
    const conditionLabel = this.getConditionLabel(rule.condition, rule.threshold)

    return `${metricLabel} is ${conditionLabel}. Current value: ${metricSnapshot.value}`
  }

  /**
   * Get metric label
   */
  private static getMetricLabel(metric: MetricType): string {
    const labels: Record<MetricType, string> = {
      meetings: 'Meetings',
      attendance: 'Attendance',
      livestream: 'Livestream',
      engagement: 'Engagement',
      members: 'Members',
    }
    return labels[metric]
  }

  /**
   * Get condition label
   */
  private static getConditionLabel(condition: AlertCondition, threshold: number): string {
    switch (condition) {
      case 'below':
        return `below ${threshold}`
      case 'above':
        return `above ${threshold}`
      case 'equals':
        return `equals ${threshold}`
      case 'changes':
        return 'changed'
      default:
        return 'triggered'
    }
  }

  /**
   * Get alert statistics
   */
  static async getAlertStats(
    userId: string,
    churchId: string
  ): Promise<{
    total: number
    enabled: number
    disabled: number
    byMetric: Record<MetricType, number>
    recentlyTriggered: number
  }> {
    const rules = await this.getAlertRules(userId, churchId)
    const now = new Date()
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    const stats = {
      total: rules.length,
      enabled: rules.filter((r) => r.enabled).length,
      disabled: rules.filter((r) => !r.enabled).length,
      byMetric: {
        meetings: 0,
        attendance: 0,
        livestream: 0,
        engagement: 0,
        members: 0,
      },
      recentlyTriggered: rules.filter((r) => r.lastTriggeredAt && r.lastTriggeredAt > oneDayAgo).length,
    }

    rules.forEach((r) => {
      stats.byMetric[r.metric]++
    })

    return stats
  }

  /**
   * Batch check metrics (for scheduled checks)
   */
  static async batchCheckMetrics(
    userId: string,
    churchId: string,
    metrics: Array<Omit<MetricSnapshot, 'userId' | 'churchId' | 'timestamp'>>
  ): Promise<void> {
    for (const metric of metrics) {
      await this.checkMetricThresholds(userId, churchId, metric)
    }
  }
}
