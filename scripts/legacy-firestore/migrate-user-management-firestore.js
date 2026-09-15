/**
 * One-time ETL: Firestore -> PostgreSQL for the User Management module.
 *
 * Migrates (in FK-safe order):
 *   subscription_plans -> SubscriptionPlan
 *   subscriptions      -> Subscription (deduped by churchId)
 *   staff_levels       -> StaffLevel
 *   church_designations-> Designation
 *   church_invites     -> ChurchInvite
 *   payroll_positions  -> PayrollPosition
 *   wage_scales        -> WageScale
 *   payroll_periods    -> PayrollPeriod
 *   payroll_payments   -> UserSalary (kind='salary' / has wageScaleId)
 *                     -> PayrollRecord (everything else)
 *   check_ins          -> ChildrenCheckIn
 *   follow_ups         -> FollowUp
 *   mentor_assignments -> MentorAssignment (deduped by mentorId+menteeId)
 *   usage_metrics      -> UsageTracking (aggregated {metricType,value,period})
 *
 * Then backfills User.firestoreData JSON -> promoted staff/designation columns.
 *
 * Safety properties:
 *   - Idempotent: all writes are upserts keyed on the Firestore doc id. Safe to re-run.
 *   - No superuser required: FK checks stay enabled; dangling references are skipped
 *     and reported instead of being force-inserted.
 *   - Non-destructive: never deletes or overwrites Firestore; raw docs are preserved
 *     in each row's firestoreData column where the model has one.
 *
 * Usage:
 *   FIREBASE_SERVICE_ACCOUNT_PATH=/path/sa.json DATABASE_URL=... \
 *     node scripts/migrate-user-management-firestore.js
 *
 *   DRY_RUN=1  -> report counts only, no writes
 */

const fs = require('fs')
const admin = require('firebase-admin')
const { PrismaClient } = require('@prisma/client')

const DRY_RUN = process.env.DRY_RUN === '1'

// ---------- firebase init (same convention as existing scripts) ----------
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH
if (!serviceAccountPath || !fs.existsSync(serviceAccountPath)) {
  console.error('FIREBASE_SERVICE_ACCOUNT_PATH not set or file not found')
  process.exit(1)
}
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'))
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id,
})
const firestore = admin.firestore()
const prisma = new PrismaClient()

// ---------- helpers ----------
function toDate(value) {
  if (!value) return undefined
  if (typeof value.toDate === 'function') return value.toDate()
  if (value instanceof Date) return value
  const d = new Date(value)
  return isNaN(d.getTime()) ? undefined : d
}

function toPlainJson(obj) {
  if (obj === null || obj === undefined) return obj
  if (typeof obj.toDate === 'function') return obj.toDate().toISOString()
  if (Array.isArray(obj)) return obj.map(toPlainJson)
  if (typeof obj === 'object') {
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, toPlainJson(v)]))
  }
  return obj
}

function toEnum(value, allowed, fallback) {
  const v = String(value || '').toUpperCase()
  return allowed.includes(v) ? v : fallback
}

const stats = {}
function bump(key, n = 1) {
  stats[key] = (stats[key] || 0) + n
}

async function upsert(model, where, create, label) {
  if (DRY_RUN) {
    bump(`${label}:would-write`)
    return
  }
  await model.upsert({ where, update: create, create })
  bump(`${label}:ok`)
}

async function getDocs(collection) {
  const snap = await firestore.collection(collection).get()
  bump(`${collection}:fetched`, snap.size)
  return snap.docs
}

// ---------- FK reference sets (prefetched once) ----------
async function loadIdSets() {
  const [users, churches, departments, plans, positions, wageScales, periods,
    readingPlans, badges, categories, events] =
    await Promise.all([
      prisma.user.findMany({ select: { id: true } }),
      prisma.church.findMany({ select: { id: true } }),
      prisma.department.findMany({ select: { id: true } }),
      prisma.subscriptionPlan.findMany({ select: { id: true } }),
      prisma.payrollPosition.findMany({ select: { id: true } }),
      prisma.wageScale.findMany({ select: { id: true } }),
      prisma.payrollPeriod.findMany({ select: { id: true } }),
      prisma.readingPlan.findMany({ select: { id: true } }),
      prisma.badge.findMany({ select: { id: true } }),
      prisma.readingResourceCategory.findMany({ select: { id: true } }),
      prisma.event.findMany({ select: { id: true } }),
    ])
  return {
    users: new Set(users.map((r) => r.id)),
    churches: new Set(churches.map((r) => r.id)),
    departments: new Set(departments.map((r) => r.id)),
    plans: new Set(plans.map((r) => r.id)),
    positions: new Set(positions.map((r) => r.id)),
    wageScales: new Set(wageScales.map((r) => r.id)),
    periods: new Set(periods.map((r) => r.id)),
    readingPlans: new Set(readingPlans.map((r) => r.id)),
    badges: new Set(badges.map((r) => r.id)),
    categories: new Set(categories.map((r) => r.id)),
    events: new Set(events.map((r) => r.id)),
  }
}

// ---------- collection migrations ----------

async function migratePlans() {
  for (const doc of await getDocs('subscription_plans')) {
    const d = doc.data()
    const create = {
      id: doc.id,
      name: d.name || 'Migrated Plan',
      type: toEnum(d.type, ['FREE', 'BASIC', 'PRO', 'ENTERPRISE'], 'FREE'),
      description: d.description ?? null,
      price: Number(d.price) || 0,
      currency: d.currency || 'USD',
      maxUsers: d.maxUsers ?? null,
      maxStorageGB: d.maxStorageGB ?? null,
      maxSermons: d.maxSermons ?? null,
      maxEvents: d.maxEvents ?? null,
      maxDepartments: d.maxDepartments ?? null,
      maxGroups: d.maxGroups ?? null,
      features: Array.isArray(d.features) ? d.features.map(String) : [],
      billingCycle: d.billingCycle || 'monthly',
      trialDays: Number(d.trialDays) || 0,
      createdAt: toDate(d.createdAt) || new Date(),
      firestoreData: toPlainJson(d),
    }
    await upsert(prisma.subscriptionPlan, { id: doc.id }, create, 'subscriptionPlan')
  }
}

