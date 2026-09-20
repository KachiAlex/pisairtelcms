
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { guardApi } from '@/lib/api-guard'
import { UserService } from '@/lib/services/user-service'
import { AccountingExpenseService } from '@/lib/services/accounting-expense-service'
import { AccountingIncomeService } from '@/lib/services/accounting-income-service'
import { prisma } from '@/lib/prisma'

type LedgerItem = {
  kind: 'income' | 'expense'
  id: string
  branchId?: string
  currency?: string
  amount: number
  title: string
  /** Account label used for grouping/filtering, e.g. "Giving · TITHE". */
  account: string
  date: string
  /** Set when ?view=ledger — running balance in this item's own currency. */
  runningBalance?: number
  /** Pending expenses don't affect the cash running balance. */
  pending?: boolean
  meta?: any
}

const DEFAULT_CCY = 'DEFAULT'
const ccy = (c?: string | null) => (c && c.trim() ? c.trim().toUpperCase() : DEFAULT_CCY)

/** Opening balances before `before`, split per account → per currency. */
async function openingBalances(churchId: string, branchId: string | null, before: Date) {
  const [giv, inc, exp] = await Promise.all([
    prisma.giving.groupBy({
      by: ['currency', 'type'],
      where: {
        churchId,
        ...(branchId ? { branchId } : {}),
        status: 'CONFIRMED',
        createdAt: { lt: before },
      },
      _sum: { amount: true },
    }),
    prisma.accountingIncome.groupBy({
      by: ['currency', 'source'],
      where: { churchId, ...(branchId ? { branchId } : {}), date: { lt: before } },
      _sum: { amount: true },
    }),
    prisma.accountingExpense.groupBy({
      by: ['currency', 'category'],
      where: {
        churchId,
        ...(branchId ? { branchId } : {}),
        status: 'Paid',
        date: { lt: before },
      },
      _sum: { amount: true },
    }),
  ])

  const byAccount: Record<string, Record<string, number>> = {}
  const add = (account: string, currency: string | null, amount: number) => {
    const key = ccy(currency)
    byAccount[account] = byAccount[account] || {}
    byAccount[account][key] = (byAccount[account][key] || 0) + amount
  }
  giv.forEach((r) => add(`Giving · ${r.type || 'General'}`, r.currency, r._sum.amount || 0))
  inc.forEach((r) => add(`Manual · ${r.source || 'Other'}`, r.currency, r._sum.amount || 0))
  exp.forEach((r) => add(`Expense · ${r.category}`, r.currency, -(r._sum.amount || 0)))
  return byAccount
}

function mergeCurrencies(byAccount: Record<string, Record<string, number>>, account?: string | null) {
  const merged: Record<string, number> = {}
  for (const [acct, currencies] of Object.entries(byAccount)) {
    if (account && acct !== account) continue
    for (const [cur, amt] of Object.entries(currencies)) {
      merged[cur] = (merged[cur] || 0) + amt
    }
  }
  return merged
}

