export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { FlutterwaveService } from '@/lib/services/flutterwave-service'
import { GivingService, ProjectService } from '@/lib/services/giving-service'
import { UserService } from '@/lib/services/user-service'
import { ReceiptService } from '@/lib/services/receipt-service'
import { EmailService } from '@/lib/services/email-service'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)

    // Flutterwave redirects with transaction_id and status
    // Some configurations might use txRef or other identifiers
    const transactionId = searchParams.get('transaction_id') || searchParams.get('id')
    const status = searchParams.get('status')
    const txRef = searchParams.get('txRef')

    if (!transactionId && !txRef) {
      return NextResponse.redirect(
        new URL('/giving?error=no_transaction_id', request.url)
      )
    }

    // If we have txRef from our pending donations, use that
    let paymentData
    let pendingData
    let pendingTxRef: string | undefined

    if (txRef) {
      // Get pending donation details from txRef
      const pending = await prisma.pendingDonation.findUnique({
        where: { txRef },
      })

      if (!pending) {
        return NextResponse.redirect(
          new URL('/giving?error=donation_not_found', request.url)
        )
      }

      pendingData = pending as any
      pendingTxRef = pending.txRef

      // Verify transaction status with Flutterwave
      if (pendingData.flwRef) {
        const verification = await FlutterwaveService.verifyPayment(pendingData.flwRef)
        if (!verification.success || !verification.data) {
          return NextResponse.redirect(
            new URL(`/giving?error=payment_verification_failed`, request.url)
          )
        }
        paymentData = verification.data
      } else if (transactionId) {
        // Try to verify with transaction ID
        const verification = await FlutterwaveService.verifyPayment(transactionId)
        if (!verification.success || !verification.data) {
          return NextResponse.redirect(
            new URL(`/giving?error=payment_verification_failed`, request.url)
          )
        }
        paymentData = verification.data
      }
    } else if (transactionId) {
      // Verify payment with Flutterwave using transaction ID
      const verification = await FlutterwaveService.verifyPayment(transactionId)

      if (!verification.success || !verification.data) {
        return NextResponse.redirect(
          new URL(`/giving?error=payment_verification_failed`, request.url)
        )
      }

      paymentData = verification.data

      // Get pending donation details from txRef in payment data
      if (paymentData.txRef) {
        const pending = await prisma.pendingDonation.findUnique({
          where: { txRef: paymentData.txRef },
        })

        if (pending) {
          pendingData = pending as any
          pendingTxRef = pending.txRef
        }
      }
    }

    // Check if payment was successful
    if (!paymentData || paymentData.status !== 'successful') {
      return NextResponse.redirect(
        new URL(
          `/giving?error=payment_failed&status=${paymentData?.status || 'unknown'}`,
          request.url
        )
      )
    }

    // If no pending data found, cannot process
    if (!pendingData) {
      return NextResponse.redirect(
        new URL('/giving?error=donation_not_found', request.url)
      )
    }

    const { userId, churchId, amount, currency, type, projectId, notes } =
      pendingData

    // Get user and church
    const user = await UserService.findById(userId)
    const churchRecord = await prisma.church.findUnique({
      where: { id: churchId },
      select: { id: true, name: true },
    })
    const church = churchRecord || ({ id: churchId } as any)

    let project = null
    if (projectId) {
      project = await ProjectService.findById(projectId)
    }

    // Create giving record (check for duplicate)
    let giving = await GivingService.findByTransactionId(paymentData.flwRef || transactionId || '')
    if (!giving) {
      giving = await GivingService.create({
        userId,
        churchId,
        branchId: user?.branchId,
        amount,
        currency,
        type,
        projectId: projectId || undefined,
        paymentMethod: 'flutterwave',
        transactionId: paymentData.flwRef || transactionId || undefined,
        notes: notes || undefined,
      })
    }

    // Generate receipt
    let receiptUrl: string | undefined
    try {
      receiptUrl = await ReceiptService.generateUploadAndAttachDonationReceipt({
        givingId: giving.id,
        userId,
        userName: user ? `${user.firstName} ${user.lastName}` : undefined,
        userEmail: user?.email,
        amount,
        type,
        projectName: project?.name,
        transactionId: paymentData.flwRef || transactionId || undefined,
        date: new Date(),
        churchName: church?.name,
      })
    } catch (error) {
      console.error('Error generating receipt:', error)
    }

    // Send receipt email
    if (user) {
      try {
        await EmailService.sendDonationReceipt(
          user.email,
          {
            amount,
            type,
            projectName: project?.name,
            transactionId: paymentData.flwRef || transactionId || undefined,
            date: new Date(),
            receiptUrl,
          },
          `${user.firstName} ${user.lastName}`
        )
      } catch (error) {
        console.error('Error sending receipt email:', error)
      }
    }

    // Mark pending donation as processed
    if (pendingTxRef) {
      await prisma.pendingDonation.update({
        where: { txRef: pendingTxRef },
        data: {
          status: 'completed',
          givingId: giving.id,
          processedAt: new Date(),
        },
      })
    }

    // Redirect to success page
    return NextResponse.redirect(
      new URL(
        `/giving?success=true&amount=${amount}&project=${project?.name || type}`,
        request.url
      )
    )
  } catch (error: any) {
    console.error('Error verifying payment:', error)
    return NextResponse.redirect(
      new URL(
        `/giving?error=verification_error&message=${encodeURIComponent(
          error.message
        )}`,
        request.url
      )
    )
  }
}