const SUB_STATUS_RANK = { ACTIVE: 4, TRIAL: 3, SUSPENDED: 2, CANCELLED: 1, EXPIRED: 0 }

async function migrateSubscriptions(ids) {
  // Subscription.churchId is unique — keep the "best" doc per church.
  const byChurch = new Map()
  for (const doc of await getDocs('subscriptions')) {
    const d = doc.data()
    if (!d.churchId) {
      bump('subscription:skipped:no-church')
      continue
    }
    const status = toEnum(d.status, Object.keys(SUB_STATUS_RANK), 'ACTIVE')
    const prev = byChurch.get(d.churchId)
    const better =
      !prev ||
      SUB_STATUS_RANK[status] > SUB_STATUS_RANK[prev.status] ||
      (SUB_STATUS_RANK[status] === SUB_STATUS_RANK[prev.status] &&
        (toDate(d.createdAt)?.getTime() || 0) > (prev.createdAt?.getTime() || 0))
    if (better) byChurch.set(d.churchId, { doc, d, status })
    else bump('subscription:skipped:duplicate-church')
  }

  // Fallback plan for subscriptions whose planId references a deleted plan doc.
  // Defaults to 'starter' when present, otherwise the first migrated plan.
  let fallbackPlanId = process.env.FALLBACK_PLAN_ID || null
  if (!fallbackPlanId) {
    if (ids.plans.has('starter')) fallbackPlanId = 'starter'
    else fallbackPlanId = [...ids.plans][0] || null
  }

  for (const { doc, d, status } of byChurch.values()) {
    if (!ids.churches.has(d.churchId)) {
      bump('subscription:skipped:no-church-row')
      continue
    }
    let planId = ids.plans.has(d.planId) ? d.planId : null
    if (!planId && fallbackPlanId) {
      planId = fallbackPlanId
      bump('subscription:plan-fallback')
    }
    if (!planId) {
      bump('subscription:skipped:no-plan')
      continue
    }
    const start = toDate(d.startDate) || toDate(d.currentPeriodStart) || toDate(d.createdAt) || new Date()
    const end =
      toDate(d.endDate) ||
      toDate(d.currentPeriodEnd) ||
      new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000)
    const create = {
      id: doc.id,
      churchId: d.churchId,
      planId,
      status,
      currentPeriodStart: start,
      currentPeriodEnd: end,
      cancelAtPeriodEnd: Boolean(d.cancelAtPeriodEnd),
      cancelledAt: toDate(d.cancelledAt) ?? null,
      paymentMethodId: d.paymentMethodId ?? null,
      lastPaymentDate: toDate(d.lastPaymentDate) ?? null,
      nextBillingDate: toDate(d.nextBillingDate) ?? null,
      trialStart: toDate(d.trialStart) ?? null,
      trialEnd: toDate(d.trialEndsAt) ?? toDate(d.trialEnd) ?? null,
      createdAt: toDate(d.createdAt) || new Date(),
      firestoreData: toPlainJson(d),
    }
    await upsert(prisma.subscription, { id: doc.id }, create, 'subscription')
  }
}

async function migrateStaffLevels(ids) {
  for (const doc of await getDocs('staff_levels')) {
    const d = doc.data()
    if (!ids.churches.has(d.churchId)) {
      bump('staffLevel:skipped:no-church')
      continue
    }
    const create = {
      id: doc.id,
      churchId: d.churchId,
      name: d.name || 'Migrated Level',
      description: d.description ?? null,
      defaultWageAmount: Number(d.defaultWageAmount) || 0,
      currency: d.currency || 'USD',
      payFrequency: d.payFrequency || 'monthly',
      order: Number.isFinite(d.order) ? d.order : 0,
      isDefault: Boolean(d.isDefault),
      createdAt: toDate(d.createdAt) || new Date(),
    }
    await upsert(prisma.staffLevel, { id: doc.id }, create, 'staffLevel')
  }
}

async function migrateDesignations(ids) {
  for (const doc of await getDocs('church_designations')) {
    const d = doc.data()
    if (!ids.churches.has(d.churchId)) {
      bump('designation:skipped:no-church')
      continue
    }
    const create = {
      id: doc.id,
      churchId: d.churchId,
      name: d.name || 'Migrated Designation',
      description: d.description ?? null,
      category: d.category ?? null,
      key: d.key ?? null,
      isDefault: Boolean(d.isDefault),
      isProtected: Boolean(d.isProtected),
      createdAt: toDate(d.createdAt) || new Date(),
    }
    await upsert(prisma.designation, { id: doc.id }, create, 'designation')
  }
}

async function migrateInvites(ids) {
  for (const doc of await getDocs('church_invites')) {
    const d = doc.data()
    if (!ids.churches.has(d.churchId) || !d.tokenHash) {
      bump('churchInvite:skipped')
      continue
    }
    const create = {
      id: doc.id,
      churchId: d.churchId,
      createdByUserId: d.createdByUserId || 'unknown',
      purpose: d.purpose || 'MEMBER_SIGNUP',
      tokenHash: d.tokenHash,
      status: String(d.status || 'ACTIVE').toUpperCase(),
      branchId: d.branchId ?? null,
      targetRole: d.targetRole ?? null,
      expiresAt: toDate(d.expiresAt) ?? null,
      revokedAt: toDate(d.revokedAt) ?? null,
      usedAt: toDate(d.usedAt) ?? null,
      usedByUserId: d.usedByUserId ?? null,
      createdAt: toDate(d.createdAt) || new Date(),
    }
    await upsert(prisma.churchInvite, { id: doc.id }, create, 'churchInvite')
  }
}

