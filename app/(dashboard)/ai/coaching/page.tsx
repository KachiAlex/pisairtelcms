import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import AICoachingChat from '@/components/AICoachingChat'
import UpgradeGate from '@/components/UpgradeGate'
import { getCurrentChurchId } from '@/lib/church-context'
import { churchHasPlanFeature } from '@/lib/subscription'

export default async function AICoachingPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/auth/login')
  }

  const churchId = await getCurrentChurchId((session.user as any)?.id)
  if (churchId && !(await churchHasPlanFeature(churchId, 'ai'))) {
    return <UpgradeGate feature="ai" />
  }

  return <AICoachingChat />
}

