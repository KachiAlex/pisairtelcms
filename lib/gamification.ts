import { prisma } from './prisma'
import { UserService } from './services/user-service'
import { BadgeService, UserBadgeService } from './services/badge-service'

/**
 * Award XP to a user
 */
export async function awardXP(userId: string, amount: number, reason?: string) {
  const user = await UserService.findById(userId)

  if (!user) {
    return null
  }

  const newXP = (user.xp || 0) + amount
  const newLevel = calculateLevel(newXP)

  const updated = await UserService.update(userId, {
    xp: newXP,
    level: newLevel,
  })

  // Check for level-up badges
  await checkLevelUpBadges(userId, newLevel)

  return updated
}

/**
 * Calculate level from XP
 */
export function calculateLevel(xp: number): number {
  // Level formula: level = floor(sqrt(xp / 100)) + 1
  return Math.floor(Math.sqrt(xp / 100)) + 1
}

/**
 * Check and award badges based on user activity
 */
export async function checkAndAwardBadges(userId: string) {
  const user = await UserService.findById(userId)

  if (!user) {
    return []
  }

  const awardedBadges: string[] = []
  const userBadges = await UserBadgeService.findByUser(userId)
  const existingBadgeIds = new Set(userBadges.map((b) => b.badgeId))

  // Get all counts up-front (loop-invariant)
  const [
    prayerRequestsCount,
    sermonsWatchedCount,
    givingCount,
    eventsAttendedCount,
    volunteerShiftsCount,
    completedPlansCount,
    visitorsBroughtCount,
  ] = await Promise.all([
    prisma.prayerRequest.count({ where: { userId } }),
    prisma.sermonView.count({ where: { userId } }),
    prisma.giving.count({ where: { userId } }),
    prisma.eventAttendance.count({ where: { userId } }),
    prisma.volunteerShift.count({ where: { userId } }),
    prisma.readingPlanProgress.count({ where: { userId, completed: true } }),
    prisma.user.count({
      where: {
        role: 'VISITOR',
        OR: [
          { parentId: userId },
          { firestoreData: { path: ['parentId'], equals: userId } },
        ],
      },
    }),
  ])

  // Get all badges
  const allBadges = await BadgeService.findAll()

  for (const badge of allBadges) {
    if (existingBadgeIds.has(badge.id)) {
      continue // Already has this badge
    }

    let shouldAward = false

    switch (badge.type) {
      case 'PRAYER_STREAK':
        // Check prayer streak (simplified - would need actual streak calculation)
        if (prayerRequestsCount >= 7) {
          shouldAward = true
        }
        break

      case 'READING_PLAN':
        if (completedPlansCount >= 1) {
          shouldAward = true
        }
        break

      case 'GIVING':
        if (givingCount >= 10) {
          shouldAward = true
        }
        break

      case 'EVENT_ATTENDANCE':
        if (eventsAttendedCount >= 5) {
          shouldAward = true
        }
        break

      case 'SERVING':
        if (volunteerShiftsCount >= 10) {
          shouldAward = true
        }
        break

      case 'EVANGELISM':
        // Check if user has brought visitors (simplified)
        if (visitorsBroughtCount >= 1) {
          shouldAward = true
        }
        break
    }

    if (shouldAward) {
      await UserBadgeService.create(userId, badge.id)

      // Award XP for badge
      if (badge.xpReward > 0) {
        await awardXP(userId, badge.xpReward, `Badge: ${badge.name}`)
      }

      awardedBadges.push(badge.id)
    }
  }

  return awardedBadges
}

/**
 * Check for level-up badges
 */
async function checkLevelUpBadges(userId: string, level: number) {
  const allBadges = await BadgeService.findAll()
  const levelBadges = allBadges.filter(badge => 
    badge.type === 'OTHER' && badge.name.includes('Level')
  )

  for (const badge of levelBadges) {
    const levelMatch = badge.name.match(/Level (\d+)/)
    if (levelMatch && parseInt(levelMatch[1]) === level) {
      const existing = await UserBadgeService.findByUserAndBadge(userId, badge.id)

      if (!existing) {
        await UserBadgeService.create(userId, badge.id)
      }
    }
  }
}

/**
 * Get leaderboard
 */
export async function getLeaderboard(
  churchId: string,
  type: 'global' | 'department' | 'group' | 'family' = 'global',
  filterId?: string
) {
  let users = await UserService.findByChurch(churchId, 100)

  // Filter by type
  if (type === 'department' && filterId) {
    const memberships = await prisma.departmentMembership.findMany({
      where: { departmentId: filterId },
      select: { userId: true },
    })
    const memberIds = new Set(memberships.map((m) => m.userId))
    users = users.filter((user) => memberIds.has(user.id))
  } else if (type === 'group' && filterId) {
    const memberships = await prisma.groupMembership.findMany({
      where: { groupId: filterId },
      select: { userId: true },
    })
    const memberIds = new Set(memberships.map((m) => m.userId))
    users = users.filter((user) => memberIds.has(user.id))
  } else if (type === 'family' && filterId) {
    // Filter family members
    users = users.filter(user => 
      user.parentId === filterId || 
      user.id === filterId || 
      user.spouseId === filterId
    )
  }

  // Sort by XP and get badges
  users = users.sort((a, b) => (b.xp || 0) - (a.xp || 0)).slice(0, 100)

  // Batch-load badges for all users in one query
  const userIds = users.map((u) => u.id)
  const allUserBadges = userIds.length
    ? await prisma.userBadge.findMany({
        where: { userId: { in: userIds } },
        include: { badge: true },
      })
    : []
  const badgesByUser = new Map<string, typeof allUserBadges>()
  for (const ub of allUserBadges) {
    const list = badgesByUser.get(ub.userId) || []
    list.push(ub)
    badgesByUser.set(ub.userId, list)
  }

  return users.map((user, index) => ({
    rank: index + 1,
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    profileImage: user.profileImage,
    xp: user.xp || 0,
    level: user.level || 1,
    badges: (badgesByUser.get(user.id) || []).map((ub) => ({ badge: ub.badge })),
  }))
}
