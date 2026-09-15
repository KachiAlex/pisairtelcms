import { SubscriptionService, SubscriptionPlanService, UsageMetricService } from './services/subscription-service'
import { ChurchService } from './services/church-service'
import { UserService } from './services/user-service'
import { prisma } from './prisma'

export interface UsageLimits {
  maxUsers?: number
  maxStorageGB?: number
  maxSermons?: number
  maxEvents?: number
  maxDepartments?: number
  maxGroups?: number
}

export async function checkStorageLimitForUpload(
  churchId: string,
  uploadBytes: number
): Promise<{ allowed: boolean; current: number; projected: number; limit?: number }> {
  const church = await ChurchService.findById(churchId)
  if (!church) {
    return { allowed: false, current: 0, projected: 0 }
  }

  const subscription = await SubscriptionService.findByChurch(churchId)
  if (!subscription) {
    return { allowed: false, current: 0, projected: 0 }
  }

  const limits = await getPlanLimits(subscription.planId)
  const usage = await getChurchUsage(churchId)

  const limit = limits.maxStorageGB
  const current = usage.storageUsedGB
  const uploadGB = uploadBytes / (1024 * 1024 * 1024)
  const projected = current + uploadGB

  if (!limit) {
    return { allowed: true, current, projected }
  }

  return {
    allowed: projected < limit,
    current,
    projected,
    limit,
  }
}

export interface UsageStats {
  userCount: number
  storageUsedGB: number
  sermonsCount: number
  eventsCount: number
  departmentsCount: number
  groupsCount: number
  apiCalls: number
  aiCoachingSessions: number
}

const limitToUsageKey: Record<keyof UsageLimits, keyof UsageStats> = {
  maxUsers: 'userCount',
  maxStorageGB: 'storageUsedGB',
  maxSermons: 'sermonsCount',
  maxEvents: 'eventsCount',
  maxDepartments: 'departmentsCount',
  maxGroups: 'groupsCount',
}

/**
 * Get subscription plan limits
 */
export async function getPlanLimits(planId: string): Promise<UsageLimits> {
  const plan = await SubscriptionPlanService.findById(planId)
  if (!plan) return {}

  return {
    maxUsers: plan.maxUsers,
    maxStorageGB: plan.maxStorageGB,
    maxSermons: plan.maxSermons,
    maxEvents: plan.maxEvents,
    maxDepartments: plan.maxDepartments,
    maxGroups: plan.maxGroups,
  }
}

/**
 * Get current usage for a church
 */
export async function getChurchUsage(churchId: string): Promise<UsageStats> {
  // Get current period (this month)
  const now = new Date()
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
  const period = `${periodStart.toISOString().split('T')[0]}`

  // Get usage metrics for current period
  const metrics = await UsageMetricService.findByChurch(churchId)
  const currentPeriodMetrics = metrics.filter(m => m.period === period)

  // Calculate current usage
  const [userCount, sermonsCount, eventsCount, departmentsCount, groupsCount] = await Promise.all([
    prisma.user.count({ where: { churchId } }),
    prisma.sermon.count({ where: { churchId } }),
    prisma.event.count({
      where: { churchId, startDate: { gte: periodStart, lte: periodEnd } },
    }),
    prisma.department.count({ where: { churchId } }),
    prisma.group.count({ where: { churchId } }),
  ])

  // Get API calls and AI sessions from metrics
  const apiCallsMetric = currentPeriodMetrics.find(m => m.metricType === 'apiCalls')
  const aiSessionsMetric = currentPeriodMetrics.find(m => m.metricType === 'aiCoachingSessions')

  // Storage used for current period (best-effort; defaults to 0 if not tracked)
  const storageMetric = currentPeriodMetrics.find(m => m.metricType === 'storageUsedGB')
  const storageUsedGB = storageMetric?.value || 0

  return {
    userCount,
    storageUsedGB,
    sermonsCount,
    eventsCount,
    departmentsCount,
    groupsCount,
    apiCalls: apiCallsMetric?.value || 0,
    aiCoachingSessions: aiSessionsMetric?.value || 0,
  }
}

/**
 * Check if church has reached a usage limit
 */
