import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { ChurchService } from '@/lib/services/church-service'
import { UserService } from '@/lib/services/user-service'
import { SubscriptionPlanService, Subscription, SubscriptionService } from '@/lib/services/subscription-service'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import LicenseManagerWrapper from '@/components/superadmin/LicenseManagerWrapper'
import UsageStats from '@/components/superadmin/UsageStats'
import { getChurchUsage, getPlanLimits } from '@/lib/subscription'
import { SubscriptionPricingService } from '@/lib/services/subscription-pricing-service'

const serializeDate = (value: any) => {
  if (!value) return value
  if (value instanceof Date) return value.toISOString()
  if (typeof value?.toDate === 'function') return value.toDate().toISOString()
  if (typeof value === 'string') return value
  return value
}

export default async function ChurchDetailPage({
  params,
}: {
  params: { churchId: string }
}) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/auth/login')
  }

  const userRole = (session.user as any)?.role
  if (userRole !== 'SUPER_ADMIN') {
    redirect('/dashboard')
  }

  const church = await ChurchService.findById(params.churchId)

  if (!church) {
    redirect('/superadmin/churches')
  }

  // Get church owner
  const owner = church.ownerId ? await UserService.findById(church.ownerId) : null

  // Get users count
  const userCount = await prisma.user.count({ where: { churchId: church.id } })

  // Get subscription
  const subscription = await SubscriptionService.findByChurch(church.id)

  // Get plan if subscription exists
  let plan = null
  if (subscription?.planId) {
    plan = await SubscriptionPlanService.findById(subscription.planId)
  }

  // Get all available plans for license management
  const availablePlans = await SubscriptionPlanService.findAll()

  // Get usage statistics
  let usage = null
  let limits = null
  if (subscription?.planId) {
    try {
      usage = await getChurchUsage(church.id)
      limits = await getPlanLimits(subscription.planId)
    } catch (error) {
      console.error('Error fetching usage:', error)
      // Set default usage if fetch fails
      usage = {
        userCount,
        storageUsedGB: 0,
        sermonsCount: 0,
        eventsCount: 0,
      }
      limits = plan ? {
        maxUsers: plan.maxUsers,
        maxStorageGB: plan.maxStorageGB,
        maxSermons: plan.maxSermons,
        maxEvents: plan.maxEvents,
        maxDepartments: plan.maxDepartments,
        maxGroups: plan.maxGroups,
      } : null
    }
  }

  const subscriptionForClient = subscription
    ? {
        ...subscription,
        startDate: serializeDate(subscription.startDate),
        endDate: serializeDate(subscription.endDate),
        trialEndsAt: serializeDate(subscription.trialEndsAt),
        createdAt: serializeDate(subscription.createdAt),
        updatedAt: serializeDate(subscription.updatedAt),
      }
    : null

  const planForClient = plan
    ? {
        ...plan,
        createdAt: serializeDate(plan.createdAt),
        updatedAt: serializeDate(plan.updatedAt),
      }
    : null

  const plansForClient = availablePlans.map((p) => ({
    ...p,
    createdAt: serializeDate(p.createdAt),
    updatedAt: serializeDate(p.updatedAt),
  }))

  const planOverrides = await SubscriptionPricingService.listOverridesForChurch(church.id)
  const planOverridesForClient = planOverrides.map((override) => ({
    ...override,
    createdAt: serializeDate(override.createdAt),
    updatedAt: serializeDate(override.updatedAt),
    expiresAt: serializeDate(override.expiresAt),
  }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/superadmin/churches"
            className="text-sm text-gray-600 hover:text-gray-900 mb-2 inline-block"
          >
            ← Back to Churches
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">{church.name}</h1>
          {church.slug && (
            <p className="text-gray-600 mt-1">Slug: /{church.slug}</p>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <p className="text-sm font-medium text-gray-600 mb-1">Total Members</p>
          <p className="text-3xl font-bold text-gray-900">{userCount}</p>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <p className="text-sm font-medium text-gray-600 mb-1">Subscription Status</p>
          <p className="text-2xl font-bold text-gray-900">
            {subscription?.status || 'TRIAL'}
          </p>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <p className="text-sm font-medium text-gray-600 mb-1">Plan</p>
          <p className="text-2xl font-bold text-gray-900">
            {plan?.name || 'Free'}
          </p>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <p className="text-sm font-medium text-gray-600 mb-1">Created</p>
          <p className="text-lg font-semibold text-gray-900">
            {new Date(church.createdAt).toLocaleDateString()}
          </p>
        </div>
      </div>

      {/* Church Details */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Church Details</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <p className="text-gray-900">{church.name}</p>
          </div>
          {church.slug && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
              <p className="text-gray-900">/{church.slug}</p>
            </div>
          )}
          {church.email && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <p className="text-gray-900">{church.email}</p>
            </div>
          )}
          {church.phone && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <p className="text-gray-900">{church.phone}</p>
            </div>
          )}
          {church.address && (
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <p className="text-gray-900">{church.address}</p>
            </div>
          )}
          {church.city && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
              <p className="text-gray-900">{church.city}</p>
            </div>
          )}
          {church.country && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
              <p className="text-gray-900">{church.country}</p>
            </div>
          )}
          {church.description && (
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <p className="text-gray-900">{church.description}</p>
            </div>
          )}
        </div>
      </div>

      {/* Owner Information */}
      {owner && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Church Owner</h2>
          <div className="flex items-center space-x-4">
            <div>
              <p className="font-semibold text-gray-900">
                {owner.firstName} {owner.lastName}
              </p>
              <p className="text-sm text-gray-600">{owner.email}</p>
              <p className="text-sm text-gray-500">Role: {owner.role}</p>
            </div>
          </div>
        </div>
      )}

      {/* Usage Statistics */}
      {usage && limits && (
        <UsageStats usage={usage} limits={limits} />
      )}

      {/* License Management */}
      <LicenseManagerWrapper
        churchId={church.id}
        initialSubscription={subscriptionForClient}
        initialPlan={planForClient}
        initialPlans={plansForClient}
        initialPlanOverrides={planOverridesForClient}
      />
    </div>
  )
}

