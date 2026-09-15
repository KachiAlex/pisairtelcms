
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { PaymentService } from '@/lib/services/payment-service'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { reference } = body

    if (!reference) {
      return NextResponse.json(
        { error: 'Payment reference is required' },
        { status: 400 }
      )
    }

    // Verify payment
    const result = await PaymentService.verifyPayment(reference)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Payment verification failed' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      transactionId: result.transactionId,
      amount: result.amount,
      currency: result.currency,
      status: result.status,
    })
  } catch (error: any) {
    console.error('Error verifying payment:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}





