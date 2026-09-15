import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { ChurchService } from '@/lib/services/church-service'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function SuperAdminDashboard() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/auth/login')
  }

  const userRole = (session.user as any)?.role
  if (userRole !== 'SUPER_ADMIN') {
    redirect('/dashboard')
  }

  // Get statistics
  const churches = await ChurchService.findAll()
  
  // Get total users count
  const totalUsers = await prisma.user.count()

  // Get active subscriptions
  const activeSubscriptions = await prisma.subscription.count({
    where: { status: 'ACTIVE' },
  })

  // Get recent churches
  const recentChurches = churches.slice(0, 5)

  const stats = [
    {
      label: 'Total Churches',
      value: churches.length.toString(),
      change: '+12',
      icon: '🏛️',
      color: 'blue',
    },
    {
      label: 'Total Users',
      value: totalUsers.toString(),
      change: '+234',
      icon: '👥',
      color: 'green',
    },
    {
      label: 'Active Subscriptions',
      value: activeSubscriptions.toString(),
      change: '+5',
      icon: '💳',
      color: 'purple',
    },
    {
      label: 'Trial Churches',
      value: (churches.length - activeSubscriptions).toString(),
      change: '-2',
      icon: '⏱️',
      color: 'orange',
    },
  ]

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Super Admin Dashboard</h1>
        <p className="text-gray-600 mt-2">Manage all church organizations and platform settings</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <div
            key={index}
            className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`w-12 h-12 bg-${stat.color}-100 rounded-xl flex items-center justify-center text-2xl`}>
                {stat.icon}
              </div>
              <span className={`text-sm font-semibold px-2.5 py-1 bg-${stat.color}-50 text-${stat.color}-700 rounded-full`}>
                {stat.change}
              </span>
            </div>
            <p className="text-sm font-medium text-gray-600 mb-1">{stat.label}</p>
            <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Recent Churches */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">Recent Churches</h2>
            <Link
              href="/superadmin/churches"
              className="text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              View all →
            </Link>
          </div>
        </div>
        <div className="divide-y divide-gray-200">
          {recentChurches.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              No churches registered yet
            </div>
          ) : (
            recentChurches.map((church) => (
              <Link
                key={church.id}
                href={`/superadmin/churches/${church.id}`}
                className="block p-6 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{church.name}</h3>
                    <div className="flex items-center space-x-4 mt-1 text-sm text-gray-600">
                      {church.city && <span>📍 {church.city}</span>}
                      {church.country && <span>🌍 {church.country}</span>}
                      {church.slug && <span>🔗 {church.slug}</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">
                      Created {new Date(church.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid md:grid-cols-3 gap-6">
        <Link
          href="/superadmin/churches"
          className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-all hover:-translate-y-1"
        >
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-2xl mb-4">
            🏛️
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Manage Churches</h3>
          <p className="text-gray-600 text-sm">View and manage all church organizations</p>
        </Link>

        <Link
          href="/superadmin/subscriptions"
          className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-all hover:-translate-y-1"
        >
          <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center text-2xl mb-4">
            💳
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Subscriptions</h3>
          <p className="text-gray-600 text-sm">Manage subscription plans and billing</p>
        </Link>

        <Link
          href="/superadmin/analytics"
          className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-all hover:-translate-y-1"
        >
          <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center text-2xl mb-4">
            📊
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Analytics</h3>
          <p className="text-gray-600 text-sm">View platform-wide analytics and insights</p>
        </Link>
      </div>
    </div>
  )
}

