import { initializeApp, getApps, cert, App } from 'firebase-admin/app'
import { getFirestore, Firestore, FieldValue, Transaction } from 'firebase-admin/firestore'
import { getStorage, Storage } from 'firebase-admin/storage'

const globalForFirebase = globalThis as typeof globalThis & {
  firebaseApp?: App
  firebaseDb?: Firestore
  firebaseStorage?: Storage
  firebaseSettingsApplied?: boolean
  firebaseDisabled?: boolean
}

let app: App
let _db: Firestore | null = globalForFirebase.firebaseDb ?? null
let _storage: Storage | null = globalForFirebase.firebaseStorage ?? null

const hasServiceAccountEnv =
  Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) ||
  Boolean(process.env.FIREBASE_SERVICE_ACCOUNT) ||
  Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_PATH)

if (!hasServiceAccountEnv) {
  globalForFirebase.firebaseDisabled = true
}

// --- Firestore disabled stubs ------------------------------------------------
// When Firebase credentials are absent, return a stub that yields empty
// collections/no-op writes instead of throwing 500s across the dashboard.
function createEmptyQuerySnapshot() {
  const docs: any[] = []
  return {
    docs,
    empty: true,
    size: 0,
    forEach: () => {},
    docChanges: () => [],
  }
}

function createQueryRef(path: string = ''): any {
  const self: any = () => self
  self.where = () => self
  self.orderBy = () => self
  self.limit = () => self
  self.offset = () => self
  self.startAt = () => self
  self.startAfter = () => self
  self.endAt = () => self
  self.endBefore = () => self
  self.get = async () => createEmptyQuerySnapshot()
  self.onSnapshot = (_: any) => () => {}
  self.doc = (sub: string) => createDocRef(path ? `${path}/${sub}` : sub)
  self.add = async (data: any) => ({ id: 'stub', writeTime: { toDate: () => new Date() } })
  self.listDocuments = async () => []
  return self
}

function createDocRef(path: string): any {
  const segments = path.split('/')
  const self: any = {
    id: segments[segments.length - 1] || '',
    path,
  }
  self.get = async () => ({ exists: false, data: () => null, id: self.id, ref: self })
  self.set = async () => ({ writeTime: { toDate: () => new Date() } })
  self.update = async () => ({ writeTime: { toDate: () => new Date() } })
  self.delete = async () => undefined
  self.collection = (sub: string) => createQueryRef()
  self.isEqual = () => true
  return self
}

function createBatch(): any {
  return {
    set: () => {},
    update: () => {},
    delete: () => {},
    commit: async () => [],
  }
}

function createTransaction(): any {
  const tx: any = {
    get: async (ref: any) => ref.get(),
    set: () => {},
    update: () => {},
    delete: () => {},
  }
  return tx
}

function createFirestoreStub(): Firestore {
  const db: any = {
    settings: () => {},
    collection: (path: string) => createQueryRef(path),
    doc: (path: string) => createDocRef(path),
    collectionGroup: () => createQueryRef(),
    batch: () => createBatch(),
    runTransaction: async (callback: any) => {
      try {
        return await callback(createTransaction())
      } catch (e) {
        console.warn('Disabled Firestore transaction callback failed:', e)
        return undefined
      }
    },
    getAll: async () => [],
    listCollections: async () => [],
    terminate: async () => {},
  }
  return db as Firestore
}

function createStorageStub(): Storage {
  const bucket = {
    file: () => ({
      save: async () => {},
      delete: async () => {},
      getSignedUrl: async () => [''],
      publicUrl: () => '',
      exists: async () => [false],
    }),
    upload: async () => [{
      name: '',
      getSignedUrl: async () => [''],
      publicUrl: () => '',
    }],
  }
  const storage: any = {
    bucket: () => bucket,
    app: globalForFirebase.firebaseApp,
  }
  return storage as Storage
}

export function isFirebaseConfigured() {
  return hasServiceAccountEnv
}

/**
 * Initialize Firebase Admin SDK
 */
