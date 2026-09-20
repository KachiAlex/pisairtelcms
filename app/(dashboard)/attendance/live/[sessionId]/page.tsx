import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import LiveAttendanceDisplay from '@/components/LiveAttendanceDisplay'

export const metadata = {
  title: 'Live check-in display',
  robots: { index: false, follow: false },
}

export default async function LiveDisplayPage({ params }: { params: { sessionId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/auth/login')

  const role = (session.user as any)?.role
  if (!['ADMIN', 'SUPER_ADMIN', 'BRANCH_ADMIN', 'PASTOR'].includes(role)) {
    redirect('/attendance')
  }

  return <LiveAttendanceDisplay sessionId={params.sessionId} />
}
