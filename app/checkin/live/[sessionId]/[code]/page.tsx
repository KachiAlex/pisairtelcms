import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { AttendanceService } from '@/lib/services/attendance-service'
import { verifyLiveCode } from '@/lib/attendance-qr'
import { prisma } from '@/lib/prisma'
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
        <h1 className="text-xl font-bold text-gray-900">Expired code</h1>
        <p className="mt-2 text-sm text-gray-500">{message}</p>
      </div>
    </div>
  )
}

export default async function LiveCheckInPage({
  params,
}: {
  params: { sessionId: string; code: string }
}) {
  const session = await prisma.attendanceSession.findUnique({
    where: { id: params.sessionId },
    include: {
      church: { select: { name: true } },
      meeting: { select: { id: true, title: true, jitsi: true, google: true } },
    },
  })
  if (!session?.qrToken || !verifyLiveCode(session.qrToken, params.code)) {
    return <InvalidCard message="This code has rotated — please scan the QR code currently shown on screen." />
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
      postUrl={`/api/checkin/live/${params.sessionId}/${params.code}`}
      userName={userName}
      alreadyCheckedIn={alreadyCheckedIn}
    />
  )
}
