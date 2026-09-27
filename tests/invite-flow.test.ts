import { describe, expect, it, vi, beforeEach } from 'vitest'

/**
 * Invite-link add-member flow:
 *   POST /api/church-invites        (admin generates link, optional branchId)
 *   GET  /api/invite/[token]        (public: invite context + branch list)
 *   POST /api/invite/[token]        (public: creates user in invite.churchId)
 */

// ---------- module mocks ----------

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/auth-options', () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({ prisma: {} }))
vi.mock('@/lib/church-context', () => ({
  setCurrentChurchId: vi.fn(),
  getCurrentChurchId: vi.fn(),
}))

const mockGuardApi = vi.fn()
vi.mock('@/lib/api-guard', () => ({ guardApi: (...args: any[]) => mockGuardApi(...args) }))

vi.mock('@/lib/services/church-invite-service', () => ({
  ChurchInviteService: {
    findByTokenHash: vi.fn(),
    findActiveByChurch: vi.fn(),
    createActive: vi.fn(),
    revoke: vi.fn(),
    markUsed: vi.fn(),
  },
  hashInviteToken: vi.fn((token: string) => `hash:${token}`),
}))

vi.mock('@/lib/services/church-service', () => ({
  ChurchService: { findById: vi.fn() },
}))

vi.mock('@/lib/services/branch-service', () => ({
  BranchService: {
    findById: vi.fn(),
    findByChurch: vi.fn(),
  },
  BranchAdminService: { assignAdmin: vi.fn(), findByUser: vi.fn() },
}))

