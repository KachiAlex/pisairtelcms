
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { ChurchService } from '@/lib/services/church-service'

export async function GET(
  request: Request,
  { params }: { params: { churchId: string } }
) {
  try {
    const { churchId } = params

    const church = await ChurchService.findById(churchId)

    if (!church) {
      return NextResponse.json(
        { error: 'Church not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      id: church.id,
      name: church.name,
      logo: church.logo,
      primaryColor: (church as any).primaryColor,
      secondaryColor: (church as any).secondaryColor,
      customDomain: (church as any).customDomain,
      domainVerified: (church as any).domainVerified,
    })
  } catch (error) {
    console.error('Error fetching branding:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { churchId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { churchId } = params
    const body = await request.json()
    const { logo, primaryColor, secondaryColor, customDomain } = body

    // Verify user has permission (should be church admin/owner)
    const userRole = (session.user as any).role
    if (!['ADMIN', 'SUPER_ADMIN', 'PASTOR'].includes(userRole)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    // Tenant isolation: non-superadmins may only brand their own church
    if (userRole !== 'SUPER_ADMIN' && (session.user as any).churchId !== churchId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const updateData: any = {}
    if (logo !== undefined) updateData.logo = logo
    if (primaryColor !== undefined) updateData.primaryColor = primaryColor
    if (secondaryColor !== undefined) updateData.secondaryColor = secondaryColor
    if (customDomain !== undefined) {
      updateData.customDomain = customDomain
      updateData.domainVerified = false // Reset verification when domain changes
    }

    const church = await ChurchService.update(churchId, updateData)

    return NextResponse.json({
      id: church.id,
      name: church.name,
      logo: church.logo,
      primaryColor: (church as any).primaryColor,
      secondaryColor: (church as any).secondaryColor,
      customDomain: (church as any).customDomain,
      domainVerified: (church as any).domainVerified,
    })
  } catch (error) {
    console.error('Error updating branding:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
