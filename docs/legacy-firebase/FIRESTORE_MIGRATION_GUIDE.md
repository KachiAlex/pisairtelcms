# Firestore Migration Guide

## Overview

This guide documents the migration from PostgreSQL/Prisma to Firestore (NoSQL).

## Migration Status

### ✅ Completed
- [x] Firestore client setup (`lib/firestore.ts`)
- [x] Collection mappings (`lib/firestore-collections.ts`)
- [x] User service layer (`lib/services/user-service.ts`)
- [x] Church service layer (`lib/services/church-service.ts`)
- [x] Authentication updated to use Firestore

### 🚧 In Progress
- [ ] Create all service layers for remaining models
- [ ] Update all API routes
- [ ] Update components
- [ ] Data migration script

### ⏳ Pending
- [ ] Testing
- [ ] Performance optimization
- [ ] Index creation
- [ ] Security rules

## Architecture Changes

### Before (Prisma/PostgreSQL)
```
API Route → Prisma Client → PostgreSQL
```

### After (Firestore)
```
API Route → Service Layer → Firestore SDK → Firestore
```

## Key Differences

### 1. No Joins
**Before (Prisma):**
```typescript
const user = await prisma.user.findUnique({
  where: { id },
  include: { church: true }
})
```

**After (Firestore):**
```typescript
const user = await UserService.findById(id)
const church = await ChurchService.findById(user.churchId)
```

### 2. No Transactions Across Collections
**Before (Prisma):**
```typescript
await prisma.$transaction([
  prisma.user.create(...),
  prisma.church.update(...)
])
```

**After (Firestore):**
```typescript
await runTransaction(async (tx) => {
  tx.set(userRef, userData)
  tx.update(churchRef, churchData)
})
```

### 3. Manual Relationships
**Before (Prisma):**
```typescript
// Foreign keys handled automatically
model User {
  churchId String
  church Church @relation(fields: [churchId], references: [id])
}
```

**After (Firestore):**
```typescript
// Store IDs, fetch separately
{
  churchId: "church-123",
  // Fetch church separately when needed
}
```

## Service Layer Pattern

Each model gets a service class:

```typescript
export class ModelService {
  static async findById(id: string): Promise<Model | null>
  static async create(data: Omit<Model, 'id'>): Promise<Model>
  static async update(id: string, data: Partial<Model>): Promise<Model>
  static async delete(id: string): Promise<void>
  static async findByChurch(churchId: string): Promise<Model[]>
  // ... other methods
}
```

## Collection Structure

### Users Collection
```
users/{userId}
  - email: string
  - firstName: string
  - lastName: string
  - password: string (hashed)
  - role: string
  - churchId: string
  - xp: number
  - level: number
  - createdAt: Timestamp
  - updatedAt: Timestamp
```

### Churches Collection
```
churches/{churchId}
  - name: string
  - address?: string
  - phone?: string
  - email?: string
  - logo?: string
  - createdAt: Timestamp
  - updatedAt: Timestamp
```

### Subcollections (for related data)
```
churches/{churchId}/subscriptions/{subscriptionId}
churches/{churchId}/branding/{brandingId}
users/{userId}/badges/{badgeId}
```

## Migration Steps

### 1. Install Dependencies
```bash
npm install firebase-admin
```

### 2. Set Environment Variables
```env
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}
# OR use default credentials in Cloud Run
```

### 3. Create Service Layers
For each Prisma model, create a service:
- `lib/services/user-service.ts` ✅
- `lib/services/church-service.ts` ✅
- `lib/services/post-service.ts`
- `lib/services/sermon-service.ts`
- `lib/services/event-service.ts`
- ... (30+ services needed)

### 4. Update API Routes
Replace Prisma calls with service calls:

**Before:**
```typescript
const user = await prisma.user.findUnique({ where: { id } })
```

**After:**
```typescript
const user = await UserService.findById(id)
```

### 5. Create Firestore Indexes
For each query, create composite indexes:

```bash
# Example: Users by church and role
firebase firestore:indexes create
```

### 6. Data Migration
Export from PostgreSQL, transform, import to Firestore:

```typescript
// scripts/migrate-to-firestore.ts
// 1. Export from PostgreSQL
// 2. Transform data structure
// 3. Import to Firestore
```

## Challenges & Solutions

### Challenge 1: Complex Queries
**Problem:** Firestore doesn't support complex WHERE clauses

**Solution:** 
- Use composite indexes
- Fetch and filter in code (for small datasets)
- Use Cloud Functions for complex queries

### Challenge 2: Relationships
**Problem:** No foreign keys or joins

**Solution:**
- Store IDs as references
- Fetch related data separately
- Use subcollections for one-to-many relationships

### Challenge 3: Transactions
**Problem:** Limited to single document or collection group

**Solution:**
- Use batch writes for multiple documents
- Design data model to minimize cross-collection transactions

### Challenge 4: Aggregations
**Problem:** No GROUP BY or complex aggregations

**Solution:**
- Use Cloud Functions
- Pre-calculate aggregations
- Use counters for simple aggregations

## Performance Considerations

### 1. Indexes
Create indexes for all query patterns:
```bash
firebase firestore:indexes
```

### 2. Pagination
Always use pagination:
```typescript
query.limit(20).startAfter(lastDoc)
```

### 3. Caching
Consider caching frequently accessed data:
```typescript
// Use React Query or similar
```

### 4. Batch Operations
Use batch writes for multiple operations:
```typescript
await batchWrite([
  { type: 'set', ref: 'users/1', data: user1 },
  { type: 'set', ref: 'users/2', data: user2 },
])
```

## Security Rules

Create Firestore security rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == userId;
    }
    
    match /churches/{churchId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.churchId == churchId;
    }
  }
}
```

## Testing Checklist

- [ ] Authentication works
- [ ] User CRUD operations
- [ ] Church CRUD operations
- [ ] Relationships work correctly
- [ ] Queries perform well
- [ ] Transactions work
- [ ] Security rules enforced
- [ ] Data migration successful

## Rollback Plan

If migration fails:
1. Keep Prisma code in separate branch
2. Switch environment variable back to PostgreSQL
3. Revert API routes
4. Restore from PostgreSQL backup

## Next Steps

1. ✅ Complete service layer for all models
2. ✅ Update all API routes
3. ✅ Create data migration script
4. ✅ Set up Firestore indexes
5. ✅ Write security rules
6. ✅ Test thoroughly
7. ✅ Deploy to staging
8. ✅ Migrate production data
9. ✅ Deploy to production

## Resources

- [Firestore Documentation](https://firebase.google.com/docs/firestore)
- [Firestore Best Practices](https://firebase.google.com/docs/firestore/best-practices)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)