vi.mock('@/lib/services/user-service', () => ({
  UserService: {
    findById: vi.fn(),
    findByEmail: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}))

vi.mock('@/lib/services/church-membership-service', () => ({
  ChurchMembershipService: {
    findByUserAndChurch: vi.fn(),
    findByUser: vi.fn(),
    isMember: vi.fn(),
    attach: vi.fn(),
    detach: vi.fn(),
  },
}))

vi.mock('@/lib/services/branch-scope', () => ({
  resolveBranchScope: vi.fn(),
  hasBranchAccess: vi.fn(() => ({ allowed: true })),
  hasGlobalChurchAccess: vi.fn(() => true),
}))

vi.mock('@/lib/permissions', () => ({
  canManageUser: vi.fn(() => true),
}))

vi.mock('@/lib/services/branch-hierarchy', () => ({
  getHierarchyLevels: vi.fn(() => [
    { key: 'REGION', label: 'Headquarters', order: 0 },
    { key: 'STATE', label: 'Region', order: 1 },
    { key: 'ZONE', label: 'State', order: 2 },
    { key: 'BRANCH', label: 'Branch', order: 3 },
  ]),
  getHierarchyLevelLabels: vi.fn(() => ({
    REGION: 'Headquarters',
    STATE: 'Region',
    ZONE: 'State',
    BRANCH: 'Branch',
  })),
}))

// ---------- imports under test ----------

import { ChurchInviteService } from '@/lib/services/church-invite-service'
import { ChurchService } from '@/lib/services/church-service'
import { BranchService, BranchAdminService } from '@/lib/services/branch-service'
import { UserService } from '@/lib/services/user-service'
import { resolveBranchScope, hasBranchAccess } from '@/lib/services/branch-scope'
import { canManageUser } from '@/lib/permissions'
import { ChurchMembershipService } from '@/lib/services/church-membership-service'

import { getServerSession } from 'next-auth'

import { POST as createInvite } from '@/app/api/church-invites/route'
import { GET as getInvite, POST as acceptInvite } from '@/app/api/invite/[token]/route'
import { POST as acceptAuthed } from '@/app/api/invite/[token]/accept/route'

// ---------- fixtures ----------

const CHURCH_ID = 'church-sowers'
const HQ = { id: 'branch-hq', name: 'HQ', level: 'REGION', churchId: CHURCH_ID, parentBranchId: null, isActive: true, levelLabel: 'Headquarters' }
const SOUTHWEST = { id: 'branch-sw', name: 'Southwest', level: 'STATE', churchId: CHURCH_ID, parentBranchId: HQ.id, isActive: true, levelLabel: 'Region' }
const OTHER_CHURCH_BRANCH = { id: 'branch-other', name: 'NotMine', level: 'STATE', churchId: 'church-other', parentBranchId: null, isActive: true }

const adminCtx = {
  ok: true as const,
  ctx: { userId: 'admin-1', role: 'ADMIN', church: { id: CHURCH_ID, name: 'Sowers' } },
}

const adminUser = { id: 'admin-1', role: 'ADMIN', churchId: CHURCH_ID, branchId: HQ.id }

const activeInvite = {
  id: 'invite-1',
  churchId: CHURCH_ID,
  branchId: null,
  purpose: 'MEMBER_SIGNUP',
  targetRole: null,
  status: 'ACTIVE',
  expiresAt: null,
}

const req = (url: string, init?: RequestInit) => new Request(url, init)
const postJson = (url: string, body: any) =>
  req(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
const tokenParams = (token: string) => ({ params: { token } })

beforeEach(() => {
  vi.clearAllMocks()
  mockGuardApi.mockResolvedValue(adminCtx)
  vi.mocked(UserService.findById).mockResolvedValue(adminUser as any)
  vi.mocked(resolveBranchScope).mockResolvedValue({ branches: [], branchMap: new Map(), scope: null } as any)
  vi.mocked(hasBranchAccess).mockReturnValue({ allowed: true } as any)
  vi.mocked(canManageUser).mockReturnValue(true)
  vi.mocked(ChurchInviteService.findActiveByChurch).mockResolvedValue(null)
})

// ---------- POST /api/church-invites ----------

describe('POST /api/church-invites (generate link)', () => {
  it('rejects unauthenticated callers', async () => {
    mockGuardApi.mockResolvedValueOnce({ ok: false, response: new Response('unauth', { status: 401 }) })
    const res = await createInvite(postJson('http://x/api/church-invites', { purpose: 'MEMBER_SIGNUP' }) as any)
    expect(res.status).toBe(401)
  })

  it('creates a branch-scoped invite for a valid in-church branch', async () => {
    vi.mocked(BranchService.findById).mockResolvedValue(SOUTHWEST as any)
    vi.mocked(ChurchInviteService.createActive).mockResolvedValue({
      invite: { ...activeInvite, branchId: SOUTHWEST.id },
      token: 'tok123',
    } as any)

    const res = await createInvite(postJson('http://x/api/church-invites', { purpose: 'MEMBER_SIGNUP', branchId: SOUTHWEST.id }) as any)
    expect(res.status).toBe(201)
    expect(ChurchInviteService.createActive).toHaveBeenCalledWith(
      expect.objectContaining({ churchId: CHURCH_ID, branchId: SOUTHWEST.id, purpose: 'MEMBER_SIGNUP' })
    )
    const body = await res.json()
    expect(body.token).toBe('tok123')
  })

  it('creates a church-wide invite when branchId is omitted (member chooses)', async () => {
    vi.mocked(ChurchInviteService.createActive).mockResolvedValue({ invite: activeInvite, token: 'tok' } as any)
    const res = await createInvite(postJson('http://x/api/church-invites', { purpose: 'MEMBER_SIGNUP' }) as any)
    expect(res.status).toBe(201)
    expect(ChurchInviteService.createActive).toHaveBeenCalledWith(
      expect.objectContaining({ churchId: CHURCH_ID, branchId: null })
    )
    expect(BranchService.findById).not.toHaveBeenCalled()
  })

  it('rejects a branchId belonging to another church (tenant isolation)', async () => {
    vi.mocked(BranchService.findById).mockResolvedValue(OTHER_CHURCH_BRANCH as any)
    const res = await createInvite(postJson('http://x/api/church-invites', { purpose: 'MEMBER_SIGNUP', branchId: OTHER_CHURCH_BRANCH.id }) as any)
    expect(res.status).toBe(400)
    expect(ChurchInviteService.createActive).not.toHaveBeenCalled()
  })

  it('rejects a nonexistent branchId', async () => {
    vi.mocked(BranchService.findById).mockResolvedValue(null)
    const res = await createInvite(postJson('http://x/api/church-invites', { branchId: 'ghost' }) as any)
    expect(res.status).toBe(400)
  })

  it('forces BRANCH_ADMIN invites to their own branch and scope-checks it', async () => {
    const branchAdminCtx = { ok: true as const, ctx: { userId: 'ba-1', role: 'BRANCH_ADMIN', church: { id: CHURCH_ID } } }
    mockGuardApi.mockResolvedValueOnce(branchAdminCtx)
    vi.mocked(UserService.findById).mockResolvedValue({ id: 'ba-1', role: 'BRANCH_ADMIN', churchId: CHURCH_ID, branchId: SOUTHWEST.id } as any)
    vi.mocked(BranchService.findById).mockResolvedValue(SOUTHWEST as any)
    vi.mocked(ChurchInviteService.createActive).mockResolvedValue({ invite: activeInvite, token: 't' } as any)

    const res = await createInvite(postJson('http://x/api/church-invites', { purpose: 'MEMBER_SIGNUP' }) as any)
    expect(res.status).toBe(201)
    // branchId defaults to the branch admin's own branch
    expect(ChurchInviteService.createActive).toHaveBeenCalledWith(
      expect.objectContaining({ branchId: SOUTHWEST.id })
    )
  })

  it('denies BRANCH_ADMIN creating an invite for an out-of-scope branch', async () => {
    const branchAdminCtx = { ok: true as const, ctx: { userId: 'ba-1', role: 'BRANCH_ADMIN', church: { id: CHURCH_ID } } }
    mockGuardApi.mockResolvedValueOnce(branchAdminCtx)
    vi.mocked(UserService.findById).mockResolvedValue({ id: 'ba-1', role: 'BRANCH_ADMIN', churchId: CHURCH_ID, branchId: HQ.id } as any)
    vi.mocked(BranchService.findById).mockResolvedValue(SOUTHWEST as any)
    vi.mocked(hasBranchAccess).mockReturnValue({ allowed: false } as any)

    const res = await createInvite(postJson('http://x/api/church-invites', { branchId: SOUTHWEST.id }) as any)
    expect(res.status).toBe(403)
    expect(ChurchInviteService.createActive).not.toHaveBeenCalled()
  })

  it('rejects targetRole escalation attempts the creator cannot manage', async () => {
    vi.mocked(canManageUser).mockReturnValue(false)
    vi.mocked(ChurchInviteService.createActive).mockResolvedValue({ invite: activeInvite, token: 't' } as any)
    const res = await createInvite(postJson('http://x/api/church-invites', { purpose: 'MEMBER_SIGNUP', targetRole: 'ADMIN' }) as any)
    expect(res.status).toBe(403)
  })

  it('revokes the existing active invite for the same branch before creating', async () => {
    vi.mocked(BranchService.findById).mockResolvedValue(SOUTHWEST as any)
    vi.mocked(ChurchInviteService.findActiveByChurch).mockResolvedValue({ id: 'old-invite' } as any)
    vi.mocked(ChurchInviteService.createActive).mockResolvedValue({ invite: activeInvite, token: 't' } as any)

    await createInvite(postJson('http://x/api/church-invites', { branchId: SOUTHWEST.id }) as any)
    expect(ChurchInviteService.revoke).toHaveBeenCalledWith('old-invite')
  })
})

// ---------- GET /api/invite/[token] ----------

describe('GET /api/invite/[token] (invite context)', () => {
  it('returns church and the full branch list for a valid active invite', async () => {
    vi.mocked(ChurchInviteService.findByTokenHash).mockResolvedValue(activeInvite as any)
    vi.mocked(ChurchService.findById).mockResolvedValue({ id: CHURCH_ID, name: 'Sowers Theatre Ministry' } as any)
    vi.mocked(BranchService.findByChurch).mockResolvedValue([HQ, SOUTHWEST] as any)

    const res = await getInvite(req('http://x/api/invite/tok'), tokenParams('tok') as any)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.church.name).toBe('Sowers Theatre Ministry')
    expect(body.branches.map((b: any) => b.id)).toEqual([HQ.id, SOUTHWEST.id])
    // child branch keeps its parent link + level label for the picker
    expect(body.branches[1].parentBranchId).toBe(HQ.id)
    expect(body.branches[1].levelLabel).toBe('Region')
  })

  it('404s an unknown token', async () => {
    vi.mocked(ChurchInviteService.findByTokenHash).mockResolvedValue(null)
    const res = await getInvite(req('http://x/api/invite/nope'), tokenParams('nope') as any)
    expect(res.status).toBe(404)
  })

  it('410s a revoked invite', async () => {
    vi.mocked(ChurchInviteService.findByTokenHash).mockResolvedValue({ ...activeInvite, status: 'REVOKED' } as any)
    const res = await getInvite(req('http://x/api/invite/tok'), tokenParams('tok') as any)
    expect(res.status).toBe(410)
  })

  it('410s an expired invite', async () => {
    vi.mocked(ChurchInviteService.findByTokenHash).mockResolvedValue({
      ...activeInvite,
      expiresAt: new Date(Date.now() - 60_000),
    } as any)
    const res = await getInvite(req('http://x/api/invite/tok'), tokenParams('tok') as any)
    expect(res.status).toBe(410)
  })
})

// ---------- POST /api/invite/[token] ----------

const signupBody = (overrides: Record<string, any> = {}) => ({
  firstName: 'Jane',
  lastName: 'Doe',
  email: 'jane@example.com',
  password: 'password123',
  ...overrides,
})

describe('POST /api/invite/[token] (member signup via link)', () => {
  it('adds the member to the invite church + chosen branch immediately', async () => {
    vi.mocked(ChurchInviteService.findByTokenHash).mockResolvedValue(activeInvite as any)
    vi.mocked(UserService.findByEmail).mockResolvedValue(null)
    vi.mocked(BranchService.findById).mockResolvedValue(SOUTHWEST as any)
    vi.mocked(UserService.create).mockResolvedValue({ id: 'u-new', email: 'jane@example.com', churchId: CHURCH_ID, branchId: SOUTHWEST.id, role: 'MEMBER' } as any)

    const res = await acceptInvite(
      postJson('http://x/api/invite/tok', signupBody({ branchId: SOUTHWEST.id })) as any,
      tokenParams('tok') as any
    )

    expect(res.status).toBe(201)
    expect(UserService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        churchId: CHURCH_ID,
        branchId: SOUTHWEST.id,
        role: 'MEMBER',
        email: 'jane@example.com',
      })
    )
    expect(ChurchInviteService.markUsed).toHaveBeenCalledWith('invite-1', 'u-new')
    const body = await res.json()
    expect(body.user.churchId).toBe(CHURCH_ID)
    expect(body.user.branchId).toBe(SOUTHWEST.id)
    expect(body.user.password).toBeUndefined()
  })

  it('locked invite assigns the invite branch even when another is requested', async () => {
    const locked = { ...activeInvite, branchId: SOUTHWEST.id }
    vi.mocked(ChurchInviteService.findByTokenHash).mockResolvedValue(locked as any)
    vi.mocked(UserService.findByEmail).mockResolvedValue(null)
    vi.mocked(BranchService.findById).mockResolvedValue(SOUTHWEST as any)
    vi.mocked(UserService.create).mockResolvedValue({ id: 'u1' } as any)

    // mismatched request branch → 400 (invite is branch-locked)
    const bad = await acceptInvite(
      postJson('http://x/api/invite/tok', signupBody({ branchId: HQ.id })) as any,
      tokenParams('tok') as any
    )
    expect(bad.status).toBe(400)

    // no request branch → invite.branchId applies
    const ok = await acceptInvite(
      postJson('http://x/api/invite/tok', signupBody()) as any,
      tokenParams('tok') as any
    )
    expect(ok.status).toBe(201)
    expect(UserService.create).toHaveBeenCalledWith(expect.objectContaining({ branchId: SOUTHWEST.id }))
  })

  it('rejects a branch from another tenant', async () => {
    vi.mocked(ChurchInviteService.findByTokenHash).mockResolvedValue(activeInvite as any)
    vi.mocked(UserService.findByEmail).mockResolvedValue(null)
    vi.mocked(BranchService.findById).mockResolvedValue(OTHER_CHURCH_BRANCH as any)

    const res = await acceptInvite(
      postJson('http://x/api/invite/tok', signupBody({ branchId: OTHER_CHURCH_BRANCH.id })) as any,
      tokenParams('tok') as any
    )
    expect(res.status).toBe(400)
    expect(UserService.create).not.toHaveBeenCalled()
  })

  it('returns account_exists (409) when the email belongs to another church', async () => {
    vi.mocked(ChurchInviteService.findByTokenHash).mockResolvedValue(activeInvite as any)
    vi.mocked(UserService.findByEmail).mockResolvedValue({ id: 'existing', churchId: 'church-other' } as any)
    vi.mocked(ChurchMembershipService.isMember).mockResolvedValue(false)

    const res = await acceptInvite(
      postJson('http://x/api/invite/tok', signupBody()) as any,
      tokenParams('tok') as any
    )
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.code).toBe('account_exists')
    expect(UserService.create).not.toHaveBeenCalled()
  })

  it('returns already_member (409) when the email already belongs to this church', async () => {
    vi.mocked(ChurchInviteService.findByTokenHash).mockResolvedValue(activeInvite as any)
    // membership table says they're already in — even if active pointer differs
    vi.mocked(UserService.findByEmail).mockResolvedValue({ id: 'existing', churchId: 'church-other' } as any)
    vi.mocked(ChurchMembershipService.isMember).mockResolvedValue(true)

    const res = await acceptInvite(
      postJson('http://x/api/invite/tok', signupBody()) as any,
      tokenParams('tok') as any
    )
    expect(res.status).toBe(409)
    expect((await res.json()).code).toBe('already_member')
    expect(UserService.create).not.toHaveBeenCalled()
  })

  it('rejects revoked and expired invites', async () => {
    vi.mocked(ChurchInviteService.findByTokenHash).mockResolvedValue({ ...activeInvite, status: 'REVOKED' } as any)
    let res = await acceptInvite(postJson('http://x/api/invite/tok', signupBody()) as any, tokenParams('tok') as any)
    expect(res.status).toBe(410)

    vi.mocked(ChurchInviteService.findByTokenHash).mockResolvedValue({ ...activeInvite, expiresAt: new Date(Date.now() - 1) } as any)
    res = await acceptInvite(postJson('http://x/api/invite/tok', signupBody()) as any, tokenParams('tok') as any)
    expect(res.status).toBe(410)
    expect(UserService.create).not.toHaveBeenCalled()
  })

  it('assigns branch-admin invites the BRANCH_ADMIN role + admin assignment', async () => {
    vi.mocked(ChurchInviteService.findByTokenHash).mockResolvedValue({
      ...activeInvite,
      purpose: 'BRANCH_ADMIN_SIGNUP',
      branchId: SOUTHWEST.id,
    } as any)
    vi.mocked(UserService.findByEmail).mockResolvedValue(null)
    vi.mocked(BranchService.findById).mockResolvedValue(SOUTHWEST as any)
    vi.mocked(UserService.create).mockResolvedValue({ id: 'u-admin' } as any)

    const res = await acceptInvite(postJson('http://x/api/invite/tok', signupBody()) as any, tokenParams('tok') as any)
    expect(res.status).toBe(201)
    expect(UserService.create).toHaveBeenCalledWith(expect.objectContaining({ role: 'BRANCH_ADMIN' }))
    expect(BranchAdminService.assignAdmin).toHaveBeenCalledWith(
      expect.objectContaining({ branchId: SOUTHWEST.id, userId: 'u-admin' })
    )
  })

  it('requires branch on branch-admin invites', async () => {
    vi.mocked(ChurchInviteService.findByTokenHash).mockResolvedValue({
      ...activeInvite,
      purpose: 'BRANCH_ADMIN_SIGNUP',
      branchId: null,
    } as any)
    vi.mocked(UserService.findByEmail).mockResolvedValue(null)

    const res = await acceptInvite(postJson('http://x/api/invite/tok', signupBody()) as any, tokenParams('tok') as any)
    expect(res.status).toBe(400)
    expect(UserService.create).not.toHaveBeenCalled()
  })

  it('validates required fields and password length', async () => {
    vi.mocked(ChurchInviteService.findByTokenHash).mockResolvedValue(activeInvite as any)
    vi.mocked(UserService.findByEmail).mockResolvedValue(null)

    const missing = await acceptInvite(
      postJson('http://x/api/invite/tok', signupBody({ lastName: '' })) as any,
      tokenParams('tok') as any
    )
    expect(missing.status).toBe(400)

    const shortPw = await acceptInvite(
      postJson('http://x/api/invite/tok', signupBody({ password: 'short' })) as any,
      tokenParams('tok') as any
    )
    expect(shortPw.status).toBe(400)
    expect(UserService.create).not.toHaveBeenCalled()
  })

  it('rejects non-signup purposes (e.g. unit invites cannot be used on this endpoint)', async () => {
    vi.mocked(ChurchInviteService.findByTokenHash).mockResolvedValue({ ...activeInvite, purpose: 'UNIT_JOIN' } as any)
    const res = await acceptInvite(postJson('http://x/api/invite/tok', signupBody()) as any, tokenParams('tok') as any)
    expect(res.status).toBe(404)
    expect(UserService.create).not.toHaveBeenCalled()
  })
})