export async function GET(request: Request) {
  try {
    const guarded = await guardApi({ requireChurch: true, allowedRoles: ['ADMIN', 'SUPER_ADMIN', 'BRANCH_ADMIN', 'PASTOR'] })
    if (!guarded.ok) return guarded.response

    const { church, userId, role } = guarded.ctx
    const user = await UserService.findById(userId)

    const { searchParams } = new URL(request.url)
    const branchIdParam = searchParams.get('branchId')
    const start = searchParams.get('start')
    const end = searchParams.get('end')
    const accountFilter = searchParams.get('account')
    const ledgerView = searchParams.get('view') === 'ledger'

    const effectiveBranchId = role === 'BRANCH_ADMIN' ? ((user as any)?.branchId || null) : (branchIdParam || null)
    if (role === 'BRANCH_ADMIN' && branchIdParam && branchIdParam !== effectiveBranchId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const startDate = start ? new Date(start) : undefined
    const endDate = end ? new Date(end) : undefined

    // Fetch by churchId/branchId only and filter by date in-memory to keep the query index-free.
    // Only CONFIRMED giving counts as income (pending bank transfers are excluded),
    // and Cancelled expenses are excluded entirely.
    const [donationsRows, expenses, manualIncome, openingByAccount] = await Promise.all([
      prisma.giving.findMany({
        where: {
          churchId: church.id,
          status: 'CONFIRMED',
          ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
        },
        take: 500,
      }),
      AccountingExpenseService.findByChurch(church.id, {
        branchId: effectiveBranchId,
        startDate,
        endDate,
        statuses: ['Paid', 'Pending'],
        limit: 500,
      }),
      AccountingIncomeService.findByChurch(church.id, {
        branchId: effectiveBranchId,
        startDate,
        endDate,
        limit: 500,
      }),
      ledgerView && startDate
        ? openingBalances(church.id, effectiveBranchId, startDate)
        : Promise.resolve({} as Record<string, Record<string, number>>),
    ])

    const income: LedgerItem[] = donationsRows
      .map((data: any) => {
        const createdAt = data.createdAt
        return {
          kind: 'income',
          id: data.id,
          branchId: data.branchId || undefined,
          currency: data.currency || undefined,
          amount: Number(data.amount || 0),
          title: data.type ? `Giving: ${data.type}` : 'Giving',
          account: `Giving · ${data.type || 'General'}`,
          date: createdAt.toISOString(),
          meta: {
            source: 'GIVING',
            userId: data.userId,
            projectId: data.projectId || null,
            transactionId: data.transactionId || null,
          },
        } as LedgerItem
      })
      .filter((x: LedgerItem) => {
        const d = new Date(x.date)
        if (startDate && d < startDate) return false
        if (endDate && d > endDate) return false
        return true
      })

    const manualIncomeItems: LedgerItem[] = manualIncome
      .map((m): LedgerItem => ({
        kind: 'income',
        id: m.id,
        branchId: m.branchId ?? undefined,
        currency: m.currency ?? undefined,
        amount: Number(m.amount || 0),
        title: `Manual: ${m.source}${m.description ? ` - ${m.description}` : ''}`,
        account: `Manual · ${m.source || 'Other'}`,
        date: m.incomeDate.toISOString(),
        meta: {
          source: 'MANUAL',
          createdBy: m.createdBy,
          attachmentUrl: m.attachmentUrl || null,
          voidsIncomeId: (m as any).voidsIncomeId || null,
        },
      }))

    const expenseItems: LedgerItem[] = expenses.map((e): LedgerItem => ({
      kind: 'expense',
      id: e.id,
      branchId: e.branchId ?? undefined,
      currency: e.currency ?? undefined,
      amount: Number(e.amount || 0),
      title: `${e.category}${e.description ? ` - ${e.description}` : ''}`,
      account: `Expense · ${e.category}`,
      date: e.expenseDate.toISOString(),
      pending: e.status === 'Pending',
      meta: { createdBy: e.createdBy, status: e.status },
    }))

    let items = [...income, ...manualIncomeItems, ...expenseItems]
    if (accountFilter) {
      items = items.filter((it) => it.account === accountFilter)
    }

    const totals = items.reduce(
      (acc, it) => {
        if (it.kind === 'income') acc.income += it.amount
        else if (!it.pending) acc.expenses += it.amount
        else acc.pendingExpenses += it.amount
        return acc
      },
      { income: 0, expenses: 0, pendingExpenses: 0 }
    )

    if (!ledgerView) {
      items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      return NextResponse.json({ items, totals: { ...totals, net: totals.income - totals.expenses } })
    }

    // Ledger view: chronological, with a per-currency running cash balance.
    // Pending expenses are listed but do not move the balance (unpaid).
    items.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    const opening = mergeCurrencies(openingByAccount, accountFilter)
    const running: Record<string, number> = { ...opening }
    for (const it of items) {
      const key = ccy(it.currency)
      if (it.pending) {
        it.runningBalance = running[key] || 0
        continue
      }
      running[key] = (running[key] || 0) + (it.kind === 'income' ? it.amount : -it.amount)
      it.runningBalance = running[key]
    }

    const accounts = Array.from(
      new Set([...Object.keys(openingByAccount), ...items.map((it) => it.account)])
    ).sort()

    return NextResponse.json({
      items,
      accounts,
      totals: { ...totals, net: totals.income - totals.expenses },
      openingBalance: opening,
      closingBalance: running,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
