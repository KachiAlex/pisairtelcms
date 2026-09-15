import { prisma } from '@/lib/prisma'
import {
  StreamingPlatform,
  LivestreamStatus,
  LivestreamPlatformStatus,
  LivestreamData,
  PlatformConnectionStatus,
} from '@/lib/types/streaming'
import { PlatformConnectionService } from './platform-connection-service'
import { PlatformClientFactory } from '@/lib/clients/platform-client-factory'
import { JitsiService } from './jitsi-service'
import crypto from 'crypto'

export type ExternalLivestreamConfig = {
  id: string
  churchId: string
  enabled: boolean
  platform: StreamingPlatform
  url?: string
  title?: string
  description?: string
  scheduledAt?: Date
  createdAt: Date
  updatedAt: Date
}

export type UpsertExternalLivestreamConfigInput = {
  enabled: boolean
  platform: StreamingPlatform
  url?: string
  title?: string
  description?: string
  scheduledAt?: Date
}

/**
 * Livestream Service
 * Manages livestream creation, updates, and multi-platform broadcasting
 * Requirements: 1.1, 1.2, 1.3, 1.4, 6.1, 6.2
 */
export class LivestreamService {
  static async findByChurch(churchId: string): Promise<ExternalLivestreamConfig | null> {
    const config = await prisma.externalLivestreamConfig.findUnique({ where: { churchId } })
    if (!config) return null
    return {
      id: config.id,
      churchId: config.churchId,
      enabled: config.enabled,
      platform: config.platform,
      url: config.url || undefined,
      title: config.title || undefined,
      description: config.description || undefined,
      scheduledAt: config.scheduledAt || undefined,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    }
  }

  static async upsertByChurch(churchId: string, input: UpsertExternalLivestreamConfigInput): Promise<ExternalLivestreamConfig> {
    const updated = await prisma.externalLivestreamConfig.upsert({
      where: { churchId },
      create: {
        churchId,
        enabled: input.enabled,
        platform: input.platform,
        url: input.enabled ? input.url || null : null,
        title: input.title || null,
        description: input.description || null,
        scheduledAt: input.scheduledAt || null,
      },
      update: {
        enabled: input.enabled,
        platform: input.platform,
        url: input.enabled ? input.url || null : null,
        title: input.title || null,
        description: input.description || null,
        scheduledAt: input.scheduledAt || null,
      },
    })

    return {
      id: updated.id,
      churchId: updated.churchId,
      enabled: updated.enabled,
      platform: updated.platform,
      url: updated.url || undefined,
      title: updated.title || undefined,
      description: updated.description || undefined,
      scheduledAt: updated.scheduledAt || undefined,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    }
  }

  /**
   * Create a new livestream
   * Property 2: Livestream Multi-Platform Broadcasting - attempts to broadcast to all selected platforms
   */
  static async createLivestream(
    churchId: string,
    userId: string,
    data: {
      title: string
      description?: string
      thumbnail?: string
      startAt?: Date
      platforms: {
        platform: StreamingPlatform
        settings?: Record<string, any>
      }[]
    }
  ): Promise<LivestreamData> {
    try {
      if (!data.platforms || data.platforms.length === 0) {
        throw new Error('At least one platform must be selected')
      }

      const platformCreatePayload = await Promise.all(
        data.platforms.map(async (p) => {
          // Built-in Jitsi broadcast needs no external connection
          const connected = p.platform === StreamingPlatform.JITSI
            ? JitsiService.isConfigured()
            : (await PlatformConnectionService.getConnection(churchId, p.platform))?.status === PlatformConnectionStatus.CONNECTED

          return {
            platform: p.platform,
            status: LivestreamPlatformStatus.PENDING,
            settings: p.settings || {},
            error: connected ? null : `Platform ${p.platform} is not connected`,
          }
        })
      )

      const startAt = data.startAt ? new Date(data.startAt) : new Date()

      const livestream = await prisma.livestream.create({
        data: {
          churchId,
          title: data.title,
          description: data.description,
          thumbnail: data.thumbnail,
          status: LivestreamStatus.SCHEDULED,
          startAt,
          createdBy: userId,
          platforms: {
            create: platformCreatePayload,
          },
        },
        include: {
          platforms: true,
        },
      })

      await Promise.all(
        livestream.platforms
          .filter((platform) => !platform.error)
          .map((platform) =>
            this.provisionPlatformLivestream(livestream, platform, {
              title: data.title,
              description: data.description,
              thumbnail: data.thumbnail,
              startAt,
            })
          )
      )

      const refreshed = await prisma.livestream.findUnique({
        where: { id: livestream.id },
        include: { platforms: true },
      })

      return this.formatLivestream(refreshed || livestream)
    } catch (error) {
      console.error('Error creating livestream:', error)
      throw error
    }
  }

