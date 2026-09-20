export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { ChurchService } from '@/lib/services/church-service'
import { StorageService } from '@/lib/services/storage-service'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_ROLES = new Set(['ADMIN', 'SUPER_ADMIN', 'PASTOR'])

export async function POST(
  request: Request,
  { params }: { params: { churchId: string } },
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const role = (session.user as any).role
    if (!ALLOWED_ROLES.has(role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const userId = (session.user as any).id as string
    const { churchId } = params

    // Tenant isolation: non-superadmins may only brand their own church
    if (role !== 'SUPER_ADMIN' && (session.user as any).churchId !== churchId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const church = await ChurchService.findById(churchId)
    if (!church) {
      return NextResponse.json({ error: 'Church not found' }, { status: 404 })
    }

    const formData = await request.formData()
    const file = formData.get('file')

    // Node 18 has no global `File`; duck-type on arrayBuffer() instead
    if (!file || typeof (file as Blob).arrayBuffer !== 'function') {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const uploadedFile = file as File
    if (!uploadedFile.type?.startsWith('image/')) {
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 })
    }

    if (uploadedFile.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File size must be less than 5MB' }, { status: 400 })
    }

    const upload = await StorageService.uploadImage(uploadedFile, {
      userId,
      churchId,
      folder: `branding/logos/${churchId}`,
    })

    const updatedChurch = await ChurchService.update(churchId, { logo: upload.url })

    return NextResponse.json({
      message: 'Logo uploaded successfully',
      logo: updatedChurch.logo ?? upload.url,
      url: upload.url,
      path: upload.path,
    })
  } catch (error: any) {
    console.error('Error uploading branding logo:', error)
    return NextResponse.json(
      { error: error?.message ?? 'Internal server error' },
      { status: 500 },
    )
  }
}
