const admin = require('firebase-admin')
const { PrismaClient } = require('@prisma/client')
const fs = require('fs')

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

const VALID_ROLES = new Set(['MEMBER', 'VISITOR', 'VOLUNTEER', 'LEADER', 'PASTOR', 'ADMIN', 'BRANCH_ADMIN', 'SUPER_ADMIN'])
const VALID_MATURITY = new Set(['NEW_BELIEVER', 'GROWING', 'MATURE', 'LEADER'])

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

async function migrateUsers() {
  const snapshot = await firestore.collection('users').get()
  const records = []

  for (const doc of snapshot.docs) {
    const data = doc.data()
    const legacy = toPlainJson({ ...data, password: undefined })
    const record = {
      id: doc.id,
      email: (data.email || '').trim().toLowerCase(),
      password: data.password || '',
      firstName: data.firstName || 'Unknown',
      lastName: data.lastName || 'User',
      phone: data.phone || null,
      profileImage: data.profileImage || null,
      bio: data.bio || null,
      dateOfBirth: toDate(data.dateOfBirth),
      address: data.address || null,
      city: data.city || null,
      state: data.state || null,
      zipCode: data.zipCode || null,
      country: data.country || null,
      role: VALID_ROLES.has(data.role) ? data.role : 'VISITOR',
      spiritualMaturity: data.spiritualMaturity && VALID_MATURITY.has(data.spiritualMaturity) ? data.spiritualMaturity : undefined,
      churchId: data.churchId || null,
      // branchId is preserved in firestoreData to avoid FK constraint on missing Branch rows
      branchId: null,
      xp: typeof data.xp === 'number' ? data.xp : 0,
      level: typeof data.level === 'number' ? data.level : 1,
      lastLoginAt: toDate(data.lastLoginAt),
      firestoreData: legacy,
      createdAt: toDate(data.createdAt) || new Date(),
      updatedAt: toDate(data.updatedAt) || new Date(),
    }
    records.push(record)
  }

  if (records.length === 0) {
    console.log('No users found in Firestore')
    return
  }

  await prisma.$transaction(
    records.map((record) =>
      prisma.user.upsert({
        where: { id: record.id },
        update: record,
        create: record,
      })
    )
  )

  console.log(`Migrated ${records.length} users`)
}

async function main() {
  await migrateUsers()
  await prisma.$disconnect()
}

main().catch((err) => {
  console.error(err)
  prisma.$disconnect().finally(() => process.exit(1))
})
