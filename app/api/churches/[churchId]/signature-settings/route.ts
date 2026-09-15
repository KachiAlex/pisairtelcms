import { NextRequest, NextResponse } from 'next/server'
import { guardApi } from '@/lib/api-guard'
import { prisma } from '@/lib/prisma'

type RouteParams = {
  params: {
    churchId: string
  }
}

// Update signature settings only (without file upload)
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const guarded = await guardApi({ requireChurch: true })
    if (!guarded.ok) return guarded.response

    if (guarded.ctx.church?.id !== params.churchId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Check if user has permission
    const allowedRoles = ['PASTOR', 'ADMIN', 'SUPER_ADMIN']
    if (!allowedRoles.includes(guarded.ctx.role || '')) {
      return NextResponse.json({ error: 'Only pastors and admins can update signature settings' }, { status: 403 })
    }

    const { title, name } = await request.json()

    if (!title?.trim()) {
      return NextResponse.json({ error: 'Signature title is required' }, { status: 400 })
    }

    // Update church record with signature settings
    await prisma.church.update({
      where: { id: params.churchId },
      data: {
        certificateSignatureTitle: title.trim(),
        ...(name?.trim() ? { certificateSignatureName: name.trim() } : {}),
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Signature settings updated successfully',
      settings: {
        title: title.trim(),
        name: name?.trim() || '',
      }
    })
  } catch (error: any) {
    console.error('Update signature settings error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update signature settings' },
      { status: 500 }
    )
  }
}
