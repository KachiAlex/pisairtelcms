import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import GivingProjects from '@/components/GivingProjects'
import { PermissionGrantService } from '@/lib/services/permission-grant-service'
import { getCurrentChurchId } from '@/lib/church-context'

export default async function GivingPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/auth/login')
  }

  const userRole = (session.user as any).role
  const userId = (session.user as any).id
  let isAdmin = ['ADMIN', 'SUPER_ADMIN', 'PASTOR'].includes(userRole)

  // Delegated access: members with a manage_giving grant see the admin UI
  if (!isAdmin && userId) {
    const churchId = await getCurrentChurchId(userId)
    if (churchId) {
      isAdmin = await PermissionGrantService.hasAnyGrant(userId, churchId, ['manage_giving'])
    }
  }

  return (
    <Suspense fallback={<div className="container mx-auto px-4 py-8">Loading...</div>}>
      <GivingProjects isAdmin={isAdmin} />
    </Suspense>
  )
}

