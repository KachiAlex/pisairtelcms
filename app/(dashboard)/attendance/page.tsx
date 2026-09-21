import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import AttendanceHub from '@/components/AttendanceHub'
import { PermissionGrantService } from '@/lib/services/permission-grant-service'
import { getCurrentChurchId } from '@/lib/church-context'

export default async function AttendancePage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/auth/login')

  const role = (session.user as any)?.role as string | undefined
  const userId = (session.user as any)?.id as string | undefined
  let isManager =
    role === 'ADMIN' ||
    role === 'SUPER_ADMIN' ||
    role === 'BRANCH_ADMIN' ||
    role === 'PASTOR' ||
    role === 'LEADER'

  // Delegated access: members with a manage_attendance grant can manage sessions
  if (!isManager && userId) {
    const churchId = await getCurrentChurchId(userId)
    if (churchId) {
      isManager = await PermissionGrantService.hasAnyGrant(userId, churchId, ['manage_attendance'])
    }
  }

  return <AttendanceHub isManager={isManager} />
}