  /**
   * Get livestream details
   */
  static async getLivestream(livestreamId: string): Promise<LivestreamData | null> {
    try {
      const livestream = await prisma.livestream.findUnique({
        where: { id: livestreamId },
        include: { platforms: true },
      })

      if (!livestream) {
        return null
      }

      return this.formatLivestream(livestream)
    } catch (error) {
      console.error('Error getting livestream:', error)
      throw error
    }
  }

  /**
   * Get all livestreams for a church
   */
  static async getLivestreams(churchId: string, status?: LivestreamStatus): Promise<LivestreamData[]> {
    try {
      const livestreams = await prisma.livestream.findMany({
        where: {
          churchId,
          ...(status && { status }),
        },
        include: { platforms: true },
        orderBy: { startAt: 'desc' },
      })

      return livestreams.map((ls) => this.formatLivestream(ls))
    } catch (error) {
      console.error('Error getting livestreams:', error)
      throw error
    }
  }

  /**
   * Start broadcasting livestream
   * Property 2: Livestream Multi-Platform Broadcasting - broadcasts to all selected platforms
   */
  static async startBroadcasting(livestreamId: string): Promise<LivestreamData> {
    try {
      const livestream = await prisma.livestream.findUnique({
        where: { id: livestreamId },
        include: { platforms: true },
      })

      if (!livestream) {
        throw new Error('Livestream not found')
      }

      const basePayload = {
        title: livestream.title,
        description: livestream.description ?? undefined,
        thumbnail: livestream.thumbnail ?? undefined,
        startAt: livestream.startAt,
      }

      await Promise.all(
        livestream.platforms.map(async (platform) => {
          let currentPlatform = platform
          if (!currentPlatform.platformId) {
            await this.provisionPlatformLivestream(livestream, currentPlatform, basePayload)
            currentPlatform =
              (await prisma.livestreamPlatform.findUnique({ where: { id: platform.id } })) || platform
          }
          await this.startPlatformBroadcast(livestream, currentPlatform)
        })
      )

      const updated = await prisma.livestream.update({
        where: { id: livestreamId },
        data: {
          status: LivestreamStatus.LIVE,
        },
        include: { platforms: true },
      })

      return this.formatLivestream(updated)
    } catch (error) {
      console.error('Error starting broadcast:', error)
      throw error
    }
  }

  /**
   * Stop broadcasting livestream
   * Property 4: Platform Failure Isolation - continues with other platforms if one fails
   */
  static async stopBroadcasting(livestreamId: string): Promise<LivestreamData> {
    try {
      const livestream = await prisma.livestream.findUnique({
        where: { id: livestreamId },
        include: { platforms: true },
      })

      if (!livestream) {
        throw new Error('Livestream not found')
      }

      await Promise.all(
        livestream.platforms.map(async (platform) => {
          await this.stopPlatformBroadcast(livestream, platform)
        })
      )

      const updated = await prisma.livestream.update({
        where: { id: livestreamId },
        data: {
          status: LivestreamStatus.ENDED,
          endAt: new Date(),
        },
        include: { platforms: true },
      })

      return this.formatLivestream(updated)
    } catch (error) {
      console.error('Error stopping broadcast:', error)
      throw error
    }
  }

