
export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth-options'
import { getCurrentChurch } from '@/lib/church-context'
import { UserService } from '@/lib/services/user-service'
import { GivingService } from '@/lib/services/giving-service'
import { ProjectService } from '@/lib/services/giving-service'
import { GivingConfigService } from '@/lib/services/giving-config-service'
import { StorageService } from '@/lib/services/storage-service'

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const church = await getCurrentChurch(userId)

    if (!church) {
      return NextResponse.json({ error: 'No church selected' }, { status: 400 })
    }

    const user = await UserService.findById(userId)
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const form = await request.formData()

    const amountRaw = form.get('amount')
    const typeRaw = form.get('type')
    const currencyRaw = form.get('currency')
    const notesRaw = form.get('notes')
    const projectIdRaw = form.get('projectId')
    const bankIdRaw = form.get('bankId')
    const receipt = form.get('receipt')

    const amount = typeof amountRaw === 'string' ? Number(amountRaw) : NaN
    const type = typeof typeRaw === 'string' ? typeRaw.trim() : ''
    const currency = typeof currencyRaw === 'string' && currencyRaw.trim() ? currencyRaw.trim() : undefined

    const projectId = typeof projectIdRaw === 'string' && projectIdRaw.trim() ? projectIdRaw.trim() : undefined
    const bankId = typeof bankIdRaw === 'string' && bankIdRaw.trim() ? bankIdRaw.trim() : undefined
    const notes = typeof notesRaw === 'string' && notesRaw.trim() ? notesRaw.trim() : undefined

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Valid amount is required' }, { status: 400 })
    }

    if (!type) {
      return NextResponse.json({ error: 'Type is required' }, { status: 400 })
    }

    const receiptFile = receipt && typeof receipt !== 'string' ? receipt as File : null
    if (receiptFile && receiptFile.size <= 0) {
      return NextResponse.json({ error: 'Transfer receipt file is empty' }, { status: 400 })
    }
    if (receiptFile && receiptFile.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'Transfer receipt must be 10MB or smaller' }, { status: 400 })
    }
    if (receiptFile && !['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(receiptFile.type)) {
      return NextResponse.json({ error: 'Transfer receipt must be a PDF, JPG, PNG, or WebP image' }, { status: 400 })
    }

    // Verify project if provided
    let project = null
    if (projectId) {
      project = await ProjectService.findById(projectId)
      if (!project || project.churchId !== church.id || project.status !== 'Active') {
        return NextResponse.json({ error: 'Project not found or inactive' }, { status: 404 })
      }
    }

    const config = await GivingConfigService.findByChurch(church.id)
    const bankTransfer = (config as any)?.paymentMethods?.bankTransfer

    if (!bankTransfer?.enabled || !Array.isArray(bankTransfer?.banks) || bankTransfer.banks.length === 0) {
      return NextResponse.json({ error: 'Bank transfer is not enabled for this church' }, { status: 400 })
    }

    const selectedBank = bankId ? bankTransfer.banks.find((b: any) => String(b.id) === String(bankId)) : null
    if (bankId && !selectedBank) {
      return NextResponse.json({ error: 'Invalid bank account selection' }, { status: 400 })
    }

    const giving = await GivingService.create({
      userId,
      churchId: church.id,
      branchId: (user as any)?.branchId || undefined,
      amount,
      currency: currency || project?.currency || (config as any)?.currency,
      type,
      projectId: projectId || undefined,
      paymentMethod: 'Bank Transfer',
      status: 'PENDING',
      bankTransferBankId: selectedBank?.id || undefined,
      notes,
    } as any)

    let transferReceiptUrl: string | undefined

    if (receiptFile) {
      const upload = await StorageService.uploadFile({
        file: receiptFile,
        fileName: `bank-transfer-receipt-${giving.id}-${receiptFile.name || 'receipt'}`,
        folder: 'bank-transfer-receipts',
        userId,
        churchId: church.id,
        contentType: receiptFile.type,
      })
      transferReceiptUrl = upload.url
      await GivingService.update(giving.id, { transferReceiptUrl } as any)
    }

    return NextResponse.json(
      {
        ...giving,
        transferReceiptUrl: transferReceiptUrl || null,
        bank: selectedBank
          ? {
              id: selectedBank.id,
              bankName: selectedBank.bankName,
              accountNumber: selectedBank.accountNumber,
              accountName: selectedBank.accountName,
              currency: selectedBank.currency,
              instructions: selectedBank.instructions || null,
            }
          : null,
      },
      { status: 201 }
    )
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
