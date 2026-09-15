'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { Recommendation, AttendancePrediction, OptimalSchedule, EngagementRecommendation } from '@/lib/services/recommendation-service'
import { useSession } from 'next-auth/react'

export interface UseRecommendationsReturn {
  recommendations: Recommendation[]
  isLoading: boolean
  error: Error | null
  updateStatus: (id: string, status: 'pending' | 'accepted' | 'rejected' | 'implemented', notes?: string) => Promise<void>
  isUpdating: boolean
}

export interface UsePredictionsReturn {
  predictions: AttendancePrediction[]
  isLoading: boolean
  error: Error | null
  predictEvent: (eventData: any) => Promise<AttendancePrediction>
  isPredicting: boolean
}

export interface UseOptimalScheduleReturn {
  schedules: OptimalSchedule[]
  isLoading: boolean
  error: Error | null
  findSchedule: (historicalData: any) => Promise<OptimalSchedule[]>
  isFinding: boolean
}

export interface UseEngagementRecommendationsReturn {
  recommendations: Map<string, EngagementRecommendation>
  isLoading: boolean
  error: Error | null
  generate: (memberData: any) => Promise<Map<string, EngagementRecommendation>>
  isGenerating: boolean
}

/**
 * Hook for fetching and managing user recommendations
 */
export function useRecommendations(): UseRecommendationsReturn {
  const { data: session } = useSession()
  const queryClient = useQueryClient()

  const { data = [], isLoading, error } = useQuery({
    queryKey: ['recommendations', session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return []
      
      const response = await fetch(`/api/recommendations?status=pending`)
      if (!response.ok) throw new Error('Failed to fetch recommendations')
      const data = await response.json()
      return data.recommendations || []
    },
    enabled: !!session?.user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 10 * 60 * 1000, // 10 minutes
  })

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      status,
      notes,
    }: {
      id: string
      status: 'pending' | 'accepted' | 'rejected' | 'implemented'
      notes?: string
    }) => {
      const response = await fetch(`/api/recommendations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, actionNotes: notes }),
      })

      if (!response.ok) throw new Error('Failed to update recommendation')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recommendations'] })
    },
  })

  return {
    recommendations: data,
    isLoading,
    error: error as Error | null,
    updateStatus: (id, status, notes) => updateMutation.mutateAsync({ id, status, notes }),
    isUpdating: updateMutation.isPending,
  }
}

/**
 * Hook for attendance predictions
 */
export function usePredictAttendance(): UsePredictionsReturn {
  const { data: session } = useSession()

  const { data = [], isLoading, error } = useQuery({
    queryKey: ['attendance-predictions', session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return []
      
      const response = await fetch('/api/recommendations/predictions')
      if (!response.ok) throw new Error('Failed to fetch predictions')
      const data = await response.json()
      return data.predictions || []
    },
    enabled: !!session?.user?.id,
    staleTime: 30 * 60 * 1000, // 30 minutes
  })

  const predictMutation = useMutation({
    mutationFn: async (eventData: any) => {
      const response = await fetch('/api/recommendations/predict-attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventData),
      })

      if (!response.ok) throw new Error('Failed to predict attendance')
      return response.json()
    },
  })

  return {
    predictions: data,
    isLoading,
    error: error as Error | null,
    predictEvent: async (eventData) => {
      const result = await predictMutation.mutateAsync(eventData)
      return result.prediction
    },
    isPredicting: predictMutation.isPending,
  }
}

/**
 * Hook for finding optimal schedule
 */
export function useOptimalSchedule(): UseOptimalScheduleReturn {
  const { data: session } = useSession()

  const { data = [], isLoading, error } = useQuery({
    queryKey: ['optimal-schedules', session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return []
      
      const response = await fetch('/api/recommendations/optimal-schedule')
      if (!response.ok) throw new Error('Failed to fetch schedules')
      const data = await response.json()
      return data.schedules || []
    },
    enabled: !!session?.user?.id,
    staleTime: 60 * 60 * 1000, // 1 hour
  })

  const findMutation = useMutation({
    mutationFn: async (historicalData: any) => {
      const response = await fetch('/api/recommendations/optimal-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(historicalData),
      })

      if (!response.ok) throw new Error('Failed to find optimal schedule')
      return response.json()
    },
  })

  return {
    schedules: data,
    isLoading,
    error: error as Error | null,
    findSchedule: async (historicalData) => {
      const result = await findMutation.mutateAsync(historicalData)
      return result.schedules
    },
    isFinding: findMutation.isPending,
  }
}

/**
 * Hook for member engagement recommendations
 */
export function useMemberEngagementRecommendations(): UseEngagementRecommendationsReturn {
  const { data: session } = useSession()

  const { data = new Map(), isLoading, error } = useQuery({
    queryKey: ['engagement-recommendations', session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return new Map()
      
      const response = await fetch('/api/recommendations/engagement')
      if (!response.ok) throw new Error('Failed to fetch engagement recommendations')
      const result = await response.json()
      
      // Convert array back to Map
      const recommendations = new Map<string, EngagementRecommendation>(
        Object.entries(result.recommendations || {}).map(([key, value]) => [key, value as EngagementRecommendation])
      )
      return recommendations
    },
    enabled: !!session?.user?.id,
    staleTime: 60 * 60 * 1000, // 1 hour
  })

  const generateMutation = useMutation({
    mutationFn: async (memberData: any) => {
      const response = await fetch('/api/recommendations/engagement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(memberData),
      })

      if (!response.ok) throw new Error('Failed to generate recommendations')
      const result = await response.json()
      
      // Convert array back to Map
      return new Map<string, EngagementRecommendation>(
        Object.entries(result.recommendations || {}).map(([key, value]) => [key, value as EngagementRecommendation])
      )
    },
  })

  return {
    recommendations: data,
    isLoading,
    error: error as Error | null,
    generate: async (memberData) => {
      return generateMutation.mutateAsync(memberData)
    },
    isGenerating: generateMutation.isPending,
  }
}

/**
 * Hook for content recommendations
 */
export interface ContentRecommendation {
  topic: string
  reason: string
  priority: number
  [key: string]: any
}

export function useContentRecommendations() {
  const { data: session } = useSession()

  const { data = [], isLoading, error, refetch } = useQuery<ContentRecommendation[]>({
    queryKey: ['content-recommendations', session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return []

      const response = await fetch('/api/recommendations/content')
      if (!response.ok) throw new Error('Failed to fetch content recommendations')
      const data = await response.json()
      return data.recommendations || []
    },
    enabled: !!session?.user?.id,
    staleTime: 24 * 60 * 60 * 1000, // 24 hours (content changes less frequently)
  })

  const generateMutation = useMutation({
    mutationFn: async (churchData: any) => {
      const response = await fetch('/api/recommendations/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(churchData),
      })

      if (!response.ok) throw new Error('Failed to generate content recommendations')
      return response.json()
    },
    onSuccess: () => {
      refetch()
    },
  })

  return {
    contentRecommendations: data,
    isLoading,
    error: error as Error | null,
    generateRecommendations: (churchData: any) => generateMutation.mutateAsync(churchData),
    isGenerating: generateMutation.isPending,
  }
}
