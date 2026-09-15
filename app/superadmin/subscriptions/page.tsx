import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'
import PlanPricingManager from '@/components/superadmin/PlanPricingManager'
import { LICENSING_PLANS } from '@/lib/licensing/plans'

export default async function SubscriptionsPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/auth/login')
  }

  const userRole = (session.user as any)?.role
  if (userRole !== 'SUPER_ADMIN') {
    redirect('/dashboard')
  }

  // Get all subscriptions
  const subscriptions = await prisma.subscription.findMany()

  // Get all plans
  const configById = new Map(LICENSING_PLANS.map((plan) => [plan.id, plan]))

  const planRows = await prisma.subscriptionPlan.findMany()
  const plans = planRows.map((data) => {
    const rawPrice = typeof data.price === 'number' ? data.price : Number(data.price) || 0
    const config = configById.get(data.id)
    return {
      id: data.id,
      name: data.name || config?.name || data.id,
      description: data.description || config?.description || '',
      price: rawPrice || config?.priceMonthlyRange.min || 0,
      currency: (data.currency || 'USD') as string,
      billingCycle: (data.billingCycle || config?.billingCycle || 'monthly') as string,
      features: Array.isArray(data.features) && data.features.length > 0 ? data.features : config?.features || [],
      type: (data as any).type || (data as any).tier || config?.tier || '',
      targetMembers: config?.targetMembers,
    }
  })

  const planMap = new Map(plans.map((plan) => [plan.id, plan]))

  LICENSING_PLANS.forEach((config) => {
    if (!planMap.has(config.id)) {
      planMap.set(config.id, {
        id: config.id,
        name: config.name,
        description: config.description,
        price: config.priceMonthlyRange.min,
        currency: 'USD',
        billingCycle: config.billingCycle ?? 'monthly',
        features: config.features || [],
        type: config.tier,
        targetMembers: config.targetMembers,
      })
    }
  })

  const mergedPlans = Array.from(planMap.values()).sort((a, b) => (a.price ?? 0) - (b.price ?? 0))

  const promos = await prisma.subscriptionPromo.findMany({ orderBy: { createdAt: 'desc' } })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Subscriptions</h1>
        <p className="text-gray-600 mt-2">Manage subscription plans and church subscriptions</p>
      </div>

      <PlanPricingManager initialPlans={mergedPlans as any} initialPromos={promos as any} />

      {/* Active Subscriptions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Active Subscriptions</h2>
        </div>
        <div className="divide-y divide-gray-200">
          {subscriptions.length === 0 ? (
            <div className="p-6 text-center text-gray-500">No subscriptions found</div>
          ) : (
            subscriptions.map((sub: any) => (
              <div key={sub.id} className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-900">Church ID: {sub.churchId}</p>
                    <p className="text-sm text-gray-600">Status: {sub.status}</p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-semibold ${
                      sub.status === 'ACTIVE'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {sub.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

