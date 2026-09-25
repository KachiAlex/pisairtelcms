import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { AttendanceService } from '@/lib/services/attendance-service'
import CheckInClient from '@/components/CheckInClient'

export const metadata = {
  title: 'Check in',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

function InvalidCard({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-600 via-purple-600 to-fuchsia-600 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 text-center">
        <h1 className="text-xl font-bold text-gray-900">Invalid check-in code</h1>
        <p className="mt-2 text-sm text-gray-500">{message}</p>
      </div>
    </div>
  )
}

export default async function CheckInPage({ params }: { params: { token: string } }) {
  const session = await AttendanceService.findSessionByQrToken(params.token)
  if (!session) {
    return <InvalidCard message="This QR code is not valid or has been replaced. Please scan the code displayed at the venue." />
  }

  const auth = await getServerSession(authOptions)
  const u = auth?.user as any
  const userName = u ? ([u.firstName, u.lastName].filter(Boolean).join(' ') || u.name || u.email || 'Member') : null
  const alreadyCheckedIn = u
    ? !!(await AttendanceService.findRecordBySessionAndUser(session.id, u.id))
    : false

  return (
    <CheckInClient
      session={{
        id: session.id,
        title: session.title,
        type: session.type,
        mode: session.mode,
        startAt: session.startAt.toISOString(),
        location: session.location,
        churchName: session.church?.name || null,
        meetingTitle: (session as any).meeting?.title || null,
        joinUrl:
          (session.mode === 'ONLINE' || session.mode === 'HYBRID')
            ? ((session as any).meeting?.jitsi?.joinUrl || (session as any).meeting?.google?.meetUrl || null)
            : null,
      }}
      postUrl={`/api/checkin/${params.token}`}
      userName={userName}
      alreadyCheckedIn={alreadyCheckedIn}
    />
  )
}
