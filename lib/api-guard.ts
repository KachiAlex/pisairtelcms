import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth-options'
import { getCurrentChurch } from '@/lib/church-context'
import { PermissionGrantService } from '@/lib/services/permission-grant-service'
import { UserRole } from '@/types'

export type ApiGuardContext = {
  session: any
  userId: string
  role?: UserRole
  church?: any
  /** True when access was granted via a PermissionGrant rather than the role matrix */
  viaGrant?: boolean
}

export type ApiGuardOptions = {
  requireChurch?: boolean
  requireAuth?: boolean
  allowedRoles?: UserRole[]
  /**
   * Permissions that unlock this route via PermissionGrant even when the
   * caller's role is not in allowedRoles (e.g. a MEMBER granted
   * 'manage_giving' scoped to a branch).
   */
  allowedPermissions?: string[]
}

export async function guardApi(options: ApiGuardOptions = {}): Promise<{ ok: true; ctx: ApiGuardContext } | { ok: false; response: NextResponse }> {
  const session = await getServerSession(authOptions)
  if (!session) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const userId = (session.user as any)?.id
  const role = (session.user as any)?.role as UserRole | undefined

  if (!userId) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const roleAllowed =
    !options.allowedRoles || options.allowedRoles.length === 0 ||
    (!!role && options.allowedRoles.includes(role))

  // Resolve church when required, or when a grant could still unlock access
  let church: any | undefined
  if (options.requireChurch || (!roleAllowed && options.allowedPermissions?.length)) {
    church = await getCurrentChurch(userId)
    if (!church) {
      return {
        ok: false,
        response: options.requireChurch
          ? NextResponse.json({ error: 'No church selected' }, { status: 400 })
          : NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 }),
      }
    }
  }

  let viaGrant = false
  if (!roleAllowed) {
    if (options.allowedPermissions?.length && church) {
      viaGrant = await PermissionGrantService.hasAnyGrant(userId, church.id, options.allowedPermissions)
    }
    if (!viaGrant) {
      return { ok: false, response: NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 }) }
    }
  }

  return {
    ok: true,
    ctx: {
      session,
      userId,
      role,
      church,
      viaGrant,
    },
  }
}