  /**
   * Update livestream details
   */
  static async updateLivestream(
    livestreamId: string,
    data: {
      title?: string
      description?: string
      thumbnail?: string
    }
  ): Promise<LivestreamData> {
    try {
      const updated = await prisma.livestream.update({
        where: { id: livestreamId },
        data,
        include: { platforms: true },
      })

      await Promise.all(
        updated.platforms.map(async (platform) => {
          await this.updatePlatformLivestream(updated, platform, data)
        })
      )

      const refreshed = await prisma.livestream.findUnique({
        where: { id: livestreamId },
        include: { platforms: true },
      })

      return this.formatLivestream(refreshed || updated)
    } catch (error) {
      console.error('Error updating livestream:', error)
      throw error
    }
  }

  /**
   * Delete livestream
   */
  static async deleteLivestream(livestreamId: string): Promise<void> {
    try {
      const livestream = await prisma.livestream.findUnique({
        where: { id: livestreamId },
        include: { platforms: true },
      })

      if (livestream) {
        await Promise.all(
          livestream.platforms.map(async (platform) => {
            await this.deletePlatformLivestream(livestream, platform)
          })
        )
      }

      await prisma.livestream.delete({
        where: { id: livestreamId },
      })
    } catch (error) {
      console.error('Error deleting livestream:', error)
      throw error
    }
  }

  /**
   * Update platform status
   * Property 4: Platform Failure Isolation - tracks individual platform failures
   */
  static async updatePlatformStatus(
    livestreamId: string,
    platform: StreamingPlatform,
    status: LivestreamPlatformStatus,
    error?: string
  ): Promise<void> {
    try {
      const safeStatus = status === LivestreamPlatformStatus.FAILED ? LivestreamPlatformStatus.PENDING : status
      await prisma.livestreamPlatform.update({
        where: {
          livestreamId_platform: {
            livestreamId,
            platform,
          },
        },
        data: {
          status: safeStatus,
          error: error || null,
        },
      })
    } catch (error) {
      console.error(`Error updating platform status for ${platform}:`, error)
      throw error
    }
  }

  /**
   * Get platform links for members
   * Property 5: Member Platform Access - returns all available platform links
   */
  static async getPlatformLinks(livestreamId: string): Promise<
    Array<{
      platform: StreamingPlatform
      url?: string
      status: LivestreamPlatformStatus
      error?: string
    }>
  > {
    try {
      const livestream = await prisma.livestream.findUnique({
        where: { id: livestreamId },
        include: { platforms: true },
      })

      if (!livestream) {
        throw new Error('Livestream not found')
      }

      return livestream.platforms.map((p) => ({
        platform: p.platform,
        url: p.url || undefined,
        status: p.status,
        error: p.error || undefined,
      }))
    } catch (error) {
      console.error('Error getting platform links:', error)
      throw error
    }
  }

  /**
   * Format livestream for API response
   */
  private static formatLivestream(livestream: any): LivestreamData {
    return {
      id: livestream.id,
      churchId: livestream.churchId,
      title: livestream.title,
      description: livestream.description,
      thumbnail: livestream.thumbnail,
      status: livestream.status,
      startAt: livestream.startAt,
      endAt: livestream.endAt,
      createdBy: livestream.createdBy,
      createdAt: livestream.createdAt,
      updatedAt: livestream.updatedAt,
      platforms: livestream.platforms
        ? livestream.platforms.map((platform: any) => ({
            id: platform.id,
            platform: platform.platform,
            status: platform.error ? LivestreamPlatformStatus.FAILED : platform.status,
            url: platform.url || undefined,
            error: platform.error || undefined,
            settings: platform.settings || undefined,
          }))
        : [],
    }
  }

