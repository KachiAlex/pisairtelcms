/**
 * Create Superadmin Script
 * 
 * This script creates a superadmin user account.
 * Run with: node scripts/create-superadmin.js
 * 
 * Make sure to set environment variables:
 * - FIREBASE_SERVICE_ACCOUNT (or firebase-service-account.json exists)
 * - NEXTAUTH_SECRET
 */

const admin = require('firebase-admin')
const bcrypt = require('bcryptjs')
const readline = require('readline')

// Initialize Firebase Admin
let serviceAccount
try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  } else {
    serviceAccount = require('../firebase-service-account.json')
  }
} catch (error) {
  console.error('Error loading Firebase service account:', error.message)
  console.error('Make sure FIREBASE_SERVICE_ACCOUNT is set or firebase-service-account.json exists')
  process.exit(1)
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
})

const db = admin.firestore()

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

function question(query) {
  return new Promise((resolve) => rl.question(query, resolve))
}

async function createSuperadmin() {
  try {
    console.log('\n=== Create Superadmin Account ===\n')

    // Check if superadmin already exists
    const existingSuperadmin = await db.collection('users')
      .where('role', '==', 'SUPER_ADMIN')
      .limit(1)
      .get()

    if (!existingSuperadmin.empty) {
      console.log('⚠️  Superadmin already exists!')
      const proceed = await question('Do you want to create another? (yes/no): ')
      if (proceed.toLowerCase() !== 'yes') {
        console.log('Cancelled.')
        rl.close()
        return
      }
    }

    // Get user input
    const email = await question('Email: ')
    const password = await question('Password: ')
    const firstName = await question('First Name: ')
    const lastName = await question('Last Name: ')

    if (!email || !password || !firstName || !lastName) {
      console.error('❌ All fields are required!')
      rl.close()
      return
    }

    // Check if user already exists
    const existingUser = await db.collection('users')
      .where('email', '==', email)
      .limit(1)
      .get()

    if (!existingUser.empty) {
      console.error('❌ User with this email already exists!')
      rl.close()
      return
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Create superadmin
    const userData = {
      email,
      password: hashedPassword,
      firstName,
      lastName,
      role: 'SUPER_ADMIN',
      churchId: '', // Superadmin doesn't belong to a specific church
      xp: 0,
      level: 1,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }

    const userRef = await db.collection('users').add(userData)
    const userDoc = await userRef.get()

    console.log('\n✅ Superadmin created successfully!')
    console.log('\n--- Access Details ---')
    console.log(`Email: ${email}`)
    console.log(`Password: ${password}`)
    console.log(`User ID: ${userDoc.id}`)
    console.log('\n--- Login URLs ---')
    console.log(`Local: http://localhost:3000/auth/login`)
    console.log(`Portal: http://localhost:3000/superadmin`)
    console.log('\n⚠️  Remember to change the password after first login!')

    rl.close()
  } catch (error) {
    console.error('❌ Error creating superadmin:', error)
    rl.close()
    process.exit(1)
  }
}

createSuperadmin()

