
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { PostService } from '@/lib/services/post-service'
import { UserService } from '@/lib/services/user-service'
import { getCurrentChurch } from '@/lib/church-context'
import { prisma } from '@/lib/prisma'

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const church = await getCurrentChurch(userId)

    if (!church) {
      return NextResponse.json(
        { error: 'No church selected' },
        { status: 400 }
      )
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    // Get posts
    let posts = await PostService.findByChurch(church.id, limit)

    // Filter by type if provided
    if (type) {
      posts = posts.filter(post => post.type === type)
    }

    // Batch-fetch related data (users, like status) in single queries
    const postIds = posts.map((p) => p.id)
    const userIds = [...new Set(posts.map((p) => p.userId))]

    const [users, myLikes, total] = await Promise.all([
      userIds.length > 0
        ? prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, firstName: true, lastName: true, profileImage: true },
          })
        : Promise.resolve([]),
      postIds.length > 0
        ? prisma.postLike.findMany({
            where: { userId, postId: { in: postIds } },
            select: { postId: true },
          })
        : Promise.resolve([]),
      prisma.post.count({ where: { churchId: church.id } }),
    ])

    const userMap = new Map(users.map((u) => [u.id, u]))
    const likedSet = new Set(myLikes.map((l) => l.postId))

    const postsWithDetails = posts.map((post) => {
      const user = userMap.get(post.userId)
      return {
        ...post,
        user: user ? {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          profileImage: user.profileImage,
        } : null,
        isLiked: likedSet.has(post.id),
        _count: {
          likes: post.likes,
          comments: post.commentsCount,
        },
      }
    })

    return NextResponse.json({
      posts: postsWithDetails,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Error fetching posts:', error)
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
    const church = await getCurrentChurch(userId)

    if (!church) {
      return NextResponse.json(
        { error: 'No church selected' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { content, type, images } = body

    if (!content || !type) {
      return NextResponse.json(
        { error: 'Content and type are required' },
        { status: 400 }
      )
    }

    const post = await PostService.create({
      userId,
      churchId: church.id,
      content,
      type,
      imageUrl: images && images.length > 0 ? images[0] : undefined,
    })

    // Get user data
    const user = await UserService.findById(userId)

    return NextResponse.json({
      ...post,
      user: user ? {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        profileImage: user.profileImage,
      } : null,
      _count: {
        likes: 0,
        comments: 0,
      },
    }, { status: 201 })
  } catch (error: any) {
    console.error('Error creating post:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
