/**
 * Script to delete all users that are not affiliated with a church organization
 * 
 * Usage: node scripts/delete-users-without-church.js
 * 
 * WARNING: This will permanently delete users without a churchId.
 * Make sure you have a backup before running this script.
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

async function deleteUsersWithoutChurch() {
  console.log('🔍 Finding users without church organizations...\n')

  try {
    // Get all users
    const usersSnapshot = await db.collection('users').get()
    
    if (usersSnapshot.empty) {
      console.log('✅ No users found in the database.')
      return
    }

    const usersWithoutChurch = []
    const usersWithChurch = []

    // Filter users without churchId
    usersSnapshot.forEach((doc) => {
      const data = doc.data()
      const userId = doc.id
      
      // Check if user has no churchId (null, undefined, or empty string)
      if (!data.churchId || data.churchId === '' || data.churchId === null) {
        usersWithoutChurch.push({
          id: userId,
          email: data.email || 'N/A',
          name: `${data.firstName || ''} ${data.lastName || ''}`.trim() || 'N/A',
          role: data.role || 'N/A',
        })
      } else {
        usersWithChurch.push({
          id: userId,
          email: data.email || 'N/A',
        })
      }
    })

    console.log(`📊 Statistics:`)
    console.log(`   Total users: ${usersSnapshot.size}`)
    console.log(`   Users with church: ${usersWithChurch.length}`)
    console.log(`   Users without church: ${usersWithoutChurch.length}\n`)

    if (usersWithoutChurch.length === 0) {
      console.log('✅ No users without church organizations found. Nothing to delete.')
      return
    }

    // Display users that will be deleted
    console.log('⚠️  Users to be deleted:')
    usersWithoutChurch.forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.name} (${user.email}) - Role: ${user.role}`)
    })

    console.log('\n⚠️  WARNING: This will permanently delete the above users.')
    console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...\n')

    // Wait 5 seconds before proceeding
    await new Promise(resolve => setTimeout(resolve, 5000))

    // Delete users in batches
    console.log('🗑️  Deleting users...\n')
    const batch = db.batch()
    let deletedCount = 0

    for (const user of usersWithoutChurch) {
      try {
        const userRef = db.collection('users').doc(user.id)
        batch.delete(userRef)
        deletedCount++

        // Firestore batch limit is 500 operations
        if (deletedCount % 500 === 0) {
          await batch.commit()
          console.log(`   Deleted ${deletedCount} users...`)
          // Create new batch for next set
          const newBatch = db.batch()
          for (let i = deletedCount; i < usersWithoutChurch.length && i < deletedCount + 500; i++) {
            const nextUser = usersWithoutChurch[i]
            const nextUserRef = db.collection('users').doc(nextUser.id)
            newBatch.delete(nextUserRef)
          }
        }
      } catch (error) {
        console.error(`   ❌ Error deleting user ${user.id} (${user.email}):`, error.message)
      }
    }

    // Commit remaining deletions
    if (deletedCount % 500 !== 0) {
      await batch.commit()
    }

    console.log(`\n✅ Successfully deleted ${deletedCount} users without church organizations.`)
    console.log(`📊 Remaining users: ${usersWithChurch.length}`)

  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

// Run the script
deleteUsersWithoutChurch()
  .then(() => {
    console.log('\n✨ Script completed successfully.')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Script failed:', error)
    process.exit(1)
  })

