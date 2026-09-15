import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockVerifyPayment = vi.fn()
vi.mock('@/lib/services/payment-service', () => ({
  PaymentService: {
    verifyPayment: mockVerifyPayment,
  },
}))

const mockWebhookEventCreate = vi.fn()
vi.mock('@/lib/prisma', () => ({
  prisma: {
    webhookEvent: {
      create: mockWebhookEventCreate,
    },
  },
}))

vi.mock('@/lib/services/giving-service', () => ({
  GivingService: {
    create: vi.fn(async () => ({ id: 'giving_1', createdAt: new Date() })),
  },
  ProjectService: {
    findById: vi.fn(async () => null),
  },
}))

vi.mock('@/lib/services/user-service', () => ({
  UserService: {
    findById: vi.fn(async () => null),
  },
}))

vi.mock('@/lib/services/email-service', () => ({
  EmailService: {
    sendDonationReceipt: vi.fn(async () => undefined),
  },
}))

vi.mock('@/lib/services/receipt-service', () => ({
  ReceiptService: {
    generateUploadAndAttachDonationReceipt: vi.fn(async () => 'https://example.com/receipt.pdf'),
  },
}))

const mockGetCurrentChurch = vi.fn()
vi.mock('@/lib/church-context', () => ({
  getCurrentChurch: mockGetCurrentChurch,
}))

const mockFindGivingConfig = vi.fn()
vi.mock('@/lib/services/giving-config-service', () => ({
  GivingConfigService: {
    findByChurch: mockFindGivingConfig,
  },
}))

vi.mock('@/lib/services/subscription-payment-service', () => ({
  SubscriptionPaymentService: {
    findByReference: vi.fn(async () => null),
    markPaid: vi.fn(async () => undefined),
    markFailed: vi.fn(async () => undefined),
    markApplied: vi.fn(async () => undefined),
  },
}))

vi.mock('@/lib/services/subscription-service', () => ({
  SubscriptionService: {
    findByChurch: vi.fn(async () => ({ id: 'sub_1' })),
    update: vi.fn(async () => ({})),
  },
  SubscriptionPlanService: {
    findById: vi.fn(async () => ({ id: 'plan_1' })),
  },
}))

vi.mock('@/lib/services/landing-payment-service', () => ({
  LandingPaymentService: {
    markPaid: vi.fn(async () => undefined),
  },
}))

vi.mock('@/lib/logger', () => ({
  getCorrelationIdFromRequest: () => 'test-correlation',
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

const SECRET = 'test_secret_hash'
process.env.FLUTTERWAVE_SECRET_HASH = SECRET

function webhookRequest(payload: any, signature?: string) {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (signature) headers['verif-hash'] = signature
  return new Request('http://localhost/api/webhooks/flutterwave', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockVerifyPayment.mockResolvedValue({ success: true, transactionId: 'txn_123', amount: 10, currency: 'NGN' })
  mockGetCurrentChurch.mockResolvedValue(null)
  mockFindGivingConfig.mockResolvedValue(null)
  mockWebhookEventCreate.mockResolvedValue({})
})

describe('Flutterwave webhook', () => {
  it('returns 400 when signature is missing', async () => {
    const { POST } = await import('@/app/api/webhooks/flutterwave/route')

    const res = await POST(webhookRequest({ event: 'charge.completed', data: {} }))
    expect(res.status).toBe(400)
  })

  it('returns 401 when signature is invalid', async () => {
    const { POST } = await import('@/app/api/webhooks/flutterwave/route')

    const res = await POST(webhookRequest({ event: 'charge.completed', data: {} }, 'wrong-signature'))
    expect(res.status).toBe(401)
  })

  it('calls PaymentService.verifyPayment when signature is valid', async () => {
    const { POST } = await import('@/app/api/webhooks/flutterwave/route')
    const { PaymentService } = await import('@/lib/services/payment-service')

    const payload = {
      event: 'charge.completed',
      data: { id: 98765, tx_ref: 'tx_ref_sig_1', status: 'successful', amount: 10, meta: {} },
    }

    const res = await POST(webhookRequest(payload, SECRET))
    expect(res.status).toBe(200)
    expect((await res.json()).received).toBe(true)

    expect(PaymentService.verifyPayment).toHaveBeenCalledTimes(1)
    expect(PaymentService.verifyPayment).toHaveBeenCalledWith(98765, undefined)
  })

  it('returns duplicate on second delivery for same transaction id', async () => {
    const { POST } = await import('@/app/api/webhooks/flutterwave/route')

    const payload = {
      event: 'charge.completed',
      data: { id: 12345, tx_ref: 'tx_ref_1', status: 'successful', amount: 10, meta: {} },
    }

    const res1 = await POST(webhookRequest(payload, SECRET))
    expect(res1.status).toBe(200)
    expect((await res1.json()).duplicate).toBeUndefined()

    // Simulate the unique-constraint hit on the second delivery
    mockWebhookEventCreate.mockRejectedValueOnce(Object.assign(new Error('Unique constraint'), { code: 'P2002' }))

    const res2 = await POST(webhookRequest(payload, SECRET))
    expect(res2.status).toBe(200)
    const json2 = await res2.json()
    expect(json2.received).toBe(true)
    expect(json2.duplicate).toBe(true)
  })
})
