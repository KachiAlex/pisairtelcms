import { describe, it, expect, beforeEach, vi } from 'vitest'
import { RestreamClient } from '@/lib/clients/restream-client'
import { StreamingPlatform } from '@/lib/types/streaming'

const okResponse = (body: any) =>
  ({
    ok: true,
    json: vi.fn(async () => body),
  }) as unknown as Response

const errResponse = (statusText = 'Not Found') =>
  ({
    ok: false,
    statusText,
    json: vi.fn(async () => ({})),
  }) as unknown as Response

describe('RestreamClient', () => {
  let client: RestreamClient
  const credentials = { accessToken: 'test-access-token' }

  beforeEach(() => {
    client = new RestreamClient()
    client['credentials'] = credentials
    vi.stubGlobal('fetch', vi.fn(async () => okResponse({ id: 'ch_1' })))
  })

  describe('platform', () => {
    it('should be RESTREAM', () => {
      expect(client.platform).toBe(StreamingPlatform.RESTREAM)
    })
  })

  describe('authenticate', () => {
    it('should throw when access token is missing', async () => {
      await expect(client.authenticate({})).rejects.toThrow('Restream access token is required')
    })

    it('should verify the token against the Restream API', async () => {
      await client.authenticate(credentials)
      expect(fetch).toHaveBeenCalledWith(
        'https://api.restream.io/v2/user',
        expect.objectContaining({ method: 'GET' })
      )
    })
  })

  describe('createLivestream', () => {
    it('should create a channel and return platformId + url', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => okResponse({ id: 'ch_42', url: 'https://restream.io/ch/42' })))

      const result = await client.createLivestream({ title: 'Sunday Service', description: 'Live' })

      expect(result.platformId).toBe('ch_42')
      expect(result.url).toBe('https://restream.io/ch/42')
      expect(fetch).toHaveBeenCalledWith(
        'https://api.restream.io/v2/channels',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ title: 'Sunday Service', description: 'Live', thumbnail: undefined }),
        })
      )
    })

    it('should fall back to a derived url when none is returned', async () => {
      const result = await client.createLivestream({ title: 'Test' })
      expect(result.url).toBe('https://restream.io/channel/ch_1')
    })

    it('should propagate API errors', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => errResponse('Bad Request')))
      await expect(client.createLivestream({ title: 'x' })).rejects.toThrow('API request failed')
    })
  })

  describe('updateLivestream', () => {
    it('should PATCH the channel', async () => {
      await client.updateLivestream('ch_9', { title: 'New title' })
      expect(fetch).toHaveBeenCalledWith(
        'https://api.restream.io/v2/channels/ch_9',
        expect.objectContaining({ method: 'PATCH' })
      )
    })
  })

  describe('startBroadcasting / stopBroadcasting', () => {
    it('should POST to the start endpoint', async () => {
      await client.startBroadcasting('ch_9')
      expect(fetch).toHaveBeenCalledWith(
        'https://api.restream.io/v2/channels/ch_9/start',
        expect.objectContaining({ method: 'POST' })
      )
    })

    it('should POST to the stop endpoint', async () => {
      await client.stopBroadcasting('ch_9')
      expect(fetch).toHaveBeenCalledWith(
        'https://api.restream.io/v2/channels/ch_9/stop',
        expect.objectContaining({ method: 'POST' })
      )
    })

    it('should propagate start failures', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => errResponse()))
      await expect(client.startBroadcasting('ch_9')).rejects.toThrow()
    })
  })

  describe('deleteLivestream', () => {
    it('should DELETE the channel', async () => {
      await client.deleteLivestream('ch_9')
      expect(fetch).toHaveBeenCalledWith(
        'https://api.restream.io/v2/channels/ch_9',
        expect.objectContaining({ method: 'DELETE' })
      )
    })
  })

  describe('getDestinations', () => {
    it('should return the destination list', async () => {
      vi.stubGlobal('fetch', vi.fn(async () =>
        okResponse({ data: [{ id: 'd1', name: 'YouTube', platform: 'youtube' }] })
      ))
      const dests = await client.getDestinations()
      expect(dests).toEqual([{ id: 'd1', name: 'YouTube', platform: 'youtube' }])
    })

    it('should return an empty array when the API returns no data', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => okResponse({})))
      expect(await client.getDestinations()).toEqual([])
    })
  })

  describe('getChannelDetails', () => {
    it('should return the channel payload', async () => {
      vi.stubGlobal('fetch', vi.fn(async () => okResponse({ id: 'ch_7', title: 'My channel' })))
      const details = await client.getChannelDetails('ch_7')
      expect(details.id).toBe('ch_7')
    })
  })
})
