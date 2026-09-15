
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { guardApi } from '@/lib/api-guard'
import { prisma } from '@/lib/prisma'
import { PostService } from '@/lib/services/post-service'
import { UnitMembershipService, UnitService } from '@/lib/services/unit-service'
import { MessageService } from '@/lib/services/message-service'

export async function POST(request: Request, { params }: { params: { postId: string } }) {
  const guarded = await guardApi({ requireChurch: true })
  if (!guarded.ok) return guarded.response

  const { church, userId } = guarded.ctx
  const body = await request.json().catch(() => ({}))

  const unitIds: string[] = Array.isArray(body?.unitIds) ? body.unitIds.map((x: any) => String(x)) : []
  const note = body?.note ? String(body.note) : ''

  if (unitIds.length === 0) {
    return NextResponse.json({ error: 'unitIds is required' }, { status: 400 })
  }

  const post = await PostService.findById(params.postId)
  if (!post || post.churchId !== church!.id) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }

  // Validate user is a member of each unit they are sharing into.
  for (const unitId of unitIds) {
    const unit = await UnitService.findById(unitId)
    if (!unit || unit.churchId !== church!.id) {
      return NextResponse.json({ error: 'Invalid unit selected' }, { status: 400 })
    }

    const membership = await UnitMembershipService.findByUserAndUnit(userId, unitId)
    if (!membership) {
      return NextResponse.json({ error: 'You must be a member of a unit to share into it' }, { status: 403 })
    }
  }

  // Store share record
  const share = await prisma.postShare.create({
    data: {
      churchId: church!.id,
      postId: post.id,
      sharedByUserId: userId,
      unitIds,
      note: note || null,
    },
  })

  // Notify members via direct messages (simple + consistent with existing messaging)
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || ''
  const link = baseUrl ? `${baseUrl}/community` : '/community'
  const preview = String(post.content || '').slice(0, 140)
  const messageText = `[POST SHARE] ${note ? note + ' — ' : ''}${preview} (view: ${link})`

  const notified = new Set<string>()
  for (const unitId of unitIds) {
    const members = await UnitMembershipService.findByUnit(unitId)
    for (const m of members) {
      if (m.userId === userId) continue
      const key = `${unitId}:${m.userId}`
      if (notified.has(key)) continue
      notified.add(key)
      await MessageService.create({
        senderId: userId,
        receiverId: m.userId,
        content: messageText,
      })
    }
  }

  return NextResponse.json({ success: true, shareId: share.id })
}
