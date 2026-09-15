
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { MessageService } from '@/lib/services/message-service'
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
    const conversationId = searchParams.get('conversationId')

    if (conversationId) {
      // Get messages for a specific conversation
      const messages = await MessageService.findByConversation(userId, conversationId, 100)

      // Mark messages as read
      await MessageService.markConversationAsRead(userId, conversationId)

      // Get user data for senders and receivers — single batched query
      const participantIds = [...new Set(messages.flatMap((m) => [m.senderId, m.receiverId]).filter(Boolean))] as string[]
      const participants = participantIds.length
        ? await prisma.user.findMany({
            where: { id: { in: participantIds } },
            select: { id: true, firstName: true, lastName: true, profileImage: true },
          })
        : []
      const participantMap = new Map(participants.map((u) => [u.id, u]))

      const messagesWithUsers = messages.map((message) => ({
        ...message,
        sender: participantMap.get(message.senderId) ?? null,
        receiver: message.receiverId ? (participantMap.get(message.receiverId) ?? null) : null,
      }))

      return NextResponse.json(messagesWithUsers)
    }

    // Get all messages (sent & received) to derive conversation list
    const allMessages = await MessageService.listUserMessages(userId)

    const partnerIds = Array.from(
      new Set(
        allMessages
          .map((message) => (message.senderId === userId ? message.receiverId : message.senderId))
          .filter((partnerId): partnerId is string => Boolean(partnerId) && partnerId !== userId)
      )
    )

    const partnerMeta = new Map<
      string,
      {
        user: Awaited<ReturnType<typeof UserService.findById>> | null
        unreadCount: number
      }
    >()

    await Promise.all(
      partnerIds.map(async (partnerId) => {
        const [user, unreadCount] = await Promise.all([
          UserService.findById(partnerId),
          MessageService.getUnreadCountFromUser(userId, partnerId),
        ])
        partnerMeta.set(partnerId, { user, unreadCount })
      })
    )

    const conversations = partnerIds
      .map((partnerId) => {
        const conversationMessages = allMessages.filter(
          (message) => message.senderId === partnerId || message.receiverId === partnerId
        )

        if (!conversationMessages.length) {
          return null
        }

        const lastMessage = conversationMessages[conversationMessages.length - 1]
        const meta = partnerMeta.get(partnerId)

        return {
          partner: meta?.user
            ? {
                id: meta.user.id,
                firstName: meta.user.firstName,
                lastName: meta.user.lastName,
                profileImage: meta.user.profileImage,
              }
            : null,
          lastMessage: {
            content: lastMessage.content,
            createdAt:
              lastMessage.createdAt instanceof Date
                ? lastMessage.createdAt.toISOString()
                : new Date(lastMessage.createdAt).toISOString(),
            senderId: lastMessage.senderId,
          },
          unreadCount: meta?.unreadCount || 0,
        }
      })
      .filter((conversation): conversation is NonNullable<typeof conversation> => Boolean(conversation))

    return NextResponse.json(conversations)
  } catch (error) {
    console.error('Error fetching messages:', error)
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
    const { receiverId, content, attachments, voiceNote } = body

    if (!receiverId) {
      return NextResponse.json(
        { error: 'Receiver ID is required' },
        { status: 400 }
      )
    }

    // Receiver must exist and belong to the sender's church
    const receiverUser = await UserService.findById(receiverId)
    const senderChurchId = (session.user as any).churchId
    if (!receiverUser || ((session.user as any).role !== 'SUPER_ADMIN' && receiverUser.churchId !== senderChurchId)) {
      return NextResponse.json({ error: 'Receiver not found' }, { status: 404 })
    }

    const trimmedContent = typeof content === 'string' ? content.trim() : ''

    const normalizedAttachments = Array.isArray(attachments)
      ? attachments
          .map((att: any) => ({
            url: typeof att?.url === 'string' ? att.url : null,
            name: typeof att?.name === 'string' ? att.name : undefined,
            contentType: typeof att?.contentType === 'string' ? att.contentType : undefined,
            size: typeof att?.size === 'number' ? att.size : undefined,
          }))
          .filter((att) => att.url)
      : []

    const normalizedVoiceNote =
      voiceNote && typeof voiceNote?.url === 'string'
        ? {
            url: voiceNote.url,
            duration: typeof voiceNote.duration === 'number' ? voiceNote.duration : undefined,
          }
        : undefined

    if (!trimmedContent && normalizedAttachments.length === 0 && !normalizedVoiceNote) {
      return NextResponse.json(
        { error: 'Message must include text, attachment, or voice note.' },
        { status: 400 }
      )
    }

    const message = await MessageService.create({
      senderId: userId,
      receiverId,
      content: trimmedContent,
      attachments: normalizedAttachments.length ? normalizedAttachments : undefined,
      voiceNote: normalizedVoiceNote,
    })

    // Get user data
    const sender = await UserService.findById(userId)
    const receiver = receiverUser

    return NextResponse.json({
      ...message,
      sender: sender ? {
        id: sender.id,
        firstName: sender.firstName,
        lastName: sender.lastName,
        profileImage: sender.profileImage,
      } : null,
      receiver: receiver ? {
        id: receiver.id,
        firstName: receiver.firstName,
        lastName: receiver.lastName,
        profileImage: receiver.profileImage,
      } : null,
    }, { status: 201 })
  } catch (error: any) {
    console.error('Error sending message:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
