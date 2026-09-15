
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { getCurrentChurch } from '@/lib/church-context'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const church = await getCurrentChurch(userId)

    if (!church) {
      return NextResponse.json(
        { error: 'No church selected' },
        { status: 400 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'File must be an image' },
        { status: 400 }
      )
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File size must be less than 5MB' },
        { status: 400 }
      )
    }

    // Upload to local storage
    try {
      const { StorageService } = await import('@/lib/services/storage-service')
      const { UserService } = await import('@/lib/services/user-service')

      const user = await UserService.findById(userId)
      const previousImage = user?.profileImage

      const result = await StorageService.uploadImage(file, {
        userId,
        churchId: church.id,
        folder: 'avatars',
        maxWidth: 512,
        maxHeight: 512,
        quality: 85,
      })

      // Persist the new avatar on the user record
      await UserService.update(userId, { profileImage: result.url })

      // Delete the previous avatar from storage to avoid orphaned files
      if (previousImage && previousImage.includes('blob.vercel-storage.com')) {
        try {
          await StorageService.deleteFile(previousImage)
        } catch (deleteError) {
          console.error('Failed to delete previous avatar:', deleteError)
        }
      }

      return NextResponse.json({
        url: result.url,
        path: result.path,
        urls: result.urls || { original: result.url },
        message: 'Avatar uploaded successfully',
      })
    } catch (error: any) {
      console.error('Error uploading to storage:', error)
      
      // Fallback to data URL if storage fails (for development)
      if (process.env.NODE_ENV === 'development') {
        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        const base64 = buffer.toString('base64')
        const dataUrl = `data:${file.type};base64,${base64}`

        return NextResponse.json({
          url: dataUrl,
          message: 'File uploaded as data URL (storage service not configured)',
        })
      }

      return NextResponse.json(
        { error: 'Failed to upload file. Please try again.' },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error('Error uploading avatar:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
