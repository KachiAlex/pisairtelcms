import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LivestreamService } from '@/lib/services/livestream-service'
import {
  LivestreamPlatformStatus,
  LivestreamStatus,
  PlatformConnectionStatus,
  StreamingPlatform,
} from '@/lib/types/streaming'

const prismaMock = vi.hoisted(() => ({
  livestream: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  livestreamPlatform: {
    update: vi.fn(),
    findUnique: vi.fn(),
  },
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

const platformConnectionServiceMock = vi.hoisted(() => ({
  getConnection: vi.fn(),
  getConnections: vi.fn(),
}))

vi.mock('@/lib/services/platform-connection-service', () => ({
  PlatformConnectionService: platformConnectionServiceMock,
}))

const platformClientMock = vi.hoisted(() => ({
  createLivestream: vi.fn(),
  startBroadcasting: vi.fn(),
  stopBroadcasting: vi.fn(),
  deleteLivestream: vi.fn(),
  updateLivestream: vi.fn(),
}))

const platformClientFactoryMock = vi.hoisted(() => ({
  getClient: vi.fn(),
}))

vi.mock('@/lib/clients/platform-client-factory', () => ({
  PlatformClientFactory: platformClientFactoryMock,
}))

const churchId = 'church-123'
const userId = 'user-456'
const baseStartAt = new Date('2024-01-01T10:00:00.000Z')

function buildLivestreamRecord(status: LivestreamStatus = LivestreamStatus.SCHEDULED) {
  return {
    id: 'ls_1',
    churchId,
    title: 'Sunday Service',
    description: 'Weekly livestream',
    thumbnail: null,
    status,
    startAt: baseStartAt,
    endAt: null,
    createdBy: userId,
    createdAt: baseStartAt,
    updatedAt: baseStartAt,
    platforms: [
      {
        id: 'lp_1',
        livestreamId: 'ls_1',
        platform: StreamingPlatform.YOUTUBE,
        platformId: 'yt-remote',
        status: LivestreamPlatformStatus.PENDING,
        url: null,
        error: null,
        settings: {},
      },
      {
        id: 'lp_2',
        livestreamId: 'ls_1',
        platform: StreamingPlatform.FACEBOOK,
        platformId: 'fb-remote',
        status: LivestreamPlatformStatus.PENDING,
        url: null,
        error: null,
        settings: {},
      },
    ],
  }
}

describe('LivestreamService multi-platform orchestration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    platformConnectionServiceMock.getConnection.mockResolvedValue({
      status: PlatformConnectionStatus.CONNECTED,
    })
    platformClientFactoryMock.getClient.mockResolvedValue(platformClientMock)
    platformClientMock.createLivestream.mockResolvedValue({
      platformId: 'remote-123',
      url: 'https://example.com/watch/remote-123',
    })
    platformClientMock.startBroadcasting.mockResolvedValue(undefined)
    platformClientMock.stopBroadcasting.mockResolvedValue(undefined)
    platformClientMock.deleteLivestream.mockResolvedValue(undefined)
    platformClientMock.updateLivestream.mockResolvedValue(undefined)

    prismaMock.livestreamPlatform.update.mockResolvedValue(null)
    prismaMock.livestreamPlatform.findUnique.mockResolvedValue(null)
  })

  it('creates a livestream and provisions all selected platforms', async () => {
    const record = buildLivestreamRecord()
    prismaMock.livestream.create.mockResolvedValue(record)
    prismaMock.livestream.findUnique.mockResolvedValue(record)

    const result = await LivestreamService.createLivestream(churchId, userId, {
      title: record.title,
      description: record.description ?? undefined,
      startAt: baseStartAt,
      platforms: [
        { platform: StreamingPlatform.YOUTUBE, settings: { title: 'YT Title' } },
        { platform: StreamingPlatform.FACEBOOK },
      ],
    })

    expect(platformConnectionServiceMock.getConnection).toHaveBeenCalledTimes(2)
    expect(platformClientFactoryMock.getClient).toHaveBeenCalledTimes(2)
    expect(platformClientMock.createLivestream).toHaveBeenCalledTimes(2)
    expect(result.platforms?.length).toBe(2)
    expect(result.status).toBe(LivestreamStatus.SCHEDULED)
  })

  it('throws if no platforms are provided', async () => {
    await expect(
      LivestreamService.createLivestream(churchId, userId, {
        title: 'Missing Platforms',
        platforms: [],
      })
    ).rejects.toThrow('At least one platform must be selected')
  })

  it('starts broadcasting across all provisioned platforms', async () => {
    const created = buildLivestreamRecord()
    prismaMock.livestream.findUnique.mockResolvedValueOnce(created)
    prismaMock.livestream.update.mockResolvedValue(buildLivestreamRecord(LivestreamStatus.LIVE))

    const result = await LivestreamService.startBroadcasting(created.id)

    expect(platformClientFactoryMock.getClient).toHaveBeenCalledTimes(created.platforms.length)
    expect(platformClientMock.startBroadcasting).toHaveBeenCalledTimes(created.platforms.length)
    expect(result.status).toBe(LivestreamStatus.LIVE)
  })

  it('stops broadcasting and marks livestream as ended', async () => {
    const liveRecord = buildLivestreamRecord(LivestreamStatus.LIVE)
    prismaMock.livestream.findUnique.mockResolvedValueOnce(liveRecord)
    prismaMock.livestream.update.mockResolvedValue(buildLivestreamRecord(LivestreamStatus.ENDED))

    const result = await LivestreamService.stopBroadcasting(liveRecord.id)

    expect(platformClientMock.stopBroadcasting).toHaveBeenCalledTimes(liveRecord.platforms.length)
    expect(result.status).toBe(LivestreamStatus.ENDED)
  })

  it('updates livestream metadata and syncs platform titles', async () => {
    const record = buildLivestreamRecord()
    prismaMock.livestream.update.mockResolvedValue(record)
    prismaMock.livestream.findUnique.mockResolvedValue(record)

    const result = await LivestreamService.updateLivestream(record.id, {
      title: 'Updated Title',
      description: 'New description',
    })

    expect(platformClientMock.updateLivestream).toHaveBeenCalledTimes(record.platforms.length)
    expect(result.title).toBe(record.title)
  })

  it('deletes remote platform broadcasts before removing the livestream', async () => {
    const record = buildLivestreamRecord()
    prismaMock.livestream.findUnique.mockResolvedValue(record)
    prismaMock.livestream.delete.mockResolvedValue(undefined)

    await LivestreamService.deleteLivestream(record.id)

    expect(platformClientMock.deleteLivestream).toHaveBeenCalledTimes(record.platforms.length)
    expect(prismaMock.livestream.delete).toHaveBeenCalledWith({ where: { id: record.id } })
  })
})
