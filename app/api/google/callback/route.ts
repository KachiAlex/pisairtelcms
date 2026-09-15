
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ChurchGoogleService, getGoogleOAuthClient } from '@/lib/services/church-google-service'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')

  if (!code || !state) {
    return NextResponse.redirect(new URL('/meetings?google=error', url.origin))
  }

  const stateRecord = await prisma.churchGoogleOauthState.findUnique({ where: { state } })

  if (!stateRecord) {
    return NextResponse.redirect(new URL('/meetings?google=expired', url.origin))
  }

  if (stateRecord.expiresAt.getTime() < Date.now()) {
    await prisma.churchGoogleOauthState.delete({ where: { id: stateRecord.id } }).catch(() => null)
    return NextResponse.redirect(new URL('/meetings?google=expired', url.origin))
  }

  const churchId = stateRecord.churchId
  const connectedByUserId = stateRecord.userId

  const oauth = getGoogleOAuthClient()
  const tokenResponse = await oauth.getToken(code)
  const tokens = tokenResponse.tokens

  await ChurchGoogleService.upsertTokens({
    churchId,
    connectedByUserId,
    accessToken: tokens.access_token || undefined,
    refreshToken: tokens.refresh_token || undefined,
    scope: tokens.scope || undefined,
    tokenType: tokens.token_type || undefined,
    expiryDate: tokens.expiry_date || undefined,
    calendarId: 'primary',
  })

  await prisma.churchGoogleOauthState.delete({ where: { id: stateRecord.id } }).catch(() => null)

  return NextResponse.redirect(new URL('/meetings?google=connected', url.origin))
}
