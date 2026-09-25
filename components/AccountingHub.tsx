'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

type Branch = {
  id: string
  name: string
}

type LedgerItem = {
  kind: 'income' | 'expense'
  id: string
  branchId?: string
  currency?: string
  amount: number
  title: string
  account: string
  date: string
  runningBalance?: number
  pending?: boolean
  meta?: any
}

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

type Expense = {
  id: string
  branchId?: string
  amount: number
  currency?: string
  category: string
  description?: string
  expenseDate: string
}

export default function AccountingHub({ isAdmin }: { isAdmin: boolean }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [branches, setBranches] = useState<Branch[]>([])
  const [branchId, setBranchId] = useState<string>('')
  const [start, setStart] = useState<string>('')
  const [end, setEnd] = useState<string>('')

  const [ledger, setLedger] = useState<LedgerItem[]>([])
  const [accounts, setAccounts] = useState<string[]>([])
  const [accountFilter, setAccountFilter] = useState('')
  const [openingBalance, setOpeningBalance] = useState<Record<string, number>>({})
  const [closingBalance, setClosingBalance] = useState<Record<string, number>>({})
  const [totals, setTotals] = useState<{ income: number; expenses: number; pendingExpenses?: number; net: number } | null>(null)
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [exporting, setExporting] = useState<'csv' | 'pdf' | null>(null)

  const [asOf, setAsOf] = useState<string>(new Date().toISOString().slice(0, 10))
  const [balanceSheet, setBalanceSheet] = useState<Record<string, CurrencySheet>>({})

  const [incomeSaving, setIncomeSaving] = useState(false)
  const [incomeForm, setIncomeForm] = useState({
    amount: '',
    currency: '',
    source: 'Other',
    description: '',
    incomeDate: new Date().toISOString().slice(0, 10),
  })
  const [incomeReceipt, setIncomeReceipt] = useState<File | null>(null)

  const [expenseForm, setExpenseForm] = useState({
    amount: '',
    currency: '',
    category: 'Other',
    description: '',
    expenseDate: new Date().toISOString().slice(0, 10),
  })

  const [expenseModalOpen, setExpenseModalOpen] = useState(false)
  const [incomeModalOpen, setIncomeModalOpen] = useState(false)

  const numberFormatter = useMemo(
    () =>
      new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    []
  )

  const { balanceRows, incomePercent, expensesPercent } = useMemo(() => {
    const incomeTotal = totals?.income ?? 0
    const expensesTotal = totals?.expenses ?? 0
    const netTotal = totals?.net ?? incomeTotal - expensesTotal
    const base = incomeTotal + expensesTotal
    const incomeShare = base > 0 ? Math.round((incomeTotal / base) * 100) : 0
    return {
      balanceRows: [
        {
          label: 'Total Income',
          amount: incomeTotal,
          tone: 'positive',
          helper: 'Giving + manual income entries',
        },
        {
          label: 'Total Expenses',
          amount: expensesTotal,
          tone: 'negative',
          helper: 'All recorded operating expenses',
        },
        {
          label: 'Net Balance',
          amount: netTotal,
          tone: netTotal >= 0 ? 'positive' : 'negative',
          helper: netTotal >= 0 ? 'Surplus available to reinvest' : 'Deficit — review spending',
        },
      ],
      incomePercent: incomeShare,
      expensesPercent: base > 0 ? 100 - incomeShare : 0,
    }
  }, [totals])

  const queryString = useMemo(() => {
    const qs = new URLSearchParams()
    if (branchId.trim()) qs.set('branchId', branchId.trim())
    if (start) qs.set('start', new Date(start).toISOString())
    if (end) qs.set('end', new Date(end).toISOString())
    const s = qs.toString()
    return s ? `?${s}` : ''
  }, [branchId, start, end])

  const ledgerQueryString = useMemo(() => {
    const qs = new URLSearchParams(queryString)
    qs.set('view', 'ledger')
    if (accountFilter) qs.set('account', accountFilter)
    return `?${qs.toString()}`
  }, [queryString, accountFilter])

  async function readApiError(res: Response) {
    try {
      const json = await res.json()
      return json?.error || 'Request failed'
    } catch {
      try {
        const text = await res.text()
        return text || 'Request failed'
      } catch {
        return 'Request failed'
      }
    }
  }

  const loadBranches = useCallback(async () => {
    try {
      const cur = await fetch('/api/churches/switch', { cache: 'no-store' })
      if (!cur.ok) return
      const curJson = await cur.json()
      const churchId = curJson?.churchId as string | undefined
      if (!churchId) return

      const res = await fetch(`/api/churches/${churchId}/branches`, { cache: 'no-store' })
      if (!res.ok) return
      const json = await res.json()
      setBranches((json || []).map((b: any) => ({ id: b.id, name: b.name })))
    } catch {
      // ignore
    }
  }, [])

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [ledgerRes, expensesRes] = await Promise.all([
        fetch(`/api/accounting/ledger${ledgerQueryString}`, { cache: 'no-store' }),
        fetch(`/api/accounting/expenses${queryString}`, { cache: 'no-store' }),
      ])

      if (!ledgerRes.ok) throw new Error(await readApiError(ledgerRes))
      if (!expensesRes.ok) throw new Error(await readApiError(expensesRes))

      const ledgerJson = await ledgerRes.json()
      const expensesJson = await expensesRes.json()

      setLedger(ledgerJson.items || [])
      setAccounts(ledgerJson.accounts || [])
      setOpeningBalance(ledgerJson.openingBalance || {})
      setClosingBalance(ledgerJson.closingBalance || {})
      setTotals(ledgerJson.totals || null)
      setExpenses((expensesJson.expenses || []).map((e: any) => ({
        id: e.id,
        branchId: e.branchId,
        amount: e.amount,
        currency: e.currency,
        category: e.category,
        description: e.description,
        expenseDate: e.expenseDate,
      })))
    } catch (e: any) {
      setError(e?.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [queryString, ledgerQueryString])

  const loadBalanceSheet = useCallback(async () => {
    try {
      const qs = new URLSearchParams()
      if (branchId.trim()) qs.set('branchId', branchId.trim())
      if (asOf) qs.set('asOf', new Date(asOf).toISOString())
      const res = await fetch(`/api/accounting/balance-sheet?${qs.toString()}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(await readApiError(res))
      const json = await res.json()
      setBalanceSheet(json.currencies || {})
    } catch (e: any) {
      setError(e?.message || 'Failed to load balance sheet')
    }
  }, [branchId, asOf])

  const downloadFile = (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
  }

  const handleExport = async (format: 'csv' | 'pdf') => {
    if (!branchId.trim()) {
      setError('Select a branch to export.')
      return
    }

    setExporting(format)
    setError(null)
    try {
      const res = await fetch(`/api/accounting/export/${format}${queryString}`, {
        cache: 'no-store',
      })

      if (!res.ok) throw new Error(await readApiError(res))
      const blob = await res.blob()
      downloadFile(blob, `accounting-balance-sheet.${format}`)
    } catch (e: any) {
      setError(e?.message || `Failed to export ${format.toUpperCase()}`)
    } finally {
      setExporting(null)
    }
  }

  useEffect(() => {
    loadBranches()
    loadAll()
  }, [loadAll, loadBranches])

  useEffect(() => {
    loadBalanceSheet()
  }, [loadBalanceSheet])

  async function createExpense() {
    if (!branchId.trim()) {
      setError('Please select a branch before adding an expense.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/accounting/expenses', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          branchId: branchId.trim() || null,
          amount: Number(expenseForm.amount),
          currency: expenseForm.currency || null,
          category: expenseForm.category,
          description: expenseForm.description || null,
          expenseDate: new Date(expenseForm.expenseDate).toISOString(),
        }),
      })

      if (!res.ok) throw new Error(await readApiError(res))

      setExpenseForm((p) => ({ ...p, amount: '', description: '' }))
      setExpenseModalOpen(false)
      await loadAll()
    } catch (e: any) {
      setError(e?.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  async function createIncome() {
    if (!branchId.trim()) {
      setError('Please select a branch before adding income.')
      return
    }
    setIncomeSaving(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.set('branchId', branchId.trim() || '')
      fd.set('amount', incomeForm.amount)
      fd.set('currency', incomeForm.currency || '')
      fd.set('source', incomeForm.source)
      fd.set('description', incomeForm.description || '')
      fd.set('incomeDate', new Date(incomeForm.incomeDate).toISOString())
      if (incomeReceipt) fd.set('file', incomeReceipt)

      const res = await fetch('/api/accounting/income', {
        method: 'POST',
        body: fd,
      })

      if (!res.ok) throw new Error(await readApiError(res))

      setIncomeForm((p) => ({ ...p, amount: '', description: '' }))
      setIncomeReceipt(null)
      setIncomeModalOpen(false)
      await loadAll()
    } catch (e: any) {
      setError(e?.message || 'Failed to save income')
    } finally {
      setIncomeSaving(false)
    }
  }

  async function voidManualIncome(incomeId: string) {
    setError(null)
    const reason = window.prompt('Reason for void (optional):') || ''
    try {
      const res = await fetch(`/api/accounting/income/${incomeId}/void`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reason }),
      })
      if (!res.ok) throw new Error(await readApiError(res))
      await loadAll()
    } catch (e: any) {
      setError(e?.message || 'Failed to void')
    }
  }

  if (!isAdmin) {
    return (
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold">Accounting</h1>
        <p className="text-gray-600 mt-2">You do not have access to Accounting.</p>
      </div>
    )
  }

  const voidedIds = new Set(
    ledger
      .filter((x) => x.kind === 'income' && x.meta?.source === 'MANUAL' && x.meta?.voidsIncomeId)
      .map((x) => x.meta.voidsIncomeId as string)
  )

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Accounting</h1>
          <p className="text-gray-600 mt-1">Income (Giving) and Expenses, branch-scoped with export.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border p-4">
          <label className="text-xs font-semibold text-gray-600">Branch (optional)</label>
          <select className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            <option value="">All branches</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <label className="text-xs font-semibold text-gray-600">Start (optional)</label>
          <input type="date" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={start} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div className="bg-white rounded-xl border p-4">
          <label className="text-xs font-semibold text-gray-600">End (optional)</label>
          <input type="date" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={end} onChange={(e) => setEnd(e.target.value)} />
        </div>
        <div className="bg-white rounded-xl border p-4 flex flex-col justify-between">
          <div className="text-xs font-semibold text-gray-600">Exports</div>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => handleExport('csv')}
              disabled={!branchId.trim() || exporting === 'csv'}
              className={`px-3 py-2 rounded-lg border text-sm transition ${
                branchId.trim()
                  ? 'hover:bg-gray-50'
                  : 'opacity-50 cursor-not-allowed'
              }`}
            >
              {exporting === 'csv' ? 'Exporting…' : 'Excel (CSV)'}
            </button>
            <button
              type="button"
              onClick={() => handleExport('pdf')}
              disabled={!branchId.trim() || exporting === 'pdf'}
              className={`px-3 py-2 rounded-lg border text-sm transition ${
                branchId.trim()
                  ? 'hover:bg-gray-50'
                  : 'opacity-50 cursor-not-allowed'
              }`}
            >
              {exporting === 'pdf' ? 'Exporting…' : 'PDF'}
            </button>
          </div>
          {!branchId.trim() && <div className="text-xs text-gray-500 mt-2">Select a branch to export.</div>}
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4">{error}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border p-4">
          <div className="text-xs font-semibold text-gray-600">Total Income</div>
          <div className="text-2xl font-bold mt-1">{numberFormatter.format(totals?.income ?? 0)}</div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="text-xs font-semibold text-gray-600">Total Expenses</div>
          <div className="text-2xl font-bold mt-1">{numberFormatter.format(totals?.expenses ?? 0)}</div>
          {totals?.pendingExpenses ? (
            <div className="text-xs text-amber-600 mt-0.5">+{numberFormatter.format(totals.pendingExpenses)} unpaid</div>
          ) : null}
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="text-xs font-semibold text-gray-600">Net</div>
          <div className="text-2xl font-bold mt-1">{numberFormatter.format(totals?.net ?? 0)}</div>
        </div>
      </div>

      <div className="bg-white rounded-xl border p-5 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold">Balance Sheet</h2>
            <p className="text-sm text-gray-600">Cumulative financial position — assets, liabilities, and net assets.</p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-gray-600">As of</label>
            <input type="date" className="border rounded-lg px-3 py-1.5 text-sm" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
          </div>
        </div>

        {Object.keys(balanceSheet).length === 0 ? (
          <div className="text-gray-600 text-sm">No activity recorded yet.</div>
        ) : (
          Object.entries(balanceSheet).map(([currency, s]) => (
            <div key={currency} className="rounded-lg border overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 text-xs font-semibold text-gray-600 flex justify-between">
                <span>{currency === 'DEFAULT' ? 'Default currency' : currency}</span>
                <span>Assets − Liabilities = Net Assets</span>
              </div>
              <div className="divide-y">
                <div className="px-4 py-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium text-gray-900">Cash &amp; equivalents</p>
                      <p className="text-xs text-gray-500">Confirmed income minus paid expenses</p>
                    </div>
                    <div className={`text-lg font-semibold ${s.cash >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {numberFormatter.format(s.cash)}
                    </div>
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    Income {numberFormatter.format(s.income)} − Paid expenses {numberFormatter.format(s.paidExpenses)}
                  </div>
                </div>
                <div className="px-4 py-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-medium text-gray-900">Accounts payable</p>
                      <p className="text-xs text-gray-500">Expenses recorded but not yet paid</p>
                    </div>
                    <div className="text-lg font-semibold text-amber-600">
                      {numberFormatter.format(s.liabilities)}
                    </div>
                  </div>
                </div>
                <div className="px-4 py-3 bg-gray-50/50">
                  <div className="flex justify-between items-center">
                    <p className="font-semibold text-gray-900">Net assets</p>
                    <div className={`text-lg font-bold ${s.netAssets >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                      {numberFormatter.format(s.netAssets)}
                    </div>
                  </div>
                </div>
              </div>

              {(Object.keys(s.incomeByFund).length > 0 || Object.keys(s.expensesByCategory).length > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-gray-100 border-t">
                  <div className="bg-white px-4 py-3">
                    <div className="text-xs font-semibold text-gray-600 mb-1.5">Income by fund</div>
                    {Object.entries(s.incomeByFund).sort((a, b) => b[1] - a[1]).map(([fund, amt]) => (
                      <div key={fund} className="flex justify-between text-xs py-0.5">
                        <span className="text-gray-600">{fund}</span>
                        <span className="font-medium">{numberFormatter.format(amt)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="bg-white px-4 py-3">
                    <div className="text-xs font-semibold text-gray-600 mb-1.5">Expenses by category</div>
                    {Object.entries(s.expensesByCategory).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => (
                      <div key={cat} className="flex justify-between text-xs py-0.5">
                        <span className="text-gray-600">{cat}</span>
                        <span className="font-medium">{numberFormatter.format(amt)}</span>
                      </div>
                    ))}
                    {Object.keys(s.payablesByCategory).length > 0 && (
                      <>
                        <div className="text-xs font-semibold text-amber-700 mt-2 mb-1">Payables (unpaid)</div>
                        {Object.entries(s.payablesByCategory).map(([cat, amt]) => (
                          <div key={cat} className="flex justify-between text-xs py-0.5">
                            <span className="text-gray-600">{cat}</span>
                            <span className="font-medium text-amber-700">{numberFormatter.format(amt)}</span>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <div className="bg-white rounded-xl border p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Period Activity</h2>
            <p className="text-sm text-gray-600">Income versus expenses for this filter range.</p>
          </div>
          <div className="text-xs text-gray-500">
            Updated {new Date().toLocaleDateString()}
          </div>
        </div>

        <div className="space-y-3">
          {balanceRows.map((row) => (
            <div key={row.label} className="flex items-center justify-between rounded-lg border px-4 py-3">
              <div>
                <p className="font-medium text-gray-900">{row.label}</p>
                <p className="text-xs text-gray-500">{row.helper}</p>
              </div>
              <div className={`text-lg font-semibold ${row.tone === 'positive' ? 'text-green-600' : row.tone === 'negative' ? 'text-red-600' : 'text-gray-900'}`}>
                {numberFormatter.format(row.amount ?? 0)}
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-gray-600">
            <span>Income {incomePercent}%</span>
            <span>Expenses {expensesPercent}%</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500"
              style={{ width: `${incomePercent}%` }}
            ></div>
            <div
              className="h-full bg-red-500 -mt-2"
              style={{ width: `${expensesPercent}%` }}
            ></div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border p-5">
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <h2 className="text-lg font-semibold">Ledger</h2>
          <div className="flex items-center gap-2">
            <select
              className="border rounded-lg px-3 py-1.5 text-xs"
              value={accountFilter}
              onChange={(e) => setAccountFilter(e.target.value)}
            >
              <option value="">All accounts</option>
              {accounts.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setIncomeModalOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-semibold hover:bg-green-700 transition"
            >
              + Add Income
            </button>
            <button
              type="button"
              onClick={() => setExpenseModalOpen(true)}
              className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition"
            >
              + Add Expense
            </button>
          </div>
        </div>
        {loading ? (
          <div className="text-gray-600">Loading...</div>
        ) : (
          <div className="max-h-[560px] overflow-auto border rounded-lg">
            <table className="w-full min-w-[560px] text-sm">
                <thead className="bg-gray-50 text-xs text-gray-600 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold">Date</th>
                    <th className="text-left px-3 py-2 font-semibold">Description</th>
                    <th className="text-left px-3 py-2 font-semibold">Account</th>
                    <th className="text-right px-3 py-2 font-semibold">Debit</th>
                    <th className="text-right px-3 py-2 font-semibold">Credit</th>
                    <th className="text-right px-3 py-2 font-semibold">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {Object.keys(openingBalance).length > 0 && (
                    <tr className="bg-gray-50/60">
                      <td className="px-3 py-2 text-xs text-gray-500" colSpan={5}>Opening balance</td>
                      <td className="px-3 py-2 text-right text-xs font-semibold text-gray-700">
                        {Object.entries(openingBalance).map(([c, v]) => (
                          <div key={c}>{numberFormatter.format(v)} {c === 'DEFAULT' ? '' : c}</div>
                        ))}
                      </td>
                    </tr>
                  )}
                  {ledger.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-6 text-center text-gray-500">No ledger items for this filter.</td>
                    </tr>
                  ) : (
                    ledger.map((it) => (
                      <tr key={`${it.kind}_${it.id}`} className={it.pending ? 'bg-amber-50/40' : ''}>
                        <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">
                          {new Date(it.date).toLocaleDateString()}
                        </td>
                        <td className="px-3 py-2">
                          <div className="text-sm">{it.title}</div>
                          <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
                            {it.pending && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-200">PENDING</span>
                            )}
                            {it.kind === 'income' && it.meta?.source && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${it.meta.source === 'GIVING' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
                                {it.meta.source}
                              </span>
                            )}
                            {it.meta?.attachmentUrl && (
                              <a className="text-[10px] underline text-gray-600" href={it.meta.attachmentUrl} target="_blank" rel="noreferrer">Receipt</a>
                            )}
                            {it.meta?.voidsIncomeId && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full border bg-gray-50 text-gray-700 border-gray-200">Reversal</span>
                            )}
                            {it.meta?.source === 'MANUAL' && it.amount > 0 && !voidedIds.has(it.id) && (
                              <button type="button" onClick={() => voidManualIncome(it.id)} className="text-[10px] px-1.5 py-0.5 rounded border hover:bg-gray-50">
                                Void
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-600">{it.account}</td>
                        <td className="px-3 py-2 text-right font-medium text-green-700 whitespace-nowrap">
                          {it.kind === 'income' ? numberFormatter.format(it.amount) : ''}
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-red-700 whitespace-nowrap">
                          {it.kind === 'expense' ? numberFormatter.format(it.amount) : ''}
                        </td>
                        <td className="px-3 py-2 text-right text-xs text-gray-700 whitespace-nowrap">
                          {it.runningBalance !== undefined ? numberFormatter.format(it.runningBalance) : ''}
                        </td>
                      </tr>
                    ))
                  )}
                  {Object.keys(closingBalance).length > 0 && (
                    <tr className="bg-gray-50 font-semibold">
                      <td className="px-3 py-2 text-xs" colSpan={5}>Closing balance</td>
                      <td className="px-3 py-2 text-right text-xs">
                        {Object.entries(closingBalance).map(([c, v]) => (
                          <div key={c}>{numberFormatter.format(v)} {c === 'DEFAULT' ? '' : c}</div>
                        ))}
                      </td>
                    </tr>
                  )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border p-5">
        <h2 className="text-lg font-semibold mb-3">Expenses</h2>
        {loading ? (
          <div className="text-gray-600">Loading...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {expenses.length === 0 ? (
              <div className="text-gray-600">No expenses for this filter.</div>
            ) : (
              expenses.map((e) => (
                <div key={e.id} className="border rounded-lg p-3">
                  <div className="text-sm font-semibold">{e.category}</div>
                  <div className="text-xs text-gray-600">{new Date(e.expenseDate).toLocaleDateString()} {e.branchId ? `• Branch: ${e.branchId}` : ''}</div>
                  {e.description && <div className="text-sm mt-1">{e.description}</div>}
                  <div className="text-sm font-bold mt-2">-{e.amount} {e.currency || ''}</div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {expenseModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setExpenseModalOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-lg p-5 space-y-3 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Add Expense</h2>
              <button
                type="button"
                onClick={() => setExpenseModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-600">Amount</label>
                <input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={expenseForm.amount} onChange={(e) => setExpenseForm((p) => ({ ...p, amount: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">Currency (optional)</label>
                <select className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={expenseForm.currency} onChange={(e) => setExpenseForm((p) => ({ ...p, currency: e.target.value }))}>
                  <option value="">Default</option>
                  {['NGN','USD','GBP','EUR','CAD','AUD','ZAR','GHS','KES'].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">Category</label>
                <select className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={expenseForm.category} onChange={(e) => setExpenseForm((p) => ({ ...p, category: e.target.value }))}>
                  {['Rent','Utilities','Welfare','Transport','Media','Maintenance','Salaries','Missions','Other'].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">Date</label>
                <input type="date" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={expenseForm.expenseDate} onChange={(e) => setExpenseForm((p) => ({ ...p, expenseDate: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600">Description (optional)</label>
              <input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={expenseForm.description} onChange={(e) => setExpenseForm((p) => ({ ...p, description: e.target.value }))} />
            </div>
            <div className="flex gap-2 pt-1">
              <button disabled={saving} onClick={createExpense} className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold text-sm disabled:opacity-60">
                {saving ? 'Saving...' : 'Save Expense'}
              </button>
              <button type="button" onClick={() => setExpenseModalOpen(false)} className="px-4 py-2 rounded-lg border text-sm">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {incomeModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setIncomeModalOpen(false)}
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-lg p-5 space-y-3 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Add Income (Manual)</h2>
              <button
                type="button"
                onClick={() => setIncomeModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-600">Amount</label>
                <input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={incomeForm.amount} onChange={(e) => setIncomeForm((p) => ({ ...p, amount: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">Currency (optional)</label>
                <select className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={incomeForm.currency} onChange={(e) => setIncomeForm((p) => ({ ...p, currency: e.target.value }))}>
                  <option value="">Default</option>
                  {['NGN','USD','GBP','EUR','CAD','AUD','ZAR','GHS','KES'].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">Source</label>
                <select className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={incomeForm.source} onChange={(e) => setIncomeForm((p) => ({ ...p, source: e.target.value }))}>
                  {['Cash Offering','Bank Transfer','Grant','Fundraising','Sponsorship','Venue Rental','Other'].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600">Date</label>
                <input type="date" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={incomeForm.incomeDate} onChange={(e) => setIncomeForm((p) => ({ ...p, incomeDate: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600">Description (optional)</label>
              <input className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" value={incomeForm.description} onChange={(e) => setIncomeForm((p) => ({ ...p, description: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600">Receipt (optional: PDF/JPG/PNG/WebP, max 10MB)</label>
              <input type="file" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" accept="application/pdf,image/*" onChange={(e) => setIncomeReceipt(e.target.files?.[0] || null)} />
            </div>
            <div className="flex gap-2 pt-1">
              <button disabled={incomeSaving} onClick={createIncome} className="px-4 py-2 rounded-lg bg-green-600 text-white font-semibold text-sm disabled:opacity-60">
                {incomeSaving ? 'Saving...' : 'Save Income'}
              </button>
              <button type="button" onClick={() => setIncomeModalOpen(false)} className="px-4 py-2 rounded-lg border text-sm">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
