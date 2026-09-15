import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { ChurchService } from '@/lib/services/church-service'
import { prisma } from '@/lib/prisma'
import ChurchesList from '@/components/superadmin/ChurchesList'

export default async function ChurchesPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/auth/login')
  }

  const userRole = (session.user as any)?.role
  if (userRole !== 'SUPER_ADMIN') {
    redirect('/dashboard')
  }

  const churches = await ChurchService.findAll()

  // Batch user counts and subscriptions for all churches (avoids N+1)
  const churchIds = churches.map((c) => c.id)
  const [userCounts, subscriptions] = await Promise.all([
    prisma.user.groupBy({ by: ['churchId'], where: { churchId: { in: churchIds } }, _count: { _all: true } }),
    prisma.subscription.findMany({ where: { churchId: { in: churchIds } } }),
  ])
  const userCountMap = new Map(userCounts.map((u) => [u.churchId, u._count._all]))
  const subscriptionMap = new Map(subscriptions.map((s) => [s.churchId, s]))

  const churchesWithStats = churches.map((church) => ({
    ...church,
    userCount: userCountMap.get(church.id) ?? 0,
    subscriptionStatus: subscriptionMap.get(church.id)?.status || 'TRIAL',
  }))

  const churchesForClient = churchesWithStats.map((church) => ({
    ...church,
    createdAt: church.createdAt instanceof Date ? church.createdAt.toISOString() : church.createdAt,
    updatedAt: church.updatedAt instanceof Date ? church.updatedAt.toISOString() : church.updatedAt,
  }))

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Tenant Management</h1>
          <p className="text-gray-600 mt-2">Manage all church organizations and licenses</p>
        </div>
      </div>

      {/* Churches List with Filters */}
      <ChurchesList churches={churchesForClient} />
    </div>
  )
}

