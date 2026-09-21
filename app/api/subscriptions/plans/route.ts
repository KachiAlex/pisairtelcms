
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { SubscriptionPlanService } from '@/lib/services/subscription-service'
import { guardApi } from '@/lib/api-guard'

export async function GET() {
  try {
    const plans = await SubscriptionPlanService.findAll()

    return NextResponse.json(plans)
  } catch (error) {
    console.error('Error fetching subscription plans:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const guarded = await guardApi({ allowedRoles: ['SUPER_ADMIN'] })
    if (!guarded.ok) return guarded.response

    const body = await request.json()
    const {
      name,
      type,
      description,
      price,
      currency,
      maxUsers,
      maxStorageGB,
      maxSermons,
      maxEvents,
      maxDepartments,
      maxGroups,
      features,
      billingCycle,
      trialDays,
    } = body

    // Validate required fields
    if (!name || !type || price === undefined) {
      return NextResponse.json(
        { error: 'Name, type, and price are required' },
        { status: 400 }
      )
    }

    const plan = await SubscriptionPlanService.create({
      name,
      type,
      description,
      price,
      currency: currency || 'USD',
      maxUsers,
      maxStorageGB,
      maxSermons,
      maxEvents,
      maxDepartments,
      maxGroups,
      features: features || [],
      billingCycle: billingCycle || 'monthly',
      trialDays: trialDays || 0,
    })

    return NextResponse.json(plan, { status: 201 })
  } catch (error) {
    console.error('Error creating subscription plan:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
