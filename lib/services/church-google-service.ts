import { google } from 'googleapis'
import { prisma } from '@/lib/prisma'

export type ChurchGoogleTokens = {
  id: string
  churchId: string
  accessToken?: string
  refreshToken?: string
  scope?: string
  tokenType?: string
  expiryDate?: number
  calendarId?: string
  connectedByUserId: string
  createdAt: Date
  updatedAt: Date
}

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing ${name}`)
  return v
}

export function getGoogleOAuthClient() {
  const clientId = requireEnv('GOOGLE_CLIENT_ID')
  const clientSecret = requireEnv('GOOGLE_CLIENT_SECRET')
  const redirectUri = requireEnv('GOOGLE_REDIRECT_URI')

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri)
}

export class ChurchGoogleService {
  static async getTokensByChurchId(churchId: string): Promise<ChurchGoogleTokens | null> {
    const record = await prisma.churchGoogleToken.findUnique({ where: { churchId } })
    if (!record) return null

    return {
      id: record.id,
      churchId: record.churchId,
      accessToken: record.accessToken ?? undefined,
      refreshToken: record.refreshToken ?? undefined,
      scope: record.scope ?? undefined,
      tokenType: record.tokenType ?? undefined,
      expiryDate: record.expiryDate ? Number(record.expiryDate) : undefined,
      calendarId: record.calendarId ?? undefined,
      connectedByUserId: record.connectedByUserId,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    }
  }

  static async upsertTokens(params: {
    churchId: string
    connectedByUserId: string
    accessToken?: string
    refreshToken?: string
    scope?: string
    tokenType?: string
    expiryDate?: number
    calendarId?: string
  }): Promise<ChurchGoogleTokens> {
    const data = {
      churchId: params.churchId,
      connectedByUserId: params.connectedByUserId,
      accessToken: params.accessToken,
      refreshToken: params.refreshToken,
      scope: params.scope,
      tokenType: params.tokenType,
      expiryDate: params.expiryDate != null ? String(params.expiryDate) : null,
      calendarId: params.calendarId,
      updatedAt: new Date(),
    }

    const record = await prisma.churchGoogleToken.upsert({
      where: { churchId: params.churchId },
      update: data,
      create: { ...data, createdAt: new Date() },
    })

    return {
      id: record.id,
      churchId: record.churchId,
      accessToken: record.accessToken ?? undefined,
      refreshToken: record.refreshToken ?? undefined,
      scope: record.scope ?? undefined,
      tokenType: record.tokenType ?? undefined,
      expiryDate: record.expiryDate ? Number(record.expiryDate) : undefined,
      calendarId: record.calendarId ?? undefined,
      connectedByUserId: record.connectedByUserId,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    }
  }

  static async getAuthorizedCalendarClient(churchId: string) {
    const tokens = await this.getTokensByChurchId(churchId)
    if (!tokens?.refreshToken) return null

    const oauth = getGoogleOAuthClient()
    oauth.setCredentials({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      expiry_date: tokens.expiryDate,
    })

    // googleapis will auto-refresh when needed.
    const calendar = google.calendar({ version: 'v3', auth: oauth })

    return {
      calendar,
      oauth,
      tokens,
    }
  }
}
