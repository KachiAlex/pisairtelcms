import crypto from 'crypto'

/**
 * Jitsi Meet Service
 * Stateless room URL generation against a self-hosted Jitsi instance.
 * Rooms are created on first join — no API call needed at scheduling time.
 * The room name is an unguessable capability URL (random suffix).
 */
export class JitsiService {
  static get baseUrl(): string | null {
    const url = process.env.JITSI_PUBLIC_URL || 'https://meet.jit.si'
    return url.replace(/\/+$/, '')
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
}
