import { NextRequest, NextResponse } from 'next/server'
import { guardApi } from '@/lib/api-guard'
import { prisma } from '@/lib/prisma'
import { StorageService } from '@/lib/services/storage-service'

type RouteParams = {
  params: {
    churchId: string
  }
}

const ALLOWED_ROLES = ['PASTOR', 'ADMIN', 'SUPER_ADMIN']

const formatSignaturePayload = (church: {
  name?: string | null
  certificateSignatureUrl?: string | null
  certificateSignatureTitle?: string | null
  certificateSignatureName?: string | null
} | null) => ({
  signatureUrl: church?.certificateSignatureUrl || null,
  signatureTitle: church?.certificateSignatureTitle || 'Lead Pastor',
  signatureName: church?.certificateSignatureName || church?.name || '',
})

const SIGNATURE_SELECT = {
  name: true,
  certificateSignatureUrl: true,
  certificateSignatureTitle: true,
  certificateSignatureName: true,
} as const

async function ensureGuardedAccess(params: RouteParams['params']) {
  const guarded = await guardApi({ requireChurch: true })
  if (!guarded.ok) return { ctx: null, errorResponse: guarded.response }

  const churchId = guarded.ctx.church?.id
  if (churchId !== params.churchId && guarded.ctx.role !== 'SUPER_ADMIN') {
    return {
      ctx: null,
      errorResponse: NextResponse.json({ error: 'Access denied' }, { status: 403 }),
    }
  }

  return { ctx: guarded.ctx, errorResponse: null }
}

export async function GET(_: NextRequest, { params }: RouteParams) {
  try {
    const { ctx, errorResponse } = await ensureGuardedAccess(params)
    if (!ctx) return errorResponse!

    const church = await prisma.church.findUnique({
      where: { id: params.churchId },
      select: SIGNATURE_SELECT,
    })
    if (!church) {
      return NextResponse.json({ error: 'Church not found' }, { status: 404 })
    }

    return NextResponse.json(formatSignaturePayload(church))
  } catch (error) {
    console.error('Certificate signature GET error:', error)
    return NextResponse.json({ error: 'Failed to load signature settings' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { ctx, errorResponse } = await ensureGuardedAccess(params)
    if (!ctx) return errorResponse!

    if (!ALLOWED_ROLES.includes(ctx.role || '')) {
      return NextResponse.json({ error: 'Only pastors and admins can upload signatures' }, { status: 403 })
    }

    const formData = await request.formData()
    const file = (formData.get('signature') || formData.get('file')) as File | null
    const title = (formData.get('title') as string | null)?.trim() || 'Lead Pastor'
    const name = (formData.get('name') as string | null)?.trim() || ctx.church?.name || ''

    if (!file) {
      return NextResponse.json({ error: 'Signature image is required' }, { status: 400 })
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Only image files are allowed' }, { status: 400 })
    }

    const maxSize = 2 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'Signature must be smaller than 2MB' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const extension = file.name.split('.').pop() || 'png'
    const upload = await StorageService.uploadFile({
      file: buffer,
      fileName: `certificate-signature-${Date.now()}.${extension}`,
      folder: `churches/${params.churchId}/certificate-signatures`,
      userId: ctx.userId,
      churchId: params.churchId,
      contentType: file.type,
    })

    await prisma.church.update({
      where: { id: params.churchId },
      data: {
        certificateSignatureUrl: upload.url,
        certificateSignatureTitle: title,
        certificateSignatureName: name,
      },
    })

    return NextResponse.json({
      signatureUrl: upload.url,
      signatureTitle: title,
      signatureName: name,
    })
  } catch (error) {
    console.error('Certificate signature POST error:', error)
    return NextResponse.json({ error: 'Failed to update signature image' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { ctx, errorResponse } = await ensureGuardedAccess(params)
    if (!ctx) return errorResponse!

    if (!ALLOWED_ROLES.includes(ctx.role || '')) {
      return NextResponse.json({ error: 'Only pastors and admins can update signature settings' }, { status: 403 })
    }

    const body = await request.json().catch(() => null)
    const title = body?.title?.trim()
    const name = body?.name?.trim()

    if (!title) {
      return NextResponse.json({ error: 'Signature title is required' }, { status: 400 })
    }

    await prisma.church.update({
      where: { id: params.churchId },
      data: {
        certificateSignatureTitle: title,
        ...(typeof name === 'string' ? { certificateSignatureName: name } : {}),
      },
    })

    const updated = await prisma.church.findUnique({
      where: { id: params.churchId },
      select: SIGNATURE_SELECT,
    })

    return NextResponse.json(formatSignaturePayload(updated))
  } catch (error) {
    console.error('Certificate signature PUT error:', error)
    return NextResponse.json({ error: 'Failed to update signature settings' }, { status: 500 })
  }
}
