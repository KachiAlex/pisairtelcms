const admin = require('firebase-admin')
const { PrismaClient } = require('@prisma/client')
const fs = require('fs')

function toDate(value) {
  if (!value) return new Date()
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

async function migrateChurches() {
  const snapshot = await firestore.collection('churches').get()
  const records = []

  for (const doc of snapshot.docs) {
    const data = doc.data()
    const legacy = toPlainJson(data)
    const record = {
      id: doc.id,
      name: data.name || 'Unknown Church',
      slug: data.slug || doc.id,
      logo: data.logo || null,
      primaryColor: data.primaryColor || null,
      secondaryColor: data.secondaryColor || null,
      address: data.address || null,
      city: data.city || null,
      state: data.state || null,
      zipCode: data.zipCode || null,
      country: data.country || null,
      phone: data.phone || null,
      email: data.email || data.organizationEmail || null,
      website: data.website || null,
      description: data.description || null,
      customDomain: data.customDomain || null,
      domainVerified: data.domainVerified || false,
      ownerId: data.ownerId || null,
      firestoreData: legacy,
      createdAt: toDate(data.createdAt),
      updatedAt: toDate(data.updatedAt),
    }
    records.push(record)
  }

  if (records.length === 0) {
    console.log('No churches found in Firestore')
    return
  }

  await prisma.$transaction(
    records.map((record) =>
      prisma.church.upsert({
        where: { id: record.id },
        update: record,
        create: record,
      })
    )
  )

  console.log(`Migrated ${records.length} churches`)
}

async function main() {
  await migrateChurches()
  await prisma.$disconnect()
}

main().catch((err) => {
  console.error(err)
  prisma.$disconnect().finally(() => process.exit(1))
})
