export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { getCurrentChurch } from '@/lib/church-context'
import { requirePermissionMiddleware } from '@/lib/middleware/rbac'
import { prisma } from '@/lib/prisma'

// Returns the departments and groups an admin can target with a broadcast.
export async function GET() {
  const { error: permError } = await requirePermissionMiddleware('send_broadcasts')
  if (permError) return permError

  const session = await getServerSession(authOptions)
  const userId = (session?.user as any)?.id
  const church = await getCurrentChurch(userId)
  if (!church) {
    return NextResponse.json({ error: 'No church selected' }, { status: 400 })
  }

  const [departments, groups] = await Promise.all([
    prisma.department.findMany({
      where: { churchId: church.id },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.group.findMany({
      where: { churchId: church.id },
      select: { id: true, name: true, type: true },
      orderBy: { name: 'asc' },
    }),
  ])

  return NextResponse.json({ departments, groups })
}