// ---------- POST /api/invite/[token]/accept (logged-in multi-tenant join) ----------

describe('POST /api/invite/[token]/accept (existing account joins another church)', () => {
  const authedSession = { user: { id: 'u-existing', email: 'jane@example.com' } }

  beforeEach(() => {
    vi.mocked(getServerSession).mockResolvedValue(authedSession as any)
    vi.mocked(ChurchInviteService.findByTokenHash).mockResolvedValue(activeInvite as any)
    vi.mocked(ChurchService.findById).mockResolvedValue({ id: CHURCH_ID, name: 'Sowers', slug: 'sowers' } as any)
    vi.mocked(UserService.findById).mockResolvedValue({ id: 'u-existing', churchId: 'church-other', role: 'ADMIN', branchId: null } as any)
    vi.mocked(ChurchMembershipService.findByUserAndChurch).mockResolvedValue(null)
    vi.mocked(ChurchMembershipService.attach).mockResolvedValue({} as any)
    vi.mocked(UserService.update).mockResolvedValue({} as any)
  })

  it('requires a session', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(null)
    const res = await acceptAuthed(req('http://x/api/invite/tok/accept', { method: 'POST' }) as any, tokenParams('tok') as any)
    expect(res.status).toBe(401)
    expect(ChurchMembershipService.attach).not.toHaveBeenCalled()
  })

  it('adds a membership and activates the invited church', async () => {
    const res = await acceptAuthed(req('http://x/api/invite/tok/accept', { method: 'POST' }) as any, tokenParams('tok') as any)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.alreadyMember).toBe(false)

    // membership row created for the invite's church + branch
    expect(ChurchMembershipService.attach).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u-existing', churchId: CHURCH_ID, role: 'MEMBER' })
    )
    // active pointers switched to the new tenant
    expect(UserService.update).toHaveBeenCalledWith(
      'u-existing',
      expect.objectContaining({ churchId: CHURCH_ID })
    )
    expect(ChurchInviteService.markUsed).toHaveBeenCalled()
  })

  it('already-member: no new membership, still activates the church', async () => {
    vi.mocked(ChurchMembershipService.findByUserAndChurch).mockResolvedValue({
      id: 'cm-1', userId: 'u-existing', churchId: CHURCH_ID, role: 'LEADER', branchId: HQ.id,
    } as any)

    const res = await acceptAuthed(req('http://x/api/invite/tok/accept', { method: 'POST' }) as any, tokenParams('tok') as any)
    expect(res.status).toBe(200)
    expect((await res.json()).alreadyMember).toBe(true)
    expect(ChurchMembershipService.attach).not.toHaveBeenCalled()
    // existing per-church role/branch win over the invite defaults
    expect(UserService.update).toHaveBeenCalledWith(
      'u-existing',
      expect.objectContaining({ churchId: CHURCH_ID, role: 'LEADER', branchId: HQ.id })
    )
  })

  it('branch-locked invite applies its branch to the new membership', async () => {
    vi.mocked(ChurchInviteService.findByTokenHash).mockResolvedValue({ ...activeInvite, branchId: SOUTHWEST.id } as any)
    vi.mocked(BranchService.findById).mockResolvedValue(SOUTHWEST as any)

    const res = await acceptAuthed(req('http://x/api/invite/tok/accept', { method: 'POST' }) as any, tokenParams('tok') as any)
    expect(res.status).toBe(200)
    expect(ChurchMembershipService.attach).toHaveBeenCalledWith(
      expect.objectContaining({ branchId: SOUTHWEST.id })
    )
  })

  it('branch-admin invite assigns the admin role on the branch', async () => {
    vi.mocked(ChurchInviteService.findByTokenHash).mockResolvedValue({
      ...activeInvite,
      purpose: 'BRANCH_ADMIN_SIGNUP',
      branchId: SOUTHWEST.id,
    } as any)
    vi.mocked(BranchService.findById).mockResolvedValue(SOUTHWEST as any)

    const res = await acceptAuthed(req('http://x/api/invite/tok/accept', { method: 'POST' }) as any, tokenParams('tok') as any)
    expect(res.status).toBe(200)
    expect(ChurchMembershipService.attach).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'BRANCH_ADMIN', branchId: SOUTHWEST.id })
    )
    expect(BranchAdminService.assignAdmin).toHaveBeenCalledWith(
      expect.objectContaining({ branchId: SOUTHWEST.id, userId: 'u-existing' })
    )
  })

  it('410s revoked invites', async () => {
    vi.mocked(ChurchInviteService.findByTokenHash).mockResolvedValue({ ...activeInvite, status: 'REVOKED' } as any)
    const res = await acceptAuthed(req('http://x/api/invite/tok/accept', { method: 'POST' }) as any, tokenParams('tok') as any)
    expect(res.status).toBe(410)
    expect(ChurchMembershipService.attach).not.toHaveBeenCalled()
  })
})
