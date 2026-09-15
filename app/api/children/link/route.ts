
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { getCurrentChurch } from '@/lib/church-context'
import { UserService } from '@/lib/services/user-service'

const PRIVILEGED_ROLES = ['ADMIN', 'SUPER_ADMIN', 'PASTOR', 'BRANCH_ADMIN', 'LEADER']

async function resolveContext() {
  const session = await getServerSession(authOptions)
  if (!session) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  const userId = (session.user as any).id
  const userRole = (session.user as any).role
  const church = await getCurrentChurch(userId)
  if (!church) {
    return { error: NextResponse.json({ error: 'No church selected' }, { status: 400 }) }
  }
  return { userId, userRole, church }
}

async function wouldCreateCycle(childId: string, parentId: string): Promise<boolean> {
  // Walk the parent's ancestry; if we reach the child, linking would create a cycle
  let cursor: string | null | undefined = parentId
  let hops = 0
  while (cursor && hops < 25) {
    if (cursor === childId) return true
    const ancestor = await UserService.findById(cursor)
    cursor = ancestor?.parentId ?? null
    hops += 1
  }
  return false
}

export async function POST(request: Request) {
  try {
    const context = await resolveContext()
    if ('error' in context) return context.error
    const { userId, userRole, church } = context

    const body = await request.json()
    const { childId } = body
    const parentId = body.parentId || userId

    if (!childId || typeof childId !== 'string') {
      return NextResponse.json({ error: 'childId is required' }, { status: 400 })
    }

    // Only privileged users may link children to someone else
    if (parentId !== userId && !PRIVILEGED_ROLES.includes(userRole)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    if (childId === parentId) {
      return NextResponse.json({ error: 'A user cannot be their own parent' }, { status: 400 })
    }

    const [child, parent] = await Promise.all([
      UserService.findById(childId),
      UserService.findById(parentId),
    ])

    if (!child || child.churchId !== church.id) {
      return NextResponse.json({ error: 'Child not found in this church' }, { status: 404 })
    }
    if (!parent || parent.churchId !== church.id) {
      return NextResponse.json({ error: 'Parent not found in this church' }, { status: 404 })
    }

    // Reassigning a child from a different parent requires elevated permissions
    if (child.parentId && child.parentId !== parentId && !PRIVILEGED_ROLES.includes(userRole)) {
      return NextResponse.json(
        { error: 'This child is already linked to a different parent' },
        { status: 403 }
      )
    }

    if (await wouldCreateCycle(childId, parentId)) {
      return NextResponse.json(
        { error: 'Cannot link: this would create a circular family relationship' },
        { status: 400 }
      )
    }

    const updated = await UserService.update(childId, { parentId })
    const { password, ...childWithoutPassword } = updated

    return NextResponse.json({
      success: true,
      child: childWithoutPassword,
    })
  } catch (error) {
    console.error('Error linking child:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const context = await resolveContext()
    if ('error' in context) return context.error
    const { userId, userRole, church } = context

    const body = await request.json()
    const { childId } = body
    const parentId = body.parentId || userId

    if (!childId || typeof childId !== 'string') {
      return NextResponse.json({ error: 'childId is required' }, { status: 400 })
    }

    if (parentId !== userId && !PRIVILEGED_ROLES.includes(userRole)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const child = await UserService.findById(childId)
    if (!child || child.churchId !== church.id) {
      return NextResponse.json({ error: 'Child not found in this church' }, { status: 404 })
    }

    // A regular user may only unlink their own children
    if (child.parentId !== parentId) {
      return NextResponse.json(
        { error: 'This child is not linked to that parent' },
        { status: 400 }
      )
    }

    await UserService.update(childId, { parentId: null })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error unlinking child:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