async function migratePositions(ids) {
  for (const doc of await getDocs('payroll_positions')) {
    const d = doc.data()
    if (!ids.churches.has(d.churchId)) {
      bump('payrollPosition:skipped:no-church')
      continue
    }
    const departmentId = ids.departments.has(d.departmentId) ? d.departmentId : null
    if (d.departmentId && !departmentId) bump('payrollPosition:bad-department')
    const create = {
      id: doc.id,
      churchId: d.churchId,
      departmentId,
      name: d.name || 'Migrated Position',
      description: d.description ?? null,
      isActive: d.isActive !== false,
      createdAt: toDate(d.createdAt) || new Date(),
      firestoreData: toPlainJson(d),
    }
    await upsert(prisma.payrollPosition, { id: doc.id }, create, 'payrollPosition')
    ids.positions.add(doc.id)
  }
}

async function migrateWageScales(ids) {
  for (const doc of await getDocs('wage_scales')) {
    const d = doc.data()
    if (!ids.churches.has(d.churchId) || !ids.positions.has(d.positionId)) {
      bump('wageScale:skipped:bad-ref')
      continue
    }
    const create = {
      id: doc.id,
      positionId: d.positionId,
      churchId: d.churchId,
      type: toEnum(d.type, ['SALARY', 'HOURLY', 'COMMISSION', 'STIPEND'], 'SALARY'),
      amount: Number(d.amount) || 0,
      currency: d.currency || 'USD',
      hoursPerWeek: d.hoursPerWeek ?? null,
      commissionRate: d.commissionRate ?? null,
      benefits: Number(d.benefits) || 0,
      deductions: Number(d.deductions) || 0,
      effectiveFrom: toDate(d.effectiveFrom) || toDate(d.createdAt) || new Date(),
      effectiveTo: toDate(d.effectiveTo) ?? null,
      notes: d.notes ?? null,
      createdAt: toDate(d.createdAt) || new Date(),
      firestoreData: toPlainJson(d), // preserves payFrequency, not a Prisma column
    }
    await upsert(prisma.wageScale, { id: doc.id }, create, 'wageScale')
    ids.wageScales.add(doc.id)
  }
}

async function migratePeriods(ids) {
  for (const doc of await getDocs('payroll_periods')) {
    const d = doc.data()
    if (!ids.churches.has(d.churchId)) {
      bump('payrollPeriod:skipped:no-church')
      continue
    }
    const start = toDate(d.startDate) || new Date()
    const end = toDate(d.endDate) || start
    const create = {
      id: doc.id,
      churchId: d.churchId,
      periodName:
        d.periodName ||
        `Migrated ${start.toISOString().slice(0, 10)} - ${end.toISOString().slice(0, 10)}`,
      startDate: start,
      endDate: end,
      payDate: toDate(d.payDate) || end,
      status: toEnum(d.status, ['PENDING', 'APPROVED', 'PAID', 'CANCELLED'], 'PENDING'),
      totalAmount: Number(d.totalAmount) || 0,
      totalEmployees: Number(d.totalEmployees) || 0,
      createdAt: toDate(d.createdAt) || new Date(),
      firestoreData: toPlainJson(d),
    }
    await upsert(prisma.payrollPeriod, { id: doc.id }, create, 'payrollPeriod')
    ids.periods.add(doc.id)
  }
}

async function migratedPositionFor(churchId, ids) {
  const key = `migrated:${churchId}`
  if (!ids.positions.has(key)) {
    const existing = await prisma.payrollPosition.findFirst({
      where: { churchId, name: 'Migrated (legacy)' },
    })
    const row =
      existing ||
      (DRY_RUN
        ? { id: `dry-${churchId}` }
        : await prisma.payrollPosition.create({
            data: { churchId, name: 'Migrated (legacy)', description: 'Placeholder for legacy payroll records' },
          }))
    ids.positions.add(key)
    ids.positionByKey = ids.positionByKey || new Map()
    ids.positionByKey.set(key, row.id)
  }
  return ids.positionByKey.get(key)
}

