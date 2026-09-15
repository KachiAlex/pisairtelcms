import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.setConfig({ testTimeout: 15000 })

const mockGetServerSession = vi.fn()
vi.mock('next-auth', () => ({
  getServerSession: mockGetServerSession,
}))

vi.mock('@/lib/auth-options', () => ({
  authOptions: {},
}))

const mockGetCurrentChurch = vi.fn()
vi.mock('@/lib/church-context', () => ({
  getCurrentChurch: mockGetCurrentChurch,
}))

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  mockGetServerSession.mockResolvedValue(null)
  mockGetCurrentChurch.mockResolvedValue(null)
})

describe('guardApi', () => {
  it('returns 401 when no session', async () => {
    const { guardApi } = await import('@/lib/api-guard')

    const result = await guardApi({ requireChurch: false })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.response.status).toBe(401)
    }
  })
})
