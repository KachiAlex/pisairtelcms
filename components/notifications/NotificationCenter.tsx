'use client'

import React, { useState } from 'react'
import { useNotifications } from '@/hooks/useNotifications'
import { formatDistanceToNow } from 'date-fns'

export interface NotificationCenterProps {
  userId: string
  maxDisplay?: number
}

/**
 * NotificationCenter Component
 * Display and manage user notifications
 */
export default function NotificationCenter({
  userId,
  maxDisplay = 10,
}: NotificationCenterProps) {
  const { notifications, unreadCount, isLoading, markAsRead, markAllAsRead, dismiss } =
    useNotifications(userId)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const displayNotifications = notifications.slice(0, maxDisplay)

  const getIcon = (type: string) => {
    switch ((type || '').toLowerCase()) {
      case 'success':
        return '✅'
      case 'error':
        return '❌'
      case 'warning':
        return '⚠️'
      case 'birthday':
        return '🎂'
      case 'info':
      default:
        return 'ℹ️'
    }
  }

  const getTypeColor = (type: string) => {
    switch ((type || '').toLowerCase()) {
      case 'success':
        return 'bg-green-50 border-green-200'
      case 'error':
        return 'bg-red-50 border-red-200'
      case 'warning':
        return 'bg-yellow-50 border-yellow-200'
      case 'birthday':
        return 'bg-pink-50 border-pink-200'
      case 'info':
      default:
        return 'bg-blue-50 border-blue-200'
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-gray-900">Notifications</h2>
          {unreadCount > 0 && (
            <span className="px-2.5 py-0.5 rounded-full bg-red-100 text-red-800 text-xs font-semibold">
              {unreadCount} new
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={() => markAllAsRead()}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
          >
            Mark all read
          </button>
        )}
      </div>

      {/* Notification List */}
      <div className="space-y-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin text-2xl">⟳</div>
          </div>
        ) : displayNotifications.length === 0 ? (
          <div className="p-6 text-center rounded-lg bg-gray-50 border border-gray-200">
            <p className="text-gray-600">No notifications yet</p>
            <p className="text-sm text-gray-500 mt-1">You're all caught up!</p>
          </div>
        ) : (
          displayNotifications.map((notif: any) => (
            <div
              key={notif.id}
              className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${
                notif.read
                  ? 'bg-white border-gray-200'
                  : `${getTypeColor(notif.type)} border-opacity-100`
              }`}
              onClick={() => {
                if (!notif.read) markAsRead(notif.id)
                setExpandedId(expandedId === notif.id ? null : notif.id)
              }}
            >
              <div className="flex items-start gap-3">
                <div className="text-2xl mt-1">{notif.icon || getIcon(notif.type)}</div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-gray-900 truncate">{notif.title}</h3>
                      <p className="text-sm text-gray-600 mt-0.5 line-clamp-2">
                        {notif.message}
                      </p>
                    </div>
                    {!notif.read && (
                      <div className="flex-shrink-0 w-2 h-2 rounded-full bg-blue-600 mt-2" />
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2 mt-3">
                    <span className="text-xs text-gray-500">
                      {formatDistanceToNow(new Date(notif.createdAt || notif.timestamp), {
                        addSuffix: true,
                      })}
                    </span>

                    <div className="flex gap-1">
                      {notif.actionUrl && (
                        <a
                          href={notif.actionUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {notif.actionLabel || 'View'}
                        </a>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          dismiss(notif.id)
                        }}
                        className="text-xs text-gray-500 hover:text-gray-700 font-medium"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Expanded Details */}
              {expandedId === notif.id && notif.metadata && (
                <div className="mt-4 p-3 bg-white bg-opacity-50 rounded border border-gray-200 text-xs text-gray-600">
                  <pre className="font-mono whitespace-pre-wrap break-words">
                    {JSON.stringify(notif.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* View All Link */}
      {notifications.length > maxDisplay && (
        <div className="text-center pt-2">
          <a
            href={`/notifications`}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
          >
            View all {notifications.length} notifications
          </a>
        </div>
      )}
    </div>
  )
}
