# Firestore Composite Indexes Guide

## Why Do We Need Indexes?

Firestore requires **composite indexes** when queries combine multiple conditions:
- `where()` + `where()` + `orderBy()`
- `where()` + `orderBy()` on different fields

Without these indexes, queries will fail with a `FAILED_PRECONDITION` error.

## Current Status

**✅ Temporary Fix Applied**
- Dashboard APIs now work without indexes
- Queries simplified to avoid index requirements
- Data is sorted in memory instead of in the database

**⚠️ Limitations**
- Month-over-month statistics are disabled
- Activity feed is empty
- Sorting happens in memory (less efficient for large datasets)

## When to Create Indexes

Create Firestore indexes when:
1. You have production data (100+ documents)
2. You need better performance
3. You want month-over-month statistics
4. You want the activity feed to work

## How to Create Indexes

### Method 1: Use Firebase Console Links (Easiest)

When a query fails, check your Vercel logs:
```bash
vercel logs [your-deployment-url]
```

The error will include a direct link to create the index, like:
```
https://console.firebase.google.com/v1/r/project/ecclesia-2025/firestore/indexes?create_composite=...
```

Click the link, sign in to Firebase, and click "Create Index"

### Method 2: Manual Creation

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project (`ecclesia-2025`)
3. Navigate to **Firestore Database** → **Indexes** tab
4. Click **Create Index**

### Required Indexes

Based on the current application, you'll need indexes for:

#### 1. Sermon Views
- **Collection**: `sermon_views`
- **Fields**:
  - `userId` (Ascending)
  - `createdAt` (Descending)

#### 2. Prayer Requests
- **Collection**: `prayer_requests`
- **Fields**:
  - `churchId` (Ascending)
  - `createdAt` (Descending)

#### 3. Prayer Requests with Status
- **Collection**: `prayer_requests`
- **Fields**:
  - `churchId` (Ascending)
  - `status` (Ascending)
  - `createdAt` (Descending)

#### 4. Prayer Interactions
- **Collection**: `prayer_interactions`
- **Fields**:
  - `userId` (Ascending)
  - `createdAt` (Descending)

#### 5. Giving Projects
- **Collection**: `giving_projects`
- **Fields**:
  - `churchId` (Ascending)
  - `status` (Ascending)
  - `createdAt` (Descending)

#### 6. Giving Records
- **Collection**: `giving`
- **Fields**:
  - `userId` (Ascending)
  - `createdAt` (Descending)

#### 7. Event Registrations
- **Collection**: `event_registrations`
- **Fields**:
  - `userId` (Ascending)
  - `createdAt` (Descending)

#### 8. Event Attendances
- **Collection**: `event_attendances`
- **Fields**:
  - `userId` (Ascending)
  - `createdAt` (Descending)

### Method 3: Using Firebase CLI (Advanced)

Create a `firestore.indexes.json` file in your project root:

```json
{
  "indexes": [
    {
      "collectionGroup": "sermon_views",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "prayer_requests",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "churchId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "prayer_requests",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "churchId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "prayer_interactions",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "giving_projects",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "churchId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "giving",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "event_registrations",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "event_attendances",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

Then deploy:
```bash
firebase deploy --only firestore:indexes
```

## Index Creation Time

- **Small datasets** (< 1000 documents): ~5 minutes
- **Medium datasets** (1000-10000 documents): ~15-30 minutes
- **Large datasets** (> 10000 documents): Several hours

You'll receive an email when indexes are ready.

## After Indexes Are Created

Once all indexes are built:

1. **Re-enable Complex Queries**: Remove the comments in:
   - `lib/services/prayer-service.ts` (line ~69)
   - `lib/services/giving-service.ts` (line ~73 and ~169)

2. **Re-enable Dashboard Stats**: Update `app/api/dashboard/stats/route.ts` to calculate month-over-month changes

3. **Re-enable Activity Feed**: Update `app/api/dashboard/activity/route.ts` to show recent activities

## Need Help?

If you encounter issues:
1. Check Vercel logs for exact error messages
2. Verify collection names match exactly (case-sensitive)
3. Ensure field names match exactly
4. Check index status in Firebase Console (they need time to build)

## Reference Links

- [Firestore Index Documentation](https://firebase.google.com/docs/firestore/query-data/indexing)
- [Best Practices for Indexes](https://firebase.google.com/docs/firestore/best-practices)
- [Understanding Index Costs](https://firebase.google.com/docs/firestore/pricing)

