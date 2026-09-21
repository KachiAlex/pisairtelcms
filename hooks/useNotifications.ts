import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useCallback, useEffect } from 'react'

export interface Notification {
  id: string
  title: string
  message: string
  type: string // uppercase enum values from the API (SUCCESS, BIRTHDAY, …)
  createdAt: string | Date
  timestamp?: Date
  icon?: string | null
  read: boolean
  actionUrl?: string
  actionLabel?: string
}

/**
 * useNotifications Hook
 * Manages notification state and operations
 */
export function useNotifications(userId?: string) {
  const queryClient = useQueryClient()
  const [unreadCount, setUnreadCount] = useState(0)

  // Fetch notifications
  const {
    data: notifications = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['notifications', userId],
    queryFn: async () => {
      if (!userId) return []

      const response = await fetch(`/api/notifications?userId=${userId}&limit=50`)
      if (!response.ok) throw new Error('Failed to fetch notifications')
      const data = await response.json()
      return data.notifications || []
    },
    enabled: !!userId,
    refetchInterval: 30000, // Refetch every 30 seconds
  })

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: 'POST',
      })
      if (!response.ok) throw new Error('Failed to mark as read')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', userId] })
    },
  })

  // Mark all as read mutation
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/notifications/mark-all-read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      if (!response.ok) throw new Error('Failed to mark all as read')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', userId] })
    },
  })

  // Dismiss notification mutation
  const dismissMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: 'DELETE',
      })
      if (!response.ok) throw new Error('Failed to dismiss notification')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications', userId] })
    },
  })

  // Update unread count
  useEffect(() => {
    const count = notifications.filter((n: Notification) => !n.read).length
    setUnreadCount(count)
  }, [notifications])

  const markAsRead = useCallback((id: string) => {
    return markAsReadMutation.mutate(id)
  }, [markAsReadMutation])

  const markAllAsRead = useCallback(() => {
    return markAllAsReadMutation.mutate()
  }, [markAllAsReadMutation])

  const dismiss = useCallback((id: string) => {
    return dismissMutation.mutate(id)
  }, [dismissMutation])

  return {
    notifications,
    unreadCount,
    isLoading,
    error,
    markAsRead,
    markAllAsRead,
    dismiss,
    isMarkingAsRead: markAsReadMutation.isPending,
    isDismissing: dismissMutation.isPending,
  }
}

/**
 * useAlertRules Hook
 * Manages alert rule subscription
 */
export function useAlertRules(userId?: string, churchId?: string) {
  const queryClient = useQueryClient()

  // Fetch alert rules
  const {
    data: rules = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['alertRules', userId, churchId],
    queryFn: async () => {
      if (!userId || !churchId) return []

      const response = await fetch(`/api/alerts/rules?userId=${userId}&churchId=${churchId}`)
      if (!response.ok) throw new Error('Failed to fetch alert rules')
      const data = await response.json()
      return data.rules || []
    },
    enabled: !!userId && !!churchId,
  })

  // Create rule mutation
  const createMutation = useMutation({
    mutationFn: async (rule: any) => {
      const response = await fetch('/api/alerts/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rule),
      })
      if (!response.ok) throw new Error('Failed to create alert rule')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alertRules', userId, churchId] })
    },
  })

  // Update rule mutation
  const updateMutation = useMutation({
    mutationFn: async ({ ruleId, updates }: { ruleId: string; updates: any }) => {
      const response = await fetch(`/api/alerts/rules/${ruleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (!response.ok) throw new Error('Failed to update alert rule')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alertRules', userId, churchId] })
    },
  })

  // Delete rule mutation
  const deleteMutation = useMutation({
    mutationFn: async (ruleId: string) => {
      const response = await fetch(`/api/alerts/rules/${ruleId}`, {
        method: 'DELETE',
      })
      if (!response.ok) throw new Error('Failed to delete alert rule')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alertRules', userId, churchId] })
    },
  })

  // Toggle rule mutation
  const toggleMutation = useMutation({
    mutationFn: async ({ ruleId, enabled }: { ruleId: string; enabled: boolean }) => {
      const response = await fetch(`/api/alerts/rules/${ruleId}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      })
      if (!response.ok) throw new Error('Failed to toggle alert rule')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alertRules', userId, churchId] })
    },
  })

  const createRule = useCallback((rule: any) => {
    return createMutation.mutate({ ...rule, userId, churchId })
  }, [createMutation, userId, churchId])

  const updateRule = useCallback((ruleId: string, updates: any) => {
    return updateMutation.mutate({ ruleId, updates })
  }, [updateMutation])

  const deleteRule = useCallback((ruleId: string) => {
    return deleteMutation.mutate(ruleId)
  }, [deleteMutation])

  const toggleRule = useCallback((ruleId: string, enabled: boolean) => {
    return toggleMutation.mutate({ ruleId, enabled })
  }, [toggleMutation])

  return {
    rules,
    isLoading,
    error,
    createRule,
    updateRule,
    deleteRule,
    toggleRule,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isToggling: toggleMutation.isPending,
  }
}

/**
 * useNotificationPreferences Hook
 * Manages notification preferences
 */
export function useNotificationPreferences(userId?: string) {
  const queryClient = useQueryClient()

  // Fetch preferences
  const {
    data: preferences,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['notificationPreferences', userId],
    queryFn: async () => {
      if (!userId) return null

      const response = await fetch(`/api/notifications/preferences?userId=${userId}`)
      if (!response.ok) throw new Error('Failed to fetch preferences')
      const data = await response.json()
      return data.preferences
    },
    enabled: !!userId,
  })

  // Update preferences mutation
  const updateMutation = useMutation({
    mutationFn: async (updates: any) => {
      const response = await fetch('/api/notifications/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (!response.ok) throw new Error('Failed to update preferences')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificationPreferences', userId] })
    },
  })

  const updatePreferences = useCallback((updates: any) => {
    return updateMutation.mutate(updates)
  }, [updateMutation])

  return {
    preferences,
    isLoading,
    error,
    updatePreferences,
    isUpdating: updateMutation.isPending,
  }
}
