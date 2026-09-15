import { NextResponse } from 'next/server'
import { ChurchService } from '@/lib/services/church-service'
import { SubscriptionService, SubscriptionPlanService } from '@/lib/services/subscription-service'
import { prisma } from '@/lib/prisma'
import { guardApi } from '@/lib/api-guard'
import { getPlanConfig, recommendPlan } from '@/lib/licensing/plans'
import { UserService } from '@/lib/services/user-service'
import { SubscriptionPricingService } from '@/lib/services/subscription-pricing-service'

export const dynamic = 'force-dynamic'

const serializeDate = (value: any) => {
  if (!value) return value
  if (value instanceof Date) return value.toISOString()
  if (typeof value?.toDate === 'function') return value.toDate().toISOString()
  return value
}

// GET - Get church details with subscription info
export async function GET(
  request: Request,
  { params }: { params: { churchId: string } }
) {
  try {
    const { churchId } = params
    const guarded = await guardApi({ allowedRoles: ['SUPER_ADMIN'] })
    if (!guarded.ok) return guarded.response

    const church = await ChurchService.findById(churchId)
    if (!church) {
      return NextResponse.json({ error: 'Church not found' }, { status: 404 })
    }

    // Get subscription
    const subscription = await SubscriptionService.findByChurch(churchId)
    let plan = null
    if (subscription?.planId) {
      plan = await SubscriptionPlanService.findById(subscription.planId)
    }
    const availablePlans = await SubscriptionPlanService.findAll()

    // Get user count and tenant admins
    const churchUsers = await prisma.user.findMany({
      where: { churchId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        branchId: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
      },
    })
    const userCount = churchUsers.length
    const adminRoles = ['ADMIN', 'PASTOR']
    const tenantAdmins = churchUsers
      .map((user) => ({
        ...user,
        createdAt: serializeDate(user.createdAt),
        updatedAt: serializeDate(user.updatedAt),
        lastLoginAt: serializeDate(user.lastLoginAt),
      }))
      .filter((user: any) => adminRoles.includes(user.role))

    const planOverrides = await SubscriptionPricingService.listOverridesForChurch(churchId)

    const churchForClient = {
      ...church,
      createdAt: serializeDate(church.createdAt),
      updatedAt: serializeDate(church.updatedAt),
    }

    const subscriptionForClient = subscription
      ? {
          ...subscription,
          startDate: serializeDate(subscription.startDate),
          endDate: serializeDate(subscription.endDate),
          trialEndsAt: serializeDate(subscription.trialEndsAt),
          createdAt: serializeDate(subscription.createdAt),
          updatedAt: serializeDate(subscription.updatedAt),
        }
      : null

    const planForClient = plan
      ? {
          ...plan,
          createdAt: serializeDate(plan.createdAt),
          updatedAt: serializeDate(plan.updatedAt),
        }
      : null

    const plansForClient = availablePlans.map((p) => ({
      ...p,
      createdAt: serializeDate(p.createdAt),
      updatedAt: serializeDate(p.updatedAt),
    }))

    const planOverridesForClient = planOverrides.map((override) => ({
      ...override,
      createdAt: serializeDate(override.createdAt),
      updatedAt: serializeDate(override.updatedAt),
      expiresAt: serializeDate(override.expiresAt),
    }))

    const planMeta = planForClient
      ? getPlanConfig(planForClient.id)
      : getPlanConfig(church.preferredPlanId)
    const recommendedPlanMeta = recommendPlan({ memberCount: church.estimatedMembers })

    return NextResponse.json({
      church: churchForClient,
      subscription: subscriptionForClient,
      plan: planForClient,
      availablePlans: plansForClient,
      userCount,
      planMeta,
      recommendedPlanMeta,
      tenantAdmins,
      planOverrides: planOverridesForClient,
    })
  } catch (error) {
    console.error('Error fetching church:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT - Update church or subscription
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ churchId: string }> }
) {
  try {
    const { churchId } = await params
    const guarded = await guardApi({ allowedRoles: ['SUPER_ADMIN'] })
    if (!guarded.ok) return guarded.response
    const body = await request.json()
    const { action, ...data } = body

    const church = await ChurchService.findById(churchId)
    if (!church) {
      return NextResponse.json({ error: 'Church not found' }, { status: 404 })
    }

    // Handle different actions
    switch (action) {
      case 'update_church':
        // Update church details
        const updatedChurch = await ChurchService.update(churchId, data)
        return NextResponse.json({ church: updatedChurch })

      case 'extend_trial':
        // Extend trial period
        const subscription = await SubscriptionService.findByChurch(churchId)
        if (!subscription) {
          return NextResponse.json(
            { error: 'Subscription not found' },
            { status: 404 }
          )
        }

        const daysToAdd = data.days || 30
        const currentEndDate = subscription.trialEndsAt || subscription.endDate || new Date()
        const newEndDate = new Date(currentEndDate)
        newEndDate.setDate(newEndDate.getDate() + daysToAdd)

        await SubscriptionService.update(subscription.id, {
          trialEndsAt: newEndDate,
          endDate: newEndDate,
        })

        const updatedSub = await SubscriptionService.findByChurch(churchId)
        return NextResponse.json({
          subscription: updatedSub,
          message: `Trial extended by ${daysToAdd} days`,
        })

      case 'change_plan':
        // Change subscription plan
        const { planId } = data
        if (!planId) {
          return NextResponse.json(
            { error: 'Plan ID is required' },
            { status: 400 }
          )
        }

        const plan = await SubscriptionPlanService.findById(planId)
        if (!plan) {
          return NextResponse.json({ error: 'Plan not found' }, { status: 404 })
        }

        const currentSub = await SubscriptionService.findByChurch(churchId)
        if (!currentSub) {
          return NextResponse.json(
            { error: 'Subscription not found' },
            { status: 404 }
          )
        }

        // Update plan
        await SubscriptionService.update(currentSub.id, { planId })

        const updatedSubscription = await SubscriptionService.findByChurch(churchId)
        return NextResponse.json({
          subscription: updatedSubscription,
          plan,
          message: 'Plan updated successfully',
        })

      case 'update_status':
        // Update subscription status (ACTIVE, TRIAL, EXPIRED, CANCELLED, SUSPENDED)
        const { status } = data
        if (!status) {
          return NextResponse.json(
            { error: 'Status is required' },
            { status: 400 }
          )
        }

        const sub = await SubscriptionService.findByChurch(churchId)
        if (!sub) {
          return NextResponse.json(
            { error: 'Subscription not found' },
            { status: 404 }
          )
        }

        await SubscriptionService.update(sub.id, { status: status as any })

        const updated = await SubscriptionService.findByChurch(churchId)
        return NextResponse.json({
          subscription: updated,
          message: `Subscription status updated to ${status}`,
        })

      case 'update_admin': {
        const { adminId, firstName, lastName, email, phone, role } = data
        if (!adminId) {
          return NextResponse.json({ error: 'adminId is required' }, { status: 400 })
        }

        const admin = await UserService.findById(adminId)
        if (!admin || admin.churchId !== churchId) {
          return NextResponse.json({ error: 'Admin not found for this church' }, { status: 404 })
        }

        const updatePayload: any = {}
        if (firstName !== undefined) updatePayload.firstName = firstName
        if (lastName !== undefined) updatePayload.lastName = lastName
        if (email !== undefined) updatePayload.email = email
        if (phone !== undefined) updatePayload.phone = phone
        if (role !== undefined) updatePayload.role = role

        const updatedAdmin = await UserService.update(adminId, updatePayload)
        const { password, ...adminWithoutPassword } = updatedAdmin

        return NextResponse.json({
          admin: {
            ...adminWithoutPassword,
            createdAt: adminWithoutPassword.createdAt?.toISOString?.() ?? adminWithoutPassword.createdAt,
            updatedAt: adminWithoutPassword.updatedAt?.toISOString?.() ?? adminWithoutPassword.updatedAt,
            lastLoginAt: adminWithoutPassword.lastLoginAt?.toISOString?.() ?? adminWithoutPassword.lastLoginAt,
          },
          message: 'Admin profile updated',
        })
      }

      case 'reset_admin_password': {
        const { adminId, password: newPassword } = data
        if (!adminId || !newPassword) {
          return NextResponse.json({ error: 'adminId and password are required' }, { status: 400 })
        }
        if (typeof newPassword !== 'string' || newPassword.length < 8) {
          return NextResponse.json(
            { error: 'Password must be at least 8 characters long' },
            { status: 400 }
          )
        }

        const admin = await UserService.findById(adminId)
        if (!admin || admin.churchId !== churchId) {
          return NextResponse.json({ error: 'Admin not found for this church' }, { status: 404 })
        }

        await UserService.update(adminId, { password: newPassword })
        return NextResponse.json({
          message:
            'Password updated. Let the tenant admin know they can personalize it later from Settings → Account.',
        })
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }
  } catch (error: any) {
    console.error('Error updating church:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - Suspend/delete church (soft delete by suspending subscription)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ churchId: string }> }
) {
  try {
    const { churchId } = await params
    const guarded = await guardApi({ allowedRoles: ['SUPER_ADMIN'] })
    if (!guarded.ok) return guarded.response
    const subscription = await SubscriptionService.findByChurch(churchId)

    if (subscription) {
      // Suspend subscription instead of deleting
      await SubscriptionService.update(subscription.id, { status: 'SUSPENDED' as any })
    }

    return NextResponse.json({
      message: 'Church subscription suspended',
    })
  } catch (error) {
    console.error('Error suspending church:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

