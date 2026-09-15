export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth-options'
import { getCurrentChurch } from '@/lib/church-context'
import { FlutterwaveService } from '@/lib/services/flutterwave-service'
import { UserService } from '@/lib/services/user-service'
import { ProjectService } from '@/lib/services/giving-service'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const church = await getCurrentChurch(userId)

    if (!church) {
      return NextResponse.json(
        { error: 'No church selected' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const {
      amount,
      currency = 'USD',
      type,
      projectId,
      notes,
    } = body

    if (!amount || !type) {
      return NextResponse.json(
        { error: 'Amount and type are required' },
        { status: 400 }
      )
    }

    if (amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be greater than 0' },
        { status: 400 }
      )
    }

    // Verify project if provided
    let project = null
    if (projectId) {
      project = await ProjectService.findById(projectId)
      if (!project || project.churchId !== church.id || project.status !== 'Active') {
        return NextResponse.json(
          { error: 'Project not found or inactive' },
          { status: 404 }
        )
      }
    }

    // Get user details
    const user = await UserService.findById(userId)
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Generate unique transaction reference
    const txRef = FlutterwaveService.generateTransactionRef()

    // Initiate payment with Flutterwave
    const redirectUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/giving/donate/verify?txRef=${txRef}`

    const paymentResult = await FlutterwaveService.initiatePayment({
      amount,
      email: user.email,
      phone: user.phone,
      fullName: `${user.firstName} ${user.lastName}`,
      currency,
      txRef,
      redirectUrl,
      meta: {
        userId,
        churchId: church.id,
        type,
        projectId: projectId || null,
        notes: notes || '',
      },
    })

    if (!paymentResult.success) {
      return NextResponse.json(
        { error: paymentResult.error || 'Failed to initiate payment' },
        { status: 400 }
      )
    }

    // Store pending donation details for webhook processing
    // This will be matched when webhook arrives with same txRef
    await prisma.pendingDonation.upsert({
      where: { txRef },
      create: {
        txRef,
        userId,
        churchId: church.id,
        amount,
        currency,
        type,
        projectId: projectId || null,
        notes: notes || null,
        status: 'pending',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
      },
      update: {
        userId,
        churchId: church.id,
        amount,
        currency,
        type,
        projectId: projectId || null,
        notes: notes || null,
        status: 'pending',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      },
    })

    return NextResponse.json({
      success: true,
      paymentLink: paymentResult.link,
      txRef,
      message: 'Redirecting to payment page...',
    })
  } catch (error: any) {
    console.error('Error initiating payment:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
