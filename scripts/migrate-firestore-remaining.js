const fs = require('fs')
const admin = require('firebase-admin')
const { PrismaClient } = require('@prisma/client')

function toDate(value) {
  if (!value) return undefined
  if (typeof value.toDate === 'function') return value.toDate()
  if (value instanceof Date) return value
  return new Date(value)
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

function snakeToCamel(str) {
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
}

function singular(str) {
  if (str.endsWith('ies')) return str.slice(0, -3) + 'y'
  if (str.endsWith('ses')) return str.slice(0, -2)
  if (str.endsWith('s')) return str.slice(0, -1)
  return str
}

const OVERRIDES = {
  'giving_projects': 'project',
  'projects': 'project',
  'donations': 'giving',
  'giving': 'giving',
  'payroll_payments': 'payrollRecord',
  'payroll_records': 'payrollRecord',
  'salaries': 'payrollRecord',
  'workforce_tasks': 'task',
  'tasks': 'task',
  'usage_metrics': 'usageTracking',
  'usage_metrics_cache': 'usageTracking',
  'check_ins': 'childrenCheckIn',
  'children_check_ins': 'childrenCheckIn',
  'group_members': 'groupMembership',
  'group_memberships': 'groupMembership',
  'password_resets': 'passwordResetToken',
  'unit_settings': 'unitSettings',
  'subscription_plan_overrides': 'subscriptionPlanOverride',
  // singular('digitalCourses') -> 'digitalCours' via the 'ses' rule; map explicitly
  'digital_courses': 'digitalCourse',
  'accounting_expenses': 'accountingExpense',
  'church_designations': 'designation',
  'ai_coaching_sessions': 'aICoachingSession',
  // stray camelCase duplicate of subscription_plans
  'subscriptionPlans': 'subscriptionPlan',
}

// Legacy collections not listed in firestore-collections.ts (renamed/typo'd
// names left behind in Firestore)
const EXTRA_COLLECTIONS = ['subscriptionPlans']

// Models whose Prisma PK is not "id" — upsert key and record PK field differ.
const PK_FIELD = {
  subscriptionPromo: 'code',
}

// Post-processors run after buildRecord to fix field-name mismatches.
const POST_PROCESS = {
  // OAuth state docs are keyed by the state value itself
  churchGoogleOauthState: (record, docId) => {
    record.state = record.state || docId
  },
  // Token invites carry the legacy doc id as the token when no token field exists
  unitInvite: (record, docId) => {
    if (!record.token) record.token = docId
  },
  // Legacy promo docs are keyed by code
  subscriptionPromo: (record, docId) => {
    record.code = record.code || docId
  },
  // Legacy prayer interactions reference the request as requestId
  prayerInteraction: (record) => {
    if (!record.prayerRequestId && record.firestoreData?.requestId) {
      record.prayerRequestId = record.firestoreData.requestId
    }
  },
  // Some legacy role docs stored millisecond timestamps in `order` (int4 overflow)
  churchRole: (record) => {
    if (typeof record.order === 'number' && record.order > 2147483646) {
      record.order = 99
    }
  },
}

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

const collectionsFile = fs.readFileSync('./lib/firestore-collections.ts', 'utf8')
const collections = [...new Set([...collectionsFile.matchAll(/:\s*['"]([^'"]+)['"]/g)].map((m) => m[1]))]
for (const extra of EXTRA_COLLECTIONS) {
  if (!collections.includes(extra)) collections.push(extra)
}

const prismaModelKeys = Object.keys(prisma).filter(
  (k) =>
    typeof prisma[k] === 'object' &&
    typeof prisma[k].findUnique === 'function' &&
    !k.startsWith('$') &&
    !k.startsWith('_')
)

function getModelKey(collection) {
  if (OVERRIDES[collection]) return OVERRIDES[collection]

  const base = snakeToCamel(collection)
  const candidates = [singular(base), base]

  for (const c of candidates) {
    if (prismaModelKeys.includes(c)) return c
  }

  const c2 = base.endsWith('es') ? base.slice(0, -2) : base
  const c3 = c2.endsWith('s') ? c2.slice(0, -1) : c2
  if (prismaModelKeys.includes(c3)) return c3

  return null
}

function getDmmfModel(modelKey) {
  const dmmf = require('@prisma/client').Prisma.dmmf || prisma._dmmf
  if (!dmmf || !dmmf.datamodel || !dmmf.datamodel.models) return null
  return dmmf.datamodel.models.find((m) => m.name.toLowerCase() === modelKey.toLowerCase())
}

function getEnumFirstValue(enumName, dmmf) {
  const e = dmmf?.datamodel?.enums?.find((en) => en.name === enumName)
  return e?.values?.[0]?.dbName || e?.values?.[0]?.name || null
}

function defaultForField(field, dmmf) {
  if (field.isList) return []
  const t = field.type
  if (field.kind === 'enum') {
    return getEnumFirstValue(t, dmmf)
  }
  if (t === 'String') return ''
  if (t === 'Int' || t === 'Float' || t === 'Decimal' || t === 'BigInt') return 0
  if (t === 'Boolean') return false
  if (t === 'DateTime') return new Date()
  if (t === 'Json') return {}
  return null
}

function coerceScalarValue(value, field, dmmf) {
  if (value === undefined || value === null) return undefined
  const t = field.type
  if (field.kind === 'enum') {
    const e = dmmf?.datamodel?.enums?.find((en) => en.name === field.type)
    const valid = e?.values?.map((v) => v.dbName || v.name) || []
    const str = String(value)
    return valid.includes(str) ? str : (valid[0] || null)
  }
  if (t === 'String') return String(value)
  if (t === 'Int') return parseInt(value, 10) || 0
  if (t === 'Float' || t === 'Decimal') return parseFloat(value) || 0
  if (t === 'Boolean') return Boolean(value)
  if (t === 'DateTime') {
    const d = toDate(value)
    return d && !isNaN(d.getTime()) ? d : new Date()
  }
  if (t === 'Json') return toPlainJson(value)
  return value
}

function coerceValue(value, field, dmmf) {
  if (value === undefined || value === null) return undefined
  if (field.isList) {
    if (!Array.isArray(value)) return []
    return value.map((v) => coerceScalarValue(v, field, dmmf))
  }
  return coerceScalarValue(value, field, dmmf)
}

function buildRecord(id, data, dmmfModel, dmmf) {
  const record = { id }
  if (!dmmfModel) return record

  for (const field of dmmfModel.fields) {
    if (['id', 'createdAt', 'updatedAt', 'firestoreData'].includes(field.name)) continue
    if (field.kind !== 'scalar' && field.kind !== 'enum') continue

    let value = data[field.name]
    if (value !== undefined) {
      record[field.name] = coerceValue(value, field, dmmf)
    } else if (field.isRequired && !field.hasDefaultValue) {
      record[field.name] = defaultForField(field, dmmf)
    }
  }

  if (dmmfModel.fields.some((f) => f.name === 'firestoreData')) {
    record.firestoreData = toPlainJson(data)
  }

  const createdAtField = dmmfModel.fields.find((f) => f.name === 'createdAt')
  if (createdAtField && data.createdAt) {
    record.createdAt = toDate(data.createdAt)
  }

  const updatedAtField = dmmfModel.fields.find((f) => f.name === 'updatedAt')
  if (updatedAtField && data.updatedAt) {
    record.updatedAt = toDate(data.updatedAt)
  }

  return record
}

async function migrateCollection(collection, modelKey) {
  const model = prisma[modelKey]
  const dmmfModel = getDmmfModel(modelKey)
  const dmmf = require('@prisma/client').Prisma.dmmf || prisma._dmmf

  const snapshot = await firestore.collection(collection).get()

  if (snapshot.empty) {
    console.log(`  ${collection} -> ${modelKey}: 0 docs`)
    return 0
  }

  const pkField = PK_FIELD[modelKey] || 'id'
  const postProcess = POST_PROCESS[modelKey]

  const records = snapshot.docs.map((doc) => {
    const record = buildRecord(doc.id, doc.data(), dmmfModel, dmmf)
    if (postProcess) postProcess(record, doc.id)
    if (pkField !== 'id') {
      record[pkField] = record[pkField] || doc.id
      delete record.id
    }
    return record
  })

  let success = 0
  for (const r of records) {
    try {
      await prisma.$transaction([
        prisma.$executeRaw`SET LOCAL session_replication_role = 'replica'`,
        model.upsert({
          where: { [pkField]: r[pkField] },
          update: r,
          create: r,
        }),
      ])
      success++
    } catch (err) {
      console.error(`    ERROR upserting ${modelKey} ${r[pkField]}:`, err.message.split('\n')[0])
    }
  }

  console.log(`  ${collection} -> ${modelKey}: ${success}/${records.length} docs`)
  return success
}

// Firestore subcollections: parent collection -> subcollection -> model + id derivation.
const SUBCOLLECTIONS = [
  { parent: 'posts', sub: 'likes', model: 'postLike', makeId: (p, d) => `${p}_${d}` },
  { parent: 'posts', sub: 'shares', model: 'postShare', makeId: (p, d) => `${p}_${d}` },
  { parent: 'comments', sub: 'likes', model: 'commentLike', makeId: (p, d) => `${p}_${d}` },
]

async function migrateSubcollections() {
  for (const spec of SUBCOLLECTIONS) {
    const model = prisma[spec.model]
    if (!model) continue
    const parentSnap = await firestore.collection(spec.parent).select().get()
    let success = 0, total = 0
    for (const parentDoc of parentSnap.docs) {
      const subSnap = await parentDoc.ref.collection(spec.sub).get()
      for (const doc of subSnap.docs) {
        total++
        const data = doc.data()
        let record
        if (spec.model === 'postShare') {
          const post = await prisma.post.findUnique({ where: { id: parentDoc.id }, select: { churchId: true } })
          record = {
            id: spec.makeId(parentDoc.id, doc.id),
            postId: parentDoc.id,
            churchId: data.churchId || post?.churchId || '',
            sharedByUserId: data.sharedByUserId || data.userId || doc.id,
            unitIds: Array.isArray(data.unitIds) ? data.unitIds : [],
            note: data.note || null,
            createdAt: toDate(data.createdAt) || new Date(),
            firestoreData: toPlainJson(data),
          }
        } else {
          record = {
            id: spec.makeId(parentDoc.id, doc.id),
            userId: data.userId || doc.id,
            ...(spec.parent === 'posts' ? { postId: parentDoc.id } : { commentId: parentDoc.id }),
            createdAt: toDate(data.createdAt) || new Date(),
            firestoreData: toPlainJson(data),
          }
        }
        try {
          await prisma.$transaction([
            prisma.$executeRaw`SET LOCAL session_replication_role = 'replica'`,
            model.upsert({
              where: { id: record.id },
              update: record,
              create: record,
            }),
          ])
          success++
        } catch (err) {
          console.error(`    ERROR upserting ${spec.model} ${record.id}:`, err.message.split('\n')[0])
        }
      }
    }
    console.log(`  ${spec.parent}/*/${spec.sub} -> ${spec.model}: ${success}/${total} docs`)
  }
}

async function main() {
  const counts = {}
  for (const collection of collections) {
    const modelKey = getModelKey(collection)
    if (!modelKey) {
      console.log(`  ${collection}: no matching Prisma model, skipping`)
      continue
    }
    try {
      counts[collection] = await migrateCollection(collection, modelKey)
    } catch (err) {
      console.error(`  ERROR migrating ${collection} -> ${modelKey}:`, err.message)
    }
  }
  await migrateSubcollections()
  console.log('\nSummary:', counts)
  await prisma.$disconnect()
}

main().catch((err) => {
  console.error(err)
  prisma.$disconnect().finally(() => process.exit(1))
})
