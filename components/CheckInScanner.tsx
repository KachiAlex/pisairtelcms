'use client'

import { useState } from 'react'
import { formatDateTime } from '@/lib/utils'

export default function CheckInScanner() {
  const [qrCode, setQrCode] = useState('')
  const [checkingIn, setCheckingIn] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const handleCheckIn = async () => {
    if (!qrCode.trim()) {
      setError('Please enter or scan a QR code')
      return
    }

    setCheckingIn(true)
    setError('')
    setSuccess(false)

    try {
      const response = await fetch('/api/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qrCode: qrCode.trim(),
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Check-in failed')
      }

      setSuccess(true)
      setQrCode('')
      setTimeout(() => setSuccess(false), 3000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setCheckingIn(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-md">
      <h1 className="text-3xl font-bold mb-6">Service Check-In</h1>

      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="mb-6">
          <label htmlFor="qrCode" className="block text-sm font-medium text-gray-700 mb-2">
            Scan or Enter QR Code
          </label>
          <input
            id="qrCode"
            type="text"
            value={qrCode}
            onChange={(e) => setQrCode(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleCheckIn()}
            placeholder="Scan QR code or enter code manually"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-center text-lg tracking-wider"
            autoFocus
          />
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded">
            ✓ Check-in successful!
          </div>
        )}

        <button
          onClick={handleCheckIn}
          disabled={checkingIn || !qrCode.trim()}
          className="w-full px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {checkingIn ? 'Checking in...' : 'Check In'}
        </button>

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600 mb-2">Or use your membership card</p>
          <a
            href="/membership-card"
            className="text-primary-600 hover:underline text-sm"
          >
            View Membership Card →
          </a>
        </div>
      </div>
    </div>
  )
}

