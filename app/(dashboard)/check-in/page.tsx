import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'

// Legacy standalone check-in wrote to the disconnected CheckIn model.
// Real check-ins happen through attendance sessions — send users there.
export default async function CheckInPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/auth/login')
  }

  redirect('/attendance')
}
