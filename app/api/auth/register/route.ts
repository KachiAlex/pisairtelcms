
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { UserService } from '@/lib/services/user-service'
import { ChurchService, generateSlug } from '@/lib/services/church-service'
import { SubscriptionPlanService, SubscriptionService } from '@/lib/services/subscription-service'
import { LICENSING_PLANS, getPlanConfig, recommendPlan } from '@/lib/licensing/plans'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      firstName,
      lastName,
      email,
      password,
      churchName,
      city,
      country,
      estimatedMembers,
      planId,
      slug: requestedSlugRaw,
    } = body

    // Validate required fields
    if (!firstName || !lastName || !email || !password || !churchName) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      )
    }

    if (typeof password !== 'string' || password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
        { status: 400 }
      )
    }

    // Check if user already exists
    const existingUser = await UserService.findByEmail(email)
    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 400 }
      )
    }

    // Generate or validate slug
    let slug: string
    const requestedSlug = typeof requestedSlugRaw === 'string' && requestedSlugRaw.trim().length > 0
      ? generateSlug(requestedSlugRaw)
      : null

    if (requestedSlug) {
      const existingChurch = await ChurchService.findBySlug(requestedSlug)
      if (existingChurch) {
        return NextResponse.json(
          { error: 'Slug already in use. Please choose another.' },
          { status: 400 }
        )
      }
      slug = requestedSlug
    } else {
      let baseSlug = generateSlug(churchName)
      let uniqueSlug = baseSlug
      let counter = 1

      while (true) {
        const existingChurch = await ChurchService.findBySlug(uniqueSlug)
        if (!existingChurch) break
        uniqueSlug = `${baseSlug}-${counter}`
        counter++
      }

      slug = uniqueSlug
    }

    // Determine plan selection
    const numericMembers = typeof estimatedMembers === 'number' ? estimatedMembers : undefined
    const preferredPlanConfig =
      getPlanConfig(planId) ??
      recommendPlan({
        memberCount: numericMembers,
      }) ??
      LICENSING_PLANS[0]

    const selectedPlan =
      (preferredPlanConfig && (await SubscriptionPlanService.ensurePlanFromConfig(preferredPlanConfig))) ??
      (await SubscriptionPlanService.create({
        name: 'Free',
        code: 'free',
        type: 'FREE',
        description: 'Free plan with basic features',
        price: 0,
        currency: 'USD',
        maxUsers: 50,
        maxStorageGB: 5,
        maxSermons: 20,
        maxEvents: 10,
        maxDepartments: 5,
        maxGroups: 10,
        features: ['Basic Features'],
        billingCycle: 'monthly',
        trialDays: 30,
      }))

    // Create church
    const church = await ChurchService.create({
      name: churchName,
      slug,
      city: city || undefined,
      country: country || undefined,
      preferredPlanId: selectedPlan.id,
      estimatedMembers: numericMembers,
    })

    // Create user with ADMIN role
    const user = await UserService.create({
      firstName,
      lastName,
      email,
      password,
      role: 'ADMIN',
      churchId: church.id,
    })

    // Update church with owner
    await ChurchService.update(church.id, {
      ownerId: user.id,
    })

    // Create subscription with 30-day trial
    const now = new Date()
    const trialEndsAt = new Date(now)
    trialEndsAt.setDate(trialEndsAt.getDate() + 30)

    const subscription = await SubscriptionService.create({
      churchId: church.id,
      planId: selectedPlan.id,
      status: 'TRIAL',
      startDate: now,
      endDate: trialEndsAt,
      trialEndsAt: trialEndsAt,
    })

    // Update church with subscription ID
    await ChurchService.update(church.id, {
      subscriptionId: subscription.id,
    })

    // Return success response (don't return sensitive data)
    return NextResponse.json(
      {
        success: true,
        message: 'Church and account created successfully',
        churchId: church.id,
        userId: user.id,
        planId: selectedPlan.id,
        trialEndsAt: trialEndsAt.toISOString(),
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Registration error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to create account. Please try again.' },
      { status: 500 }
    )
  }
}
