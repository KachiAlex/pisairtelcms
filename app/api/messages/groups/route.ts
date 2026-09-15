
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { getCurrentChurch } from '@/lib/church-context'
import { GroupMessageService } from '@/lib/services/message-service'
import { GroupMembershipService } from '@/lib/services/group-service'
import { UserService } from '@/lib/services/user-service'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const { searchParams } = new URL(request.url)
    const groupId = searchParams.get('groupId')

    if (!groupId) {
      return NextResponse.json(
        { error: 'Group ID is required' },
        { status: 400 }
      )
    }

    // Verify user is member of group
    const membership = await GroupMembershipService.findByUserAndGroup(userId, groupId)

    if (!membership) {
      return NextResponse.json(
        { error: 'Not a member of this group' },
        { status: 403 }
      )
    }

    const messages = await GroupMessageService.findByGroup(groupId, 100)

    // Add user info to messages — single batched query
    const authorIds = [...new Set(messages.map((m) => m.userId).filter(Boolean))] as string[]
    const authors = authorIds.length
      ? await prisma.user.findMany({
          where: { id: { in: authorIds } },
          select: { id: true, firstName: true, lastName: true, profileImage: true },
        })
      : []
    const authorMap = new Map(authors.map((u) => [u.id, u]))

    const messagesWithUsers = messages.map((message) => ({
      ...message,
      user: authorMap.get(message.userId) ?? null,
    }))

    return NextResponse.json(messagesWithUsers)
  } catch (error) {
    console.error('Error fetching group messages:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const body = await request.json()
    const { groupId, content } = body

    if (!groupId || !content) {
      return NextResponse.json(
        { error: 'Group ID and content are required' },
        { status: 400 }
      )
    }

    // Verify user is member
    const membership = await GroupMembershipService.findByUserAndGroup(userId, groupId)

    if (!membership) {
      return NextResponse.json(
        { error: 'Not a member of this group' },
        { status: 403 }
      )
    }

    const message = await GroupMessageService.create({
      userId,
      groupId,
      content,
    })

    // Add user info
    const user = await UserService.findById(userId)
    const messageWithUser = {
      ...message,
      user: user ? {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        profileImage: user.profileImage,
      } : null,
    }

    return NextResponse.json(messageWithUser, { status: 201 })
  } catch (error: any) {
    console.error('Error sending group message:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
