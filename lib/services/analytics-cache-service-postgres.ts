/**
 * Analytics Cache Service (PostgreSQL)
 * Stores and manages cached analytics computations for performance.
 * Backed by the AnalyticsCache model (one row per church).
 */

import { prisma } from '@/lib/prisma'
import { DataAggregationService, AnalyticsSnapshot } from './data-aggregation-service-postgres'

export interface CachedAnalytics {
  churchId: string
  id: string
  snapshot: AnalyticsSnapshot
  recommendations: {
    attendance: unknown
    schedules: unknown
    engagement: unknown
    content: unknown
  }
  lastUpdated: Date
  nextRefresh: Date
  quality: {
    dataCompleteness: number
    eventsCount: number
    membersCount: number
  }
}

export class AnalyticsCacheService {
  private static readonly CACHE_DURATION_MS = 1 * 60 * 60 * 1000 // 1 hour

  /**
   * Get or compute analytics cache
   * `key` is accepted for backward compatibility but unused — the cache is one row per church.
   */
  static async getCachedAnalytics(churchId: string, _key?: string): Promise<CachedAnalytics | null> {
    try {
      const record = await prisma.analyticsCache.findUnique({ where: { churchId } })
      if (!record) return null

      const snapshot = (record.snapshotData as any) || {}
      return {
        churchId: record.churchId,
        id: record.id,
        snapshot: {
          ...snapshot,
          timestamp: snapshot.timestamp ? new Date(snapshot.timestamp) : record.lastUpdated,
        },
        recommendations: (record.recommendationsData as any) || {},
        lastUpdated: record.lastUpdated,
        nextRefresh: record.nextRefresh,
        quality: (record.qualityData as any) || {},
      }
    } catch (error) {
      console.error('Error getting cached analytics:', error)
      return null
    }
  }

  /**
   * Store arbitrary analytics data under a key (kept for API compatibility).
   * Stored inside snapshotData under `custom.<key>` to avoid schema changes.
   */
  static async setCachedAnalytics(
    churchId: string,
    key: string,
    data: any,
    ttlSeconds?: number
  ): Promise<void> {
    const existing = await prisma.analyticsCache.findUnique({ where: { churchId } })
    const snapshotData = ((existing?.snapshotData as any) || {}) as Record<string, unknown>
    const custom = { ...((snapshotData.custom as object) || {}), [key]: data }

    const nextRefresh = ttlSeconds
      ? new Date(Date.now() + ttlSeconds * 1000)
      : new Date(Date.now() + this.CACHE_DURATION_MS)

    await prisma.analyticsCache.upsert({
      where: { churchId },
      update: { snapshotData: { ...snapshotData, custom } as any, lastUpdated: new Date(), nextRefresh },
      create: {
        churchId,
        snapshotData: { custom } as any,
        lastUpdated: new Date(),
        nextRefresh,
      },
    })
  }

  /**
   * Check if cache is valid (not expired)
   */
  static async isCacheValid(churchId: string): Promise<boolean> {
    try {
      const cache = await this.getCachedAnalytics(churchId)
      if (!cache) return false
      return cache.nextRefresh > new Date()
    } catch (error) {
      console.error('Error checking cache validity:', error)
      return false
    }
  }

