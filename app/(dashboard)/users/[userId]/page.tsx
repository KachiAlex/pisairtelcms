import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth-options'
import UserProfile from '@/components/UserProfile'
import UserAccessPanel from '@/components/UserAccessPanel'

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>
}) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/auth/login')
  }

  const { userId } = await params
  return (
    <div className="space-y-6">
      <UserProfile userId={userId} />
      <UserAccessPanel userId={userId} />
    </div>
  )
}

