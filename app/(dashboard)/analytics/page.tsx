import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { getCurrentChurch } from '@/lib/church-context'
import AnalyticsDashboard from '@/components/AnalyticsDashboard'

const MANAGER_ROLES = ['ADMIN', 'SUPER_ADMIN', 'PASTOR']

export const metadata = {
  title: 'Performance Analytics',
  description: 'Real-time metrics and insights for your church',
}

export default async function AnalyticsPage() {
  const session = await getServerSession(authOptions)
  if (!session) {
    redirect('/auth/login')
  }

  const role = (session.user as any)?.role as string | undefined
  if (!role || !MANAGER_ROLES.includes(role)) {
    redirect('/')
  }

  const church = await getCurrentChurch((session.user as any)?.id)
  if (!church) {
    redirect('/register-church')
  }

  return (
    <div className="container mx-auto py-8">
      <AnalyticsDashboard churchId={church.id} />
    </div>
  )
}
