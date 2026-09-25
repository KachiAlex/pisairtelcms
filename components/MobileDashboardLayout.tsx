'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import SignOutButton from '@/components/SignOutButton'
import BranchSwitcher from '@/components/BranchSwitcher'
import ChurchSwitcher from '@/components/ChurchSwitcher'
import DashboardNav from '@/components/DashboardNav'
import NotificationBell from '@/components/notifications/NotificationBell'

interface MobileDashboardLayoutProps {
  children: React.ReactNode
  brandName: string
  brandTagline: string
  brandLogo: string
  brandInitial: string
  profileName: string
  profileEmail: string
  profileImage: string
  profileInitials: string
  userRole: string
  isStaff: boolean
  userId: string
  activeChurch: any
  user: any
}

export default function MobileDashboardLayout({
  children,
  brandName,
  brandTagline,
  brandLogo,
  brandInitial,
  profileName,
  profileEmail,
  profileImage,
  profileInitials,
  userRole,
  isStaff,
  userId,
  activeChurch,
  user
}: MobileDashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const pathname = usePathname()

  return (
    <div className="min-h-screen bg-gradient-to-br bg-[#faf9f5]">
      {/* Mobile Header */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-gray-200/50 shadow-sm">
        <div className="flex items-center justify-between px-4 py-3">
          {/* Menu Button */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="relative">
              <div className="w-8 h-8 bg-gradient-to-br from-primary-600 to-primary-700 rounded-lg flex items-center justify-center shadow-md">
                {activeChurch?.logo ? (
                  <img src={brandLogo} alt={`${brandName} logo`} className="w-6 h-6 object-contain" />
                ) : (
                  <span className="text-white text-sm font-semibold">{brandInitial}</span>
                )}
              </div>
            </div>
            <div className="hidden sm:block">
              <span className="text-lg font-bold bg-gradient-to-r from-primary-600 to-primary-700 bg-clip-text text-transparent">
                {brandName}
              </span>
            </div>
          </Link>

          {/* Right side: notifications + profile */}
          <div className="flex items-center gap-1">
            <NotificationBell userId={userId} />

            {/* Profile Button */}
            <div className="relative">
              <button
                onClick={() => setProfileMenuOpen(!profileMenuOpen)}
              className="flex items-center gap-2 p-1 rounded-lg hover:bg-gray-100 transition-colors"
            >
              {profileImage ? (
                <img
                  src={profileImage}
                  alt="Profile"
                  className="w-8 h-8 rounded-full object-cover ring-2 ring-primary-100"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-xs font-semibold text-primary-700">
                  {profileInitials}
                </div>
              )}
            </button>

            {/* Profile Dropdown */}
            {profileMenuOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-xl border border-gray-200 bg-white shadow-xl z-50">
                <div className="p-4">
                  <div className="space-y-1 mb-4">
                    <p className="text-sm font-semibold text-gray-900 truncate">{profileName}</p>
                    <p className="text-xs text-gray-500">Administrator</p>
                    <p className="text-xs text-gray-400 truncate">{profileEmail}</p>
                  </div>
                  <div className="space-y-2">
                    <Link
                      href={`/users/${userId}`}
                      className="block w-full text-center rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                      onClick={() => setProfileMenuOpen(false)}
                    >
                      View profile
                    </Link>
                    <Link
                      href={`/users/${userId}/edit`}
                      className="block w-full text-center rounded-lg bg-primary-600 px-3 py-2 text-xs font-semibold text-white hover:bg-primary-700"
                      onClick={() => setProfileMenuOpen(false)}
                    >
                      Edit profile
                    </Link>
                  </div>
                </div>
              </div>
            )}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          
          {/* Sidebar */}
          <div className="relative w-80 max-w-[85vw] bg-white/95 backdrop-blur-xl shadow-2xl flex flex-col">
            {/* Sidebar Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200/50">
              <Link href="/" className="flex items-center gap-3" onClick={() => setSidebarOpen(false)}>
                <div className="relative">
                  <div className="w-10 h-10 bg-gradient-to-br from-primary-600 to-primary-700 rounded-xl flex items-center justify-center shadow-lg">
                    {activeChurch?.logo ? (
                      <img src={brandLogo} alt={`${brandName} logo`} className="w-8 h-8 object-contain" />
                    ) : (
                      <span className="text-white text-lg font-semibold">{brandInitial}</span>
                    )}
                  </div>
                </div>
                <div>
                  <span className="text-lg font-bold bg-gradient-to-r from-primary-600 to-primary-700 bg-clip-text text-transparent">
                    {brandName}
                  </span>
                  <p className="text-xs text-gray-500 font-medium truncate">{brandTagline}</p>
                </div>
              </Link>
              
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Navigation */}
            <div className="flex-1 overflow-y-auto overscroll-none-y">
              <div onClick={() => setSidebarOpen(false)}>
                <DashboardNav userRole={userRole} isStaff={isStaff} />
              </div>
            </div>

            {/* Sidebar Footer */}
            <div className="border-t border-gray-200/50 p-4 bg-gradient-to-br from-gray-50/50 to-blue-50/30">
              {user?.role === 'SUPER_ADMIN' && !activeChurch ? (
                <div className="mb-4">
                  <ChurchSwitcher />
                </div>
              ) : (
                <div className="mb-4">
                  <BranchSwitcher />
                </div>
              )}

              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-2">
                  {user?.role !== 'MEMBER' && (
                    <Link
                      href="/subscription"
                      className="flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium text-gray-700 rounded-lg hover:bg-white hover:shadow-sm transition-all border border-gray-200/50"
                      onClick={() => setSidebarOpen(false)}
                    >
                      <span>💳</span>
                      <span>Plan</span>
                    </Link>
                  )}
                  <Link
                    href="/settings"
                    className="flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium text-gray-700 rounded-lg hover:bg-white hover:shadow-sm transition-all border border-gray-200/50"
                    onClick={() => setSidebarOpen(false)}
                  >
                    <span>⚙️</span>
                    <span>Settings</span>
                  </Link>
                </div>
                <SignOutButton />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content — bottom padding clears the fixed tab bar */}
      <main className="p-4 sm:p-6 pb-24">
        {children}
      </main>

      {/* Bottom Tab Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xl border-t border-gray-200/80 pb-safe">
        <div className="grid grid-cols-5">
          {[
            { href: '/', label: 'Home', icon: 'M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1h3a1 1 0 001-1V10' },
            { href: '/giving', label: 'Giving', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
            { href: '/attendance', label: 'Attendance', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
            { href: '/meetings', label: 'Meetings', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
          ].map((tab) => {
            const active = tab.href === '/' ? pathname === '/' : !!pathname?.startsWith(tab.href)
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex flex-col items-center justify-center py-2 gap-0.5 transition-colors ${
                  active ? 'text-primary-600' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={active ? 2.2 : 1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={tab.icon} />
                </svg>
                <span className={`text-[10px] ${active ? 'font-semibold' : 'font-medium'}`}>{tab.label}</span>
              </Link>
            )
          })}
          <button
            onClick={() => setSidebarOpen(true)}
            className={`flex flex-col items-center justify-center py-2 gap-0.5 transition-colors ${
              sidebarOpen ? 'text-primary-600' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <span className="text-[10px] font-medium">Menu</span>
          </button>
        </div>
      </nav>

      {/* Click outside to close profile menu */}
      {profileMenuOpen && (
        <div 
          className="fixed inset-0 z-40"
          onClick={() => setProfileMenuOpen(false)}
        />
      )}
    </div>
  )
}