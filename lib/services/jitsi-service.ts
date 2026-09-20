import crypto from 'crypto'
import { SignJWT } from 'jose'

/**
 * Jitsi Meet Service
 * Stateless room URL generation against a self-hosted Jitsi instance.
 * Rooms are created on first join — no API call needed at scheduling time.
 * The room name is an unguessable capability URL (random suffix).
 *
 * When JITSI_APP_SECRET is set, the Jitsi instance runs in secure-domain
 * JWT mode: joins require a short-lived token minted by issueToken().
 * The `room` claim binds each token to one room, so a token for room A
 * cannot open room B — this is what enforces per-church tenancy.
 */
export class JitsiService {
  static get baseUrl(): string | null {
    const url = process.env.JITSI_PUBLIC_URL || 'https://meet.jit.si'
    return url.replace(/\/+$/, '')
  }

  static get appId(): string {
    return process.env.JITSI_APP_ID || 'pisairtelcms'
  }

  static get appSecret(): string | null {
    return process.env.JITSI_APP_SECRET || null
  }

  /** True when the deployment enforces JWT auth on the Jitsi instance. */
  static get jwtEnabled(): boolean {
    return !!this.appSecret
  }

  static isConfigured(): boolean {
    return !!this.baseUrl
  }

  static generateRoomName(meetingId: string): string {
    return `picms-${meetingId}-${crypto.randomBytes(8).toString('hex')}`
  }

  static getJoinUrl(roomName: string): string {
    return `${this.baseUrl}/${roomName}`
  }

  static createRoom(meetingId: string): { roomName: string; joinUrl: string } {
    const roomName = this.generateRoomName(meetingId)
    return { roomName, joinUrl: this.getJoinUrl(roomName) }
  }

  /**
   * Mint a short-lived Jitsi JWT bound to a specific room.
   * Standard jitsi-meet-tokens claims: aud/iss/sub/room + context.user.
   */
  static async issueToken(
    roomName: string,
    user: { id: string; name?: string | null; email?: string | null },
    opts: { moderator?: boolean; ttlSeconds?: number } = {}
  ): Promise<string> {
    const secret = this.appSecret
    if (!secret) throw new Error('JITSI_APP_SECRET is not configured')

    const { moderator = false, ttlSeconds = 3600 } = opts
    const now = Math.floor(Date.now() / 1000)

    return new SignJWT({
      context: {
        user: {
          id: user.id,
          name: user.name || 'Member',
          email: user.email || '',
          moderator,
        },
      },
      room: roomName,
      sub: new URL(this.baseUrl!).host,
    })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setAudience('jitsi')
      .setIssuer(this.appId)
      .setIssuedAt(now)
      .setNotBefore(now - 30)
      .setExpirationTime(now + ttlSeconds)
      .sign(new TextEncoder().encode(secret))
  }

  /**
   * Appended to join URLs so the Jitsi UI (prejoin screen, conference header)
   * shows a friendly meeting name instead of the unguessable room slug.
   * This build resolves the displayed name via callDisplayName before
   * falling back to the start-cased room name.
   */
  static displayNameFragment(displayName?: string | null): string {
    if (!displayName) return ''
    return `#config.callDisplayName=${encodeURIComponent(JSON.stringify(displayName))}`
  }

  /** Join URL with an embedded JWT for the given user. */
  static async getAuthedJoinUrl(
    roomName: string,
    user: { id: string; name?: string | null; email?: string | null },
    opts: { moderator?: boolean; displayName?: string | null } = {}
  ): Promise<string> {
    const base = this.getJoinUrl(roomName)
    const fragment = this.displayNameFragment(opts.displayName)
    if (!this.jwtEnabled) return base + fragment
    const jwt = await this.issueToken(roomName, user, opts)
    return `${base}?jwt=${encodeURIComponent(jwt)}${fragment}`
  }
}
