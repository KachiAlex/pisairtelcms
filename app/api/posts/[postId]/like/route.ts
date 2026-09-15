
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth-options'
import { PostService } from '@/lib/services/post-service'

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

    const result = await PostService.toggleLike(postId, userId)
    return NextResponse.json({ liked: result.liked, likes: result.likes })
  } catch (error: any) {
    console.error('Error toggling like:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