async function migratePayments(ids) {
  for (const doc of await getDocs('payroll_payments')) {
    const d = doc.data()
    // Salary docs were stamped kind='salary' after the collision fix; older docs
    // are distinguished by which shape fields they carry.
    const isSalary =
      d.kind === 'salary' || (d.kind === undefined && d.wageScaleId !== undefined)

    if (isSalary) {
      if (
        !ids.users.has(d.userId) ||
        !ids.positions.has(d.positionId) ||
        !ids.wageScales.has(d.wageScaleId) ||
        !ids.churches.has(d.churchId)
      ) {
        bump('userSalary:skipped:bad-ref')
        continue
      }
      const create = {
        id: doc.id,
        userId: d.userId,
        positionId: d.positionId,
        wageScaleId: d.wageScaleId,
        churchId: d.churchId,
        type: toEnum(d.type, ['SALARY', 'HOURLY', 'COMMISSION', 'STIPEND'], 'SALARY'),
        amount: Number(d.amount) || 0,
        currency: d.currency || 'USD',
        startDate: toDate(d.startDate) || toDate(d.createdAt) || new Date(),
        endDate: toDate(d.endDate) ?? null,
        isActive: d.isActive !== false,
        createdAt: toDate(d.createdAt) || new Date(),
        firestoreData: toPlainJson(d),
      }
      await upsert(prisma.userSalary, { id: doc.id }, create, 'userSalary')
    } else {
      if (!ids.users.has(d.userId) || !ids.periods.has(d.periodId)) {
        bump('payrollRecord:skipped:bad-ref')
        continue
      }
      const churchId = d.churchId || (await churchForPeriod(d.periodId))
      if (!churchId || !ids.churches.has(churchId)) {
        bump('payrollRecord:skipped:no-church')
        continue
      }
      const positionId = ids.positions.has(d.positionId)
        ? d.positionId
        : await migratedPositionFor(churchId, ids)
      const create = {
        id: doc.id,
        userId: d.userId,
        periodId: d.periodId,
        churchId,
        positionId,
        baseAmount: Number(d.baseAmount ?? d.amount ?? d.grossAmount) || 0,
        type: toEnum(d.type, ['SALARY', 'HOURLY', 'COMMISSION', 'STIPEND'], 'SALARY'),
        hoursWorked: d.hoursWorked ?? null,
        commissionEarned: d.commissionEarned ?? null,
        bonuses: Number(d.bonuses) || 0,
        allowances: Number(d.allowances) || 0,
        deductions: Number(d.deductions) || 0,
        taxes: Number(d.taxes) || 0,
        grossAmount: Number(d.grossAmount ?? d.netAmount) || 0,
        netAmount: Number(d.netAmount ?? d.grossAmount) || 0,
        status: toEnum(d.status, ['PENDING', 'APPROVED', 'PAID', 'CANCELLED'], 'PENDING'),
        paymentMethod: toEnum(
          d.paymentMethod,
          ['BANK_TRANSFER', 'CHECK', 'CASH', 'MOBILE_MONEY'],
          null
        ),
        paymentDate: toDate(d.paymentDate) ?? toDate(d.paidAt) ?? null,
        transactionReference: d.transactionReference ?? null,
        notes: d.notes ?? null,
        createdAt: toDate(d.createdAt) || new Date(),
        firestoreData: toPlainJson(d),
      }
      await upsert(prisma.payrollRecord, { id: doc.id }, create, 'payrollRecord')
    }
  }
}

async function churchForPeriod(periodId) {
  const p = await prisma.payrollPeriod.findUnique({
    where: { id: periodId },
    select: { churchId: true },
  })
  return p?.churchId
}

async function migrateCheckIns(ids) {
  // The check_ins collection is mixed: child check-ins carry childId+parentId,
  // general member check-ins carry userId (+ optional eventId). Split by shape.
  for (const doc of await getDocs('check_ins')) {
    const d = doc.data()

    if (d.childId || d.parentId) {
      if (!ids.users.has(d.parentId) || !d.childId) {
        bump('childrenCheckIn:skipped:bad-ref')
        continue
      }
      const create = {
        id: doc.id,
        childId: d.childId,
        parentId: d.parentId,
        qrCode: d.qrCode || `migrated-${doc.id}`,
        checkedInAt: toDate(d.checkedInAt) || toDate(d.createdAt) || new Date(),
        checkedOutAt: toDate(d.checkedOutAt) ?? null,
        createdAt: toDate(d.createdAt) || new Date(),
        firestoreData: toPlainJson(d),
      }
      await upsert(prisma.childrenCheckIn, { id: doc.id }, create, 'childrenCheckIn')
      continue
    }

    // General member check-in
    if (!ids.users.has(d.userId)) {
      bump('checkIn:skipped:no-user')
      continue
    }
    const create = {
      id: doc.id,
      userId: d.userId,
      eventId: ids.events.has(d.eventId) ? d.eventId : null,
      qrCode: d.qrCode || `ci-${doc.id}`,
      location: d.location ?? null,
      checkedInAt: toDate(d.checkedInAt) || toDate(d.createdAt) || new Date(),
      createdAt: toDate(d.createdAt) || new Date(),
      firestoreData: toPlainJson(d),
    }
    await upsert(prisma.checkIn, { id: doc.id }, create, 'checkIn')
  }
}

async function migrateFollowUps(ids) {
  for (const doc of await getDocs('follow_ups')) {
    const d = doc.data()
    if (!ids.users.has(d.userId)) {
      bump('followUp:skipped:no-user')
      continue
    }
    const create = {
      id: doc.id,
      userId: d.userId,
      type: d.type || 'New Convert',
      message: d.message || '',
      scripture: d.scripture ?? null,
      sentAt: toDate(d.sentAt) || toDate(d.createdAt) || new Date(),
      readAt: toDate(d.readAt) ?? null,
      firestoreData: toPlainJson(d),
    }
    await upsert(prisma.followUp, { id: doc.id }, create, 'followUp')
  }
}

async function migrateMentorAssignments(ids) {
  const seen = new Set()
  for (const doc of await getDocs('mentor_assignments')) {
    const d = doc.data()
    const pair = `${d.mentorId}:${d.menteeId}`
    if (!ids.users.has(d.mentorId) || !ids.users.has(d.menteeId)) {
      bump('mentorAssignment:skipped:bad-ref')
      continue
    }
    if (seen.has(pair)) {
      bump('mentorAssignment:skipped:duplicate')
      continue
    }
    seen.add(pair)
    const create = {
      id: doc.id,
      mentorId: d.mentorId,
      menteeId: d.menteeId,
      assignedAt: toDate(d.assignedAt) || toDate(d.createdAt) || new Date(),
      status: d.status || 'Active',
      firestoreData: toPlainJson(d),
    }
    await upsert(prisma.mentorAssignment, { id: doc.id }, create, 'mentorAssignment')
  }
}

const USAGE_COLUMNS = new Set([
  'userCount',
  'storageUsedGB',
  'sermonsCount',
  'eventsCount',
  'apiCalls',
  'aiCoachingSessions',
])

