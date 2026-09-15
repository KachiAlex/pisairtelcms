import { prisma } from '@/lib/prisma'
import { LicensingPlanConfig, LICENSING_PLANS } from '@/lib/licensing/plans'

export interface SubscriptionPlan {
  id: string
  code?: string
  name: string
  type: string
  description?: string
  price: number
  currency: string
  maxUsers?: number
  maxStorageGB?: number
  maxSermons?: number
  maxEvents?: number
  maxDepartments?: number
  maxGroups?: number
  features: string[]
  billingCycle: string
  trialDays: number
  createdAt: Date
  updatedAt: Date
}

export interface Subscription {
  id: string
  churchId: string
  planId: string
  status: string
  startDate: Date
  endDate?: Date
  trialEndsAt?: Date
  createdAt: Date
  updatedAt: Date
}

export interface UsageMetric {
  id: string
  churchId: string
  metricType: string
  value: number
  period: string
  createdAt: Date
}

const PLAN_TYPES = ['FREE', 'BASIC', 'PRO', 'ENTERPRISE']
const SUBSCRIPTION_STATUSES = ['ACTIVE', 'TRIAL', 'EXPIRED', 'CANCELLED', 'SUSPENDED']

// UsageTracking columns that back the legacy metricType keys
const METRIC_COLUMNS: Record<string, string> = {
  userCount: 'userCount',
  storageUsedGB: 'storageUsedGB',
  sermonsCount: 'sermonsCount',
  eventsCount: 'eventsCount',
  apiCalls: 'apiCalls',
  aiCoachingSessions: 'aiCoachingSessions',
}

const withLegacy = <T>(record: any): T => {
  if (!record) return record
  const { firestoreData, ...rest } = record
  const legacy = (firestoreData as Record<string, unknown>) || {}
  return { ...legacy, ...rest } as T
}

const toSubscription = (record: any): Subscription => {
  const mapped = withLegacy<any>(record)
  return {
    ...mapped,
    // Prisma stores billing-period dates; the API surface uses start/end/trialEndsAt
    startDate: mapped.currentPeriodStart ?? mapped.startDate,
    endDate: mapped.currentPeriodEnd ?? mapped.endDate,
    trialEndsAt: mapped.trialEnd ?? mapped.trialEndsAt,
  } as Subscription
}

export class SubscriptionPlanService {
  static async findAll(): Promise<SubscriptionPlan[]> {
    await Promise.all(LICENSING_PLANS.map((plan) => this.ensurePlanFromConfig(plan)))

    const records = await prisma.subscriptionPlan.findMany({
      orderBy: { price: 'asc' },
    })
    return records.map((r) => withLegacy<SubscriptionPlan>(r))
  }

  static async findById(id: string): Promise<SubscriptionPlan | null> {
    const record = await prisma.subscriptionPlan.findUnique({ where: { id } })
    return record ? withLegacy<SubscriptionPlan>(record) : null
  }

  static async ensurePlan(planId: string): Promise<SubscriptionPlan | null> {
    const existing = await this.findById(planId)
    if (existing) return existing

    const config = LICENSING_PLANS.find((plan) => plan.id === planId)
    if (!config) return null
    return this.ensurePlanFromConfig(config)
  }

  static async create(data: Omit<SubscriptionPlan, 'id' | 'createdAt' | 'updatedAt'>): Promise<SubscriptionPlan> {
    const { code, ...rest } = data as any
    const record = await prisma.subscriptionPlan.create({
      data: {
        name: rest.name,
        type: (PLAN_TYPES.includes(String(rest.type).toUpperCase()) ? String(rest.type).toUpperCase() : 'FREE') as any,
        description: rest.description ?? null,
        price: rest.price ?? 0,
        currency: rest.currency || 'USD',
        maxUsers: rest.maxUsers ?? null,
        maxStorageGB: rest.maxStorageGB ?? null,
        maxSermons: rest.maxSermons ?? null,
        maxEvents: rest.maxEvents ?? null,
        maxDepartments: rest.maxDepartments ?? null,
        maxGroups: rest.maxGroups ?? null,
        features: rest.features || [],
        billingCycle: rest.billingCycle || 'monthly',
        trialDays: rest.trialDays ?? 0,
        ...(code ? { firestoreData: { code } } : {}),
      },
    })
    return withLegacy<SubscriptionPlan>(record)
  }

