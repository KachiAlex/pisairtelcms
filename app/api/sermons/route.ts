
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { SermonService } from '@/lib/services/sermon-service'
import { prisma } from '@/lib/prisma'
import { guardApi } from '@/lib/api-guard'
import { checkUsageLimit } from '@/lib/subscription'
import { SermonMediaService } from '@/lib/services/sermon-media-service'

export async function GET(request: Request) {
  try {
    const guarded = await guardApi({ requireChurch: true })
    if (!guarded.ok) return guarded.response

    const { userId, church } = guarded.ctx

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const search = searchParams.get('search')
    const tag = searchParams.get('tag')
    const limit = parseInt(searchParams.get('limit') || '20')
    const cursor = searchParams.get('cursor')

    if (search && tag) {
      return NextResponse.json(
        { error: 'Search cannot be combined with tag filter' },
        { status: 400 }
      )
    }

    // Get sermons using service
    const sermons = await SermonService.findByChurch(church.id, {
      category: category || undefined,
      search: search || undefined,
      tag: tag || undefined,
      limit,
      lastDocId: cursor || undefined,
    })

    const sermonIds = sermons.map((s) => s.id)

    // Get user's watch progress from Postgres
    const [userViews, viewCounts, downloadCounts] = await Promise.all([
      sermonIds.length
        ? prisma.sermonView.findMany({ where: { userId, sermonId: { in: sermonIds } } })
        : Promise.resolve([]),
      sermonIds.length
        ? prisma.sermonView.groupBy({
            by: ['sermonId'],
            where: { sermonId: { in: sermonIds } },
            _count: { _all: true },
          })
        : Promise.resolve([]),
      sermonIds.length
        ? prisma.sermonDownload.groupBy({
            by: ['sermonId'],
            where: { sermonId: { in: sermonIds } },
            _count: { _all: true },
          })
        : Promise.resolve([]),
    ])

    const viewMap = new Map(
      userViews.map((v) => [
        v.sermonId,
        { watchedDuration: v.watchedDuration, completed: v.completed },
      ])
    )
    const viewCountMap = new Map(viewCounts.map((c) => [c.sermonId, c._count._all]))
    const downloadCountMap = new Map(downloadCounts.map((c) => [c.sermonId, c._count._all]))

    // Get view and download counts from Postgres
    const sermonsWithDetails = sermons.map((sermon) => {
      const view = viewMap.get(sermon.id)

      return {
        ...sermon,
        userProgress: view
          ? {
              watchedDuration: view.watchedDuration,
              completed: view.completed,
              progress: sermon.duration ? (view.watchedDuration / sermon.duration) * 100 : 0,
            }
          : null,
        _count: {
          views: viewCountMap.get(sermon.id) || 0,
          downloads: downloadCountMap.get(sermon.id) || 0,
        },
      }
    })
    const nextCursor = sermons.length === limit ? sermons[sermons.length - 1].id : null

    return NextResponse.json({
      sermons: sermonsWithDetails,
      pagination: {
        limit,
        nextCursor,
      },
    })
  } catch (error) {
    console.error('Error fetching sermons:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const guarded = await guardApi({ requireChurch: true, allowedRoles: ['ADMIN', 'SUPER_ADMIN', 'PASTOR'] })
    if (!guarded.ok) return guarded.response

    const { userId, church } = guarded.ctx

    const body = await request.json()
    const {
      title,
      description,
      speaker,
      videoUrl,
      audioUrl,
      thumbnailUrl,
      duration,
      category,
      tags,
    } = body

    if (!title || !speaker) {
      return NextResponse.json(
        { error: 'Title and speaker are required' },
        { status: 400 }
      )
    }

    // A sermon needs at least one playable source: a video embed URL or an
    // audio URL (the client uploads audio files first, so files arrive as URLs).
    // Thumbnails are always optional.
    if (!videoUrl && !audioUrl) {
      return NextResponse.json(
        { error: 'Provide at least one media source: a video embed URL or an audio source.' },
        { status: 400 }
      )
    }

    const usageCheck = await checkUsageLimit(church.id, 'maxSermons')
    if (!usageCheck.allowed && usageCheck.limit) {
      return NextResponse.json(
        {
          error: `Sermon limit reached. Maximum ${usageCheck.limit} sermons allowed on your plan.`,
          limit: usageCheck.limit,
          current: usageCheck.current,
        },
        { status: 403 }
      )
    }

    // Auto-derive a thumbnail (YouTube/Vimeo platform art, or an ffmpeg
    // frame grab for direct video URLs) and duration when not provided.
    let resolvedThumbnail = thumbnailUrl || undefined
    let resolvedDuration = duration ? parseInt(duration) : undefined
    if (videoUrl && (!resolvedThumbnail || !resolvedDuration)) {
      const meta = await SermonMediaService.resolveVideoMeta(videoUrl, {
        churchId: church.id,
        userId,
      })
      resolvedThumbnail = resolvedThumbnail || meta.thumbnailUrl
      resolvedDuration = resolvedDuration || meta.durationSeconds
    }

    const sermon = await SermonService.create({
      title,
      description,
      speaker,
      videoUrl: videoUrl || undefined,
      audioUrl: audioUrl || undefined,
      thumbnailUrl: resolvedThumbnail,
      duration: resolvedDuration,
      category: category || undefined,
      tags: tags || [],
      topics: [], // Default empty topics array
      churchId: church.id,
    })

    // Generate AI summary if OpenAI or DeepSeek is available
    if (description && (process.env.OPENAI_API_KEY || process.env.DEEPSEEK_API_KEY)) {
      try {
        const { generateSermonSummary } = await import('@/lib/ai/openai')
        const summary = await generateSermonSummary(description, title)
        
        await SermonService.update(sermon.id, {
          aiSummary: summary,
        })
      } catch (error) {
        console.error('Error generating AI summary:', error)
        // Don't fail sermon creation if AI summary fails
      }
    }

    return NextResponse.json(sermon, { status: 201 })
  } catch (error: any) {
    console.error('Error creating sermon:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