async function migrateUsageMetrics(ids) {
  // Firestore shape: one doc per {churchId, metricType, period}.
  // Prisma shape: one row per {churchId, periodStart} with fixed columns.
  const grouped = new Map()
  for (const doc of await getDocs('usage_metrics')) {
    const d = doc.data()
    if (!USAGE_COLUMNS.has(d.metricType) || !ids.churches.has(d.churchId)) {
      bump('usageTracking:skipped')
      continue
    }
    const periodStr = String(d.period || '')
    const periodStart = /^\d{4}-\d{2}$/.test(periodStr)
      ? new Date(`${periodStr}-01T00:00:00Z`)
      : toDate(d.period)
    if (!periodStart) {
      bump('usageTracking:skipped:bad-period')
      continue
    }
    const key = `${d.churchId}|${periodStart.toISOString()}`
    const g = grouped.get(key) || { churchId: d.churchId, periodStart, metrics: {} }
    g.metrics[d.metricType] = Math.max(g.metrics[d.metricType] || 0, Number(d.value) || 0)
    grouped.set(key, g)
  }

  for (const g of grouped.values()) {
    const periodEnd = new Date(
      g.periodStart.getFullYear(),
      g.periodStart.getMonth() + 1,
      0,
      23,
      59,
      59
    )
    const data = { ...g.metrics, periodEnd }
    if (DRY_RUN) {
      bump('usageTracking:would-write')
      continue
    }
    await prisma.usageTracking.upsert({
      where: { churchId_periodStart: { churchId: g.churchId, periodStart: g.periodStart } },
      update: data,
      create: { churchId: g.churchId, periodStart: g.periodStart, ...data },
    })
    bump('usageTracking:ok')
  }
}

// ---------- AI discipleship collections ----------

async function migrateReadingPlans() {
  for (const doc of await getDocs('reading_plans')) {
    const d = doc.data()
    const create = {
      id: doc.id,
      title: d.title || 'Migrated Plan',
      description: d.description ?? null,
      duration: Number(d.duration) || 0,
      difficulty: d.difficulty ?? null,
      topics: Array.isArray(d.topics) ? d.topics.map(String) : [],
      startDate: toDate(d.startDate) ?? null,
      endDate: toDate(d.endDate) ?? null,
      createdAt: toDate(d.createdAt) || new Date(),
      firestoreData: toPlainJson(d),
    }
    await upsert(prisma.readingPlan, { id: doc.id }, create, 'readingPlan')
  }
}

async function migrateReadingPlanDays(ids) {
  for (const doc of await getDocs('reading_plan_days')) {
    const d = doc.data()
    if (!ids.readingPlans.has(d.planId)) {
      bump('readingPlanDay:skipped:no-plan')
      continue
    }
    const create = {
      id: doc.id,
      planId: d.planId,
      dayNumber: Number(d.dayNumber) || 0,
      title: d.title || `Day ${d.dayNumber}`,
      summary: d.summary ?? null,
      passageId: d.passageId || 'unknown',
      bibleVersionId: d.bibleVersionId || 'unknown',
      devotionalText: d.devotionalText ?? null,
      prayerFocus: d.prayerFocus ?? null,
      resourceIds: Array.isArray(d.resourceIds) ? d.resourceIds.map(String) : [],
      createdAt: toDate(d.createdAt) || new Date(),
      firestoreData: toPlainJson(d),
    }
    await upsert(prisma.readingPlanDay, { id: doc.id }, create, 'readingPlanDay')
  }
}

async function migrateReadingCategories() {
  for (const doc of await getDocs('reading_resource_categories')) {
    const d = doc.data()
    const create = {
      id: doc.id,
      name: d.name || 'Migrated Category',
      description: d.description ?? null,
      color: d.color ?? null,
      icon: d.icon ?? null,
      createdAt: toDate(d.createdAt) || new Date(),
      firestoreData: toPlainJson(d),
    }
    await upsert(prisma.readingResourceCategory, { id: doc.id }, create, 'readingResourceCategory')
  }
}

async function migrateReadingResources(ids) {
  for (const doc of await getDocs('reading_plan_resources')) {
    const d = doc.data()
    if (!d.createdBy) {
      bump('readingPlanResource:skipped:no-creator')
      continue
    }
    if (d.categoryId && !ids.categories.has(d.categoryId)) {
      d.categoryId = null // drop dangling category ref, keep the resource
    }
    const planIds = Array.isArray(d.planIds)
      ? d.planIds.map(String)
      : d.planId ? [String(d.planId)] : []
    const create = {
      id: doc.id,
      planIds,
      title: d.title || 'Migrated Resource',
      description: d.description ?? null,
      author: d.author ?? null,
      categoryId: d.categoryId ?? null,
      tags: Array.isArray(d.tags) ? d.tags.map(String) : [],
      type: d.type || 'link',
      fileUrl: d.fileUrl ?? null,
      fileName: d.fileName ?? null,
      filePath: d.filePath ?? null,
      contentType: d.contentType ?? null,
      size: d.size != null ? Number(d.size) : null,
      createdBy: String(d.createdBy),
      metadata: toPlainJson(d.metadata) ?? undefined,
      createdAt: toDate(d.createdAt) || new Date(),
      firestoreData: toPlainJson(d),
    }
    await upsert(prisma.readingPlanResource, { id: doc.id }, create, 'readingPlanResource')
  }
}

async function migrateReadingProgress(ids) {
  const seen = new Set()
  for (const doc of await getDocs('reading_plan_progress')) {
    const d = doc.data()
    const planId = d.readingPlanId || d.planId
    if (!ids.users.has(d.userId) || !ids.readingPlans.has(planId)) {
      bump('readingPlanProgress:skipped:bad-ref')
      continue
    }
    const pair = `${d.userId}:${planId}`
    if (seen.has(pair)) {
      bump('readingPlanProgress:skipped:duplicate')
      continue
    }
    seen.add(pair)
    const create = {
      id: doc.id,
      userId: d.userId,
      readingPlanId: planId,
      currentDay: Number(d.currentDay) || 1,
      completed: Boolean(d.completed),
      startedAt: toDate(d.startedAt) || toDate(d.createdAt) || new Date(),
      completedAt: toDate(d.completedAt) ?? null,
      createdAt: toDate(d.createdAt) || new Date(),
      firestoreData: toPlainJson(d),
    }
    await upsert(prisma.readingPlanProgress, { id: doc.id }, create, 'readingPlanProgress')
  }
}

