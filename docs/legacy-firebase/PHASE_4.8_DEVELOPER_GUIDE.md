# Phase 4.8 Developer Guide: Real Data Connections

## Quick Start

### Using Analytics Cache in Components

```tsx
import { useAnalyticsCache } from '@/hooks/useAnalyticsCache'

export function MyComponent() {
  const { analytics, status, isLoading, refreshCache, isRefreshing } = useAnalyticsCache()

  if (isLoading) return <div>Loading analytics...</div>

  return (
    <div>
      <h2>Analytics Status</h2>
      <p>Cache Valid: {status?.isValid ? '✓' : '✗'}</p>
      <p>Quality Score: {status?.qualityScore}%</p>
      <button onClick={refreshCache} disabled={isRefreshing}>
        {isRefreshing ? 'Refreshing...' : 'Refresh Cache'}
      </button>

      {analytics && (
        <div>
          <p>Active Members: {analytics.snapshot.activeMembers}</p>
          <p>Top Topics: {analytics.snapshot.topTopics.join(', ')}</p>
        </div>
      )}
    </div>
  )
}
```

### Using Services Directly

```ts
import { DataAggregationService } from '@/lib/services/data-aggregation-service'
import { AnalyticsCacheService } from '@/lib/services/analytics-cache-service'

// Get historical events
const events = await DataAggregationService.getHistoricalEvents('church-id', 90)
console.log(events) // HistoricalEvent[]

// Get member engagement data
const members = await DataAggregationService.getMemberEngagementData('church-id')
console.log(members) // MemberEngagementData[]

// Get content engagement
const content = await DataAggregationService.getContentEngagementData('church-id', 50)
console.log(content) // ContentEngagementData[]

// Get cached analytics
const analytics = await AnalyticsCacheService.getAnalytics('church-id')
console.log(analytics) // CachedAnalytics

// Manually refresh cache
const refreshed = await AnalyticsCacheService.refreshAnalyticsCache('church-id')
console.log(refreshed) // CachedAnalytics (fresh)
```

### Using Recommendation Service with Real Data

```ts
import { RecommendationService } from '@/lib/services/recommendation-service'

// Predict attendance (now uses real data automatically)
const prediction = await RecommendationService.predictEventAttendance('church-id', {
  eventType: 'service',
  dayOfWeek: 'Sunday',
  timeOfDay: 'morning',
  specialFactors: ['holiday']
})
console.log(prediction.predictedAttendance) // number

// Find optimal schedule
const schedule = await RecommendationService.findOptimalSchedule('church-id')
console.log(schedule[0].dayOfWeek) // 'Sunday'
console.log(schedule[0].predictedAttendance) // number

// Get member engagement recommendations
const recommendations = await RecommendationService.generateMemberEngagementRecommendations('church-id')
console.log(recommendations.get('member-id'))

// Get content recommendations
const contentRecs = await RecommendationService.generateContentRecommendations('church-id')
console.log(contentRecs) // Recommendation[]
```

---

## API Endpoints Reference

### GET `/api/analytics/cache`
Fetch cached or fresh analytics

**Params:**
- `churchId` (required): Church ID
- `forceRefresh` (optional): Force recompute cache

**Response:**
```json
{
  "churchId": "string",
  "id": "string",
  "snapshot": {
    "totalMembers": 100,
    "activeMembers": 75,
    "avgEngagement": 65,
    "topTopics": ["faith", "justice"],
    "riskMembers": [{ "id": "...", "reason": "..." }],
    "leadershipCandidates": [{ "id": "...", "readiness": 85 }]
  },
  "recommendations": {
    "attendance": [{ "topic": "...", "reason": "...", "priority": 8 }],
    "schedules": [{ "dayOfWeek": "Sunday", "time": "morning", "expected": 120 }],
    "engagement": [{ "memberId": "...", "action": "..." }],
    "content": [{ "topic": "...", "expected": 150 }]
  },
  "lastUpdated": "2024-01-15T10:00:00Z",
  "nextRefresh": "2024-01-15T11:00:00Z",
  "quality": {
    "dataCompleteness": 95,
    "eventsCount": 52,
    "membersCount": 450,
    "avgEventAttendance": 100
  }
}
```

### POST `/api/analytics/cache`
Manually refresh cache

**Body:**
```json
{
  "churchId": "string"
}
```

**Response:**
```json
{
  "success": true,
  "analytics": { /* same as GET */ },
  "message": "Cache refreshed successfully"
}
```

### GET `/api/analytics/cache/status`
Check cache health

**Params:**
- `churchId` (required): Church ID

**Response:**
```json
{
  "churchId": "string",
  "cacheExists": true,
  "isValid": true,
  "lastUpdated": "2024-01-15T10:00:00Z",
  "nextRefresh": "2024-01-15T11:00:00Z",
  "cacheAge": 15,
  "dataQuality": {
    "dataCompleteness": 95,
    "eventsCount": 52,
    "membersCount": 450,
    "avgEventAttendance": 100
  },
  "qualityScore": 95,
  "recommendation": "ok"
}
```

---

## Data Structures Reference

### HistoricalEvent
```ts
{
  id: string
  date: Date
  dayOfWeek: string // Monday, Tuesday, etc.
  timeOfDay: string // morning, afternoon, evening
  type: string // service, prayer, meeting, etc.
  expectedAttendees: number
  actualAttendees: number
  engagementScore: number // 0-100
}
```

