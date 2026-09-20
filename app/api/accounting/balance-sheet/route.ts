
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { guardApi } from '@/lib/api-guard'
import { UserService } from '@/lib/services/user-service'
import { prisma } from '@/lib/prisma'

const DEFAULT_CCY = 'DEFAULT'
const ccy = (c?: string | null) => (c && c.trim() ? c.trim().toUpperCase() : DEFAULT_CCY)

/**
 * Simplified cash-basis balance sheet per currency, as of a date:
 *
 *   Assets      Cash & equivalents = confirmed income − paid expenses
 *   Liabilities Accounts payable  = recorded expenses still Pending
 *   Net Assets  = Assets − Liabilities
 *
 * Amounts are never summed across currencies — each currency is reported
 * independently under `currencies`.
 */
export async function GET(request: Request) {
  try {
    const guarded = await guardApi({
      requireChurch: true,
      allowedRoles: ['ADMIN', 'SUPER_ADMIN', 'BRANCH_ADMIN', 'PASTOR'],
    })
    if (!guarded.ok) return guarded.response

    const { church, userId, role } = guarded.ctx
    const user = await UserService.findById(userId)

    const { searchParams } = new URL(request.url)
    const branchIdParam = searchParams.get('branchId')
    const asOfParam = searchParams.get('asOf')

    const effectiveBranchId =
      role === 'BRANCH_ADMIN' ? ((user as any)?.branchId || null) : branchIdParam || null
    if (role === 'BRANCH_ADMIN' && branchIdParam && branchIdParam !== effectiveBranchId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const asOf = asOfParam ? new Date(asOfParam) : new Date()
    const branchScope = effectiveBranchId ? { branchId: effectiveBranchId } : {}

    const [givByType, incBySource, expPaidByCategory, expPendingRows] = await Promise.all([
      prisma.giving.groupBy({
        by: ['currency', 'type'],
        where: { churchId: church.id, status: 'CONFIRMED', createdAt: { lte: asOf }, ...branchScope },
        _sum: { amount: true },
      }),
      prisma.accountingIncome.groupBy({
        by: ['currency', 'source'],
        where: { churchId: church.id, date: { lte: asOf }, ...branchScope },
        _sum: { amount: true },
      }),
      prisma.accountingExpense.groupBy({
        by: ['currency', 'category'],
        where: { churchId: church.id, status: 'Paid', date: { lte: asOf }, ...branchScope },
        _sum: { amount: true },
      }),
      prisma.accountingExpense.groupBy({
        by: ['currency', 'category'],
        where: { churchId: church.id, status: 'Pending', date: { lte: asOf }, ...branchScope },
        _sum: { amount: true },
      }),
    ])

    type CurrencySheet = {
      income: number
      paidExpenses: number
      pendingExpenses: number
      cash: number
      liabilities: number
      netAssets: number
      incomeByFund: Record<string, number>
      expensesByCategory: Record<string, number>
      payablesByCategory: Record<string, number>
    }

    const sheets: Record<string, CurrencySheet> = {}
    const sheet = (cur: string | null): CurrencySheet => {
      const key = ccy(cur)
      if (!sheets[key]) {
        sheets[key] = {
          income: 0,
          paidExpenses: 0,
          pendingExpenses: 0,
          cash: 0,
          liabilities: 0,
          netAssets: 0,
          incomeByFund: {},
          expensesByCategory: {},
          payablesByCategory: {},
        }
      }
      return sheets[key]
    }

    for (const r of givByType) {
      const s = sheet(r.currency)
      const amt = r._sum.amount || 0
      s.income += amt
      const fund = String(r.type || 'General')
      s.incomeByFund[fund] = (s.incomeByFund[fund] || 0) + amt
    }
    for (const r of incBySource) {
      const s = sheet(r.currency)
      const amt = r._sum.amount || 0
      s.income += amt
      const fund = String(r.source || 'Other')
      s.incomeByFund[fund] = (s.incomeByFund[fund] || 0) + amt
    }
    for (const r of expPaidByCategory) {
      const s = sheet(r.currency)
      const amt = r._sum.amount || 0
      s.paidExpenses += amt
      s.expensesByCategory[r.category] = (s.expensesByCategory[r.category] || 0) + amt
    }
    for (const r of expPendingRows) {
      const s = sheet(r.currency)
      const amt = r._sum.amount || 0
      s.pendingExpenses += amt
      s.payablesByCategory[r.category] = (s.payablesByCategory[r.category] || 0) + amt
    }

    for (const s of Object.values(sheets)) {
      s.cash = s.income - s.paidExpenses
      s.liabilities = s.pendingExpenses
      s.netAssets = s.cash - s.liabilities
    }

    return NextResponse.json({ asOf: asOf.toISOString(), currencies: sheets })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