  static async update(
    id: string,
    data: Partial<Omit<SubscriptionPlan, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<SubscriptionPlan | null> {
    const existing = await prisma.subscriptionPlan.findUnique({ where: { id } })
    if (!existing) return null

    const { code, type, ...rest } = data as any
    const record = await prisma.subscriptionPlan.update({
      where: { id },
      data: {
        ...rest,
        ...(type !== undefined
          ? { type: (PLAN_TYPES.includes(String(type).toUpperCase()) ? String(type).toUpperCase() : existing.type) as any }
          : {}),
        ...(code !== undefined
          ? { firestoreData: { ...((existing.firestoreData as any) || {}), code } }
          : {}),
      },
    })
    return withLegacy<SubscriptionPlan>(record)
  }

  static async ensurePlanFromConfig(config: LicensingPlanConfig): Promise<SubscriptionPlan> {
    const record = await prisma.subscriptionPlan.upsert({
      where: { id: config.id },
      create: {
        id: config.id,
        name: config.name,
        type: (PLAN_TYPES.includes(String(config.tier).toUpperCase()) ? String(config.tier).toUpperCase() : 'FREE') as any,
        description: config.description,
        price: config.priceMonthlyRange.min,
        currency: 'USD',
        maxUsers: config.limits?.maxUsers,
        maxStorageGB: config.limits?.maxStorageGB,
        maxSermons: config.limits?.maxSermons,
        maxEvents: config.limits?.maxEvents,
        maxDepartments: config.limits?.maxDepartments,
        maxGroups: config.limits?.maxGroups,
        features: config.features,
        billingCycle: config.billingCycle ?? 'monthly',
        trialDays: 30,
        firestoreData: { code: config.id },
      },
      update: {},
    })
    return withLegacy<SubscriptionPlan>(record)
  }
}

export class SubscriptionService {
  static async findByChurch(churchId: string): Promise<Subscription | null> {
    const record = await prisma.subscription.findUnique({ where: { churchId } })
    return record ? toSubscription(record) : null
  }

  static async findById(id: string): Promise<Subscription | null> {
    const record = await prisma.subscription.findUnique({ where: { id } })
    return record ? toSubscription(record) : null
  }

  static async create(data: Omit<Subscription, 'id' | 'createdAt' | 'updatedAt'>): Promise<Subscription> {
    const startDate = data.startDate instanceof Date ? data.startDate : new Date(data.startDate)
    const endDate = data.endDate ? (data.endDate instanceof Date ? data.endDate : new Date(data.endDate)) : null
    const trialEndsAt = data.trialEndsAt
      ? (data.trialEndsAt instanceof Date ? data.trialEndsAt : new Date(data.trialEndsAt))
      : null

    const record = await prisma.subscription.upsert({
      where: { churchId: data.churchId },
      create: {
        churchId: data.churchId,
        planId: data.planId,
        status: (SUBSCRIPTION_STATUSES.includes(data.status) ? data.status : 'ACTIVE') as any,
        currentPeriodStart: startDate,
        currentPeriodEnd: endDate ?? new Date(startDate.getFullYear(), startDate.getMonth() + 1, startDate.getDate()),
        trialStart: trialEndsAt ? startDate : null,
        trialEnd: trialEndsAt,
      },
      update: {
        planId: data.planId,
        status: (SUBSCRIPTION_STATUSES.includes(data.status) ? data.status : 'ACTIVE') as any,
        currentPeriodStart: startDate,
        currentPeriodEnd: endDate ?? new Date(startDate.getFullYear(), startDate.getMonth() + 1, startDate.getDate()),
        trialEnd: trialEndsAt,
      },
    })
    return toSubscription(record)
  }

