
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'

export async function POST(
  _: Request,
  { params }: { params: { postId: string; commentId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const { postId, commentId } = params

    // Ensure comment belongs to post
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: { id: true, postId: true },
    })
    if (!comment || comment.postId !== postId) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
    }

    const existing = await prisma.commentLike.findUnique({
      where: { commentId_userId: { commentId, userId } },
    })

    if (existing) {
      await prisma.commentLike.delete({ where: { id: existing.id } })
      return NextResponse.json({ liked: false })
    }

    await prisma.commentLike.create({ data: { commentId, userId } })
    return NextResponse.json({ liked: true })
  } catch (error: any) {
    console.error('Error toggling comment like:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