async function migrateReadingCoachSessions(ids) {
  for (const doc of await getDocs('reading_coach_sessions')) {
    const d = doc.data()
    if (!ids.users.has(d.userId)) {
      bump('readingCoachSession:skipped:no-user')
      continue
    }
    const create = {
      id: doc.id,
      userId: d.userId,
      planId: ids.readingPlans.has(d.planId) ? d.planId : null,
      dayNumber: d.dayNumber != null ? Number(d.dayNumber) : null,
      question: d.question || '',
      answer: d.answer || '',
      actionStep: d.actionStep ?? null,
      encouragement: d.encouragement ?? null,
      scriptures: Array.isArray(d.scriptures) ? d.scriptures.map(String) : [],
      followUpQuestion: d.followUpQuestion ?? null,
      metadata: toPlainJson(d.metadata) ?? undefined,
      createdAt: toDate(d.createdAt) || new Date(),
      firestoreData: toPlainJson(d),
    }
    await upsert(prisma.readingCoachSession, { id: doc.id }, create, 'readingCoachSession')
  }
}

async function migrateReadingCoachNudges(ids) {
  for (const doc of await getDocs('reading_coach_nudges')) {
    const d = doc.data()
    if (!ids.users.has(d.userId)) {
      bump('readingCoachNudge:skipped:no-user')
      continue
    }
    const create = {
      id: doc.id,
      userId: d.userId,
      planId: ids.readingPlans.has(d.planId) ? d.planId : null,
      type: d.type || 'reminder',
      message: d.message || '',
      status: toEnum(d.status, ['PENDING', 'SENT', 'DISMISSED'], 'pending').toLowerCase(),
      scheduledAt: toDate(d.scheduledAt) ?? null,
      metadata: toPlainJson(d.metadata) ?? undefined,
      createdAt: toDate(d.createdAt) || new Date(),
      firestoreData: toPlainJson(d),
    }
    await upsert(prisma.readingCoachNudge, { id: doc.id }, create, 'readingCoachNudge')
  }
}

async function migrateAICoachingSessions(ids) {
  for (const doc of await getDocs('ai_coaching_sessions')) {
    const d = doc.data()
    if (!ids.users.has(d.userId)) {
      bump('aiCoachingSession:skipped:no-user')
      continue
    }
    const create = {
      id: doc.id,
      userId: d.userId,
      question: d.question || '',
      answer: d.answer || '',
      topic: d.topic ?? null,
      createdAt: toDate(d.createdAt) || new Date(),
      firestoreData: toPlainJson(d),
    }
    await upsert(prisma.aICoachingSession, { id: doc.id }, create, 'aiCoachingSession')
  }
}

async function migrateBibleCache() {
  for (const doc of await getDocs('bible_passage_cache')) {
    const d = doc.data()
    const bibleId = d.bibleId || String(doc.id).split('::')[0] || 'unknown'
    const passageId = d.passageId || String(doc.id).split('::').slice(1).join('::') || doc.id
    const create = {
      id: doc.id.includes('::') ? doc.id : `${bibleId}::${passageId}`,
      bibleId,
      passageId,
      reference: d.reference || passageId,
      content: d.content || '',
      html: d.html ?? null,
      copyright: d.copyright ?? null,
      fetchedAt: toDate(d.fetchedAt) || toDate(d.createdAt) || new Date(),
      createdAt: toDate(d.createdAt) || new Date(),
      firestoreData: toPlainJson(d),
    }
    await upsert(prisma.biblePassageCache, { id: create.id }, create, 'biblePassageCache')
  }
}

const BADGE_TYPES = [
  'PRAYER_STREAK', 'READING_PLAN', 'GIVING',
  'EVENT_ATTENDANCE', 'SERVING', 'EVANGELISM', 'OTHER',
]

async function migrateBadges() {
  for (const doc of await getDocs('badges')) {
    const d = doc.data()
    const create = {
      id: doc.id,
      name: d.name || 'Migrated Badge',
      description: d.description ?? null,
      type: toEnum(d.type, BADGE_TYPES, 'OTHER'),
      icon: d.icon ?? null,
      xpReward: Number(d.xpReward) || 0,
      createdAt: toDate(d.createdAt) || new Date(),
      firestoreData: toPlainJson(d),
    }
    await upsert(prisma.badge, { id: doc.id }, create, 'badge')
  }
}

async function migrateUserBadges(ids) {
  const seen = new Set()
  for (const doc of await getDocs('user_badges')) {
    const d = doc.data()
    if (!ids.users.has(d.userId) || !ids.badges.has(d.badgeId)) {
      bump('userBadge:skipped:bad-ref')
      continue
    }
    const pair = `${d.userId}:${d.badgeId}`
    if (seen.has(pair)) {
      bump('userBadge:skipped:duplicate')
      continue
    }
    seen.add(pair)
    const create = {
      id: doc.id,
      userId: d.userId,
      badgeId: d.badgeId,
      earnedAt: toDate(d.earnedAt) || toDate(d.createdAt) || new Date(),
      firestoreData: toPlainJson(d),
    }
    await upsert(prisma.userBadge, { id: doc.id }, create, 'userBadge')
  }
}

