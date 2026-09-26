import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { requirePermissionMiddleware } from '@/lib/middleware/rbac'
import PayrollDashboard from '@/components/PayrollDashboard'
import UpgradeGate from '@/components/UpgradeGate'
import { UserService } from '@/lib/services/user-service'
import { churchHasPlanFeature } from '@/lib/subscription'

export default async function PayrollPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/auth/login')
  }

  const userId = (session.user as any)?.id
  const role = (session.user as any)?.role

  // Check if user is staff member
  const user = await UserService.findById(userId)
  const isStaff = user?.isStaff || false

  if (user?.churchId && !(await churchHasPlanFeature(user.churchId, 'payroll'))) {
    return <UpgradeGate feature="payroll" />
  }

  // Only allow admins or staff members
  if (role === 'MEMBER' && !isStaff) {
    redirect('/dashboard')
  }

  // For staff members (non-admin), show limited view
  if (role === 'MEMBER' && isStaff) {
    return <PayrollDashboard isStaffView={true} userId={userId} />
  }

  // For admins, check full permissions
  const { error } = await requirePermissionMiddleware('view_payroll')
  if (error) {
    redirect('/dashboard')
  }

  return <PayrollDashboard />
}

