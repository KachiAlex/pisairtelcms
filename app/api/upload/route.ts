import { NextRequest, NextResponse } from 'next/server'
import { guardApi } from '@/lib/api-guard'
import { StorageService } from '@/lib/services/storage-service'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const guarded = await guardApi({ requireChurch: true })
    if (!guarded.ok) return guarded.response

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Whitelist safe image types — extension derived from the validated
    // MIME type, never from the client-supplied filename (svg can carry
    // scripts; a spoofed extension could smuggle other content types)
    const MIME_EXT: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
    }
    const extension = MIME_EXT[file.type]
    if (!extension) {
      return NextResponse.json(
        { error: 'Only JPEG, PNG, GIF, and WebP images are allowed' },
        { status: 400 }
      )
    }

    // Validate file size (5MB limit)
    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'File size must be less than 5MB' }, { status: 400 })
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const fileName = `${Date.now()}-${crypto.randomUUID()}.${extension}`

    // Upload to storage
    const upload = await StorageService.uploadFile({
      file: buffer,
      fileName,
      folder: 'course-assets',
      userId: guarded.ctx.userId,
      contentType: file.type,
    })

    return NextResponse.json({
      success: true,
      url: upload.url,
      path: upload.path,
      fileName: file.name,
      size: file.size,
      type: file.type,
    })
  } catch (error: any) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to upload file' },
      { status: 500 }
    )
  }
}