async function migrateRecommendations(ids) {
  for (const doc of await getDocs('recommendations')) {
    const d = doc.data()
    if (!ids.users.has(d.userId) || !ids.churches.has(d.churchId)) {
      bump('recommendation:skipped:bad-ref')
      continue
    }
    const create = {
      id: doc.id,
      userId: d.userId,
      churchId: d.churchId,
      type: d.type || 'member',
      title: d.title || 'Migrated Recommendation',
      description: d.description || '',
      reason: d.reason || '',
      confidence: d.confidence || 'medium',
      priority: Number(d.priority) || 5,
      suggestedAction: d.suggestedAction || '',
      expectedImpact: d.expectedImpact || '',
      dataPoints: Array.isArray(d.dataPoints) ? d.dataPoints.map(String) : [],
      status: d.status || 'pending',
      actionTakenAt: toDate(d.actionTakenAt) ?? null,
      actionNotes: d.actionNotes ?? null,
      metrics: toPlainJson(d.metrics) ?? undefined,
      createdAt: toDate(d.createdAt) || new Date(),
      firestoreData: toPlainJson(d),
    }
    await upsert(prisma.recommendation, { id: doc.id }, create, 'recommendation')
  }
}

// ---------- Events & attendance collections ----------

const EVENT_TYPES = [
  'SERVICE', 'MEETING', 'CONFERENCE', 'SOCIAL', 'OUTREACH',
  'TRAINING', 'FUNDRAISER', 'OTHER',
]

async function migrateEvents(ids) {
  for (const doc of await getDocs('events')) {
    const d = doc.data()
    if (!ids.churches.has(d.churchId)) {
      bump('event:skipped:no-church')
      continue
    }
    const create = {
      id: doc.id,
      title: d.title || 'Migrated Event',
      description: d.description ?? null,
      type: toEnum(d.type, EVENT_TYPES, 'OTHER'),
      churchId: d.churchId,
      branchId: d.branchId ?? null,
      groupId: d.groupId ?? null,
      location: d.location ?? null,
      startDate: toDate(d.startDate) || toDate(d.date) || new Date(),
      endDate: toDate(d.endDate) ?? null,
      maxAttendees: d.maxAttendees != null ? Number(d.maxAttendees) : null,
      isTicketed: Boolean(d.isTicketed),
      ticketPrice: d.ticketPrice != null ? Number(d.ticketPrice) : null,
      imageUrl: d.imageUrl ?? null,
      reminderConfig: toPlainJson(d.reminderConfig) ?? undefined,
      createdAt: toDate(d.createdAt) || new Date(),
      firestoreData: toPlainJson(d),
    }
    await upsert(prisma.event, { id: doc.id }, create, 'event')
  }
}

async function migrateEventRegistrations(ids) {
  const seen = new Set()
  for (const doc of await getDocs('event_registrations')) {
    const d = doc.data()
    if (!ids.users.has(d.userId) || !ids.events.has(d.eventId)) {
      bump('eventRegistration:skipped:bad-ref')
      continue
    }
    const pair = `${d.userId}:${d.eventId}`
    if (seen.has(pair)) {
      bump('eventRegistration:skipped:duplicate')
      continue
    }
    seen.add(pair)
    const create = {
      id: doc.id,
      userId: d.userId,
      eventId: d.eventId,
      ticketNumber: d.ticketNumber ?? null,
      qrCode: d.qrCode ?? null,
      status: d.status || 'Registered',
      registeredAt: toDate(d.registeredAt) || toDate(d.createdAt) || new Date(),
      firestoreData: toPlainJson(d),
    }
    await upsert(prisma.eventRegistration, { id: doc.id }, create, 'eventRegistration')
  }
}

async function migrateEventAttendances(ids) {
  const seen = new Set()
  for (const doc of await getDocs('event_attendances')) {
    const d = doc.data()
    if (!ids.users.has(d.userId) || !ids.events.has(d.eventId)) {
      bump('eventAttendance:skipped:bad-ref')
      continue
    }
    const pair = `${d.userId}:${d.eventId}`
    if (seen.has(pair)) {
      bump('eventAttendance:skipped:duplicate')
      continue
    }
    seen.add(pair)
    const create = {
      id: doc.id,
      userId: d.userId,
      eventId: d.eventId,
      checkedInAt: toDate(d.checkedInAt) || toDate(d.createdAt) || new Date(),
      firestoreData: toPlainJson(d),
    }
    await upsert(prisma.eventAttendance, { id: doc.id }, create, 'eventAttendance')
  }
}

async function migrateEventReminders(ids) {
  for (const doc of await getDocs('event_reminders')) {
    const d = doc.data()
    if (!ids.events.has(d.eventId) || !ids.churches.has(d.churchId)) {
      bump('eventReminder:skipped:bad-ref')
      continue
    }
    const create = {
      id: doc.id,
      eventId: d.eventId,
      churchId: d.churchId,
      notifyAt: toDate(d.notifyAt) || new Date(),
      message: d.message || '',
      status: toEnum(d.status, ['SCHEDULED', 'SENT', 'CANCELLED'], 'scheduled').toLowerCase(),
      frequencyMinutes: Number(d.frequencyMinutes) || 60,
      durationMinutes: Number(d.durationMinutes) || 60,
      createdBy: ids.users.has(d.createdBy) ? d.createdBy : null,
      createdAt: toDate(d.createdAt) || new Date(),
      firestoreData: toPlainJson(d),
    }
    await upsert(prisma.eventReminder, { id: doc.id }, create, 'eventReminder')
  }
}

async function migrateVolunteerShifts(ids) {
  for (const doc of await getDocs('volunteer_shifts')) {
    const d = doc.data()
    if (!ids.users.has(d.userId)) {
      bump('volunteerShift:skipped:no-user')
      continue
    }
    const create = {
      id: doc.id,
      userId: d.userId,
      departmentId: ids.departments.has(d.departmentId) ? d.departmentId : null,
      role: d.role || 'Volunteer',
      startTime: toDate(d.startTime) || new Date(),
      endTime: toDate(d.endTime) ?? null,
      status: d.status || 'Scheduled',
      reminderSent: Boolean(d.reminderSent),
      createdAt: toDate(d.createdAt) || new Date(),
      firestoreData: toPlainJson(d),
    }
    await upsert(prisma.volunteerShift, { id: doc.id }, create, 'volunteerShift')
  }
}