### MemberEngagementData
```ts
{
  id: string
  firstName: string
  lastName: string
  email: string
  lastLogin: Date | null
  lastActivity: Date | null
  eventAttendance: number // count
  sermonsWatched: number // count
  volunteered: boolean
  gave: boolean
  engagementScore: number // 0-100 with decay
  daysInactive: number
  roles: string[] // ['member', 'leader', etc.]
}
```

### ContentEngagementData
```ts
{
  id: string
  title: string
  type: string // sermon, article, etc.
  topic: string
  publishedAt: Date
  viewCount: number
  completionRate: number // 0-1
  engagementScore: number // 0-100
}
```

### AnalyticsSnapshot
```ts
{
  churchId: string
  timestamp: Date
  totalMembers: number
  activeMembers: number // < 30 days
  avgEngagement: number // 0-100
  topTopics: string[] // top 5 by engagement
  riskMembers: Array<{
    id: string
    name: string
    reason: string
    engagementScore: number
  }>
  leadershipCandidates: Array<{
    id: string
    name: string
    readinessScore: number // 0-100
    reasoning: string
  }>
  optimalEventDays: Array<{
    dayOfWeek: string
    timeOfDay: string
    avgAttendance: number
    confidence: string
  }>
}
```

---

## Important Notes

### Engagement Scoring
The engagement score calculation includes temporal decay:
```
Base Score = (events × 0.4 + sermons × 0.3 + comments × 0.3) / 2

Decay Factors:
- 7+ days inactive: × 0.9 (-10%)
- 30+ days inactive: × 0.7 (-30%)
- 60+ days inactive: × 0.5 (-50%)

Final Score = max(0, Base Score × Decay)
```

### Cache TTL
- **Cache Duration:** 1 hour (3,600,000 ms)
- **React Query Stale Time:** 30 minutes (to refresh cache at 55 min mark)
- **Status Check Interval:** 5 minutes (lightweight polling)
- **Full Refresh Check:** 1 hour (cache TTL)

### Error Handling
All services include graceful error handling:
```ts
try {
  // Get real data
  const events = await DataAggregationService.getHistoricalEvents(churchId)
} catch (error) {
  console.error('Error getting events:', error)
  // Fall back to provided data or empty array
  return []
}
```

All hooks include error states:
```tsx
if (error) {
  return <div>Error: {error.message}</div>
}
```

---

## Common Patterns

### Display Cache Status
```tsx
import { AnalyticsCacheManagement } from '@/components/dashboard/AnalyticsCacheManagement'

<AnalyticsCacheManagement compact={false} />
```

### Check Data Quality Before Operations
```ts
const analytics = await AnalyticsCacheService.getAnalytics(churchId)
if (analytics.quality.dataCompleteness < 50) {
  console.warn('Insufficient data quality for reliable recommendations')
}
```

### Trigger Recommendations
```ts
const snapshot = analytics.snapshot
if (snapshot.riskMembers.length > 0) {
  // Follow up with at-risk members
}

if (snapshot.leadershipCandidates.length > 0) {
  // Invite leadership development program
}
```

### Monitor Cache Age
```ts
const now = new Date()
const lastUpdate = new Date(analytics.lastUpdated)
const ageMinutes = (now.getTime() - lastUpdate.getTime()) / 60000

if (ageMinutes > 55) {
  // Cache expiring soon - proactively refresh
  await refreshCache()
}
```

---

## Testing

Example of testing DataAggregationService:
```ts
describe('DataAggregationService', () => {
  it('should get historical events', async () => {
    const events = await DataAggregationService.getHistoricalEvents('test-church', 90)
    expect(events).toBeDefined()
    expect(events.length).toBeGreaterThan(0)
    expect(events[0]).toHaveProperty('dayOfWeek')
  })

  it('should calculate engagement with decay', async () => {
    const members = await DataAggregationService.getMemberEngagementData('test-church')
    for (const member of members) {
      if (member.daysInactive > 30) {
        expect(member.engagementScore).toBeLessThan(70)
      }
    }
  })
})
```

---

## Troubleshooting

### "Cache Invalid" Status
- Happens after 1 hour of last refresh
- Solution: Wait for auto-refresh or click "Refresh Now" in dashboard

### "Insufficient Data" Recommendation
- Means events < 10 OR members < 50 OR incomplete attendance records
- Solution: Ensure users are being tracked, events have attendance marked

### Hook returns null across page refresh
- React Query is caching but Firestore has no persistent cache
- Solution: Manual refresh button or `forceRefresh: true`

### Stale Data in Components
- Check React Query devtools
- Verify stale time (30 min < cache TTL 60 min)
- Manual refresh available in UI

---

## Performance Tips

1. **Use compact mode for dashboards** - Lighter DOM
2. **Cache status separately** - 5 min refresh << 1 hour full refresh
3. **Batch operations when possible** - Use `refreshMultipleAnalytics`
4. **Check cache age before using** - Avoid stale recommendations
5. **Implement monitoring** - Use status endpoint in alerting system

---

## Next Steps

After Phase 4.8, ready for:
- **Phase 5A:** ML models trained on aggregated data
- **Phase 5B:** Advanced predictive analytics
- **Phase 5C:** ML model integration into recommendations

All services support these extensions without modification.
