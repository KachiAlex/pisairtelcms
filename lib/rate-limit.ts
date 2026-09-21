/**
 * Minimal in-memory sliding-window rate limiter.
 * Suitable for a single-container deployment; a multi-instance setup would
 * need a shared store (Redis/Postgres) instead.
 */

interface Bucket {
  timestamps: number[]
}

const buckets = new Map<string, Bucket>()

// Periodically evict stale buckets so the map doesn't grow unbounded
const SWEEP_INTERVAL_MS = 10 * 60 * 1000
let lastSweep = Date.now()

function sweep(windowMs: number) {
  const now = Date.now()
  if (now - lastSweep < SWEEP_INTERVAL_MS) return
  lastSweep = now
  for (const [key, bucket] of buckets) {
    bucket.timestamps = bucket.timestamps.filter((t) => now - t < windowMs)
    if (bucket.timestamps.length === 0) buckets.delete(key)
  }
}

/**
 * Returns true if the request is within the limit, false if it should be rejected.
 */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  sweep(Math.max(windowMs, SWEEP_INTERVAL_MS))

  const bucket = buckets.get(key) || { timestamps: [] }
  bucket.timestamps = bucket.timestamps.filter((t) => now - t < windowMs)

  if (bucket.timestamps.length >= limit) {
    buckets.set(key, bucket)
    return false
  }

  bucket.timestamps.push(now)
  buckets.set(key, bucket)
  return true
}

/**
 * Best-effort client IP from a Next.js request (respects nginx forwarding).
 */
export function clientIp(request: Request): string {
  const fwd = request.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return request.headers.get('x-real-ip') || 'unknown'
}
