
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { getCurrentChurch } from '@/lib/church-context'
import { requirePermissionMiddleware } from '@/lib/middleware/rbac'
import { UserService } from '@/lib/services/user-service'
import { MessageService } from '@/lib/services/message-service'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request) {
  try {
    const { error: permError } = await requirePermissionMiddleware('send_broadcasts')
    if (permError) {
      return permError
    }

    const session = await getServerSession(authOptions)
    const userId = (session?.user as any).id
    const church = await getCurrentChurch(userId)

    if (!church) {
      return NextResponse.json(
        { error: 'No church selected' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { content, targetRole, targetDepartmentId, targetGroupId } = body

    if (!content) {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      )
    }

    // Get all users in church
    let targetUsers = await UserService.findByChurch(church.id)

    // Filter by role
    if (targetRole) {
      targetUsers = targetUsers.filter(user => user.role === targetRole)
    }

    // Filter by department (relational membership table)
    if (targetDepartmentId) {
      const memberships = await prisma.departmentMembership.findMany({
        where: { departmentId: targetDepartmentId, department: { churchId: church.id } },
        select: { userId: true },
      })
      const memberIds = new Set(memberships.map((m) => m.userId))
      targetUsers = targetUsers.filter(user => memberIds.has(user.id))
    }

    // Filter by group (relational membership table)
    if (targetGroupId) {
      const memberships = await prisma.groupMembership.findMany({
        where: { groupId: targetGroupId, group: { churchId: church.id } },
        select: { userId: true },
      })
      const memberIds = new Set(memberships.map((m) => m.userId))
      targetUsers = targetUsers.filter(user => memberIds.has(user.id))
    }

    // Create broadcast messages (simplified - in production, use push notifications)
    const messages = await Promise.all(
      targetUsers.map((user) =>
        MessageService.create({
          senderId: userId,
          receiverId: user.id,
          content: `[BROADCAST] ${content}`,
        })
      )
    )

    return NextResponse.json({
      success: true,
      sentTo: messages.length,
      messages: messages.length,
    })
  } catch (error: any) {
    console.error('Error broadcasting message:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
