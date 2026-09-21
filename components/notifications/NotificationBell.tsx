'use client'

import React, { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useNotifications } from '@/hooks/useNotifications'
import { formatDistanceToNow } from 'date-fns'

const TYPE_ICONS: Record<string, string> = {
  success: '✅',
  error: '❌',
  warning: '⚠️',
  birthday: '🎂',
  info: 'ℹ️',
}

function iconFor(n: any): string {
  if (n.icon) return n.icon
  return TYPE_ICONS[(n.type || '').toLowerCase()] || 'ℹ️'
}

function timeFor(n: any): string {
  const d = new Date(n.createdAt || n.timestamp)
  if (isNaN(d.getTime())) return ''
  return formatDistanceToNow(d, { addSuffix: true })
}

/**
 * NotificationBell — header bell with unread badge + dropdown.
 * Polls every 30s via useNotifications.
 */
export default function NotificationBell({ userId }: { userId?: string }) {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications(userId)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const recent = (notifications || []).slice(0, 10)

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
        aria-label="Notifications"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[90vw] rounded-xl border border-gray-200 bg-white shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-900">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllAsRead()}
                className="text-xs text-primary-600 hover:text-primary-700 font-medium"
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto divide-y divide-gray-50">
            {recent.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-500">
                You're all caught up
              </div>
            ) : (
              recent.map((n: any) => (
                <div
                  key={n.id}
                  className={`px-4 py-3 flex gap-3 ${!n.read ? 'bg-blue-50/40' : ''}`}
                  onClick={() => !n.read && markAsRead(n.id)}
                >
                  <span className="text-lg flex-shrink-0">{iconFor(n)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{n.title}</p>
                    <p className="text-xs text-gray-600 line-clamp-2">{n.message}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-gray-400">{timeFor(n)}</span>
                      {n.actionUrl && (
                        <Link
                          href={n.actionUrl}
                          className="text-[10px] text-primary-600 font-medium"
                          onClick={() => setOpen(false)}
                        >
                          {n.actionLabel || 'View'}
                        </Link>
                      )}
                    </div>
                  </div>
                  {!n.read && <span className="w-2 h-2 rounded-full bg-blue-600 mt-1.5 flex-shrink-0" />}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
