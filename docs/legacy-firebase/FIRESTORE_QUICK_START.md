# Firestore Quick Start

## Current Status

✅ **Foundation Complete**
- Firestore client configured
- User & Church services created
- Authentication migrated
- Migration tools ready

## What's Working

1. **Authentication** - Uses Firestore
2. **User Service** - Full CRUD operations
3. **Church Service** - Basic operations

## What's Needed

You need to create **30+ service layers** for remaining models:
- Posts, Sermons, Events, Prayer Requests
- Giving, Payroll, Badges, Messages
- And 20+ more...

## Quick Usage

### Using Services

```typescript
import { UserService } from '@/lib/services/user-service'
import { ChurchService } from '@/lib/services/church-service'

// Find user
const user = await UserService.findById(userId)

// Find by email
const user = await UserService.findByEmail(email)

// Create user
const user = await UserService.create({
  email: 'user@example.com',
  firstName: 'John',
  lastName: 'Doe',
  password: 'password123',
  role: 'MEMBER',
  churchId: 'church-123',
})

// Update user
await UserService.update(userId, { firstName: 'Jane' })

// Search users
const users = await UserService.search(churchId, 'john')
```

### Direct Firestore Access

```typescript
import { db } from '@/lib/firestore'
import { COLLECTIONS } from '@/lib/firestore-collections'

// Get document
const doc = await db.collection(COLLECTIONS.users).doc(userId).get()
const user = doc.data()

// Query
const snapshot = await db.collection(COLLECTIONS.users)
  .where('churchId', '==', churchId)
  .limit(10)
  .get()

// Create
await db.collection(COLLECTIONS.users).doc(userId).set({
  email: 'user@example.com',
  firstName: 'John',
  // ...
})

// Update
await db.collection(COLLECTIONS.users).doc(userId).update({
  firstName: 'Jane',
})
```

## Creating a New Service

Follow this pattern:

```typescript
// lib/services/post-service.ts
import { db, toDate } from '@/lib/firestore'
import { COLLECTIONS } from '@/lib/firestore-collections'
import { FieldValue } from 'firebase-admin/firestore'

export interface Post {
  id: string
  userId: string
  churchId: string
  content: string
  type: string
  likes: number
  createdAt: Date
  updatedAt: Date
}

export class PostService {
  static async findById(id: string): Promise<Post | null> {
    const doc = await db.collection(COLLECTIONS.posts).doc(id).get()
    if (!doc.exists) return null
    
    const data = doc.data()!
    return {
      id: doc.id,
      ...data,
      createdAt: toDate(data.createdAt),
      updatedAt: toDate(data.updatedAt),
    } as Post
  }

  static async create(data: Omit<Post, 'id' | 'createdAt' | 'updatedAt'>): Promise<Post> {
    const postData = {
      ...data,
      likes: 0,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }

    const docRef = db.collection(COLLECTIONS.posts).doc()
    await docRef.set(postData)

    const created = await docRef.get()
    return {
      id: created.id,
      ...created.data()!,
      createdAt: toDate(created.data()!.createdAt),
      updatedAt: toDate(created.data()!.updatedAt),
    } as Post
  }

  // Add more methods as needed...
}
```

## Environment Setup

```env
# Required for Firestore
FIREBASE_PROJECT_ID=your-project-id

# Option 1: Service Account JSON (for local dev)
FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}

# Option 2: Use default credentials (Cloud Run)
# Leave FIREBASE_SERVICE_ACCOUNT empty
```

## Next Steps

1. **Create remaining services** - Follow pattern in `user-service.ts`
2. **Update API routes** - Replace Prisma with services
3. **Create indexes** - For all query patterns
4. **Write security rules** - Access control
5. **Test thoroughly** - Before production

## Resources

- Migration Guide: `FIRESTORE_MIGRATION_GUIDE.md`
- Service Examples: `lib/services/user-service.ts`
- Collection Names: `lib/firestore-collections.ts`