  /**
   * Refresh analytics cache by computing fresh data
   */
  static async refreshAnalyticsCache(churchId: string): Promise<CachedAnalytics> {
    try {
      const snapshot = await DataAggregationService.generateAnalyticsSnapshot(churchId)
      const quality = await DataAggregationService.assessDataQuality(churchId)

      const now = new Date()
      const nextRefresh = new Date(now.getTime() + this.CACHE_DURATION_MS)

      const cacheEntry: CachedAnalytics = {
        churchId,
        id: churchId,
        snapshot,
        recommendations: {
          attendance: snapshot,
          schedules: snapshot.optimalEventDays,
          engagement: {
            riskMembers: snapshot.riskMembers,
            leaders: snapshot.leadershipCandidates,
          },
          content: snapshot.topTopics,
        },
        lastUpdated: now,
        nextRefresh,
        quality: {
          dataCompleteness: quality.dataCompleteness,
          eventsCount: quality.eventsCount,
          membersCount: quality.membersCount,
        },
      }

      const record = await prisma.analyticsCache.upsert({
        where: { churchId },
        update: {
          snapshotData: snapshot as any,
          recommendationsData: cacheEntry.recommendations as any,
          qualityData: cacheEntry.quality as any,
          lastUpdated: now,
          nextRefresh,
        },
        create: {
          churchId,
          snapshotData: snapshot as any,
          recommendationsData: cacheEntry.recommendations as any,
          qualityData: cacheEntry.quality as any,
          lastUpdated: now,
          nextRefresh,
        },
      })

      return { ...cacheEntry, id: record.id }
    } catch (error) {
      console.error('Error refreshing analytics cache:', error)
      throw error
    }
  }

  /**
   * Get cached or fresh analytics
   * Returns cached if valid, otherwise computes fresh
   */
  static async getAnalytics(churchId: string, forceRefresh: boolean = false): Promise<CachedAnalytics> {
    try {
      // Check cache if not forcing refresh
      if (!forceRefresh) {
        const cached = await this.getCachedAnalytics(churchId)
        if (cached && cached.nextRefresh > new Date()) {
          return cached
        }
      }

      // Refresh cache
      return await this.refreshAnalyticsCache(churchId)
    } catch (error) {
      console.error('Error getting analytics:', error)

      // Fallback to expired cache if refresh fails
      const cached = await this.getCachedAnalytics(churchId)
      if (cached) {
        return cached
      }

      throw error
    }
  }

  /**
   * Cache multiple churches' analytics in batch
   */
  static async refreshMultipleAnalytics(churchIds: string[]): Promise<Map<string, CachedAnalytics>> {
    const results = new Map<string, CachedAnalytics>()
    const errors = new Map<string, Error>()

    for (const churchId of churchIds) {
      try {
        const cache = await this.refreshAnalyticsCache(churchId)
        results.set(churchId, cache)
      } catch (error) {
        console.error(`Error refreshing analytics for church ${churchId}:`, error)
        errors.set(churchId, error instanceof Error ? error : new Error(String(error)))
      }
    }

    if (errors.size > 0) {
      console.warn(`${errors.size} churches failed to refresh analytics`)
    }

    return results
  }

  /**
   * Get cache statistics across all churches
   */
  static async getCacheStatistics(): Promise<{
    totalCached: number
    validCaches: number
    invalidCaches: number
    avgDataCompleteness: number
    totalMembers: number
    totalEvents: number
  }> {
    try {
      const caches = await prisma.analyticsCache.findMany()
      const now = new Date()
      const valid = caches.filter((c) => c.nextRefresh > now)

      const totalMembers = caches.reduce(
        (sum, c) => sum + (((c.qualityData as any)?.membersCount as number) || 0),
        0
      )
      const totalEvents = caches.reduce(
        (sum, c) => sum + (((c.qualityData as any)?.eventsCount as number) || 0),
        0
      )
      const avgCompleteness =
        caches.length > 0
          ? Math.round(
              caches.reduce(
                (sum, c) => sum + (((c.qualityData as any)?.dataCompleteness as number) || 0),
                0
              ) / caches.length
            )
          : 0

      return {
        totalCached: caches.length,
        validCaches: valid.length,
        invalidCaches: caches.length - valid.length,
        avgDataCompleteness: avgCompleteness,
        totalMembers,
        totalEvents,
      }
    } catch (error) {
      console.error('Error getting cache statistics:', error)
      throw error
    }
  }

  /**
   * Clear specific cache or all caches
   */
  static async clearCache(churchId?: string): Promise<void> {
    try {
      if (churchId) {
        await prisma.analyticsCache.delete({ where: { churchId } }).catch(() => {})
      } else {
        await prisma.analyticsCache.deleteMany({})
      }
    } catch (error) {
      console.error('Error clearing cache:', error)
      throw error
    }
  }
}
