
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { guardApi } from '@/lib/api-guard'
import { prisma } from '@/lib/prisma'
import { PostService } from '@/lib/services/post-service'


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

  // Validate units + caller's membership in batched queries
  const units = await prisma.unit.findMany({
    where: { id: { in: unitIds }, churchId: church!.id },
    select: { id: true },
  })
  if (units.length !== new Set(unitIds).size) {
    return NextResponse.json({ error: 'Invalid unit selected' }, { status: 400 })
  }

  const memberships = await prisma.unitMembership.findMany({
    where: { userId, unitId: { in: unitIds } },
    select: { unitId: true },
  })
  if (memberships.length !== new Set(unitIds).size) {
    return NextResponse.json({ error: 'You must be a member of a unit to share into it' }, { status: 403 })
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

  // Fan out via a single membership query + batched message insert
  const members = await prisma.unitMembership.findMany({
    where: { unitId: { in: unitIds } },
    select: { unitId: true, userId: true },
  })

  const notified = new Set<string>()
  const messages: { senderId: string; receiverId: string; content: string }[] = []
  for (const m of members) {
    if (m.userId === userId) continue
    const key = `${m.unitId}:${m.userId}`
    if (notified.has(key)) continue
    notified.add(key)
    messages.push({ senderId: userId, receiverId: m.userId, content: messageText })
  }
  if (messages.length) {
    await prisma.message.createMany({ data: messages })
  }

  return NextResponse.json({ success: true, shareId: share.id })
}
