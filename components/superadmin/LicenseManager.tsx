'use client'

import { useMemo, useState } from 'react'
import { SubscriptionPlan } from '@/lib/services/subscription-service'

interface LicenseManagerProps {
  churchId: string
  currentSubscription: any
  currentPlan: any
  availablePlans: SubscriptionPlan[]
  planOverrides?: PlanOverride[]
  onUpdate: () => void
}

type PlanOverride = {
  id: string
  planId: string
  churchId: string
  customPrice?: number
  customSetupFee?: number
  promoCode?: string
  expiresAt?: string | Date | null
  notes?: string
  updatedAt?: string | Date
}

type OverrideFormState = {
  customPrice: string
  customSetupFee: string
  promoCode: string
  expiresAt: string
  notes: string
}

export default function LicenseManager({
  churchId,
  currentSubscription,
  currentPlan,
  availablePlans,
  planOverrides = [],
  onUpdate,
}: LicenseManagerProps) {
  const [loading, setLoading] = useState(false)
  const [checkoutPlanId, setCheckoutPlanId] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [showExtendModal, setShowExtendModal] = useState(false)
  const [showPlanModal, setShowPlanModal] = useState(false)
  const [showOverrideModal, setShowOverrideModal] = useState(false)
  const [daysToExtend, setDaysToExtend] = useState(30)
  const [savingOverride, setSavingOverride] = useState(false)
  const [overrideForm, setOverrideForm] = useState<OverrideFormState>({
    customPrice: '',
    customSetupFee: '',
    promoCode: '',
    expiresAt: '',
    notes: '',
  })

  const currentPlanOverride = useMemo(() => {
    if (!currentPlan?.id) return undefined
    return planOverrides.find((override) => override.planId === currentPlan.id)
  }, [planOverrides, currentPlan?.id])

  const effectivePrice = currentPlanOverride?.customPrice ?? currentPlan?.price
  const overrideExpiresAt = currentPlanOverride?.expiresAt
    ? new Date(currentPlanOverride.expiresAt)
    : null

  const handleExtendTrial = async () => {
    setLoading(true)
    setMessage(null)

    try {
      const response = await fetch(`/api/superadmin/churches/${churchId}/extend-trial`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: daysToExtend }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to extend trial')
      }

      setMessage({ type: 'success', text: data.message })
      setShowExtendModal(false)
      onUpdate()
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      setLoading(false)
    }
  }

  const handleChangePlan = async (planId: string) => {
    setCheckoutPlanId(planId)
    setMessage(null)

    try {
      const response = await fetch(`/api/superadmin/churches/${churchId}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to start checkout')
      }

      if (data.authorizationUrl) {
        if (typeof window !== 'undefined') {
          window.open(data.authorizationUrl, '_blank', 'noopener,noreferrer')
        }
        setMessage({
          type: 'success',
          text: 'Checkout launched in a new tab. Complete payment to apply the upgrade automatically.',
        })
      } else if (data.subscription) {
        setMessage({
          type: 'success',
          text: data.message || 'Plan updated successfully.',
        })
        onUpdate()
      } else if (data.message) {
        setMessage({ type: 'success', text: data.message })
      }

      setShowPlanModal(false)
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      setCheckoutPlanId(null)
    }
  }

  const handleSuspend = async () => {
    if (!confirm('Are you sure you want to suspend this church? They will lose access to the platform.')) {
      return
    }

    setLoading(true)
    setMessage(null)

    try {
      const response = await fetch(`/api/superadmin/churches/${churchId}/suspend`, {
        method: 'POST',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to suspend church')
      }

      setMessage({ type: 'success', text: data.message })
      onUpdate()
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      setLoading(false)
    }
  }

  const handleActivate = async () => {
    setLoading(true)
    setMessage(null)

    try {
      const response = await fetch(`/api/superadmin/churches/${churchId}/activate`, {
        method: 'POST',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to activate church')
      }

      setMessage({ type: 'success', text: data.message })
      onUpdate()
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      setLoading(false)
    }
  }

  const handleOverrideInput = (field: keyof OverrideFormState, value: string) => {
    setOverrideForm((prev) => ({ ...prev, [field]: value }))
  }

  const openOverrideModal = () => {
    setOverrideForm({
      customPrice: currentPlanOverride?.customPrice?.toString() ?? '',
      customSetupFee: currentPlanOverride?.customSetupFee?.toString() ?? '',
      promoCode: currentPlanOverride?.promoCode ?? '',
      expiresAt: overrideExpiresAt ? overrideExpiresAt.toISOString().slice(0, 10) : '',
      notes: currentPlanOverride?.notes ?? '',
    })
    setShowOverrideModal(true)
  }

  const handleSaveOverride = async () => {
    if (!currentPlan?.id) return
    setSavingOverride(true)
    setMessage(null)
    try {
      const payload: Record<string, any> = {
        planId: currentPlan.id,
      }
      if (overrideForm.customPrice) payload.customPrice = Number(overrideForm.customPrice)
      if (overrideForm.customSetupFee) payload.customSetupFee = Number(overrideForm.customSetupFee)
      if (overrideForm.promoCode) payload.promoCode = overrideForm.promoCode.toUpperCase()
      if (overrideForm.expiresAt) payload.expiresAt = overrideForm.expiresAt
      if (overrideForm.notes) payload.notes = overrideForm.notes

      const response = await fetch(`/api/superadmin/churches/${churchId}/plan-overrides`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to save override')
      }
      setMessage({ type: 'success', text: 'Custom pricing saved.' })
      setShowOverrideModal(false)
      onUpdate()
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      setSavingOverride(false)
    }
  }

  const handleClearOverride = async () => {
    if (!currentPlan?.id) return
    setSavingOverride(true)
    setMessage(null)
    try {
      const response = await fetch(
        `/api/superadmin/churches/${churchId}/plan-overrides?planId=${encodeURIComponent(currentPlan.id)}`,
        {
          method: 'DELETE',
        },
      )
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error || 'Failed to remove override')
      }
      setMessage({ type: 'success', text: 'Override removed.' })
      setShowOverrideModal(false)
      onUpdate()
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message })
    } finally {
      setSavingOverride(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-green-100 text-green-800'
      case 'TRIAL':
        return 'bg-blue-100 text-primary-800'
      case 'EXPIRED':
        return 'bg-red-100 text-red-800'
      case 'SUSPENDED':
        return 'bg-gray-100 text-gray-800'
      case 'CANCELLED':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const trialEndDate = currentSubscription?.trialEndsAt
    ? new Date(currentSubscription.trialEndsAt.toDate ? currentSubscription.trialEndsAt.toDate() : currentSubscription.trialEndsAt)
    : null

  const isTrial = currentSubscription?.status === 'TRIAL'
  const isSuspended = currentSubscription?.status === 'SUSPENDED'

  return (
    <div className="space-y-6">
      {/* Message */}
      {message && (
        <div
          className={`p-4 rounded-xl ${
            message.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Current License Status */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">License Management</h2>
          <span
            className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(
              currentSubscription?.status || 'TRIAL'
            )}`}
          >
            {currentSubscription?.status || 'TRIAL'}
          </span>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Current Plan</label>
            <p className="text-lg font-semibold text-gray-900">
              {currentPlan?.name || 'Free Trial'}
            </p>
            {currentPlan && (
              <p className="text-sm text-gray-600 mt-1">
                ${currentPlan.price}/{currentPlan.billingCycle === 'monthly' ? 'mo' : 'yr'}
              </p>
            )}
          </div>

          {trialEndDate && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {isTrial ? 'Trial Ends' : 'Subscription Ends'}
              </label>
              <p className="text-lg font-semibold text-gray-900">
                {trialEndDate.toLocaleDateString()}
              </p>
              <p className="text-sm text-gray-600 mt-1">
                {Math.ceil((trialEndDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} days remaining
              </p>
            </div>
          )}
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Current Price
            </label>
            <p className="text-lg font-semibold text-gray-900">
              ${effectivePrice ?? '0'}{' '}
              <span className="text-sm text-gray-500">
                {currentPlan?.billingCycle === 'annual' ? '/yr' : '/mo'}
              </span>
            </p>
            {currentPlanOverride?.customPrice !== undefined && (
              <p className="text-xs text-emerald-700 mt-1">
                Override active {overrideExpiresAt ? `(expires ${overrideExpiresAt.toLocaleDateString()})` : ''}
              </p>
            )}
            {currentPlanOverride?.promoCode && (
              <p className="text-xs text-primary-600 mt-1">Promo: {currentPlanOverride.promoCode}</p>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {isTrial && (
            <button
              onClick={() => setShowExtendModal(true)}
              disabled={loading}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              Extend Trial
            </button>
          )}

          <button
            onClick={() => setShowPlanModal(true)}
            disabled={loading}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors disabled:opacity-50"
          >
            Change / Upgrade Plan
          </button>

          <button
            onClick={openOverrideModal}
            disabled={loading || !currentPlan}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
          >
            Adjust Pricing / Promo
          </button>

          {isSuspended ? (
            <button
              onClick={handleActivate}
              disabled={loading}
              className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              Activate
            </button>
          ) : (
            <button
              onClick={handleSuspend}
              disabled={loading}
              className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              Suspend
            </button>
          )}

          <button
            onClick={() => {
              if (confirm('Activate subscription immediately?')) {
                fetch(`/api/superadmin/churches/${churchId}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ action: 'update_status', status: 'ACTIVE' }),
                }).then(() => onUpdate())
              }
            }}
            disabled={loading}
            className="px-4 py-2 bg-primary-700 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            Set Active
          </button>
        </div>
      </div>

      {/* Extend Trial Modal */}
      {showExtendModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Extend Trial Period</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Days to Extend
                </label>
                <input
                  type="number"
                  value={daysToExtend}
                  onChange={(e) => setDaysToExtend(parseInt(e.target.value) || 30)}
                  min="1"
                  max="365"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={handleExtendTrial}
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Extending...' : 'Extend Trial'}
                </button>
                <button
                  onClick={() => setShowExtendModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Override Modal */}
      {showOverrideModal && currentPlan && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-lg w-full space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900">Adjust Pricing / Promo</h3>
              <button
                type="button"
                onClick={() => setShowOverrideModal(false)}
                className="text-gray-500 hover:text-gray-800"
                aria-label="Close override modal"
              >
                âœ•
              </button>
            </div>
            <p className="text-sm text-gray-600">
              Overrides apply to <span className="font-semibold">{currentPlan.name}</span> for this tenant only.
            </p>
            <div className="space-y-3">
              <label className="text-sm font-medium text-gray-700 flex flex-col">
                Custom Price
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={overrideForm.customPrice}
                  onChange={(e) => handleOverrideInput('customPrice', e.target.value)}
                  className="mt-1 rounded-lg border-gray-300 focus:border-primary-500 focus:ring-primary-500 text-sm px-3 py-2"
                  placeholder="Leave blank to use plan default"
                />
              </label>
              <label className="text-sm font-medium text-gray-700 flex flex-col">
                Setup Fee Override
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={overrideForm.customSetupFee}
                  onChange={(e) => handleOverrideInput('customSetupFee', e.target.value)}
                  className="mt-1 rounded-lg border-gray-300 focus:border-primary-500 focus:ring-primary-500 text-sm px-3 py-2"
                  placeholder="Optional"
                />
              </label>
              <label className="text-sm font-medium text-gray-700 flex flex-col">
                Promo Code
                <input
                  type="text"
                  value={overrideForm.promoCode}
                  onChange={(e) => handleOverrideInput('promoCode', e.target.value.toUpperCase())}
                  className="mt-1 rounded-lg border-gray-300 focus:border-primary-500 focus:ring-primary-500 text-sm px-3 py-2 uppercase"
                  placeholder="E.g. SPRING25"
                />
              </label>
              <label className="text-sm font-medium text-gray-700 flex flex-col">
                Expires At
                <input
                  type="date"
                  value={overrideForm.expiresAt}
                  onChange={(e) => handleOverrideInput('expiresAt', e.target.value)}
                  className="mt-1 rounded-lg border-gray-300 focus:border-primary-500 focus:ring-primary-500 text-sm px-3 py-2"
                />
              </label>
              <label className="text-sm font-medium text-gray-700 flex flex-col">
                Notes
                <textarea
                  value={overrideForm.notes}
                  onChange={(e) => handleOverrideInput('notes', e.target.value)}
                  className="mt-1 rounded-lg border-gray-300 focus:border-primary-500 focus:ring-primary-500 text-sm px-3 py-2"
                  rows={3}
                  placeholder="Optional internal note"
                />
              </label>
            </div>

            <div className="flex flex-wrap gap-3 justify-end pt-2">
              {currentPlanOverride && (
                <button
                  type="button"
                  onClick={handleClearOverride}
                  disabled={savingOverride}
                  className="px-4 py-2 rounded-lg border border-red-100 text-red-600 font-medium hover:bg-red-50 disabled:opacity-50"
                >
                  Remove Override
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowOverrideModal(false)}
                className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 font-medium hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveOverride}
                disabled={savingOverride}
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-50"
              >
                {savingOverride ? 'Saving...' : 'Save Override'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Plan Modal */}
      {showPlanModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Change Subscription Plan</h3>
            <div className="space-y-3">
              {availablePlans.map((plan) => {
                const isCurrent = plan.id === currentPlan?.id
                const isProcessing = checkoutPlanId === plan.id
                return (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => handleChangePlan(plan.id)}
                    disabled={isProcessing}
                    className={`w-full text-left p-4 border-2 rounded-lg transition-all ${
                      isCurrent
                        ? 'border-blue-500 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300'
                    } ${isProcessing ? 'opacity-70 cursor-wait' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold text-gray-900">{plan.name}</h4>
                        <p className="text-sm text-gray-600">{plan.description}</p>
                        <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-gray-600">
                          {plan.maxUsers && <span>Max {plan.maxUsers} users</span>}
                          {plan.maxSermons && <span>{plan.maxSermons} sermons</span>}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-gray-900">
                          ${plan.price}/{plan.billingCycle === 'monthly' ? 'mo' : 'yr'}
                        </p>
                        {isCurrent && (
                          <span className="text-xs text-primary-600 font-medium">Current</span>
                        )}
                        {isProcessing && (
                          <span className="block text-xs text-purple-600 font-medium">
                            Launching checkout...
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
            <button
              onClick={() => setShowPlanModal(false)}
              className="mt-4 w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
