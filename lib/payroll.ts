import { SalaryService, WageScaleService, PayrollPositionService, PayrollPeriodService, PayrollRecordService } from './services/payroll-service'

/**
 * Calculate payroll for a user based on their salary and period
 */
type PayrollCalcSalary = { wageScaleId: string; positionId: string }
type PayrollCalcScale = {
  type?: string | null
  amount?: number | null
  commissionRate?: number | null
  benefits?: number | null
  deductions?: number | null
}

/** Pure payroll calculation over already-resolved salary/wage-scale data */
function computePayrollAmounts(
  wageScale: PayrollCalcScale,
  periodStart: Date,
  periodEnd: Date,
  hoursWorked?: number,
  commissionEarned?: number,
  bonuses: number = 0,
  allowances: number = 0,
  deductions: number = 0,
  taxes: number = 0
) {
  const type = wageScale.type || 'SALARY'
  const amount = wageScale.amount || 0

  let baseAmount = 0
  let grossAmount = 0

  const salaryType = type
  switch (salaryType) {
    case 'SALARY':
      // Monthly salary - calculate prorated amount if needed
      const daysInPeriod = Math.ceil(
        (periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)
      )
      const daysInMonth = new Date(
        periodEnd.getFullYear(),
        periodEnd.getMonth() + 1,
        0
      ).getDate()
      baseAmount = (amount / daysInMonth) * daysInPeriod
      break

    case 'HOURLY':
      if (hoursWorked === undefined || hoursWorked === null) {
        throw new Error('Hours worked required for hourly workers')
      }
      baseAmount = amount * hoursWorked
      break

    case 'COMMISSION':
      if (commissionEarned === undefined) {
        throw new Error('Commission earned required for commission-based workers')
      }
      baseAmount = commissionEarned
      if (wageScale.commissionRate) {
        baseAmount = commissionEarned * (wageScale.commissionRate / 100)
      }
      break

    case 'STIPEND':
      baseAmount = amount
      break
  }

  // Calculate gross amount
  grossAmount = baseAmount + bonuses + allowances + (wageScale.benefits || 0)

  // Calculate net amount
  const totalDeductions = deductions + (wageScale.deductions || 0) + taxes
  const netAmount = grossAmount - totalDeductions

  return {
    baseAmount,
    grossAmount,
    netAmount,
    bonuses,
    allowances,
    deductions: totalDeductions,
    taxes,
    hoursWorked,
    commissionEarned,
  }
}

/**
 * Calculate payroll for a user based on their salary and period
 */
export async function calculatePayroll(
  userId: string,
  periodStart: Date,
  periodEnd: Date,
  hoursWorked?: number,
  commissionEarned?: number,
  bonuses: number = 0,
  allowances: number = 0,
  deductions: number = 0,
  taxes: number = 0
) {
  const salaries = await SalaryService.findByUser(userId)
  const userSalary = salaries.find(s => !s.endDate) // Active salary

  if (!userSalary) {
    throw new Error('User does not have an active salary assignment')
  }

  // Get wage scale and position
  const [wageScale, position] = await Promise.all([
    WageScaleService.findById(userSalary.wageScaleId),
    PayrollPositionService.findById(userSalary.positionId),
  ])
  if (!wageScale || !position) {
    throw new Error('Salary configuration incomplete')
  }

  return computePayrollAmounts(
    wageScale,
    periodStart,
    periodEnd,
    hoursWorked,
    commissionEarned,
    bonuses,
    allowances,
    deductions,
    taxes
  )
}

/**
 * Create a payroll period
 */
export async function createPayrollPeriod(
  churchId: string,
  periodName: string,
  startDate: Date,
  endDate: Date,
  payDate: Date
) {
  return await PayrollPeriodService.create({
    churchId,
    periodName,
    startDate,
    endDate,
    payDate,
    status: 'PENDING',
  })
}

/**
 * Generate payroll records for all active employees in a period
 */
