'use client'

import { useEffect, useMemo, useState } from 'react'
import { formatCurrency } from '@/lib/utils'

interface Project {
  id: string
  name: string
  currency?: string
  goalAmount: number
  currentAmount: number
}

interface DonateModalProps {
  project?: Project
  onClose: () => void
  onSuccess: (info?: { pending?: boolean }) => void
}

export default function DonateModal({
  project,
  onClose,
  onSuccess,
}: DonateModalProps) {
  const defaultCurrency = project?.currency || 'NGN'
  const [amount, setAmount] = useState('')
  const [type, setType] = useState(project ? 'PROJECT' : 'TITHE')
  const [selectedProject, setSelectedProject] = useState(project?.id || '')
  const [notes, setNotes] = useState('')
  const [currency, setCurrency] = useState(defaultCurrency)
  const [paymentMethod, setPaymentMethod] = useState<'GATEWAY' | 'BANK_TRANSFER'>('GATEWAY')
  const [givingConfig, setGivingConfig] = useState<any>(null)
  const [bankId, setBankId] = useState('')
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [donating, setDonating] = useState(false)
  const [error, setError] = useState('')

  const quickAmounts = [25, 50, 100, 250, 500, 1000]

  const bankAccounts = useMemo(() => {
    const banks = givingConfig?.paymentMethods?.bankTransfer?.banks
    return Array.isArray(banks) ? banks : []
  }, [givingConfig])

  const commonCurrencies = useMemo(() => ['NGN', 'USD', 'EUR', 'GBP', 'CAD', 'AUD', 'ZAR', 'KES', 'GHS'], [])

  const bankTransferEnabled = !!givingConfig?.paymentMethods?.bankTransfer?.enabled && bankAccounts.length > 0

  const selectedBank = useMemo(() => {
    if (!bankId) return null
    return bankAccounts.find((b: any) => String(b.id) === String(bankId)) || null
  }, [bankAccounts, bankId])

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/giving/config', { cache: 'no-store' })
        if (res.ok) {
          const json = await res.json().catch(() => null)
          setGivingConfig(json)
          if (!project?.currency && json?.currency && typeof json.currency === 'string') {
            setCurrency(json.currency)
          }
        }
      } catch {
        // ignore
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount')
      return
    }

    if (type === 'PROJECT' && !selectedProject) {
      setError('Please select a project')
      return
    }

    setDonating(true)
    setError('')

    try {
      if (paymentMethod === 'BANK_TRANSFER') {
        if (!bankTransferEnabled) {
          throw new Error('Bank transfer is not available for this church')
        }

        const fd = new FormData()
        fd.set('amount', String(parseFloat(amount)))
        fd.set('currency', currency)
        fd.set('type', type)
        if (type === 'PROJECT') fd.set('projectId', selectedProject)
        if (bankId) fd.set('bankId', bankId)
        if (notes) fd.set('notes', notes)
        if (receiptFile) fd.set('receipt', receiptFile)

        const res = await fetch('/api/giving/bank-transfer', {
          method: 'POST',
          body: fd,
        })

        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}))
          throw new Error(errorData.error || 'Failed to submit bank transfer donation')
        }

        onSuccess({ pending: true })
        return
      }

      const paymentResponse = await fetch('/api/giving/donate/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(amount),
          currency,
          type,
          projectId: type === 'PROJECT' ? selectedProject : null,
          notes,
        }),
      })

      if (!paymentResponse.ok) {
        const errorData = await paymentResponse.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to initialize payment')
      }

      const paymentData = await paymentResponse.json().catch(() => null)

      if (paymentData?.paymentLink) {
        window.location.href = paymentData.paymentLink
      } else {
        throw new Error('Payment initialization failed')
      }
    } catch (err: any) {
      setError(err.message || 'Payment initialization failed')
      setDonating(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start sm:items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[calc(100vh-2rem)] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Make a Donation</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl"
            >
              ×
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!project && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Giving Type
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                >
                  <option value="TITHE">Tithe</option>
                  <option value="OFFERING">Offering</option>
                  <option value="THANKSGIVING">Thanksgiving</option>
                  <option value="SEED">Seed</option>
                  <option value="PROJECT">Project</option>
                </select>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Currency</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                >
                  {Array.from(new Set([
                    ...commonCurrencies,
                    defaultCurrency,
                    givingConfig?.currency,
                    ...bankAccounts.map((b: any) => b.currency),
                  ].filter(Boolean))).map((c: any) => (
                    <option key={String(c)} value={String(c)}>
                      {String(c)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                >
                  <option value="GATEWAY">Payment gateway</option>
                  <option value="BANK_TRANSFER" disabled={!bankTransferEnabled}>
                    Bank transfer
                  </option>
                </select>
              </div>
            </div>

            {type === 'PROJECT' && !project && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Project
                </label>
                <select
                  value={selectedProject}
                  onChange={(e) => setSelectedProject(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  required
                >
                  <option value="">Select a project...</option>
                  {/* Projects would be loaded here */}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Amount *
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {quickAmounts.map((quickAmount) => (
                  <button
                    key={quickAmount}
                    type="button"
                    onClick={() => setAmount(quickAmount.toString())}
                    className={`px-3 py-1 rounded text-xs whitespace-nowrap ${
                      amount === quickAmount.toString()
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {formatCurrency(quickAmount, currency)}
                  </button>
                ))}
              </div>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter amount"
                min="1"
                step="0.01"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes (optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                placeholder="Add a note or dedication..."
              />
            </div>

            {paymentMethod === 'BANK_TRANSFER' ? (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
                <div>
                  <div className="text-sm font-semibold text-gray-900">Bank Transfer</div>
                  <div className="text-sm text-gray-700 mt-1">
                    Transfer to the church account below, then optionally upload your transfer receipt for accounting confirmation.
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Select bank account</label>
                  <select
                    value={bankId}
                    onChange={(e) => setBankId(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">Choose...</option>
                    {bankAccounts.map((b: any) => (
                      <option key={String(b.id)} value={String(b.id)}>
                        {String(b.bankName)} ({String(b.currency)})
                      </option>
                    ))}
                  </select>
                </div>

                {selectedBank && (
                  <div className="text-sm text-gray-800">
                    <div><span className="font-medium">Account name:</span> {selectedBank.accountName}</div>
                    <div><span className="font-medium">Account number:</span> {selectedBank.accountNumber}</div>
                    <div><span className="font-medium">Bank:</span> {selectedBank.bankName}</div>
                    {selectedBank.instructions && (
                      <div className="mt-2 text-gray-700">{selectedBank.instructions}</div>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Upload transfer receipt (optional)</label>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                    className="w-full text-sm"
                  />
                </div>
              </div>
            ) : (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Secure Payment:</strong> You will be redirected to Flutterwave to complete your payment securely.
                </p>
              </div>
            )}

            <div className="flex gap-4">
              <button
                type="submit"
                disabled={donating}
                className="flex-1 px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >
                {donating ? 'Processing...' : 'Donate'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

