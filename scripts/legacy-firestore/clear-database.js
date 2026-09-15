/**
 * Script to delete ALL users and churches from the database
 * 
 * Usage: node scripts/clear-database.js
 * 
 * WARNING: This will permanently delete ALL users and churches.
 * This action cannot be undone. Make sure you have a backup before running this script.
 */

const admin = require('firebase-admin')

// Initialize Firebase Admin
if (!admin.apps.length) {
  try {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
      ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
      : require('../firebase-service-account.json')

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    })
  } catch (error) {
    console.error('Error initializing Firebase Admin:', error)
    console.error('Make sure FIREBASE_SERVICE_ACCOUNT environment variable is set or firebase-service-account.json exists')
    process.exit(1)
  }
}

const db = admin.firestore()

/**
 * Delete all documents from a collection in batches
 */
async function deleteCollection(collectionName, displayName) {
  console.log(`\n🔍 Finding ${displayName}...`)
  
  const snapshot = await db.collection(collectionName).get()
  
  if (snapshot.empty) {
    console.log(`✅ No ${displayName} found.`)
    return 0
  }

  console.log(`📊 Found ${snapshot.size} ${displayName}`)
  console.log(`🗑️  Deleting ${displayName}...`)

  let deletedCount = 0
  const batches = []
  let currentBatch = db.batch()
  let batchCount = 0

  snapshot.forEach((doc) => {
    currentBatch.delete(doc.ref)
    deletedCount++
    batchCount++

    // Firestore batch limit is 500 operations
    if (batchCount === 500) {
      batches.push(currentBatch)
      currentBatch = db.batch()
      batchCount = 0
    }
  })

  // Add the last batch if it has operations
  if (batchCount > 0) {
    batches.push(currentBatch)
  }

  // Commit all batches
  for (let i = 0; i < batches.length; i++) {
    await batches[i].commit()
    console.log(`   Deleted ${Math.min((i + 1) * 500, deletedCount)} ${displayName}...`)
  }

  console.log(`✅ Successfully deleted ${deletedCount} ${displayName}.`)
  return deletedCount
}

/**
 * Delete all subscriptions
 */
async function deleteSubscriptions() {
  return await deleteCollection('subscriptions', 'subscriptions')
}

/**
 * Delete all churches
 */
async function deleteChurches() {
  return await deleteCollection('churches', 'churches')
}

/**
 * Delete all users
 */
async function deleteUsers() {
  return await deleteCollection('users', 'users')
}

/**
 * Main function to clear the database
 */
async function clearDatabase() {
  console.log('╔════════════════════════════════════════════════════════════╗')
  console.log('║          DATABASE CLEARANCE SCRIPT                        ║')
  console.log('║                                                            ║')
  console.log('║  WARNING: This will permanently delete ALL:               ║')
  console.log('║    - Users                                                  ║')
  console.log('║    - Churches                                              ║')
  console.log('║    - Subscriptions                                          ║')
  console.log('║                                                            ║')
  console.log('║  This action CANNOT be undone!                             ║')
  console.log('╚════════════════════════════════════════════════════════════╝')
  console.log('\n⚠️  Press Ctrl+C to cancel, or wait 10 seconds to continue...\n')

  // Wait 10 seconds before proceeding
  await new Promise(resolve => setTimeout(resolve, 10000))

  try {
    // Get counts before deletion
    const usersSnapshot = await db.collection('users').get()
    const churchesSnapshot = await db.collection('churches').get()
    const subscriptionsSnapshot = await db.collection('subscriptions').get()

    console.log('\n📊 Current Database State:')
    console.log(`   Users: ${usersSnapshot.size}`)
    console.log(`   Churches: ${churchesSnapshot.size}`)
    console.log(`   Subscriptions: ${subscriptionsSnapshot.size}`)

    if (usersSnapshot.empty && churchesSnapshot.empty && subscriptionsSnapshot.empty) {
      console.log('\n✅ Database is already empty. Nothing to delete.')
      return
    }

    // Delete in order: subscriptions -> churches -> users
    // This order helps avoid foreign key issues
    const subscriptionsDeleted = await deleteSubscriptions()
    const churchesDeleted = await deleteChurches()
    const usersDeleted = await deleteUsers()

    console.log('\n╔════════════════════════════════════════════════════════════╗')
    console.log('║                    DELETION SUMMARY                       ║')
    console.log('╚════════════════════════════════════════════════════════════╝')
    console.log(`\n✅ Deleted ${subscriptionsDeleted} subscriptions`)
    console.log(`✅ Deleted ${churchesDeleted} churches`)
    console.log(`✅ Deleted ${usersDeleted} users`)
    console.log(`\n📊 Total records deleted: ${subscriptionsDeleted + churchesDeleted + usersDeleted}`)

  } catch (error) {
    console.error('\n❌ Error during deletion:', error)
    process.exit(1)
  }
}

// Run the script
clearDatabase()
  .then(() => {
    console.log('\n✨ Database cleared successfully.')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Script failed:', error)
    process.exit(1)
  })