export async function generatePayrollRecords(
  periodId: string,
  churchId: string
) {
  const periods = await PayrollPeriodService.findByChurch(churchId)
  const period = periods.find(p => p.id === periodId)

  if (!period) {
    throw new Error('Payroll period not found')
  }

  // Get all users in church
  const { UserService } = await import('./services/user-service')
  const { prisma } = await import('./prisma')
  const allUsers = await UserService.findByChurch(churchId)

  // Fetch existing records once to avoid re-querying inside the loop
  const existingRecords = await PayrollRecordService.findByPeriod(periodId)
  const existingUserIds = new Set(existingRecords.map(r => r.userId))

  // Batch-load all church salaries, wage scales, and positions (avoids N+1
  // inside the per-user loop and inside calculatePayroll)
  const allSalaries = await prisma.userSalary.findMany({ where: { churchId } })
  const salariesByUser = new Map<string, typeof allSalaries>()
  for (const s of allSalaries) {
    const list = salariesByUser.get(s.userId) ?? []
    list.push(s)
    salariesByUser.set(s.userId, list)
  }

  const wageScaleIds = [...new Set(allSalaries.map((s) => s.wageScaleId))]
  const positionIds = [...new Set(allSalaries.map((s) => s.positionId))]
  const [wageScales, positions] = await Promise.all([
    prisma.wageScale.findMany({ where: { id: { in: wageScaleIds } } }),
    prisma.payrollPosition.findMany({ where: { id: { in: positionIds } } }),
  ])
  const wageScaleById = new Map(wageScales.map((w) => [w.id, w]))
  const positionById = new Map(positions.map((p) => [p.id, p]))

  const records = []
  const errors = []

  for (const user of allUsers) {
    try {
      if (existingUserIds.has(user.id)) {
        continue // Skip if already exists
      }

      // Get active salary for user (from preloaded map)
      const salaries = salariesByUser.get(user.id) ?? []
      const activeSalary = salaries.find(s =>
        new Date(s.startDate) <= period.endDate &&
        (!s.endDate || new Date(s.endDate) >= period.startDate)
      )

      if (!activeSalary) {
        continue
      }

      // Calculate payroll from preloaded wage scale/position
      const wageScale = wageScaleById.get(activeSalary.wageScaleId)
      const position = positionById.get(activeSalary.positionId)
      if (!wageScale || !position) {
        throw new Error('Salary configuration incomplete')
      }
      const calculation = computePayrollAmounts(
        wageScale,
        period.startDate,
        period.endDate
      )

      // Create payroll record
      const record = await PayrollRecordService.create({
        periodId,
        userId: user.id,
        salaryId: activeSalary.id,
        grossAmount: calculation.grossAmount,
        deductions: calculation.deductions,
        netAmount: calculation.netAmount,
        status: 'PENDING',
      })

      records.push(record)
    } catch (error: any) {
      // Log error but continue with next user
      errors.push({
        userId: user.id,
        userName: `${user.firstName} ${user.lastName}`,
        error: error.message,
      })
      console.error(`Error generating payroll for user ${user.id}:`, error)
    }
  }

  return {
    records,
    errors,
    total: records.length,
    failed: errors.length,
  }
}

/**
 * Get payroll summary for a church
 */
export async function getPayrollSummary(churchId: string, startDate?: Date, endDate?: Date) {
  // Get all periods for church
  const periods = await PayrollPeriodService.findByChurch(churchId)
  const relevantPeriods = periods.filter(p => {
    if (startDate && p.endDate < startDate) return false
    if (endDate && p.startDate > endDate) return false
    return true
  })

  // Get all records for these periods in one query (avoids N+1)
  const { prisma } = await import('./prisma')
  const fetchedRecords: any[] = relevantPeriods.length
    ? await prisma.payrollRecord.findMany({
        where: { periodId: { in: relevantPeriods.map((p) => p.id) } },
      })
    : []

  // Filter by date if needed
  let allRecords = fetchedRecords
  if (startDate || endDate) {
    allRecords = fetchedRecords.filter(r => {
      const createdAt = r.createdAt
      if (startDate && createdAt < startDate) return false
      if (endDate && createdAt > endDate) return false
      return true
    })
  }

  const totalRecords = allRecords.length
  const paidRecords = allRecords.filter(r => r.status === 'PAID').length
  const pendingRecords = allRecords.filter(r => r.status === 'PENDING').length
  const totalPaid = allRecords
    .filter(r => r.status === 'PAID')
    .reduce((sum, r) => sum + (r.netAmount || 0), 0)
  const totalPending = allRecords
    .filter(r => r.status === 'PENDING')
    .reduce((sum, r) => sum + (r.netAmount || 0), 0)

  return {
    totalRecords,
    paidRecords,
    pendingRecords,
    totalPaid,
    totalPending,
  }
}

