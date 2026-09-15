
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { guardApi } from '@/lib/api-guard'
import {
  DigitalCourseEnrollmentService,
  DigitalCourseService,
} from '@/lib/services/digital-school-service'
import { CertificateService } from '@/lib/services/certificate-service'
import { UserService } from '@/lib/services/user-service'
import { UserRole } from '@/types'
import { prisma } from '@/lib/prisma'

const MANAGER_ROLES: UserRole[] = ['ADMIN', 'PASTOR', 'BRANCH_ADMIN', 'SUPER_ADMIN']

type RouteParams = {
  params: {
    enrollmentId: string
  }
}

const isManager = (role?: UserRole) => !!role && MANAGER_ROLES.includes(role)

export async function POST(_: Request, { params }: RouteParams) {
  try {
    const guarded = await guardApi({ requireChurch: true })
    if (!guarded.ok) return guarded.response

    const enrollment = await DigitalCourseEnrollmentService.get(params.enrollmentId)
    if (!enrollment || enrollment.churchId !== guarded.ctx.church?.id) {
      return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 })
    }

    const isOwner = enrollment.userId === guarded.ctx.userId
    if (!isOwner && !isManager(guarded.ctx.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    if (enrollment.status !== 'completed') {
      return NextResponse.json({ error: 'Certificate available only after completion' }, { status: 400 })
    }

    const course = await DigitalCourseService.get(enrollment.courseId)
    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 })
    }

    // Get church signature settings
    let signatureUrl, signatureTitle, signatureName
    try {
      const church = await prisma.church.findUnique({
        where: { id: guarded.ctx.church.id },
        select: {
          certificateSignatureUrl: true,
          certificateSignatureTitle: true,
          certificateSignatureName: true,
        },
      })
      if (church) {
        signatureUrl = church.certificateSignatureUrl || undefined
        signatureTitle = church.certificateSignatureTitle || undefined
        signatureName = church.certificateSignatureName || undefined
      }
    } catch (error) {
      console.warn('Could not fetch church signature settings:', error)
    }

    if (enrollment.certificateUrl) {
      return NextResponse.json({
        url: enrollment.certificateUrl,
        issuedAt: enrollment.certificateIssuedAt ?? null,
      })
    }

    const user = await UserService.findById(enrollment.userId)
    const studentName = user ? `${user.firstName} ${user.lastName}`.trim() : 'Participant'

    const upload = await CertificateService.generateUploadAndAttachCertificate({
      enrollmentId: enrollment.id,
      courseId: course.id,
      userId: enrollment.userId,
      studentName,
      courseTitle: course.title,
      churchName: guarded.ctx.church?.name || 'pi-CMS',
      theme: course.certificateTheme,
      badgeIssuedAt: enrollment.badgeIssuedAt ?? new Date(),
      signatureUrl,
      signatureTitle,
      signatureName,
    })

    return NextResponse.json({
      url: upload.url,
      path: upload.path,
    })
  } catch (error: any) {
    console.error('DigitalSchool.certificate.POST', error)
    return NextResponse.json({ error: error.message || 'Failed to generate certificate' }, { status: 500 })
  }
}
