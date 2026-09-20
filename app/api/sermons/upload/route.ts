
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
import { guardApi } from '@/lib/api-guard'
import { checkStorageLimitForUpload, incrementUsage } from '@/lib/subscription'
import { StorageService } from '@/lib/services/storage-service'

export async function POST(request: Request) {
  try {
    const guarded = await guardApi({ requireChurch: true, allowedRoles: ['ADMIN', 'SUPER_ADMIN', 'PASTOR'] })
    if (!guarded.ok) return guarded.response

    const { userId, church } = guarded.ctx

    const formData = await request.formData()
    const file = formData.get('file') as File
    const type = formData.get('type') as 'video' | 'audio' | 'thumbnail'

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    if (type === 'video') {
      return NextResponse.json(
        { error: 'Video uploads must be provided via embed URLs. Please paste a YouTube, Vimeo, or direct streaming link instead.' },
        { status: 400 }
      )
    }

    // Validate file type
    const validTypes: Record<string, string[]> = {
      audio: ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/webm', 'audio/x-m4a', 'audio/m4a', 'audio/mp4', 'audio/aac', 'audio/flac'],
      thumbnail: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'],
    }

    if (!validTypes[type]?.includes(file.type)) {
      return NextResponse.json(
        { error: `Invalid file type for ${type}. Received: ${file.type}` },
        { status: 400 }
      )
    }

    // Check file size (max 500MB for video, 100MB for audio, 5MB for thumbnail)
    const maxSizes: Record<string, number> = {
      video: 500 * 1024 * 1024, // 500MB
      audio: 100 * 1024 * 1024, // 100MB
      thumbnail: 5 * 1024 * 1024, // 5MB
    }

    if (file.size > maxSizes[type]) {
      return NextResponse.json(
        { error: `File too large. Maximum size for ${type} is ${maxSizes[type] / (1024 * 1024)}MB` },
        { status: 400 }
      )
    }

    const storageCheck = await checkStorageLimitForUpload(church.id, file.size)
    if (!storageCheck.allowed && storageCheck.limit) {
      return NextResponse.json(
        {
          error: `Storage limit reached. Uploading this file would exceed your plan limit of ${storageCheck.limit}GB.`,
          limit: storageCheck.limit,
          current: storageCheck.current,
          projected: storageCheck.projected,
        },
        { status: 403 }
      )
    }

    // Generate unique filename & upload
    const fileExtension = file.name.split('.').pop()
    const fileName = `${uuidv4()}.${fileExtension}`

    const upload = await StorageService.uploadFile({
      file,
      fileName,
      folder: `sermons/${church.id}/${type}`,
      userId,
      churchId: church.id,
      contentType: file.type,
    })

    await incrementUsage(church.id, 'storageUsedGB', file.size / (1024 * 1024 * 1024))

    return NextResponse.json({
      success: true,
      url: upload.url,
      fileName,
      fileSize: file.size,
      fileType: file.type,
    })
  } catch (error: any) {
    console.error('Error uploading file:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
