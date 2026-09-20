import { createHmac, randomBytes } from 'crypto'

/**
 * QR check-in credentials for attendance sessions.
 *
 * Static QR (printed at the door): encodes /checkin/{qrToken} — a permanent,
 * unguessable per-session URL.
 *
 * Rotating QR (projected/streamed): encodes /checkin/live/{sessionId}/{code}
 * where `code` is an HMAC of the session's secret qrToken over a time window.
 * The raw token never appears in the rotating URL, so a screenshot of the
 * projected QR goes stale within ~2 windows and cannot be replayed or used to
 * reconstruct the static check-in link.
 */

const WINDOW_MS = 45_000
const CODE_LENGTH = 20

export function generateQrToken(): string {
  return randomBytes(24).toString('base64url')
}

function windowIndex(offset = 0): number {
  return Math.floor(Date.now() / WINDOW_MS) + offset
}

function codeForWindow(qrToken: string, offset = 0): string {
  return createHmac('sha256', qrToken)
    .update(`attendance-live:${windowIndex(offset)}`)
    .digest('hex')
    .slice(0, CODE_LENGTH)
}

/** Current rotating code for a session, plus seconds until it rolls over. */
export function currentLiveCode(qrToken: string): { code: string; expiresIn: number } {
  const expiresIn = Math.ceil((WINDOW_MS - (Date.now() % WINDOW_MS)) / 1000)
  return { code: codeForWindow(qrToken), expiresIn }
}

/** Accepts the current window and the previous one (~90s grace for lag). */
export function verifyLiveCode(qrToken: string, code: string): boolean {
  if (!code || typeof code !== 'string') return false
  return code === codeForWindow(qrToken, 0) || code === codeForWindow(qrToken, -1)
}
