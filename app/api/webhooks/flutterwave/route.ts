
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { PaymentService } from '@/lib/services/payment-service'
import { GivingService } from '@/lib/services/giving-service'
import { SubscriptionService, SubscriptionPlanService } from '@/lib/services/subscription-service'
import { EmailService } from '@/lib/services/email-service'
import { prisma } from '@/lib/prisma'
import { ReceiptService } from '@/lib/services/receipt-service'
import { getCorrelationIdFromRequest, logger } from '@/lib/logger'
import { GivingConfigService } from '@/lib/services/giving-config-service'
import { getCurrentChurch } from '@/lib/church-context'
import { SubscriptionPaymentService } from '@/lib/services/subscription-payment-service'
import { LandingPaymentService } from '@/lib/services/landing-payment-service'

export async function POST(request: Request) {
  const correlationId = getCorrelationIdFromRequest(request)
  try {
    logger.info('webhook.flutterwave.request', { correlationId })
    const body = await request.json()
    const signature = request.headers.get('verif-hash')

    if (!signature) {
      logger.warn('webhook.flutterwave.missing_signature', { correlationId })
      return NextResponse.json(
        { error: 'Missing signature' },
        { status: 400 }
      )
    }

    // Verify webhook signature (Flutterwave uses verif-hash header)
    // Prefer per-church config if available, fallback to env.
    const metadata = body?.data?.meta || {}
    const metadataUserId = metadata?.userId
    const churchFromMeta = metadataUserId ? await getCurrentChurch(metadataUserId) : null
    const config = churchFromMeta ? await GivingConfigService.findByChurch(churchFromMeta.id) : null
    const secretHash = config?.paymentMethods?.flutterwave?.webhookSecretHash || process.env.FLUTTERWAVE_SECRET_HASH

    if (!secretHash) {
      logger.error('webhook.flutterwave.missing_secret', { correlationId })
      return NextResponse.json(
        { error: 'Webhook not configured' },
        { status: 500 }
      )
    }

    const { timingSafeEqual } = await import('crypto')
    const sigOk = (() => {
      try {
        return timingSafeEqual(Buffer.from(signature), Buffer.from(secretHash))
      } catch {
        return false
      }
    })()

    if (!sigOk) {
      logger.warn('webhook.flutterwave.invalid_signature', { correlationId })
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      )
    }

    const event = body.event
    const data = body.data
    const meta = data?.meta || {}

    // Idempotency: a row marks "received"; processedAt marks "done".
    // A row with processedAt=null means a previous attempt failed — reprocess it
    // instead of discarding, so Flutterwave retries (and manual replays) work.
    const transactionKey = data?.id ? `flutterwave_${data.id}` : data?.tx_ref ? `flutterwave_txref_${data.tx_ref}` : null
    let webhookEventId: string | null = null
    if (transactionKey) {
      try {
        const created = await prisma.webhookEvent.create({
          data: {
            transactionKey,
            provider: 'flutterwave',
            event,
            txRef: data?.tx_ref || null,
            transactionId: data?.id ? String(data.id) : null,
            status: data?.status || null,
          },
        })
        webhookEventId = created.id
      } catch (error: any) {
        if (error?.code === 'P2002') {
          const existing = await prisma.webhookEvent.findUnique({ where: { transactionKey } })
          if (existing?.processedAt) {
            logger.info('webhook.flutterwave.duplicate', { correlationId, transactionKey })
            return NextResponse.json({ received: true, duplicate: true })
          }
          webhookEventId = existing?.id ?? null
          logger.info('webhook.flutterwave.retry_unprocessed', { correlationId, transactionKey })
        } else {
          throw error
        }
      }
    }

    const markProcessed = async () => {
      if (!webhookEventId) return
      await prisma.webhookEvent
        .update({ where: { id: webhookEventId }, data: { processedAt: new Date() } })
        .catch((e) => logger.warn('webhook.flutterwave.mark_processed_failed', { correlationId, message: e?.message }))
    }

    const failProcessing = (logKey: string, extra: Record<string, any> = {}) => {
      logger.error(logKey, { correlationId, ...extra })
      return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
    }

    // Handle successful payment
    if (event === 'charge.completed' && data.status === 'successful') {
      const transactionId = data.id
      const meta = data.meta || {}

      logger.info('webhook.flutterwave.charge_completed', { correlationId, transactionId })

      // Verify payment
      const fw = config?.paymentMethods?.flutterwave
      const flutterwaveCreds = fw?.enabled && fw.publicKey && fw.secretKey ? { publicKey: fw.publicKey, secretKey: fw.secretKey } : undefined
      const verification = await PaymentService.verifyPayment(transactionId, flutterwaveCreds)

      logger.info('webhook.flutterwave.verify_done', {
        correlationId,
        transactionId,
        success: verification.success,
      })

      if (verification.success && verification.transactionId) {
        if (meta.kind === 'landing_subscription') {
          const reference = data?.tx_ref || verification.transactionId
          if (!reference) {
            // Missing reference can never heal — mark processed, don't retry
            await markProcessed()
            logger.error('webhook.flutterwave.landing_missing_reference', { correlationId, transactionId })
            return NextResponse.json({ received: true })
          }

          try {
            await LandingPaymentService.markPaid(reference, {
              transactionId: verification.transactionId,
              rawEvent: data,
            })
            await markProcessed()
            return NextResponse.json({ received: true, landingPayment: true })
          } catch (error: any) {
            return failProcessing('webhook.flutterwave.landing_payment_error', {
              transactionId,
              reference,
              message: error?.message,
            })
          }
        }

        // Handle subscription upgrades initiated from superadmin
        if (meta.kind === 'subscription_upgrade') {
          const reference = data?.tx_ref || verification.transactionId
          if (!reference) {
            await markProcessed()
            logger.error('webhook.flutterwave.subscription_upgrade_missing_reference', { correlationId, transactionId })
            return NextResponse.json({ received: true })
          }

          try {
            const payment = await SubscriptionPaymentService.findByReference(reference)
            if (!payment) {
              // Could be an ordering race — return 5xx so Flutterwave retries
              return failProcessing('webhook.flutterwave.subscription_payment_not_found', { reference })
            }

            await SubscriptionPaymentService.markPaid(payment.id, {
              transactionId: verification.transactionId,
              rawEvent: data,
              amount: verification.amount || data.amount,
              currency: verification.currency || data.currency,
            })

            const targetPlanId = meta.planId || payment.planId
            const targetChurchId = meta.churchId || payment.churchId

            const plan = await SubscriptionPlanService.findById(targetPlanId)
            if (!plan) {
              await SubscriptionPaymentService.markFailed(payment.id, 'Plan not found')
              return failProcessing('webhook.flutterwave.plan_not_found', { targetPlanId })
            }

            const subscription = await SubscriptionService.findByChurch(targetChurchId)
            if (!subscription) {
              await SubscriptionPaymentService.markFailed(payment.id, 'Subscription not found')
              return failProcessing('webhook.flutterwave.subscription_not_found', { targetChurchId })
            }

            await SubscriptionService.update(subscription.id, {
              planId: plan.id,
              status: 'ACTIVE',
            })

            await SubscriptionPaymentService.markApplied(payment.id)
            await markProcessed()

            return NextResponse.json({ received: true, subscriptionUpgraded: true })
          } catch (error: any) {
            return failProcessing('webhook.flutterwave.subscription_upgrade_error', {
              message: error?.message,
              reference: data?.tx_ref,
            })
          }
        }

        // Create giving record — idempotent on transactionId so a retried
        // webhook after partial success never double-counts a donation.
        if (meta.userId && meta.type) {
          try {
            const { UserService } = await import('@/lib/services/user-service')
            const { ProjectService } = await import('@/lib/services/giving-service')

            const existingGiving = verification.transactionId
              ? await GivingService.findByTransactionId(verification.transactionId)
              : null

            if (existingGiving) {
              await markProcessed()
              return NextResponse.json({ received: true, alreadyRecorded: true })
            }

            const user = await UserService.findById(meta.userId)
            const project = meta.projectId ? await ProjectService.findById(meta.projectId) : null

            const giving = await GivingService.create({
              userId: meta.userId,
              churchId: churchFromMeta?.id || (user as any)?.churchId,
              branchId: (user as any)?.branchId || undefined,
              amount: verification.amount || data.amount,
              currency: verification.currency || project?.currency || undefined,
              type: meta.type,
              projectId: meta.projectId || undefined,
              paymentMethod: 'Card',
              transactionId: verification.transactionId,
              notes: meta.notes || undefined,
            })

            // Send donation receipt email
            if (user) {
              let receiptUrl: string | undefined
              try {
                receiptUrl = await ReceiptService.generateUploadAndAttachDonationReceipt({
                  givingId: giving.id,
                  userId: metadata.userId,
                  userName: `${user.firstName} ${user.lastName}`,
                  userEmail: user.email,
                  amount: verification.amount || data.amount,
                  type: meta.type,
                  projectName: project?.name,
                  transactionId: verification.transactionId,
                  date: new Date(giving.createdAt),
                })
              } catch (error) {
                logger.error('webhook.flutterwave.receipt_error', {
                  correlationId,
                  transactionId,
                  message: (error as any)?.message,
                  name: (error as any)?.name,
                })
              }

              await EmailService.sendDonationReceipt(
                user.email,
                {
                  amount: verification.amount || data.amount,
                  type: meta.type,
                  projectName: project?.name,
                  transactionId: verification.transactionId,
                  date: new Date(giving.createdAt),
                  receiptUrl,
                },
                `${user.firstName} ${user.lastName}`
              )
            }
          } catch (error) {
            // Money was captured but no Giving record was written — return 5xx
            // so Flutterwave retries instead of silently losing the payment.
            return failProcessing('webhook.flutterwave.giving_or_email_error', {
              transactionId,
              message: (error as any)?.message,
              name: (error as any)?.name,
            })
          }
        }
      } else {
        // Payment verified unsuccessful — nothing to record, safe to dedupe
        logger.warn('webhook.flutterwave.verification_failed', { correlationId, transactionId })
      }
    }

    await markProcessed()
    return NextResponse.json({ received: true })
  } catch (error: any) {
    logger.error('webhook.flutterwave.error', {
      correlationId,
      message: error?.message,
      name: error?.name,
    })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}





