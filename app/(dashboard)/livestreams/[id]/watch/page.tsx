import { redirect, notFound } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'
import LivestreamWatcher from '@/components/LivestreamWatcher'

export default async function WatchPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/auth/login')

  const user = session.user as any
  const livestream = await prisma.livestream.findFirst({
    where: { id: params.id, churchId: user.churchId },
    include: { platforms: true },
  })
  if (!livestream) notFound()

  const jitsi = livestream.platforms.find((p) => p.platform === 'JITSI')
  const streamPath = (jitsi?.settings as any)?.streamPath as string | undefined

  return (
    <LivestreamWatcher
      livestreamId={livestream.id}
      title={livestream.title}
      status={livestream.status}
      streamPath={streamPath ?? null}
      mediaBase={process.env.JITSI_PUBLIC_URL || 'https://meet.jit.si'}
    />
  )
}
