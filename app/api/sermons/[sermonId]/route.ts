
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth-options'
import { SermonService } from '@/lib/services/sermon-service'
import { SermonViewService, SermonDownloadService } from '@/lib/services/sermon-view-service'
import { ChurchService } from '@/lib/services/church-service'
import { getCorrelationIdFromRequest, logger } from '@/lib/logger'
import { guardApi } from '@/lib/api-guard'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sermonId: string }> }
) {
  const correlationId = getCorrelationIdFromRequest(request)
  try {
    const { sermonId } = await params
    logger.info('sermons.detail.request', { correlationId, sermonId })
    const session = await getServerSession(authOptions)
    if (!session) {
      logger.warn('sermons.detail.unauthorized', { correlationId, sermonId })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const userChurchId = (session.user as any).churchId

    const sermon = await SermonService.findById(sermonId)

    if (!sermon || (userChurchId && sermon.churchId !== userChurchId)) {
      logger.warn('sermons.detail.not_found', { correlationId, sermonId, userId })
      return NextResponse.json(
        { error: 'Sermon not found' },
        { status: 404 }
      )
    }

    // Get church info
    const church = await ChurchService.findById(sermon.churchId)

    // Get user's watch progress
    const userView = await SermonViewService.findByUserAndSermon(userId, sermonId)

    // Get download status
    const userDownload = await SermonDownloadService.findByUserAndSermon(userId, sermonId)

    return NextResponse.json({
      ...sermon,
      church: church ? {
        id: church.id,
        name: church.name,
      } : null,
      _count: {
        views: (sermon as any).viewsCount || 0,
        downloads: (sermon as any).downloadsCount || 0,
      },
      userProgress: userView
        ? {
            watchedDuration: userView.watchedDuration,
            completed: userView.completed,
            progress: sermon.duration
              ? (userView.watchedDuration / sermon.duration) * 100
              : 0,
          }
        : null,
      isDownloaded: !!userDownload,
    })
  } catch (error) {
    logger.error('sermons.detail.error', {
      correlationId,
      message: (error as any)?.message,
      name: (error as any)?.name,
    })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ sermonId: string }> }
) {
  const correlationId = getCorrelationIdFromRequest(request)
  try {
    const guarded = await guardApi({ requireChurch: true, allowedRoles: ['ADMIN', 'SUPER_ADMIN', 'PASTOR'] })
    if (!guarded.ok) {
      logger.warn('sermons.update.unauthorized', { correlationId })
      return guarded.response
    }

    const { sermonId } = await params
    const { church, userId } = guarded.ctx

    const sermon = await SermonService.findById(sermonId)
    if (!sermon) {
      logger.warn('sermons.update.not_found', { correlationId, sermonId, userId })
      return NextResponse.json({ error: 'Sermon not found' }, { status: 404 })
    }

    if ((sermon as any).churchId !== church.id) {
      logger.warn('sermons.update.forbidden_church', { correlationId, sermonId, userId, churchId: church.id })
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()

    const updateData: any = {}
    if (body.title !== undefined) updateData.title = body.title
    if (body.description !== undefined) updateData.description = body.description
    if (body.speaker !== undefined) updateData.speaker = body.speaker
    if (body.videoUrl !== undefined) updateData.videoUrl = body.videoUrl || undefined
    if (body.audioUrl !== undefined) updateData.audioUrl = body.audioUrl || undefined
    if (body.thumbnailUrl !== undefined) updateData.thumbnailUrl = body.thumbnailUrl || undefined
    if (body.duration !== undefined) updateData.duration = body.duration ? parseInt(body.duration) : undefined
    if (body.category !== undefined) updateData.category = body.category || undefined
    if (body.tags !== undefined) updateData.tags = Array.isArray(body.tags) ? body.tags : []

    // A sermon must keep at least one playable source after the update.
    const effectiveVideo = body.videoUrl !== undefined ? body.videoUrl : sermon.videoUrl
    const effectiveAudio = body.audioUrl !== undefined ? body.audioUrl : sermon.audioUrl
    if (!effectiveVideo && !effectiveAudio) {
      return NextResponse.json(
        { error: 'A sermon must have at least one media source: a video URL or an audio URL.' },
        { status: 400 }
      )
    }

    const updated = await SermonService.update(sermonId, updateData)
    logger.info('sermons.update.success', { correlationId, sermonId, userId })
    return NextResponse.json(updated)
  } catch (error) {
    logger.error('sermons.update.error', {
      correlationId,
      message: (error as any)?.message,
      name: (error as any)?.name,
    })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ sermonId: string }> }
) {
  const correlationId = getCorrelationIdFromRequest(request)
  try {
    const guarded = await guardApi({ requireChurch: true, allowedRoles: ['ADMIN', 'SUPER_ADMIN', 'PASTOR'] })
    if (!guarded.ok) {
      logger.warn('sermons.delete.unauthorized', { correlationId })
      return guarded.response
    }

    const { sermonId } = await params
    const { church, userId } = guarded.ctx

    const sermon = await SermonService.findById(sermonId)
    if (!sermon) {
      logger.warn('sermons.delete.not_found', { correlationId, sermonId, userId })
      return NextResponse.json({ error: 'Sermon not found' }, { status: 404 })
    }

    if ((sermon as any).churchId !== church.id) {
      logger.warn('sermons.delete.forbidden_church', { correlationId, sermonId, userId, churchId: church.id })
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await SermonService.delete(sermonId)
    logger.info('sermons.delete.success', { correlationId, sermonId, userId })
    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('sermons.delete.error', {
      correlationId,
      message: (error as any)?.message,
      name: (error as any)?.name,
    })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
