
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { UserService } from '@/lib/services/user-service'
import { prisma } from '@/lib/prisma'

function getBearerToken(req: Request): string | null {
  const auth = req.headers.get('authorization') || req.headers.get('Authorization')
  if (!auth) return null
  const match = auth.match(/^Bearer\s+(.+)$/i)
  return match ? match[1] : null
}

export async function POST(request: Request) {
  try {
    const expected = (process.env.SUPERADMIN_BOOTSTRAP_TOKEN || '').trim()
    if (!expected) {
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 })
    }

    const provided = getBearerToken(request)
    if (!provided || provided !== expected) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))

    const email = typeof body.email === 'string' && body.email ? body.email : 'admin@pi-cms.com'
    const password = typeof body.password === 'string' ? body.password : ''
    const firstName = typeof body.firstName === 'string' && body.firstName ? body.firstName : 'Super'
    const lastName = typeof body.lastName === 'string' && body.lastName ? body.lastName : 'Admin'
    const force = body.force === true

    if (!password) {
      return NextResponse.json({ error: 'Missing required field: password' }, { status: 400 })
    }

    const existingUser = await UserService.findByEmail(email)

    if (!existingUser) {
      const superAdmin = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' }, select: { id: true } })

      if (superAdmin && !force) {
        return NextResponse.json(
          {
            error: 'A superadmin already exists. Set {"force": true} to create another, or provide the existing superadmin email to reset it.',
          },
          { status: 400 }
        )
      }

      const created = await UserService.create({
        email,
        password,
        firstName,
        lastName,
        role: 'SUPER_ADMIN',
        churchId: '',
      })

      const { password: _pw, ...userWithoutPassword } = created
      return NextResponse.json({ message: 'Superadmin created', user: userWithoutPassword }, { status: 201 })
    }

    const updated = await UserService.update(existingUser.id, {
      password,
      firstName,
      lastName,
      role: 'SUPER_ADMIN',
      churchId: '',
    } as any)

    const { password: _pw, ...userWithoutPassword } = updated

    return NextResponse.json({ message: 'Superadmin reset', user: userWithoutPassword })
  } catch (error: any) {
    console.error('Error bootstrapping superadmin:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
