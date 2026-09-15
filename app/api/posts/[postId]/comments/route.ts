
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth-options'
import { CommentService } from '@/lib/services/comment-service'
import { UserService } from '@/lib/services/user-service'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: Request,
  { params }: { params: { postId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id

    const { postId } = params

    const comments = await CommentService.findByPost(postId)

    // Batch-fetch users, like status and like counts in single queries
    const commentIds = comments.map((c) => c.id)
    const userIds = [...new Set(comments.map((c) => c.userId))]

    const [users, myLikes, likeCounts] = await Promise.all([
      userIds.length > 0
        ? prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, firstName: true, lastName: true, profileImage: true },
          })
        : Promise.resolve([]),
      commentIds.length > 0
        ? prisma.commentLike.findMany({
            where: { userId, commentId: { in: commentIds } },
            select: { commentId: true },
          })
        : Promise.resolve([]),
      commentIds.length > 0
        ? prisma.commentLike.groupBy({
            by: ['commentId'],
            where: { commentId: { in: commentIds } },
            _count: { _all: true },
          })
        : Promise.resolve([]),
    ])

    const userMap = new Map(users.map((u) => [u.id, u]))
    const likedSet = new Set(myLikes.map((l) => l.commentId))
    const countMap = new Map(likeCounts.map((c) => [c.commentId, c._count._all]))

    const commentsWithUsers = comments.map((comment) => {
      const user = userMap.get(comment.userId)
      return {
        ...comment,
        user: user ? {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          profileImage: user.profileImage,
        } : null,
        isLiked: likedSet.has(comment.id),
        _count: {
          likes: countMap.get(comment.id) || 0,
        },
      }
    })

    return NextResponse.json(commentsWithUsers)
  } catch (error) {
    console.error('Error fetching comments:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: Request,
  { params }: { params: { postId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const { postId } = params
    const body = await request.json()
    const { content, parentCommentId } = body

    if (!content) {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      )
    }

    const comment = await CommentService.create({
      userId,
      postId,
      content,
      parentCommentId: parentCommentId ? String(parentCommentId) : undefined,
    })

    // Get user data
    const user = await UserService.findById(userId)

    return NextResponse.json({
      ...comment,
      user: user ? {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        profileImage: user.profileImage,
      } : null,
      isLiked: false,
      _count: {
        likes: 0,
      },
    }, { status: 201 })
  } catch (error: any) {
    console.error('Error creating comment:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