export function initFirebase(): Firestore | null {
  try {
    if (!hasServiceAccountEnv) {
      globalForFirebase.firebaseDisabled = true
    }
    if (!globalForFirebase.firebaseApp) {
      if (getApps().length === 0) {
        // Try to get service account from environment variable (for Vercel/Railway/etc)
        let serviceAccount: any = undefined

        // First try FIREBASE_SERVICE_ACCOUNT_BASE64 (preferred for Vercel)
        if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
          try {
            serviceAccount = JSON.parse(
              Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8')
            )
            console.log('Successfully parsed Firebase service account from BASE64 environment variable')
          } catch (e) {
            console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT_BASE64:', e)
          }
        }

        // Then try FIREBASE_SERVICE_ACCOUNT (JSON string)
        if (!serviceAccount && process.env.FIREBASE_SERVICE_ACCOUNT) {
          try {
            serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
            console.log('Successfully parsed Firebase service account from JSON environment variable')
          } catch (e) {
            console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT:', e)
          }
        }
        
        // Try to load from file (for local development)
        if (!serviceAccount && process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
          try {
            const fs = require('fs')
            const path = require('path')
            const serviceAccountPath = path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH)
            if (fs.existsSync(serviceAccountPath)) {
              serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'))
              console.log('Successfully loaded Firebase service account from file')
            }
          } catch (e) {
            console.error('Failed to load service account from file:', e)
          }
        }

        // Only use cert() if we have a valid service account object
        if (serviceAccount && typeof serviceAccount === 'object' && serviceAccount.type === 'service_account') {
          try {
            globalForFirebase.firebaseApp = initializeApp({
              credential: cert(serviceAccount),
              projectId: process.env.FIREBASE_PROJECT_ID || process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
              storageBucket: process.env.FIREBASE_STORAGE_BUCKET || `${process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.appspot.com`,
            })
            console.log('Firebase initialized with service account credentials')
          } catch (e) {
            console.error('Failed to initialize Firebase with service account:', e)
            // Don't try fallback - service account is required
            console.error('Firebase initialization failed - service account is required for Firestore access')
          }
        } else if (!globalForFirebase.firebaseDisabled) {
          console.error('No valid service account found in environment variables')
          console.error('FIREBASE_SERVICE_ACCOUNT_BASE64 or FIREBASE_SERVICE_ACCOUNT must be set in Vercel environment variables')
          globalForFirebase.firebaseDisabled = true
        }
      }
    } else if (getApps().length > 0) {
      // Ensure firebase-admin uses the first registered app (important in local dev with HMR)
      globalForFirebase.firebaseApp = getApps()[0]
    }

    // If Firebase app is still not initialized, return null
    if (!globalForFirebase.firebaseApp) {
      console.warn('Firebase app not initialized - Firestore will not be available')
      return null as any
    }

    app = globalForFirebase.firebaseApp

    if (!globalForFirebase.firebaseDb) {
      try {
        const instance = getFirestore(app)
        if (!globalForFirebase.firebaseSettingsApplied) {
          instance.settings({ ignoreUndefinedProperties: true })
          globalForFirebase.firebaseSettingsApplied = true
        }
        globalForFirebase.firebaseDb = instance
      } catch (e) {
        console.error('Failed to get Firestore instance:', e)
        return null as any
      }
    }

    if (!globalForFirebase.firebaseStorage) {
      try {
        globalForFirebase.firebaseStorage = getStorage(app)
      } catch (e) {
        console.error('Failed to get Firebase Storage:', e)
      }
    }

    _db = globalForFirebase.firebaseDb!
    _storage = globalForFirebase.firebaseStorage!

    return _db
  } catch (error) {
    console.error('Unexpected error in initFirebase:', error)
    return null as any
  }
}

/**
 * Get Firestore instance
 */
export function getFirestoreDB(): Firestore {
  if (!_db) {
    if (globalForFirebase.firebaseDisabled || !hasServiceAccountEnv) {
      _db = createFirestoreStub()
      return _db
    }
    const result = initFirebase()
    _db = result ?? createFirestoreStub()
  }
  return _db
}

/**
 * Get Firebase Storage instance
 */
export function getFirebaseStorage(): Storage {
  if (!_storage) {
    if (globalForFirebase.firebaseDisabled || !hasServiceAccountEnv) {
      _storage = createStorageStub()
      return _storage
    }
    initFirebase() // This will initialize storage too
    _storage = _storage ?? createStorageStub()
  }
  return _storage
}

// Export db and storage - initialized on first access
// These are wrapped in getters to ensure lazy initialization
export const db: Firestore = getFirestoreDB()
export const storage: Storage = getFirebaseStorage()

/**
 * Helper to convert Firestore timestamp to Date
 */
export function toDate(timestamp: any): Date {
  if (!timestamp) return new Date()
  if (timestamp.toDate) return timestamp.toDate()
  if (timestamp instanceof Date) return timestamp
  return new Date(timestamp)
}

/**
 * Helper to convert Date to Firestore timestamp
 */
export function toTimestamp(date: Date | string) {
  const d = typeof date === 'string' ? new Date(date) : date
  return { _seconds: Math.floor(d.getTime() / 1000), _nanoseconds: 0 }
}

/**
 * Batch write helper
 */
export async function batchWrite(operations: Array<{ type: 'set' | 'update' | 'delete'; ref: string; data?: any }>) {
  const firestoreDB = getFirestoreDB()
  const batch = firestoreDB.batch()
  
  for (const op of operations) {
    const docRef = firestoreDB.doc(op.ref)
    if (op.type === 'set') {
      batch.set(docRef, op.data)
    } else if (op.type === 'update') {
      batch.update(docRef, op.data)
    } else if (op.type === 'delete') {
      batch.delete(docRef)
    }
  }
  
  await batch.commit()
}

/**
 * Transaction helper
 */
export async function runTransaction<T>(
  callback: (transaction: Transaction) => Promise<T>
): Promise<T> {
  const firestoreDB = getFirestoreDB()
  return await firestoreDB.runTransaction(callback)
}

// Export FieldValue for use in updates
export { FieldValue }