export async function checkUsageLimit(
  churchId: string,
  limitType: keyof UsageLimits
): Promise<{ allowed: boolean; current: number; limit?: number }> {
  const church = await ChurchService.findById(churchId)
  if (!church) {
    return { allowed: false, current: 0 }
  }

  const subscription = await SubscriptionService.findByChurch(churchId)
  if (!subscription) {
    return { allowed: false, current: 0 }
  }

  const limits = await getPlanLimits(subscription.planId)
  const usage = await getChurchUsage(churchId)

  const limit = limits[limitType]
  if (!limit) {
    // Unlimited
    return { allowed: true, current: usage[limitToUsageKey[limitType]] as number }
  }

  const current = usage[limitToUsageKey[limitType]] as number
  return {
    allowed: current < limit,
    current,
    limit,
  }
}

/**
 * Increment usage counter
 */
export async function incrementUsage(
  churchId: string,
  metric: keyof UsageStats,
  amount: number = 1
): Promise<void> {
  const now = new Date()
  const period = `${new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]}`

  await UsageMetricService.increment(churchId, metric, period, amount)
}

/**
 * Check if subscription is active
 */
export async function isSubscriptionActive(churchId: string): Promise<boolean> {
  const subscription = await SubscriptionService.findByChurch(churchId)

  if (!subscription) {
    return false
  }

  const { status, endDate } = subscription
  const now = new Date()

  if (status === 'ACTIVE' || status === 'TRIAL') {
    return !endDate || endDate > now
  }

  return false
}

/**
 * Get subscription status with details
 */
export async function getSubscriptionStatus(churchId: string) {
  const subscription = await SubscriptionService.findByChurch(churchId)

  if (!subscription) {
    return {
      active: false,
      status: null,
      plan: null,
      usage: null,
      limits: null,
      subscription: null,
    }
  }

  const plan = await SubscriptionPlanService.findById(subscription.planId)
  const usage = await getChurchUsage(churchId)
  const limits = await getPlanLimits(subscription.planId)

  const planPrice = typeof plan?.price === 'number' ? plan.price : Number(plan?.price ?? 0)
  const isFreePlan = planPrice <= 0
  const baseActive = await isSubscriptionActive(churchId)
  const active = baseActive || isFreePlan

  // Calculate current billing period
  const now = new Date()
  const billingCycle = plan?.billingCycle || 'monthly'
  let currentPeriodStart: Date
  let currentPeriodEnd: Date

  if (billingCycle === 'monthly') {
    currentPeriodStart = new Date(now.getFullYear(), now.getMonth(), 1)
    currentPeriodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
  } else {
    // Yearly - use subscription start date as period start
    currentPeriodStart = subscription.startDate
    currentPeriodEnd = new Date(
      currentPeriodStart.getFullYear() + 1,
      currentPeriodStart.getMonth(),
      currentPeriodStart.getDate()
    )
  }

  // Transform subscription to include required fields
  const normalizedStatus = isFreePlan ? 'ACTIVE' : subscription.status
  const subscriptionWithPeriod = {
    ...subscription,
    status: normalizedStatus,
    currentPeriodStart,
    currentPeriodEnd,
    cancelAtPeriodEnd: normalizedStatus === 'CANCELLED' || normalizedStatus === 'CANCELING',
  }

  return {
    active,
    status: normalizedStatus,
    plan,
    usage,
    limits,
    subscription: subscriptionWithPeriod,
  }
}

/**
 * Create a new subscription (trial or paid)
 */
export async function createSubscription(
  churchId: string,
  planId: string,
  startTrial: boolean = true
) {
  const plan = await SubscriptionPlanService.findById(planId)

  if (!plan) {
    throw new Error('Plan not found')
  }

  const now = new Date()
  let endDate = new Date(now)
  endDate.setMonth(endDate.getMonth() + 1)

  let status = 'ACTIVE'
  let trialEndsAt: Date | undefined = undefined

  if (startTrial && plan.trialDays > 0) {
    status = 'TRIAL'
    trialEndsAt = new Date(now)
    trialEndsAt.setDate(trialEndsAt.getDate() + plan.trialDays)
    endDate = trialEndsAt
  }

  const subscription = await SubscriptionService.create({
    churchId,
    planId,
    status,
    startDate: now,
    endDate,
    trialEndsAt,
  })

  return subscription
}

/**
 * Cancel subscription
 */
export async function cancelSubscription(churchId: string, cancelAtPeriodEnd: boolean = true) {
  const subscription = await SubscriptionService.findByChurch(churchId)

  if (!subscription) {
    throw new Error('Subscription not found')
  }

  const updateData: any = {
    status: cancelAtPeriodEnd ? subscription.status : 'CANCELLED',
  }

  if (!cancelAtPeriodEnd) {
    updateData.endDate = new Date()
  }

  await SubscriptionService.update(subscription.id, updateData)

  return {
    ...subscription,
    ...updateData,
  }
}

