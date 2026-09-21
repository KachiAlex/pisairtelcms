import { UserRole } from '@/types'

export type Permission =
  | 'view_users'
  | 'edit_users'
  | 'delete_users'
  | 'manage_roles'
  | 'view_payroll'
  | 'manage_payroll'
  | 'view_analytics'
  | 'manage_church_settings'
  | 'manage_subscription'
  | 'manage_departments'
  | 'manage_groups'
  | 'manage_sermons'
  | 'manage_events'
  | 'manage_giving'
  | 'send_broadcasts'
  | 'approve_testimonies'
  | 'manage_volunteers'
  | 'manage_attendance'
  | 'manage_accounting'

const rolePermissions: Record<UserRole, Permission[]> = {
  VISITOR: [],
  VOLUNTEER: ['view_users'],
  MEMBER: [],
  LEADER: [
    'view_users', // Can view users but with restrictions
  ],
  BRANCH_ADMIN: [
    'view_users',
    'edit_users',
    'view_payroll',
    'view_analytics',
    'manage_departments',
    'manage_groups',
    'manage_sermons',
    'manage_events',
    'manage_giving',
    'send_broadcasts',
    'approve_testimonies',
    'manage_volunteers',
  ],
  PASTOR: [
    'view_users',
    'edit_users',
    'manage_roles',
    'view_payroll',
    'manage_payroll',
    'view_analytics',
    'manage_church_settings',
    'manage_departments',
    'manage_groups',
    'manage_sermons',
    'manage_events',
    'manage_giving',
    'send_broadcasts',
    'approve_testimonies',
    'manage_volunteers',
  ],
  ADMIN: [
    'view_users',
    'edit_users',
    'delete_users',
    'manage_roles',
    'view_payroll',
    'manage_payroll',
    'view_analytics',
    'manage_church_settings',
    'manage_subscription',
    'manage_departments',
    'manage_groups',
    'manage_sermons',
    'manage_events',
    'manage_giving',
    'send_broadcasts',
    'approve_testimonies',
    'manage_volunteers',
  ],
  SUPER_ADMIN: [
    // Super admin has all permissions
    'view_users',
    'edit_users',
    'delete_users',
    'manage_roles',
    'view_payroll',
    'manage_payroll',
    'view_analytics',
    'manage_church_settings',
    'manage_subscription',
    'manage_departments',
    'manage_groups',
    'manage_sermons',
    'manage_events',
    'manage_giving',
    'send_broadcasts',
    'approve_testimonies',
    'manage_volunteers',
  ],
  STAFF: [
    'view_users',
  ],
}

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  return rolePermissions[role]?.includes(permission) || false
}

/**
 * Check if a role has any of the specified permissions
 */
export function hasAnyPermission(
  role: UserRole,
  permissions: Permission[]
): boolean {
  return permissions.some((permission) => hasPermission(role, permission))
}

/**
 * Check if a role has all of the specified permissions
 */
export function hasAllPermissions(
  role: UserRole,
  permissions: Permission[]
): boolean {
  return permissions.every((permission) => hasPermission(role, permission))
}

/**
 * Get all permissions for a role
 */
export function getRolePermissions(role: UserRole): Permission[] {
  return rolePermissions[role] || []
}

/**
 * Require permission - throws error if user doesn't have permission
 */
export function requirePermission(role: UserRole, permission: Permission) {
  if (!hasPermission(role, permission)) {
    throw new Error(`Insufficient permissions: ${permission} required`)
  }
}

/**
 * Check if user can perform action on another user
 */
export function canManageUser(
  actorRole: UserRole,
  targetRole: UserRole
): boolean {
  // Super admin can manage anyone
  if (actorRole === 'SUPER_ADMIN') return true

  // Admin can manage anyone except super admin
  if (actorRole === 'ADMIN' && targetRole !== 'SUPER_ADMIN') return true

  // Branch admin can manage members, leaders, volunteers, and visitors
  if (actorRole === 'BRANCH_ADMIN') {
    return ['VISITOR', 'MEMBER', 'VOLUNTEER', 'LEADER', 'STAFF'].includes(targetRole)
  }

  // Pastor can manage members, leaders, and visitors
  if (actorRole === 'PASTOR') {
    return ['VISITOR', 'MEMBER', 'VOLUNTEER', 'LEADER', 'BRANCH_ADMIN', 'STAFF'].includes(targetRole)
  }

  // Leader can manage members and visitors
  if (actorRole === 'LEADER') {
    return ['VISITOR', 'MEMBER', 'VOLUNTEER'].includes(targetRole)
  }

  return false
}

