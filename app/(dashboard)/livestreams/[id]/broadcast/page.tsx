import { redirect, notFound } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'
import BroadcastStudio from '@/components/BroadcastStudio'

export default async function BroadcastPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/auth/login')

  const user = session.user as any
  const livestream = await prisma.livestream.findFirst({
    where: { id: params.id, churchId: user.churchId },
    select: { id: true, title: true, status: true },
  })
  if (!livestream) notFound()

  if (!['ADMIN', 'SUPER_ADMIN', 'PASTOR', 'BRANCH_ADMIN', 'LEADER'].includes(user.role)) {
    redirect('/livestreams')
  }

  return <BroadcastStudio livestreamId={livestream.id} title={livestream.title} />
}
