
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { guardApi } from '@/lib/api-guard'
import { AttendanceService } from '@/lib/services/attendance-service'
import { UserService } from '@/lib/services/user-service'

export async function GET(request: Request) {
  try {
    const guarded = await guardApi({ requireChurch: true, allowedRoles: ['ADMIN', 'SUPER_ADMIN', 'BRANCH_ADMIN', 'PASTOR', 'MEMBER'] })
    if (!guarded.ok) return guarded.response

    const { church, userId, role } = guarded.ctx
    const user = await UserService.findById(userId)

    const { searchParams } = new URL(request.url)
    const branchIdParam = searchParams.get('branchId')
    const start = searchParams.get('start')
    const end = searchParams.get('end')

    const effectiveBranchId = role === 'BRANCH_ADMIN' ? ((user as any)?.branchId || null) : (branchIdParam || null)
    if (role === 'BRANCH_ADMIN' && branchIdParam && branchIdParam !== effectiveBranchId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const sessions = await AttendanceService.listSessionsByChurch(church.id, {
      branchId: effectiveBranchId,
      startAt: start ? new Date(start) : undefined,
      endAt: end ? new Date(end) : undefined,
      limit: 200,
    })

    const counts = await AttendanceService.countRecordsBySessions(sessions.map((s) => s.id))
    const sessionsWithCounts = sessions.map((s) => ({
      ...s,
      checkInCount: counts.get(s.id) || 0,
    }))

    return NextResponse.json({ sessions: sessionsWithCounts })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const guarded = await guardApi({ requireChurch: true, allowedRoles: ['ADMIN', 'SUPER_ADMIN', 'BRANCH_ADMIN', 'PASTOR'] })
    if (!guarded.ok) return guarded.response

    const { church, userId, role } = guarded.ctx
    const user = await UserService.findById(userId)

    const body = await request.json()
    const { branchId, title, type, mode, startAt, endAt, location, notes } = body

    if (!title || !type || !mode || !startAt) {
      return NextResponse.json({ error: 'title, type, mode, startAt are required' }, { status: 400 })
    }

    const effectiveBranchId = role === 'BRANCH_ADMIN' ? ((user as any)?.branchId || null) : (branchId || null)
    if (role === 'BRANCH_ADMIN' && branchId && branchId !== effectiveBranchId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const created = await AttendanceService.createSession({
      churchId: church.id,
      branchId: effectiveBranchId || undefined,
      title,
      type,
      mode,
      startAt: new Date(startAt),
      endAt: endAt ? new Date(endAt) : undefined,
      location: location || undefined,
      notes: notes || undefined,
      createdBy: userId,
      headcount: {},
    })

    return NextResponse.json({ session: created }, { status: 201 })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
