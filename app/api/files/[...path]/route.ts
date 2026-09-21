export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createReadStream } from 'fs'
import { stat } from 'fs/promises'
import { join, normalize, extname } from 'path'
import { Readable } from 'stream'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { prisma } from '@/lib/prisma'
import { getCurrentChurchId } from '@/lib/church-context'
import { StorageService } from '@/lib/services/storage-service'

// Path prefixes that must stay public (login page branding, etc.)
const PUBLIC_PREFIXES = ['branding/']

// Path prefixes that embed the church id as the second segment:
//   churches/{churchId}/..., accounting/{churchId}/..., sermons/{churchId}/...
const CHURCH_SCOPED_PREFIXES = ['churches/', 'accounting/', 'sermons/', 'digital-school/', 'reading-plans/']

const MANAGER_ROLES = ['ADMIN', 'PASTOR', 'BRANCH_ADMIN', 'SUPER_ADMIN']

/**
 * Returns null when the request may proceed, or a NextResponse error.
 */
async function authorizeFileAccess(relPath: string): Promise<NextResponse | null> {
  if (PUBLIC_PREFIXES.some((p) => relPath.startsWith(p))) return null

  const session = await getServerSession(authOptions)
  const user = session?.user as any
  if (!user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Church-scoped prefixes carry the tenant id in the path
  const scoped = CHURCH_SCOPED_PREFIXES.find((p) => relPath.startsWith(p))
  if (scoped) {
    const pathChurchId = relPath.slice(scoped.length).split('/')[0]
    if (pathChurchId && pathChurchId !== 'shared' && user.role !== 'SUPER_ADMIN') {
      const callerChurchId = await getCurrentChurchId(user.id)
      if (callerChurchId !== pathChurchId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }
    return null
  }

  // Bank-transfer receipts don't embed the tenant — resolve via the Giving row
  if (relPath.startsWith('bank-transfer-receipts/')) {
    if (MANAGER_ROLES.includes(user.role)) return null
    // Delegated giving managers may also view receipts
    const grant = await prisma.permissionGrant.findFirst({
      where: { userId: user.id, permission: 'manage_giving' },
      select: { id: true },
    })
    if (grant) return null
    const giving = await prisma.giving.findFirst({
      where: { transferReceiptUrl: { contains: relPath }, userId: user.id },
      select: { id: true },
    })
    if (!giving) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  // messages/, avatars/, and any other prefix: any authenticated user
  return null
}

const CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.ogg': 'video/ogg',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.pdf': 'application/pdf',
}

/**
 * GET /api/files/[...path]
 * Streams files stored under UPLOAD_DIR (local disk storage on the VPS).
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: segments } = await context.params
    if (!segments || segments.length === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const relPath = normalize(segments.join('/')).replace(/^(\.\.(\/|\\|$))+/, '')

    const denied = await authorizeFileAccess(relPath)
    if (denied) return denied

    const ext = extname(relPath).toLowerCase()
    const contentType = CONTENT_TYPES[ext] || 'application/octet-stream'
    let stream: ReadableStream | Uint8Array
    let contentLength: number | undefined

    if (StorageService.isR2Configured()) {
      const object = await StorageService.getR2Object(relPath)
      if (!object) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      stream = object.body
      contentLength = object.contentLength
    } else {
      const uploadDir = StorageService.getUploadDir()
      const absPath = join(uploadDir, relPath)

      // Guard against path traversal outside the upload root
      if (!absPath.startsWith(normalize(uploadDir))) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
      }

      const info = await stat(absPath).catch(() => null)
      if (!info || !info.isFile()) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
      }
      stream = Readable.toWeb(createReadStream(absPath)) as ReadableStream
      contentLength = info.size
    }

    const headers: Record<string, string> = {
      'Content-Type': contentType,
      ...(contentLength !== undefined ? { 'Content-Length': String(contentLength) } : {}),
      'Cache-Control': 'public, max-age=31536000, immutable',
    }
    // SVGs can carry scripts — serve them sandboxed so they can't execute
    if (ext === '.svg') {
      headers['Content-Security-Policy'] = "default-src 'none'; style-src 'unsafe-inline'"
    }

    const responseBody = stream instanceof Uint8Array
      ? new ReadableStream({
          start(controller) {
            controller.enqueue(stream)
            controller.close()
          },
        })
      : stream

    return new NextResponse(responseBody, { headers })
  } catch (error) {
    console.error('File serve error:', error)
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}