  static async update(id: string, data: Partial<Subscription>): Promise<Subscription | null> {
    const { id: _id, churchId: _c, createdAt: _ca, updatedAt: _u, startDate, endDate, trialEndsAt, ...rest } = data as any
    const record = await prisma.subscription.update({
      where: { id },
      data: {
        ...rest,
        ...(rest.status && SUBSCRIPTION_STATUSES.includes(rest.status) ? { status: rest.status } : { status: undefined }),
        ...(startDate ? { currentPeriodStart: new Date(startDate) } : {}),
        ...(endDate !== undefined ? { currentPeriodEnd: endDate ? new Date(endDate) : null } : {}),
        ...(trialEndsAt !== undefined ? { trialEnd: trialEndsAt ? new Date(trialEndsAt) : null } : {}),
      },
    })
    return toSubscription(record)
  }
}

export class UsageMetricService {
  /**
   * Returns one synthetic UsageMetric entry per non-zero metric column,
   * preserving the legacy { metricType, value, period } shape.
   */
  static async findByChurch(churchId: string, metricType?: string): Promise<UsageMetric[]> {
    const rows = await prisma.usageTracking.findMany({
      where: { churchId },
      orderBy: { periodStart: 'desc' },
      take: 100,
    })

    const metrics: UsageMetric[] = []
    for (const row of rows) {
      const period = row.periodStart.toISOString().split('T')[0]
      const customMetrics = ((row.firestoreData as any)?.metrics as Record<string, number>) || {}

      for (const [metricKey, column] of Object.entries(METRIC_COLUMNS)) {
        if (metricType && metricKey !== metricType) continue
        metrics.push({
          id: `${row.id}:${metricKey}`,
          churchId,
          metricType: metricKey,
          value: (row as any)[column] ?? 0,
          period,
          createdAt: row.createdAt,
        })
      }
      for (const [key, value] of Object.entries(customMetrics)) {
        if (metricType && key !== metricType) continue
        metrics.push({ id: `${row.id}:${key}`, churchId, metricType: key, value, period, createdAt: row.createdAt })
      }
    }

    metrics.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    return metrics.slice(0, 100)
  }

  /**
   * Upsert the UsageTracking row for the metric's period and set the column.
   * `period` is an ISO date string (YYYY-MM-DD) representing the period start.
   */
  static async create(data: Omit<UsageMetric, 'id' | 'createdAt'>): Promise<UsageMetric> {
    const periodStart = new Date(data.period)
    const periodEnd = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 0, 23, 59, 59)
    const column = METRIC_COLUMNS[data.metricType]

    const existing = await prisma.usageTracking.findFirst({
      where: { churchId: data.churchId, periodStart },
    })

    let row
    if (existing) {
      row = column
        ? await prisma.usageTracking.update({ where: { id: existing.id }, data: { [column]: data.value } })
        : await prisma.usageTracking.update({
            where: { id: existing.id },
            data: {
              firestoreData: {
                ...((existing.firestoreData as any) || {}),
                metrics: {
                  ...(((existing.firestoreData as any)?.metrics) || {}),
                  [data.metricType]: data.value,
                },
              },
            },
          })
    } else {
      row = await prisma.usageTracking.create({
        data: {
          churchId: data.churchId,
          periodStart,
          periodEnd,
          ...(column ? { [column]: data.value } : { firestoreData: { metrics: { [data.metricType]: data.value } } }),
        },
      })
    }

    return {
      id: `${row.id}:${data.metricType}`,
      churchId: data.churchId,
      metricType: data.metricType,
      value: data.value,
      period: data.period,
      createdAt: row.createdAt,
    }
  }

  /** Increment a metric column for the given period, creating the row if needed */
  static async increment(churchId: string, metricType: string, period: string, amount: number = 1): Promise<void> {
    const periodStart = new Date(period)
    const periodEnd = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 0, 23, 59, 59)
    const column = METRIC_COLUMNS[metricType]

    const existing = await prisma.usageTracking.findFirst({
      where: { churchId, periodStart },
    })

    if (existing) {
      if (column) {
        await prisma.usageTracking.update({
          where: { id: existing.id },
          data: { [column]: { increment: amount } },
        })
      } else {
        const metrics = (((existing.firestoreData as any)?.metrics) || {}) as Record<string, number>
        await prisma.usageTracking.update({
          where: { id: existing.id },
          data: {
            firestoreData: {
              ...((existing.firestoreData as any) || {}),
              metrics: { ...metrics, [metricType]: (metrics[metricType] || 0) + amount },
            },
          },
        })
      }
      return
    }

    await prisma.usageTracking.create({
      data: {
        churchId,
        periodStart,
        periodEnd,
        ...(column ? { [column]: amount } : { firestoreData: { metrics: { [metricType]: amount } } }),
      },
    })
  }
}
