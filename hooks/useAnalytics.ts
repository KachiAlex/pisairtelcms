'use client'

/**
 * Analytics React Hooks for Dashboard Components
 */

import { useState, useEffect, useCallback } from 'react'
import {
  MeetingAnalytics,
  LivestreamAnalytics,
  AttendanceAnalytics,
  DashboardMetrics,
  EngagementAnalytics,
  RealTimeAnalytics,
} from '@/lib/types/analytics'

export function useAnalytics(churchId: string) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const recordMeeting = useCallback(
    async (data: Omit<MeetingAnalytics, 'meetingId'>) => {
      try {
        setLoading(true)
        const response = await fetch('/api/analytics/meetings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...data, churchId }),
        })

        if (!response.ok) throw new Error('Failed to record meeting')
        return await response.json()
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        setError(message)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [churchId]
  )

  const recordLivestream = useCallback(
    async (data: Omit<LivestreamAnalytics, 'livestreamId'>) => {
      try {
        setLoading(true)
        const response = await fetch('/api/analytics/livestream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...data, churchId }),
        })

        if (!response.ok) throw new Error('Failed to record livestream')
        return await response.json()
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        setError(message)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [churchId]
  )

  const recordAttendance = useCallback(
    async (data: Omit<AttendanceAnalytics, 'attendanceId'>) => {
      try {
        setLoading(true)
        const response = await fetch('/api/analytics/attendance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...data, churchId }),
        })

        if (!response.ok) throw new Error('Failed to record attendance')
        return await response.json()
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        setError(message)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [churchId]
  )

  return {
    loading,
    error,
    recordMeeting,
    recordLivestream,
    recordAttendance,
  }
}

export function useDashboardMetrics(churchId: string, period: 'week' | 'month' | 'year' = 'month') {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchMetrics = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch(`/api/analytics/metrics?churchId=${churchId}&period=${period}`)

      if (!response.ok) throw new Error('Failed to fetch metrics')
      const data = await response.json()
      setMetrics(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [churchId, period])

  useEffect(() => {
    fetchMetrics()
  }, [fetchMetrics])

  return { metrics, loading, error, refetch: fetchMetrics }
}

export function useMeetingAnalytics(churchId: string, startDate: Date, endDate: Date) {
  const [meetings, setMeetings] = useState<MeetingAnalytics[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchMeetings = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const params = new URLSearchParams({
        churchId,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      })
      const response = await fetch(`/api/analytics/meetings?${params}`)

      if (!response.ok) throw new Error('Failed to fetch meeting analytics')
      const data = await response.json()
      setMeetings(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [churchId, startDate, endDate])

  useEffect(() => {
    fetchMeetings()
  }, [fetchMeetings])

  return { meetings, loading, error, refetch: fetchMeetings }
}

export function useEngagementAnalytics(churchId: string, startDate: Date, endDate: Date) {
  const [topMembers, setTopMembers] = useState<Array<{ userId: string; points: number; name: string }>>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchEngagement = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const params = new URLSearchParams({
        churchId,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      })
      const response = await fetch(`/api/analytics/engagement?${params}`)

      if (!response.ok) throw new Error('Failed to fetch engagement analytics')
      const data = await response.json()
      setTopMembers(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [churchId, startDate, endDate])

  useEffect(() => {
    fetchEngagement()
  }, [fetchEngagement])

  return { topMembers, loading, error, refetch: fetchEngagement }
}

export function useAttendanceAnalytics(churchId: string, startDate: Date, endDate: Date) {
  const [attendance, setAttendance] = useState<AttendanceAnalytics[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchAttendance = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const params = new URLSearchParams({
        churchId,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      })
      const response = await fetch(`/api/analytics/attendance?${params}`)

      if (!response.ok) throw new Error('Failed to fetch attendance analytics')
      const data = await response.json()
      setAttendance(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [churchId, startDate, endDate])

  useEffect(() => {
    fetchAttendance()
  }, [fetchAttendance])

  return { attendance, loading, error, refetch: fetchAttendance }
}

export function useRealTimeAnalytics(churchId: string) {
  const [realtimeData, setRealtimeData] = useState<RealTimeAnalytics | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchRealtimeData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch(`/api/analytics/realtime?churchId=${churchId}`)

      if (!response.ok) throw new Error('Failed to fetch real-time analytics')
      const data = await response.json()
      setRealtimeData(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [churchId])

  useEffect(() => {
    // Initial fetch
    fetchRealtimeData()

    // Poll every 10 seconds for real-time updates
    const interval = setInterval(fetchRealtimeData, 10000)
    return () => clearInterval(interval)
  }, [fetchRealtimeData])

  return { realtimeData, loading, error, refetch: fetchRealtimeData }
}
