import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { UserService } from '@/lib/services/user-service'
import { getCurrentChurch, getCurrentChurchId } from '@/lib/church-context'
import Link from 'next/link'
import SignOutButton from '@/components/SignOutButton'
import BranchSwitcher from '@/components/BranchSwitcher'
import ChurchSwitcher from '@/components/ChurchSwitcher'
import OnboardingBanner from '@/components/OnboardingBanner'
import DashboardNav from '@/components/DashboardNav'
import MobileDashboardLayout from '@/components/MobileDashboardLayout'
import NotificationBell from '@/components/notifications/NotificationBell'

export const dynamic = 'force-dynamic'

export const metadata = {
  robots: { index: false, follow: false },
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/auth/login')
  }

  // Check if user has a church
  const userId = (session.user as any).id
  const user = await UserService.findById(userId)

  // If SUPER_ADMIN, always redirect to superadmin portal
  if (user?.role === 'SUPER_ADMIN') {
    redirect('/superadmin')
  }

  // Suspended accounts lose access even with a valid JWT
  if (user?.isSuspended) {
    redirect('/auth/login')
  }

  // If user doesn't have a church and is not a superadmin, redirect to register
  if (!user?.churchId && user?.role !== 'SUPER_ADMIN') {
    console.log('Dashboard layout: No churchId and not superadmin, redirecting to register', { userId: user?.id, role: user?.role, churchId: user?.churchId })
    redirect('/auth/register')
  }

  // For SUPER_ADMIN, skip church verification
  let activeChurch: Awaited<ReturnType<typeof getCurrentChurch>> | null = null
  if (user?.role !== 'SUPER_ADMIN') {
    // Verify church exists
    const churchId = await getCurrentChurchId(userId)
    if (!churchId) {
      console.log('Dashboard layout: No church found, redirecting to register', { userId, role: user?.role })
      redirect('/auth/register')
    }
    activeChurch = await getCurrentChurch(userId)
  }

  console.log('Dashboard layout: Rendering dashboard', { userId, role: user?.role, churchId: user?.churchId })

  const brandName = activeChurch?.name ?? 'Pisairtel CMS'
  const brandTagline = activeChurch?.tagline ?? 'Modern Church Management & Discipleship Platform'
  const brandLogo = activeChurch?.logo ?? '/favicon.svg'
  const brandInitial = brandName?.[0]?.toUpperCase() ?? 'P'
  const profileName =
    [user?.firstName, user?.lastName].filter(Boolean).join(' ') || session.user?.name || 'Admin user'
  const profileEmail = session.user?.email || user?.email || ''
  const profileImage = (user as any)?.profileImage || (session.user as any)?.image || ''
  const profileInitials =
    profileName
      .split(' ')
      .map((part) => part.trim().charAt(0).toUpperCase())
      .join('')
      .slice(0, 2) || profileEmail.charAt(0).toUpperCase() || 'A'

  const layoutProps = {
    brandName,
    brandTagline,
    brandLogo,
    brandInitial,
    profileName,
    profileEmail,
    profileImage,
    profileInitials,
    userRole: (session.user as any).role,
    isStaff: user?.isStaff || false,
    userId,
    activeChurch,
    user
  }

  return (
    <>
      {/* Mobile Layout */}
      <div className="lg:hidden">
        <MobileDashboardLayout {...layoutProps}>
          <OnboardingBanner />
          {children}
        </MobileDashboardLayout>
      </div>

      {/* Desktop Layout */}
      <div className="hidden lg:block min-h-screen bg-gradient-to-br bg-[#faf9f5]">
        {/* Sidebar */}
        <div className="fixed inset-y-0 left-0 z-50 w-72 bg-white/80 backdrop-blur-xl border-r border-gray-200/50 flex flex-col shadow-xl">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 px-6 py-6 border-b border-gray-200/50">
            <div className="relative shrink-0">
              <div className="absolute inset-0 bg-gradient-to-br from-primary-600 to-primary-700 rounded-xl blur opacity-50"></div>
              <div className="relative w-12 h-12 bg-gradient-to-br from-primary-600 to-primary-700 rounded-xl flex items-center justify-center shadow-lg">
                {activeChurch?.logo ? (
                  <img src={brandLogo} alt={`${brandName} logo`} className="w-10 h-10 object-contain" />
                ) : (
                  <span className="text-white text-xl font-semibold">{brandInitial}</span>
                )}
              </div>
            </div>
            <div className="min-w-0">
              <span className="block text-xl font-bold bg-gradient-to-r from-primary-600 to-primary-700 bg-clip-text text-transparent truncate">
                {brandName}
              </span>
              <p className="text-xs text-gray-500 font-medium truncate">{brandTagline}</p>
            </div>
          </Link>

          {/* Navigation */}
          <div className="flex-1 overflow-y-auto">
            <DashboardNav userRole={(session.user as any).role} isStaff={user?.isStaff || false} />
          </div>

          {/* User Section */}
          <div className="border-t border-gray-200/50 p-4 bg-gradient-to-br from-gray-50/50 to-blue-50/30">
            {user?.role === 'SUPER_ADMIN' && !activeChurch ? (
              <ChurchSwitcher />
            ) : (
              <BranchSwitcher />
            )}

            <div className="space-y-3 w-full">
              <div className="grid grid-cols-2 gap-2 pt-2 px-2">
                {user?.role !== 'MEMBER' && (
                  <Link
                    href="/subscription"
                    className="flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-medium text-gray-700 rounded-lg hover:bg-white hover:shadow-sm transition-all border border-gray-200/50"
                  >
                    <span>💳</span>
                    <span>Plan</span>
                  </Link>
                )}
                <Link
                  href="/settings"
                  className={`flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-medium text-gray-700 rounded-lg hover:bg-white hover:shadow-sm transition-all border border-gray-200/50 ${user?.role === 'MEMBER' ? 'col-span-2' : ''}`}
                >
                  <span>⚙️</span>
                  <span>Settings</span>
                </Link>
              </div>
              <SignOutButton />
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="pl-72">
          {/* Onboarding Banner */}
          <OnboardingBanner />

          {/* Top Bar */}
          <header className="sticky top-0 z-40 bg-white/70 backdrop-blur-xl border-b border-gray-200/50 shadow-sm">
            <div className="px-8 py-4">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <h1 className="text-2xl lg:text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                    Welcome back!
                  </h1>
                  <p className="text-xs lg:text-sm text-gray-600 mt-1 font-medium">
                    {new Date().toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <NotificationBell />
                  <details className="relative [&_summary::-webkit-details-marker]:hidden">
                    <summary className="cursor-pointer list-none">
                      {profileImage ? (
                        <img
                          src={profileImage}
                          alt="Open profile menu"
                          className="h-12 w-12 rounded-full object-cover ring-2 ring-primary-100 transition hover:ring-primary-300"
                        />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-700 ring-2 ring-primary-50 transition hover:ring-primary-300">
                          {profileInitials}
                        </div>
                      )}
                    </summary>
                    <div className="absolute right-0 mt-3 w-64 rounded-2xl border border-gray-200 bg-white/95 p-4 shadow-xl">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-gray-900">{profileName}</p>
                        <p className="text-xs text-gray-500">Administrator</p>
                        <p className="text-xs text-gray-400">{profileEmail}</p>
                      </div>
                      <div className="mt-4 space-y-2">
                        <Link
                          href={`/users/${userId}`}
                          className="flex items-center justify-center rounded-xl border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                        >
                          View profile
                        </Link>
                        <Link
                          href={`/users/${userId}/edit`}
                          className="flex items-center justify-center rounded-xl bg-primary-600 px-3 py-2 text-xs font-semibold text-white hover:bg-primary-700"
                        >
                          Edit profile
                        </Link>
                      </div>
                    </div>
                  </details>
                </div>
              </div>
            </div>
          </header>

          {/* Page Content */}
          <main className="p-8">{children}</main>
        </div>
      </div>
    </>
  )
}
