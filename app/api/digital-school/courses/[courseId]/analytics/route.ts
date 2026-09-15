export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { guardApi } from '@/lib/api-guard'
import {
  DigitalCourseEnrollmentService,
  DigitalCourseExamService,
  DigitalCourseService,
  DigitalExamAttemptService,
} from '@/lib/services/digital-school-service'
import { UserService } from '@/lib/services/user-service'
import { prisma } from '@/lib/prisma'
import { UserRole } from '@/types'

const MANAGER_ROLES: UserRole[] = ['ADMIN', 'PASTOR', 'BRANCH_ADMIN', 'SUPER_ADMIN']

type RouteParams = {
  params: {
    courseId: string
  }
}

export async function GET(_: Request, { params }: RouteParams) {
  try {
    const guarded = await guardApi({ requireChurch: true, allowedRoles: MANAGER_ROLES })
    if (!guarded.ok) return guarded.response

    const course = await DigitalCourseService.get(params.courseId)
    if (!course || course.churchId !== guarded.ctx.church?.id) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 })
    }

    const enrollments = await DigitalCourseEnrollmentService.listByCourse(course.id)

    const userIds = Array.from(new Set(enrollments.map((enrollment) => enrollment.userId)))
    const users = await Promise.all(userIds.map(async (userId) => UserService.findById(userId)))
    const userMap = new Map(users.filter(Boolean).map((user) => [user!.id, user!]))

    const branchIds = Array.from(
      new Set(
        users
          .filter((user): user is NonNullable<typeof user> => Boolean(user?.branchId))
          .map((user) => user.branchId as string),
      ),
    )
    const branchRows = branchIds.length
      ? await prisma.branch.findMany({ where: { id: { in: branchIds } }, select: { id: true, name: true } })
      : []
    const branchMap = new Map(branchRows.map((entry) => [entry.id, entry.name ?? 'Branch']))

    const exams = await DigitalCourseExamService.listByCourse(course.id)
    const attemptsByUser = new Map<
      string,
      {
        score?: number | null
        submittedAt?: Date
      }
    >()

    for (const exam of exams) {
      const attempts = await DigitalExamAttemptService.listByExam(exam.id)
      attempts.forEach((attempt) => {
        const existing = attemptsByUser.get(attempt.userId)
        const attemptTimestamp =
          attempt.submittedAt?.getTime() ?? attempt.updatedAt?.getTime() ?? attempt.startedAt?.getTime() ?? 0
        const existingTimestamp =
          existing?.submittedAt?.getTime() ??
          existing?.submittedAt?.getTime() ??
          existing?.submittedAt?.getTime() ??
          0
        if (!existing || attemptTimestamp > existingTimestamp) {
          attemptsByUser.set(attempt.userId, {
            score: attempt.score ?? null,
            submittedAt: attempt.submittedAt ?? attempt.updatedAt ?? attempt.startedAt,
          })
        }
      })
    }

    const rows = enrollments.map((enrollment) => {
      const user = userMap.get(enrollment.userId)
      const attempt = attemptsByUser.get(enrollment.userId)
      const progressPercent = Math.round(enrollment.progressPercent ?? 0)

      return {
        enrollmentId: enrollment.id,
        userId: enrollment.userId,
        memberName: user ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email : 'Member',
        churchLevel: user?.churchRoleName ?? user?.spiritualMaturity ?? 'Member',
        branch: user?.branchId ? branchMap.get(user.branchId) ?? 'Branch' : '—',
        designation: user?.designationName ?? user?.churchRoleName ?? '—',
        progressPercent,
        status: enrollment.status,
        examScore: attempt?.score ?? null,
        lastExamAt: attempt?.submittedAt?.toISOString() ?? null,
      }
    })

    const summary = {
      total: rows.length,
      notStarted: rows.filter((row) => row.progressPercent === 0).length,
      inProgress: rows.filter((row) => row.progressPercent > 0 && row.progressPercent < 100).length,
      completed: rows.filter((row) => row.progressPercent >= 100 || row.status === 'completed').length,
    }

    return NextResponse.json({
      course: {
        id: course.id,
        title: course.title,
      },
      summary,
      rows,
    })
  } catch (error: any) {
    console.error('DigitalSchool.course.analytics.GET', error)
    return NextResponse.json({ error: error.message || 'Failed to load analytics' }, { status: 500 })
  }
}
