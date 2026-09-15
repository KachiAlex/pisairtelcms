import { UserService } from '../services/user-service'
import { prisma } from '../prisma'
import { getSpiritualCoachingResponse } from './openai'

/**
 * Automatically assign mentor to new convert
 */
export async function assignMentorToNewConvert(userId: string) {
  try {
    const user = await UserService.findById(userId)

    if (!user || !user.churchId) {
      return null
    }

    // Get all users in church
    const churchUsers = await UserService.findByChurch(user.churchId)

    // Find potential mentors (LEADER or PASTOR)
    const potentialMentors = churchUsers.filter(u =>
      ['LEADER', 'PASTOR'].includes(u.role)
    )

    if (potentialMentors.length === 0) {
      return null
    }

    // Get active mentee counts for all potential mentors in one query
    const mentorIds = potentialMentors.map((m) => m.id)
    const counts = await prisma.mentorAssignment.groupBy({
      by: ['mentorId'],
      where: { mentorId: { in: mentorIds }, status: 'Active' },
      _count: { menteeId: true },
    })
    const countByMentor = new Map(counts.map((c) => [c.mentorId, c._count.menteeId]))

    const mentor = potentialMentors
      .map((m) => ({ ...m, menteeCount: countByMentor.get(m.id) ?? 0 }))
      .sort((a, b) => a.menteeCount - b.menteeCount)[0]

    // Check if assignment already exists
    const existing = await prisma.mentorAssignment.findUnique({
      where: { mentorId_menteeId: { mentorId: mentor.id, menteeId: userId } },
    })

    if (existing) {
      return {
        ...existing,
        mentor: {
          id: mentor.id,
          firstName: mentor.firstName,
          lastName: mentor.lastName,
          email: mentor.email,
        },
      }
    }

    // Create mentor assignment
    const assignment = await prisma.mentorAssignment.create({
      data: {
        mentorId: mentor.id,
        menteeId: userId,
        status: 'Active',
      },
    })

    return {
      ...assignment,
      mentor: {
        id: mentor.id,
        firstName: mentor.firstName,
        lastName: mentor.lastName,
        email: mentor.email,
      },
    }
  } catch (error) {
    console.error('Error assigning mentor:', error)
    return null
  }
}

/**
 * Generate daily follow-up messages for new converts
 */
export async function generateDailyFollowUp(userId: string, dayNumber: number) {
  try {
    const user = await UserService.findById(userId)

    if (!user) {
      return null
    }

    const prompts = [
      'Welcome to the family! Here\'s your first day encouragement and a Bible verse.',
      'Day 2: Let\'s talk about prayer and how to develop a prayer life.',
      'Day 3: Understanding the Bible and how to read it effectively.',
      'Day 4: The importance of fellowship and community.',
      'Day 5: Growing in faith and overcoming doubts.',
      'Day 6: Understanding God\'s love and grace.',
      'Day 7: Your first week milestone! Reflection and encouragement.',
    ]

    const prompt =
      prompts[dayNumber - 1] ||
      `Day ${dayNumber}: Continue your spiritual journey with encouragement and guidance.`

    const message = await getSpiritualCoachingResponse(
      `Generate a personalized daily follow-up message for ${user?.firstName || 'there'}, day ${dayNumber} of their journey. ${prompt}`,
      {
        userMaturity: (user as any)?.spiritualMaturity || undefined,
      }
    )

    // Extract scripture
    const scriptureMatch = message.match(/(\d+\s*[A-Za-z]+\s*\d+:\d+)/)
    const scripture = scriptureMatch ? scriptureMatch[1] : null

    return {
      message,
      scripture,
    }
  } catch (error) {
    console.error('Error generating daily follow-up:', error)
    return null
  }
}

/**
 * Schedule follow-ups for a new convert (7 days)
 */
export async function scheduleNewConvertFollowUps(userId: string) {
  try {
    const followUps = []

    for (let day = 1; day <= 7; day++) {
      const followUp = await generateDailyFollowUp(userId, day)
      if (followUp) {
        const sentAt = new Date(Date.now() + day * 24 * 60 * 60 * 1000) // Schedule for future
        const record = await prisma.followUp.create({
          data: {
            userId,
            type: 'New Convert',
            message: followUp.message,
            scripture: followUp.scripture,
            sentAt,
          },
        })
        followUps.push(record)
      }
    }

    // Assign mentor
    await assignMentorToNewConvert(userId)

    return followUps
  } catch (error) {
    console.error('Error scheduling follow-ups:', error)
    return []
  }
}
