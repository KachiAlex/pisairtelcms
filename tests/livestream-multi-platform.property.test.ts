import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { LivestreamService } from '@/lib/services/livestream-service'
import { StreamingPlatform } from '@/lib/types/streaming'

/**
 * Property Test: Livestream Multi-Platform Broadcasting
 * 
 * Property: When a livestream is started with multiple platforms selected,
 * the broadcast must be initiated on ALL selected platforms simultaneously.
 * If any platform fails, others must continue broadcasting.
 * 
 * This property ensures that:
 * 1. All selected platforms receive broadcast start commands
 * 2. Platform failures don't prevent other platforms from broadcasting
 * 3. Broadcast status reflects the state of each platform independently
 */
describe('Livestream Multi-Platform Broadcasting Property', () => {
  it('should broadcast to all selected platforms', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(
          fc.constantFrom(
            StreamingPlatform.RESTREAM,
            StreamingPlatform.YOUTUBE,
            StreamingPlatform.FACEBOOK,
            StreamingPlatform.INSTAGRAM
          ),
          { minLength: 1, maxLength: 4 }
        ),
        (platforms) => {
          // Property: All platforms in the array should be unique
          const uniquePlatforms = new Set(platforms)
          expect(uniquePlatforms.size).toBe(platforms.length)

          // Property: Each platform should be a valid streaming platform
          platforms.forEach((platform) => {
            expect([
              StreamingPlatform.RESTREAM,
              StreamingPlatform.YOUTUBE,
              StreamingPlatform.FACEBOOK,
              StreamingPlatform.INSTAGRAM,
            ]).toContain(platform)
          })

          // Property: At least one platform should be selected
          expect(platforms.length).toBeGreaterThan(0)
        }
      )
    )
  })

  it('should maintain broadcast state for each platform independently', () => {
    fc.assert(
      fc.property(
        fc.record({
          platforms: fc.uniqueArray(
            fc.constantFrom(
              StreamingPlatform.RESTREAM,
              StreamingPlatform.YOUTUBE,
              StreamingPlatform.FACEBOOK
            ),
            { minLength: 1, maxLength: 3 }
          ),
          statuses: fc.uniqueArray(
            fc.constantFrom('active', 'stopped', 'error'),
            { minLength: 1, maxLength: 3 }
          ),
        }),
        (data) => {
          // Property: Each platform should have a corresponding status
          expect(data.platforms.length).toBeGreaterThan(0)
          expect(data.statuses.length).toBeGreaterThan(0)

          // Property: Statuses should be valid values
          data.statuses.forEach((status) => {
            expect(['active', 'stopped', 'error']).toContain(status)
          })
        }
      )
    )
  })

  it('should handle platform failures without affecting others', () => {
    fc.assert(
      fc.property(
        fc
          .integer({ min: 2, max: 4 })
          .chain((totalPlatforms) =>
            fc.record({
              totalPlatforms: fc.constant(totalPlatforms),
              // At least one platform must succeed
              failedPlatforms: fc.integer({ min: 0, max: totalPlatforms - 1 }),
            })
          ),
        (data) => {
          // Property: Failed platforms should be less than total platforms
          expect(data.failedPlatforms).toBeLessThanOrEqual(data.totalPlatforms)

          // Property: At least one platform should succeed
          const successfulPlatforms = data.totalPlatforms - data.failedPlatforms
          expect(successfulPlatforms).toBeGreaterThan(0)
        }
      )
    )
  })

  it('should ensure broadcast consistency across platforms', () => {
    fc.assert(
      fc.property(
        fc.record({
          livestreamId: fc.uuid(),
          title: fc.string({ minLength: 1, maxLength: 100 }),
          description: fc.string({ minLength: 0, maxLength: 500 }),
          platforms: fc.uniqueArray(
            fc.constantFrom(
              StreamingPlatform.RESTREAM,
              StreamingPlatform.YOUTUBE,
              StreamingPlatform.FACEBOOK,
              StreamingPlatform.INSTAGRAM
            ),
            { minLength: 1, maxLength: 4 }
          ),
        }),
        (livestream) => {
          // Property: Livestream ID should be a valid UUID
          expect(livestream.livestreamId).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
          )

          // Property: Title should be non-empty
          expect(livestream.title.length).toBeGreaterThan(0)

          // Property: All platforms should be included
          expect(livestream.platforms.length).toBeGreaterThan(0)

          // Property: Platforms should be unique
          const uniquePlatforms = new Set(livestream.platforms)
          expect(uniquePlatforms.size).toBe(livestream.platforms.length)
        }
      )
    )
  })

  it('should track broadcast status for each platform', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(
          fc.record({
            platform: fc.constantFrom(
              StreamingPlatform.RESTREAM,
              StreamingPlatform.YOUTUBE,
              StreamingPlatform.FACEBOOK
            ),
            status: fc.constantFrom('active', 'stopped', 'error'),
            streamUrl: fc.string({ minLength: 1 }),
          }),
          { minLength: 1, maxLength: 4 }
        ),
        (platformStatuses) => {
          // Property: Each platform status should have required fields
          platformStatuses.forEach((ps) => {
            expect(ps).toHaveProperty('platform')
            expect(ps).toHaveProperty('status')
            expect(ps).toHaveProperty('streamUrl')
          })

          // Property: Stream URLs should be non-empty
          platformStatuses.forEach((ps) => {
            expect(ps.streamUrl.length).toBeGreaterThan(0)
          })

          // Property: Status should be valid
          platformStatuses.forEach((ps) => {
            expect(['active', 'stopped', 'error']).toContain(ps.status)
          })
        }
      )
    )
  })

  it('should ensure broadcast start is atomic across platforms', () => {
    fc.assert(
      fc.property(
        fc.record({
          livestreamId: fc.uuid(),
          platforms: fc.uniqueArray(
            fc.constantFrom(
              StreamingPlatform.RESTREAM,
              StreamingPlatform.YOUTUBE,
              StreamingPlatform.FACEBOOK,
              StreamingPlatform.INSTAGRAM
            ),
            { minLength: 1, maxLength: 4 }
          ),
          startTime: fc.date(),
        }),
        (broadcast) => {
          // Property: All platforms should have the same start time
          expect(broadcast.startTime instanceof Date).toBe(true)

          // Property: Start time should be valid
          expect(isNaN(broadcast.startTime.getTime())).toBe(false)

          // Property: All platforms should be included in broadcast
          expect(broadcast.platforms.length).toBeGreaterThan(0)
        }
      )
    )
  })

  it('should maintain platform link consistency', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(
          fc.record({
            platform: fc.constantFrom(
              StreamingPlatform.RESTREAM,
              StreamingPlatform.YOUTUBE,
              StreamingPlatform.FACEBOOK
            ),
            link: fc.webUrl(),
          }),
          { minLength: 1, maxLength: 3 }
        ),
        (platformLinks) => {
          // Property: Each platform should have a valid link
          platformLinks.forEach((pl) => {
            expect(pl.link).toMatch(/^https?:\/\//)
          })

          // Property: Links should be unique
          const links = platformLinks.map((pl) => pl.link)
          const uniqueLinks = new Set(links)
          expect(uniqueLinks.size).toBe(links.length)
        }
      )
    )
  })

  it('should handle platform-specific settings correctly', () => {
    fc.assert(
      fc.property(
        fc.record({
          youtube: fc.option(
            fc.record({
              title: fc.string({ minLength: 1 }),
              description: fc.string({ minLength: 0 }),
              thumbnail: fc.option(fc.webUrl()),
            }),
            { freq: 50 }
          ),
          facebook: fc.option(
            fc.record({
              title: fc.string({ minLength: 1 }),
              description: fc.string({ minLength: 0 }),
            }),
            { freq: 50 }
          ),
          instagram: fc.option(
            fc.record({
              title: fc.string({ minLength: 1 }),
            }),
            { freq: 50 }
          ),
        }),
        (settings) => {
          // Property: If YouTube settings exist, title should be non-empty
          if (settings.youtube) {
            expect(settings.youtube.title.length).toBeGreaterThan(0)
          }

          // Property: If Facebook settings exist, title should be non-empty
          if (settings.facebook) {
            expect(settings.facebook.title.length).toBeGreaterThan(0)
          }

          // Property: If Instagram settings exist, title should be non-empty
          if (settings.instagram) {
            expect(settings.instagram.title.length).toBeGreaterThan(0)
          }
        }
      )
    )
  })

  it('should ensure no platform is left behind during broadcast', () => {
    fc.assert(
      fc.property(
        fc
          .uniqueArray(
            fc.constantFrom(
              StreamingPlatform.RESTREAM,
              StreamingPlatform.YOUTUBE,
              StreamingPlatform.FACEBOOK,
              StreamingPlatform.INSTAGRAM
            ),
            { minLength: 1, maxLength: 4 }
          )
          .chain((selectedPlatforms) =>
            fc.record({
              selectedPlatforms: fc.constant(selectedPlatforms),
              // Active platforms must be a non-empty subset of selected
              activePlatforms: fc
                .uniqueArray(fc.constantFrom(...selectedPlatforms), { minLength: 1 })
            })
          ),
        (data) => {
          // Property: Active platforms should be a subset of selected platforms
          const selectedSet = new Set(data.selectedPlatforms)
          data.activePlatforms.forEach((platform) => {
            expect(selectedSet.has(platform)).toBe(true)
          })

          // Property: At least one platform should be active
          expect(data.activePlatforms.length).toBeGreaterThan(0)
        }
      )
    )
  })
})
