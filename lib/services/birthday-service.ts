import { prisma } from '@/lib/prisma'
import { AIAssistantService } from '@/lib/services/ai-assistant-service'
import { NotificationService } from '@/lib/services/notification-service'

/**
 * Daily birthday announcements.
 *
 * For every member whose birthday is today:
 *  1. A celebration post is published to the church community feed so members
 *     can like/comment ("everyone can celebrate them").
 *  2. A BIRTHDAY notification is broadcast to all church members.
 *  3. A personal notification goes to the member.
 *
 * Idempotent per (member, calendar year) via a metadata marker on the
 * broadcast notification — safe for a daily cron to re-run.
 */
export class BirthdayService {
  static async announceTodaysBirthdays(): Promise<{
    churchesProcessed: number
    birthdaysAnnounced: number
    skippedDuplicates: number
  }> {
    const today = new Date()
    const year = today.getFullYear()

    const churches = await prisma.church.findMany({ select: { id: true, name: true } })

    let announced = 0
    let skipped = 0

    for (const church of churches) {
      const alerts = await AIAssistantService.getUpcomingBirthdays(church.id, 0)
      const todays = alerts.filter((a) => a.daysUntilBirthday === 0)
      if (!todays.length) continue

      const memberIds = (
        await prisma.user.findMany({ where: { churchId: church.id }, select: { id: true } })
      ).map((u) => u.id)

      // Celebration posts are attributed to a church leader so they read as
      // official announcements rather than messages the member never wrote.
      const author =
        (await prisma.user.findFirst({
          where: { churchId: church.id, role: { in: ['ADMIN', 'SUPER_ADMIN', 'PASTOR'] } },
          select: { id: true },
        })) || null

      for (const alert of todays) {
        const fullName = `${alert.firstName} ${alert.lastName}`.trim()

        const existing = await prisma.notification.findFirst({
          where: {
            churchId: church.id,
            type: 'BIRTHDAY',
            AND: [
              { metadata: { path: ['birthdayUserId'], equals: alert.userId } },
              { metadata: { path: ['year'], equals: year } },
            ],
          },
          select: { id: true },
        })
        if (existing) {
          skipped++
          continue
        }

        const post = await prisma.post.create({
          data: {
            userId: author?.id || alert.userId,
            churchId: church.id,
            type: 'Announcement',
            content:
              `🎉 Happy Birthday, ${fullName}! 🎂\n\n` +
              `Today we celebrate ${alert.firstName} — may this new year of life overflow with ` +
              `joy, good health, and God's blessings. Drop a birthday wish below! 👇🎈`,
            images: [],
          },
          select: { id: true },
        })

        const broadcastTo = memberIds.filter((id) => id !== alert.userId)
        await NotificationService.broadcast(
          {
            churchId: church.id,
            type: 'BIRTHDAY',
            title: `🎂 It's ${alert.firstName}'s birthday today!`,
            message: `Join us in celebrating ${fullName} — tap to leave a birthday wish.`,
            actionUrl: '/community',
            actionLabel: 'Celebrate',
            icon: '🎂',
            metadata: {
              birthdayUserId: alert.userId,
              year,
              ageTurning: alert.ageTurning,
              postId: post.id,
            },
          },
          broadcastTo,
        )

        await NotificationService.sendNotification({
          churchId: church.id,
          userId: alert.userId,
          type: 'BIRTHDAY',
          title: `Happy Birthday, ${alert.firstName}! 🎉`,
          message: `Your ${church.name} family is celebrating you today. Have a wonderful year ahead!`,
          actionUrl: '/community',
          actionLabel: 'See the love',
          icon: '🎉',
          metadata: { birthdayUserId: alert.userId, year, self: true, postId: post.id },
        })

        announced++
      }
    }

    return { churchesProcessed: churches.length, birthdaysAnnounced: announced, skippedDuplicates: skipped }
  }
}
