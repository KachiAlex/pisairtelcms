export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createHash, timingSafeEqual } from 'crypto'
import { BirthdayService } from '@/lib/services/birthday-service'

/**
 * Daily birthday announcements. Invoked by the VPS host crontab:
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://pisairtelcms.com/api/cron/birthdays
 *
 * Auth: bearer token compared via SHA-256 digests (timing-safe, length-agnostic).
 */
function authorized(request: Request): boolean {
  const expected = process.env.CRON_SECRET
  if (!expected) return false
  const provided = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || ''
  if (!provided) return false
  const a = createHash('sha256').update(provided).digest()
  const b = createHash('sha256').update(expected).digest()
  return timingSafeEqual(a, b)
}

async function run(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await BirthdayService.announceTodaysBirthdays()
    return NextResponse.json({ success: true, ...result })
  } catch (error: any) {
    console.error('Birthday cron failed:', error)
    return NextResponse.json({ error: error?.message || 'Internal error' }, { status: 500 })
  }
}

export const GET = run
export const POST = run