  private static async provisionPlatformLivestream(
    livestream: any,
    platform: any,
    baseData: { title: string; description?: string; thumbnail?: string; startAt: Date }
  ): Promise<void> {
    // Built-in Jitsi broadcast: stage room + WHIP/HLS stream credentials.
    // platformId = MediaMTX stream path; streamKey authorizes publishing.
    if (platform.platform === StreamingPlatform.JITSI) {
      const streamPath = `lv-${crypto.randomBytes(8).toString('hex')}`
      const streamKey = crypto.randomBytes(24).toString('hex')
      const roomName = JitsiService.generateRoomName(livestream.id)

      await prisma.livestreamPlatform.update({
        where: { id: platform.id },
        data: {
          platformId: streamPath,
          url: `/livestreams/${livestream.id}/watch`,
          status: LivestreamPlatformStatus.PENDING,
          error: null,
          settings: {
            ...(platform.settings || {}),
            roomName,
            streamPath,
            streamKey,
          },
        },
      })
      return
    }

    try {
      const client = await PlatformClientFactory.getClient(livestream.churchId, platform.platform)
      const response = await client.createLivestream({
        title: platform.settings?.title || baseData.title,
        description: platform.settings?.description || baseData.description,
        thumbnail: platform.settings?.thumbnail || baseData.thumbnail,
        startAt: baseData.startAt,
        settings: platform.settings,
      })

      await prisma.livestreamPlatform.update({
        where: { id: platform.id },
        data: {
          platformId: response.platformId,
          url: response.url,
          status: LivestreamPlatformStatus.PENDING,
          error: null,
        },
      })
    } catch (error) {
      await prisma.livestreamPlatform.update({
        where: { id: platform.id },
        data: {
          status: LivestreamPlatformStatus.PENDING,
          error: error instanceof Error ? error.message : 'Failed to provision platform',
        },
      })
    }
  }

  private static async startPlatformBroadcast(livestream: any, platform: any): Promise<void> {
    // Jitsi broadcast goes LIVE when the studio actually publishes (WHIP)
    if (platform.platform === StreamingPlatform.JITSI) return

    if (!platform.platformId) {
      await prisma.livestreamPlatform.update({
        where: { id: platform.id },
        data: {
          status: LivestreamPlatformStatus.PENDING,
          error: 'Platform stream not provisioned',
        },
      })
      return
    }

    try {
      const client = await PlatformClientFactory.getClient(livestream.churchId, platform.platform)
      await client.startBroadcasting(platform.platformId)
      await prisma.livestreamPlatform.update({
        where: { id: platform.id },
        data: {
          status: LivestreamPlatformStatus.LIVE,
          error: null,
        },
      })
    } catch (error) {
      await prisma.livestreamPlatform.update({
        where: { id: platform.id },
        data: {
          status: LivestreamPlatformStatus.PENDING,
          error: error instanceof Error ? error.message : 'Failed to start broadcasting',
        },
      })
    }
  }

  private static async stopPlatformBroadcast(livestream: any, platform: any): Promise<void> {
    if (platform.platform === StreamingPlatform.JITSI) {
      await prisma.livestreamPlatform.update({
        where: { id: platform.id },
        data: { status: LivestreamPlatformStatus.ENDED },
      })
      return
    }

    if (!platform.platformId) {
      return
    }

    try {
      const client = await PlatformClientFactory.getClient(livestream.churchId, platform.platform)
      await client.stopBroadcasting(platform.platformId)
      await prisma.livestreamPlatform.update({
        where: { id: platform.id },
        data: {
          status: LivestreamPlatformStatus.ENDED,
          error: null,
        },
      })
    } catch (error) {
      await prisma.livestreamPlatform.update({
        where: { id: platform.id },
        data: {
          status: LivestreamPlatformStatus.ENDED,
          error: error instanceof Error ? error.message : 'Failed to stop broadcasting',
        },
      })
    }
  }

  private static async deletePlatformLivestream(livestream: any, platform: any): Promise<void> {
    if (platform.platform === StreamingPlatform.JITSI) return

    if (!platform.platformId) {
      return
    }

    try {
      const client = await PlatformClientFactory.getClient(livestream.churchId, platform.platform)
      await client.deleteLivestream(platform.platformId)
    } catch (error) {
      console.error(`Error deleting platform livestream for ${platform.platform}:`, error)
    }
  }

  private static async updatePlatformLivestream(
    livestream: any,
    platform: any,
    data: { title?: string; description?: string; thumbnail?: string }
  ): Promise<void> {
    if (platform.platform === StreamingPlatform.JITSI || !platform.platformId) {
      return
    }

    try {
      const client = await PlatformClientFactory.getClient(livestream.churchId, platform.platform)
      await client.updateLivestream(platform.platformId, {
        title: data.title,
        description: data.description,
        thumbnail: data.thumbnail,
        settings: platform.settings,
      })
    } catch (error) {
      console.error(`Error updating platform livestream for ${platform.platform}:`, error)
    }
  }
}
