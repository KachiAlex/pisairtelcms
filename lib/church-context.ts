import { cookies } from 'next/headers'
import { ChurchService } from './services/church-service'
import { UserService } from './services/user-service'
import { prisma } from './prisma'
import { logger } from '@/lib/logger'

const CHURCH_COOKIE_NAME = 'pi_cms_church_id'

/**
 * Get the current church ID from cookies or user's default church
 */
export async function getCurrentChurchId(userId?: string): Promise<string | null> {
  const cookieStore = await cookies()
  const churchIdFromCookie = cookieStore.get(CHURCH_COOKIE_NAME)?.value

  // Resolve the user first — the cookie is client-controlled and must never
  // grant access to a church the user does not belong to.
  const user = userId ? await UserService.findById(userId) : null
  const isSuperAdmin = user?.role === 'SUPER_ADMIN'

  if (churchIdFromCookie) {
    const cookieAllowed =
      isSuperAdmin || (user !== null && user.churchId === churchIdFromCookie)

    if (cookieAllowed) {
      // Verify church exists
      const church = await ChurchService.findById(churchIdFromCookie)
      if (church) {
        logger.info('tenant.current_church.from_cookie', { userId, churchId: churchIdFromCookie })
        return churchIdFromCookie
      }
    } else {
      logger.warn('tenant.current_church.cookie_mismatch', {
        userId,
        cookieChurchId: churchIdFromCookie,
        userChurchId: user?.churchId,
      })
    }
  }

  // If no cookie or invalid, try user's default church
  if (user?.churchId) {
    logger.info('tenant.current_church.from_user_default', { userId, churchId: user.churchId })
    return user.churchId
  }

  return null
}

/**
 * Set the current church ID in cookies
 */
export async function setCurrentChurchId(churchId: string) {
  const cookieStore = await cookies()
  cookieStore.set(CHURCH_COOKIE_NAME, churchId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  })
}

/**
 * Get current church with subscription info
 */
const serialize = <T>(value: T): T => {
  if (value === null || value === undefined) {
    return value
  }
  return JSON.parse(JSON.stringify(value))
}

export async function getCurrentChurch(userId?: string) {
  const churchId = await getCurrentChurchId(userId)
  if (!churchId) {
    return null
  }

  const church = await ChurchService.findById(churchId)
  if (!church) return null

  try {
    // Get subscription with plan (Prisma: churchId is unique on Subscription)
    const subscriptionRecord = await prisma.subscription.findUnique({
      where: { churchId },
      include: { plan: true },
    })

    const subscription = subscriptionRecord
      ? {
          ...subscriptionRecord,
          // Normalize to the legacy API shape used across the app
          startDate: subscriptionRecord.currentPeriodStart,
          endDate: subscriptionRecord.currentPeriodEnd,
          trialEndsAt: subscriptionRecord.trialEnd,
          plan: subscriptionRecord.plan ?? null,
        }
      : null

    return serialize({
      ...church,
      subscription,
    })
  } catch (error) {
    logger.error('tenant.current_church.subscription_fetch_failed', { error })
    return serialize({
      ...church,
      subscription: null,
    })
  }
}

