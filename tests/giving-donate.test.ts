import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.setConfig({ testTimeout: 15000 })

const mockGetServerSession = vi.fn()
vi.mock('next-auth/next', () => ({
  getServerSession: mockGetServerSession,
}))

vi.mock('@/lib/auth-options', () => ({
  authOptions: {},
}))

const mockGetCurrentChurch = vi.fn()
vi.mock('@/lib/church-context', () => ({
  getCurrentChurch: mockGetCurrentChurch,
}))

const mockGivingCreate = vi.fn()
const mockProjectFindById = vi.fn()
vi.mock('@/lib/services/giving-service', () => ({
  GivingService: {
    create: mockGivingCreate,
  },
  ProjectService: {
    findById: mockProjectFindById,
  },
}))

const mockUserFindById = vi.fn()
vi.mock('@/lib/services/user-service', () => ({
  UserService: {
    findById: mockUserFindById,
  },
}))

const mockGenerateReceipt = vi.fn()
vi.mock('@/lib/services/receipt-service', () => ({
  ReceiptService: {
    generateUploadAndAttachDonationReceipt: mockGenerateReceipt,
  },
}))

const mockSendDonationReceipt = vi.fn()
vi.mock('@/lib/services/email-service', () => ({
  EmailService: {
    sendDonationReceipt: mockSendDonationReceipt,
  },
}))

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()

  mockGetServerSession.mockResolvedValue(null)
  mockGetCurrentChurch.mockResolvedValue({ id: 'church_1', name: 'Test Church' })
  mockProjectFindById.mockResolvedValue(null)
  mockUserFindById.mockResolvedValue({
    id: 'user_1',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    branchId: 'branch_1',
  })
  mockGivingCreate.mockResolvedValue({
    id: 'giving_1',
    userId: 'user_1',
    churchId: 'church_1',
    amount: 10,
    type: 'Tithe',
    createdAt: new Date(),
  })
  mockGenerateReceipt.mockResolvedValue('https://example.com/receipt.pdf')
  mockSendDonationReceipt.mockResolvedValue(undefined)
})

describe('Giving donate', () => {
  it('returns 401 when unauthenticated', async () => {
    const { POST } = await import('@/app/api/giving/donate/route')

    const req = new Request('http://localhost/api/giving/donate', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ amount: '10', type: 'Tithe' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(401)
    expect(mockGetServerSession).toHaveBeenCalled()
  })

  it('returns 201 and receiptUrl when authenticated (happy path)', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'user_1' } })

    const { POST } = await import('@/app/api/giving/donate/route')

    const req = new Request('http://localhost/api/giving/donate', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ amount: '10', type: 'Tithe', paymentMethod: 'Card' }),
    })

    const res = await POST(req)
    expect(res.status).toBe(201)

    const json = await res.json()
    expect(json).toMatchObject({
      id: 'giving_1',
      receiptUrl: 'https://example.com/receipt.pdf',
    })
    expect(mockGivingCreate).toHaveBeenCalled()
    expect(mockGenerateReceipt).toHaveBeenCalled()
    expect(mockSendDonationReceipt).toHaveBeenCalled()
  })
})
