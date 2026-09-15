import { NextRequest, NextResponse } from 'next/server'
import { guardApi } from '@/lib/api-guard'
import { StorageService } from '@/lib/services/storage-service'
import { prisma } from '@/lib/prisma'

type RouteParams = {
  params: {
    churchId: string
  }
}

// Get church signature settings
export async function GET(_: NextRequest, { params }: RouteParams) {
  try {
    const guarded = await guardApi({ requireChurch: true })
    if (!guarded.ok) return guarded.response

    if (guarded.ctx.church?.id !== params.churchId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const church = await prisma.church.findUnique({
      where: { id: params.churchId },
      select: {
        name: true,
        certificateSignatureUrl: true,
        certificateSignatureTitle: true,
        certificateSignatureName: true,
      },
    })

    if (!church) {
      return NextResponse.json({ error: 'Church not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      signature: {
        url: church.certificateSignatureUrl || null,
        title: church.certificateSignatureTitle || 'Lead Pastor',
        name: church.certificateSignatureName || church.name || 'Church',
      }
    })
  } catch (error: any) {
    console.error('Get signature error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get signature settings' },
      { status: 500 }
    )
  }
}

// Upload/update church signature
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const guarded = await guardApi({ requireChurch: true })
    if (!guarded.ok) return guarded.response

    if (guarded.ctx.church?.id !== params.churchId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Check if user has permission (Pastor, Admin, or Super Admin)
    const allowedRoles = ['PASTOR', 'ADMIN', 'SUPER_ADMIN']
    if (!allowedRoles.includes(guarded.ctx.role || '')) {
      return NextResponse.json({ error: 'Only pastors and admins can upload signatures' }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const title = formData.get('title') as string
    const name = formData.get('name') as string

    if (!file) {
      return NextResponse.json({ error: 'No signature file provided' }, { status: 400 })
    }

    // Validate file type (images only)
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Only image files are allowed for signatures' }, { status: 400 })
    }

    // Validate file size (2MB limit for signatures)
    const maxSize = 2 * 1024 * 1024 // 2MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'Signature file size must be less than 2MB' }, { status: 400 })
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Generate unique filename for signature
    const timestamp = Date.now()
    const extension = file.name.split('.').pop() || 'png'
    const fileName = `signature-${timestamp}.${extension}`

    // Upload signature to storage
    const upload = await StorageService.uploadFile({
      file: buffer,
      fileName,
      folder: `churches/${params.churchId}/signatures`,
      userId: guarded.ctx.userId,
      contentType: file.type,
    })

    // Update church record with signature settings
    await prisma.church.update({
      where: { id: params.churchId },
      data: {
        certificateSignatureUrl: upload.url,
        certificateSignatureTitle: title || 'Lead Pastor',
        certificateSignatureName: name || guarded.ctx.church?.name || 'Church',
      },
    })

    return NextResponse.json({
      success: true,
      signature: {
        url: upload.url,
        title: title || 'Lead Pastor',
        name: name || guarded.ctx.church?.name || 'Church',
      },
      upload: {
        path: upload.path,
        fileName: file.name,
        size: file.size,
        type: file.type,
      }
    })
  } catch (error: any) {
    console.error('Upload signature error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to upload signature' },
      { status: 500 }
    )
  }
}

// Delete church signature
export async function DELETE(_: NextRequest, { params }: RouteParams) {
  try {
    const guarded = await guardApi({ requireChurch: true })
    if (!guarded.ok) return guarded.response

    if (guarded.ctx.church?.id !== params.churchId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Check if user has permission
    const allowedRoles = ['PASTOR', 'ADMIN', 'SUPER_ADMIN']
    if (!allowedRoles.includes(guarded.ctx.role || '')) {
      return NextResponse.json({ error: 'Only pastors and admins can delete signatures' }, { status: 403 })
    }

    // Remove signature settings from church record
    await prisma.church.update({
      where: { id: params.churchId },
      data: {
        certificateSignatureUrl: null,
        certificateSignatureTitle: null,
        certificateSignatureName: null,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Signature removed successfully'
    })
  } catch (error: any) {
    console.error('Delete signature error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete signature' },
      { status: 500 }
    )
  }
}