async function migrateTasks(ids) {
  for (const doc of await getDocs('workforce_tasks')) {
    const d = doc.data()
    if (!ids.users.has(d.userId)) {
      bump('task:skipped:no-user')
      continue
    }
    const create = {
      id: doc.id,
      userId: d.userId,
      title: d.title || 'Migrated Task',
      description: d.description ?? null,
      departmentId: ids.departments.has(d.departmentId) ? d.departmentId : null,
      dueDate: toDate(d.dueDate) ?? null,
      priority: d.priority || 'Medium',
      status: d.status || 'Pending',
      createdAt: toDate(d.createdAt) || new Date(),
      firestoreData: toPlainJson(d),
    }
    await upsert(prisma.task, { id: doc.id }, create, 'task')
  }
}

// ---------- User column backfill (firestoreData -> promoted columns) ----------
async function backfillUserColumns() {
  if (DRY_RUN) {
    console.log('  [dry-run] would backfill User staff/designation columns from firestoreData')
    return
  }
  const n = await prisma.$executeRaw`
    UPDATE "User" SET
      "isStaff"          = CASE WHEN "firestoreData"->>'isStaff' IN ('true','false')
                                THEN ("firestoreData"->>'isStaff')::boolean ELSE "isStaff" END,
      "staffLevelId"     = COALESCE("staffLevelId",     NULLIF("firestoreData"->>'staffLevelId', '')),
      "staffLevelName"   = COALESCE("staffLevelName",   NULLIF("firestoreData"->>'staffLevelName', '')),
      "designationId"    = COALESCE("designationId",    NULLIF("firestoreData"->>'designationId', '')),
      "designationName"  = COALESCE("designationName",  NULLIF("firestoreData"->>'designationName', '')),
      "employmentStatus" = COALESCE("employmentStatus", NULLIF("firestoreData"->>'employmentStatus', '')),
      "isSuspended"      = CASE WHEN "firestoreData"->>'isSuspended' IN ('true','false')
                                THEN ("firestoreData"->>'isSuspended')::boolean ELSE "isSuspended" END,
      "customWage"       = COALESCE("customWage", "firestoreData"->'customWage')
    WHERE "firestoreData" IS NOT NULL
      AND jsonb_typeof("firestoreData") = 'object'
  `
  bump('user:backfilled', n)
}

// ---------- main ----------
async function main() {
  console.log(DRY_RUN ? '== DRY RUN — no writes ==\n' : '== Migrating Firestore -> PostgreSQL ==\n')
  const ids = await loadIdSets()

  const refreshIds = async () => {
    const fresh = await loadIdSets()
    Object.assign(ids, fresh)
  }

  const steps = [
    ['subscription_plans', () => migratePlans()],
    ['subscriptions', () => migrateSubscriptions(ids)],
    ['staff_levels', () => migrateStaffLevels(ids)],
    ['church_designations', () => migrateDesignations(ids)],
    ['church_invites', () => migrateInvites(ids)],
    ['payroll_positions', () => migratePositions(ids)],
    ['wage_scales', () => migrateWageScales(ids)],
    ['payroll_periods', () => migratePeriods(ids)],
    ['payroll_payments', () => migratePayments(ids)],
    ['events', () => migrateEvents(ids)],
    ['refresh ids (events)', () => refreshIds()],
    ['check_ins', () => migrateCheckIns(ids)],
    ['follow_ups', () => migrateFollowUps(ids)],
    ['mentor_assignments', () => migrateMentorAssignments(ids)],
    ['usage_metrics', () => migrateUsageMetrics(ids)],
    // AI discipleship module
    ['reading_plans', () => migrateReadingPlans()],
    ['reading_resource_categories', () => migrateReadingCategories()],
    ['refresh ids (plans/categories)', () => refreshIds()],
    ['reading_plan_days', () => migrateReadingPlanDays(ids)],
    ['reading_plan_resources', () => migrateReadingResources(ids)],
    ['reading_plan_progress', () => migrateReadingProgress(ids)],
    ['reading_coach_sessions', () => migrateReadingCoachSessions(ids)],
    ['reading_coach_nudges', () => migrateReadingCoachNudges(ids)],
    ['ai_coaching_sessions', () => migrateAICoachingSessions(ids)],
    ['bible_passage_cache', () => migrateBibleCache()],
    ['badges', () => migrateBadges()],
    ['refresh ids (badges)', () => refreshIds()],
    ['user_badges', () => migrateUserBadges(ids)],
    ['recommendations', () => migrateRecommendations(ids)],
    // Events & attendance module
    ['event_registrations', () => migrateEventRegistrations(ids)],
    ['event_attendances', () => migrateEventAttendances(ids)],
    ['event_reminders', () => migrateEventReminders(ids)],
    ['volunteer_shifts', () => migrateVolunteerShifts(ids)],
    ['workforce_tasks', () => migrateTasks(ids)],
    ['user column backfill', () => backfillUserColumns()],
  ]

  for (const [name, fn] of steps) {
    try {
      await fn()
    } catch (err) {
      console.error(`ERROR in ${name}:`, err.message)
      bump(`${name}:fatal`)
    }
  }

  console.log('\n== Summary ==')
  for (const [k, v] of Object.entries(stats).sort()) console.log(`  ${k}: ${v}`)
  await prisma.$disconnect()
}

main().catch((err) => {
  console.error(err)
  prisma.$disconnect().finally(() => process.exit(1))
})
