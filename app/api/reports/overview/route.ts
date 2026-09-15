
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'

import { guardApi } from '@/lib/api-guard'
import { AttendanceService } from '@/lib/services/attendance-service'
import { AccountingIncomeService } from '@/lib/services/accounting-income-service'
import { AccountingExpenseService } from '@/lib/services/accounting-expense-service'
import { UserService } from '@/lib/services/user-service'
import { BranchService } from '@/lib/services/branch-service'
import { ReadingPlanService } from '@/lib/services/reading-plan-service'
import { prisma } from '@/lib/prisma'

type MonthlySeries = Record<
  string,
  {
    income: number
    expenses: number
  }
>

function formatMonth(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function isWithinRange(date: Date, start?: Date, end?: Date) {
  if (start && date < start) return false
  if (end && date > end) return false
  return true
}

export async function GET(request: Request) {
  try {
    const guarded = await guardApi({
      requireChurch: true,
      allowedRoles: ['ADMIN', 'SUPER_ADMIN', 'BRANCH_ADMIN', 'PASTOR'],
    })
    if (!guarded.ok) return guarded.response

    const { church, role, userId } = guarded.ctx
    const user = await UserService.findById(userId)

    const params = new URL(request.url).searchParams
    const branchIdParam = params.get('branchId')
    const startParam = params.get('start')
    const endParam = params.get('end')

    const effectiveBranchId =
      role === 'BRANCH_ADMIN' ? user?.branchId || null : branchIdParam || null

    const startDate = startParam ? new Date(startParam) : undefined
    const endDate = endParam ? new Date(endParam) : undefined

    const [
      attendanceSessions,
      expenses,
      manualIncome,
      users,
      branches,
      donationsRows,
      readingPlans,
      readingPlanTotalCount,
      resourcesSample,
      resourcesTotalCount,
    ] = await Promise.all([
      AttendanceService.listSessionsByChurch(church!.id, {
        branchId: effectiveBranchId,
        startAt: startDate,
        endAt: endDate,
        limit: 500,
      }),
      AccountingExpenseService.findByChurch(church!.id, {
        branchId: effectiveBranchId,
        startDate,
        endDate,
        limit: 500,
      }),
      AccountingIncomeService.findByChurch(church!.id, {
        branchId: effectiveBranchId,
        startDate,
        endDate,
        limit: 500,
      }),
      UserService.findByChurch(church!.id),
      BranchService.findByChurch(church!.id),
      prisma.giving.findMany({
        where: {
          churchId: church!.id,
          ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
        },
        take: 500,
      }),
      ReadingPlanService.findAll(200),
      prisma.readingPlan.count(),
      prisma.readingPlanResource.findMany({
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
      prisma.readingPlanResource.count(),
    ])

    const scopedUsers = effectiveBranchId
      ? users.filter((member: any) => member.branchId === effectiveBranchId)
      : users

    const branchMap = new Map(
      branches.map((branch) => [branch.id, branch])
    )

    // Attendance summary
    const attendanceTotals = attendanceSessions.reduce(
      (acc, session) => {
        const headcount = Number(session.headcount?.total ?? 0)
        acc.totalHeadcount += headcount
        acc.byType[session.type] = (acc.byType[session.type] || 0) + 1
        acc.byMode[session.mode] = (acc.byMode[session.mode] || 0) + 1
        if (headcount > acc.peak.headcount) {
          acc.peak = {
            sessionId: session.id,
            title: session.title,
            date: session.startAt.toISOString(),
            headcount,
          }
        }
        if (session.headcount?.firstTimers) {
          acc.firstTimers += Number(session.headcount.firstTimers || 0)
        }
        return acc
      },
      {
        totalHeadcount: 0,
        byType: {} as Record<string, number>,
        byMode: {} as Record<string, number>,
        peak: { sessionId: null, title: null, date: null, headcount: 0 } as {
          sessionId: string | null
          title: string | null
          date: string | null
          headcount: number
        },
        firstTimers: 0,
      }
    )

    const attendanceTimeline = attendanceSessions.slice(0, 10).map((session) => ({
      id: session.id,
      title: session.title,
      type: session.type,
      mode: session.mode,
      date: session.startAt.toISOString(),
      headcount: Number(session.headcount?.total ?? 0),
    }))

    const attendanceSummary = {
      totalSessions: attendanceSessions.length,
      totalHeadcount: attendanceTotals.totalHeadcount,
      averageHeadcount:
        attendanceSessions.length > 0
          ? Math.round(attendanceTotals.totalHeadcount / attendanceSessions.length)
          : 0,
      firstTimers: attendanceTotals.firstTimers,
      byType: attendanceTotals.byType,
      byMode: attendanceTotals.byMode,
      peakSession: attendanceTotals.peak,
      timeline: attendanceTimeline,
    }

    // Financial summary
    const donations = donationsRows
      .map((data: any) => ({
        amount: Number(data.amount || 0),
        date: data.createdAt,
        type: data.type || 'Giving',
      }))
      .filter((entry) => isWithinRange(entry.date, startDate, endDate))

    const givingTotal = donations.reduce((sum, entry) => sum + entry.amount, 0)
    const manualIncomeTotal = manualIncome.reduce(
      (sum, entry) => sum + Number(entry.amount || 0),
      0
    )
    const expenseTotal = expenses.reduce(
      (sum, entry) => sum + Number(entry.amount || 0),
      0
    )

    const monthlySeries: MonthlySeries = {}

    const recordIncome = (date: Date, amount: number) => {
      const key = formatMonth(date)
      monthlySeries[key] = monthlySeries[key] || { income: 0, expenses: 0 }
      monthlySeries[key].income += amount
    }

    const recordExpense = (date: Date, amount: number) => {
      const key = formatMonth(date)
      monthlySeries[key] = monthlySeries[key] || { income: 0, expenses: 0 }
      monthlySeries[key].expenses += amount
    }

    donations.forEach((entry) => recordIncome(entry.date, entry.amount))
    manualIncome.forEach((entry) => recordIncome(entry.incomeDate, Number(entry.amount || 0)))
    expenses.forEach((entry) => recordExpense(entry.expenseDate, Number(entry.amount || 0)))

    const financialSummary = {
      givingTotal,
      manualIncomeTotal,
      totalIncome: givingTotal + manualIncomeTotal,
      totalExpenses: expenseTotal,
      net: givingTotal + manualIncomeTotal - expenseTotal,
      topExpenseCategories: expenses.reduce((acc, expense) => {
        acc[expense.category] = (acc[expense.category] || 0) + Number(expense.amount || 0)
        return acc
      }, {} as Record<string, number>),
      timeline: Object.entries(monthlySeries)
        .sort(([a], [b]) => (a > b ? 1 : -1))
        .map(([month, data]) => ({ month, ...data })),
    }

    // Member analytics
    const branchMemberCounts: Record<string, number> = {}
    scopedUsers.forEach((member: any) => {
      const memberBranchId = member.branchId || 'unassigned'
      branchMemberCounts[memberBranchId] = (branchMemberCounts[memberBranchId] || 0) + 1
    })

    const membersByRole = scopedUsers.reduce((acc: Record<string, number>, member: any) => {
      acc[member.role] = (acc[member.role] || 0) + 1
      return acc
    }, {})

    const membersByRegion = Array.from(branchMap.values()).reduce(
      (acc: Record<string, number>, branch) => {
        const region =
          [branch.state, branch.country].filter(Boolean).join(', ') ||
          branch.city ||
          'Unspecified'
        const count = branchMemberCounts[branch.id] || 0
        acc[region] = (acc[region] || 0) + count
        return acc
      },
      {}
    )

    const branchBreakdown = branches.map((branch) => ({
      id: branch.id,
      name: branch.name,
      city: branch.city,
      state: branch.state,
      country: branch.country,
      members: branchMemberCounts[branch.id] || 0,
    }))

    const recentMembers = scopedUsers
      .slice()
      .sort(
        (a: any, b: any) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      .slice(0, 10)
      .map((member: any) => ({
        id: member.id,
        name: `${member.firstName || ''} ${member.lastName || ''}`.trim() || member.email,
        role: member.role,
        branchId: member.branchId || null,
        joinedAt: new Date(member.createdAt).toISOString(),
        lastLoginAt: member.lastLoginAt ? new Date(member.lastLoginAt).toISOString() : null,
      }))

    const memberAnalytics = {
      totalMembers: scopedUsers.length,
      membersByRole,
      membersByRegion,
      branches: branchBreakdown,
      recent: recentMembers,
    }

    // Reading / resources summary
    const resourcesByType = resourcesSample.reduce((acc: Record<string, number>, resource: any) => {
      const type = resource.type || 'book'
      acc[type] = (acc[type] || 0) + 1
      return acc
    }, {})

    const activePlans = readingPlans.filter((plan) => {
      if (!plan.startDate || !plan.endDate) return true
      const now = new Date()
      return plan.startDate <= now && plan.endDate >= now
    })

    const resourcesSummary = {
      totalResources: resourcesTotalCount || 0,
      sampleByType: resourcesByType,
      totalPlans: readingPlanTotalCount || 0,
      activePlans: activePlans.length,
    }

    return NextResponse.json({
      filters: {
        branchId: effectiveBranchId,
        start: startDate ? startDate.toISOString() : null,
        end: endDate ? endDate.toISOString() : null,
      },
      attendance: attendanceSummary,
      finances: financialSummary,
      members: memberAnalytics,
      resources: resourcesSummary,
      meta: {
        generatedAt: new Date().toISOString(),
      },
    })
  } catch (error: any) {
    console.error('Reports overview error:', error)
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
