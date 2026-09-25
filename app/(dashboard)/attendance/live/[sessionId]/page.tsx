import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import LiveAttendanceDisplay from '@/components/LiveAttendanceDisplay'
import { PermissionGrantService } from '@/lib/services/permission-grant-service'
import { getCurrentChurchId } from '@/lib/church-context'

export const metadata = {
  title: 'Live check-in display',
  robots: { index: false, follow: false },
}

export default async function LiveDisplayPage({ params }: { params: { sessionId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/auth/login')

  const user = session.user as any
  const role = user?.role
  if (!['ADMIN', 'SUPER_ADMIN', 'BRANCH_ADMIN', 'PASTOR'].includes(role)) {
    // Delegated attendance managers may also project the display
    const churchId = user?.id ? await getCurrentChurchId(user.id) : null
    const granted = churchId
      ? await PermissionGrantService.hasAnyGrant(user.id, churchId, ['manage_attendance'])
      : false
    if (!granted) redirect('/attendance')
  }

  return <LiveAttendanceDisplay sessionId={params.sessionId} />
}
