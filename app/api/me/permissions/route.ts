import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { getCurrentChurchId } from '@/lib/church-context'
import { PermissionGrantService } from '@/lib/services/permission-grant-service'
import { getRolePermissions } from '@/lib/permissions'
import { UserRole } from '@/types'

export const dynamic = 'force-dynamic'

/**
 * GET /api/me/permissions
 * Effective permissions for the current user in the current church —
 * role-matrix permissions plus active grants. Drives nav/tab visibility.
 */
export async function GET() {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as any)?.id
  const role = (session?.user as any)?.role as UserRole | undefined
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const churchId = await getCurrentChurchId(userId)
  const rolePermissions = role ? getRolePermissions(role) : []
  const grants = churchId ? await PermissionGrantService.listForUser(churchId, userId) : []

  const grantPermissions = grants.map((g) => g.permission)
  const effective = Array.from(new Set([...rolePermissions, ...grantPermissions]))

  return NextResponse.json({ role, churchId, permissions: effective, grants })
}
