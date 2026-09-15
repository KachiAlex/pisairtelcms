"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"

type Plan = {
  id: string
  name: string
  description?: string
  price: number
  currency: string
  billingCycle: string
  features: string[]
  type?: string
  targetMembers?: { min: number; max?: number }
}

type Promo = {
  code: string
  type: 'percentage' | 'flat'
  value: number
  appliesTo: 'plan' | 'church' | 'global'
  planIds?: string[]
  churchIds?: string[]
  status?: 'active' | 'inactive'
  validFrom?: string
  validTo?: string
  maxRedemptions?: number
  redeemedCount?: number
  notes?: string
}

const currencyOptions = ["USD", "NGN", "EUR", "GBP"]

const formatPrice = (value: number, currency: string) => {
  if (!value || value === 0) return "Free"
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
    }).format(value)
  } catch {
    return `${currency} ${value}`
  }
}

interface PlanPricingManagerProps {
  initialPlans: Plan[]
  initialPromos?: Promo[]
}

export default function PlanPricingManager({ initialPlans, initialPromos }: PlanPricingManagerProps) {
  const router = useRouter()
  const [plans, setPlans] = useState<Plan[]>(initialPlans)
  const [drafts, setDrafts] = useState(() =>
    Object.fromEntries(
      initialPlans.map((plan) => [
        plan.id,
        {
          name: plan.name,
          price: plan.price,
          currency: plan.currency || "USD",
          billingCycle: plan.billingCycle || "monthly",
        },
      ])
    )
  )
  const [savingPlanId, setSavingPlanId] = useState<string | null>(null)
  const [status, setStatus] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [promos, setPromos] = useState<Promo[]>(initialPromos || [])
  const [promoStatus, setPromoStatus] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [savingPromo, setSavingPromo] = useState(false)
  const [promoForm, setPromoForm] = useState({
    code: '',
    type: 'percentage',
    value: 10,
    appliesTo: 'plan',
    planIds: [] as string[],
    churchIds: '',
    maxRedemptions: '',
    validFrom: '',
    validTo: '',
    notes: '',
  })

  const sortedPlans = useMemo(() => {
    return [...plans].sort((a, b) => (a.price ?? 0) - (b.price ?? 0))
  }, [plans])

  const handleDraftChange = (planId: string, field: string, value: string | number) => {
    setDrafts((prev) => ({
      ...prev,
      [planId]: {
        ...prev[planId],
        [field]: value,
      },
    }))
  }

  const handleSave = async (planId: string) => {
    const draft = drafts[planId]
    if (!draft) return

    const parsedPrice = Number(draft.price)
    if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
      setStatus({ type: "error", text: "Price must be a non-negative number." })
      return
    }

    const payload = {
      name: draft.name?.trim(),
      price: parsedPrice,
      currency: draft.currency || "USD",
      billingCycle: draft.billingCycle || "monthly",
    }

    setSavingPlanId(planId)
    setStatus(null)

    try {
      const response = await fetch(`/api/superadmin/plans/${planId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || "Failed to update plan")
      }

      const updatedPlan = result.plan as Plan
      setPlans((prev) => prev.map((plan) => (plan.id === planId ? { ...plan, ...updatedPlan } : plan)))
      setDrafts((prev) => ({
        ...prev,
        [planId]: {
          name: updatedPlan.name,
          price: updatedPlan.price,
          currency: updatedPlan.currency,
          billingCycle: updatedPlan.billingCycle,
        },
      }))
      setStatus({ type: "success", text: `${updatedPlan.name} pricing updated.` })
      router.refresh()
    } catch (error: any) {
      setStatus({ type: "error", text: error.message || "Unable to update plan. Try again." })
    } finally {
      setSavingPlanId(null)
    }
  }

  const handlePromoInput = (field: string, value: string | number | string[]) => {
    setPromoForm((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleCreatePromo = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!promoForm.code.trim()) {
      setPromoStatus({ type: "error", text: "Promo code is required." })
      return
    }
    const payload: Record<string, any> = {
      code: promoForm.code.trim().toUpperCase(),
      type: promoForm.type,
      value: Number(promoForm.value),
      appliesTo: promoForm.appliesTo,
      notes: promoForm.notes?.trim() || undefined,
    }
    if (promoForm.appliesTo === 'plan') {
      payload.planIds = promoForm.planIds
    } else if (promoForm.appliesTo === 'church') {
      payload.churchIds = promoForm.churchIds
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean)
    }
    if (promoForm.maxRedemptions) {
      payload.maxRedemptions = Number(promoForm.maxRedemptions)
    }
    if (promoForm.validFrom) payload.validFrom = promoForm.validFrom
    if (promoForm.validTo) payload.validTo = promoForm.validTo

    if (!Number.isFinite(payload.value) || payload.value <= 0) {
      setPromoStatus({ type: "error", text: "Discount value must be greater than 0." })
      return
    }

    setSavingPromo(true)
    setPromoStatus(null)
    try {
      const response = await fetch('/api/superadmin/promos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || 'Failed to create promo')
      }
      setPromos((prev) => [result.promo, ...prev])
      setPromoStatus({ type: 'success', text: `Promo ${result.promo.code} created.` })
      setPromoForm({
        code: '',
        type: 'percentage',
        value: 10,
        appliesTo: 'plan',
        planIds: [],
        churchIds: '',
        maxRedemptions: '',
        validFrom: '',
        validTo: '',
        notes: '',
      })
      router.refresh()
    } catch (error: any) {
      setPromoStatus({ type: 'error', text: error.message || 'Unable to create promo.' })
    } finally {
      setSavingPromo(false)
    }
  }

  const handleTogglePromoStatus = async (promo: Promo) => {
    const nextStatus = promo.status === 'inactive' ? 'active' : 'inactive'
    try {
      const response = await fetch(`/api/superadmin/promos/${promo.code}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || 'Failed to update promo status')
      }
      setPromos((prev) => prev.map((item) => (item.code === promo.code ? result.promo : item)))
      setPromoStatus({ type: 'success', text: `Promo ${promo.code} ${nextStatus === 'active' ? 'activated' : 'paused'}.` })
      router.refresh()
    } catch (error: any) {
      setPromoStatus({ type: 'error', text: error.message || 'Unable to update promo.' })
    }
  }

  const formatDateBadge = (value?: string) => {
    if (!value) return '--'
    const date = new Date(value)
    return date.toLocaleDateString()
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Subscription Plans</h2>
          <p className="text-sm text-gray-600">
            Edit pricing, names, currency, and billing cadence for each plan. Member ranges come from our recommended tiers.
          </p>
        </div>
        {status && (
          <div
            className={`rounded-lg px-4 py-2 text-sm font-medium ${
              status.type === "success"
                ? "bg-green-50 text-green-800 border border-green-200"
                : "bg-red-50 text-red-800 border border-red-200"
            }`}
          >
            {status.text}
          </div>
        )}
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sortedPlans.map((plan) => {
          const draft = drafts[plan.id]
          const isSaving = savingPlanId === plan.id
          const isLifetimePlan = plan.id === 'lifetime' || plan.billingCycle === 'lifetime'
          return (
            <div key={plan.id} className="border border-gray-200 rounded-2xl p-5 flex flex-col gap-4">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-col">
                    <h3 className="font-semibold text-gray-900">{plan.name}</h3>
                    {plan.targetMembers && (
                      <span className="text-xs text-gray-500">
                        {plan.targetMembers.min.toLocaleString()}"
                        {plan.targetMembers.max ? plan.targetMembers.max.toLocaleString() : '+'} members
                      </span>
                    )}
                  </div>
                  {plan.type && (
                    <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                      {plan.type}
                    </span>
                  )}
                </div>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {formatPrice(plan.price, plan.currency)}
                  <span className="text-base text-gray-500 font-normal">
                    {plan.billingCycle === "annual"
                      ? "/year"
                      : plan.billingCycle === "lifetime"
                        ? "one-time"
                        : "/month"}
                  </span>
                </p>
                {plan.description && <p className="text-sm text-gray-600 mt-1">{plan.description}</p>}
                {isLifetimePlan && (
                  <p className="text-xs text-emerald-700 font-medium mt-1">
                    Lifetime license  -  charge a single upfront payment
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <label className="text-sm font-medium text-gray-700 flex flex-col">
                  Price
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={draft?.price ?? 0}
                    onChange={(e) => handleDraftChange(plan.id, "price", e.target.value)}
                    className="mt-1 rounded-lg border-gray-300 focus:border-primary-500 focus:ring-primary-500 text-sm px-3 py-2"
                  />
                </label>
                <label className="text-sm font-medium text-gray-700 flex flex-col">
                  Currency
                  <select
                    value={draft?.currency ?? "USD"}
                    onChange={(e) => handleDraftChange(plan.id, "currency", e.target.value)}
                    className="mt-1 rounded-lg border-gray-300 focus:border-primary-500 focus:ring-primary-500 text-sm px-3 py-2"
                  >
                    {currencyOptions.map((code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    ))}
                  </select>
                </label>
                {isLifetimePlan ? (
                  <div className="text-sm font-medium text-gray-700 flex flex-col">
                    Billing Cycle
                    <div className="mt-1 rounded-lg border border-gray-200 bg-gray-50 text-gray-600 text-sm px-3 py-2">
                      Lifetime (one-time)
                    </div>
                  </div>
                ) : (
                  <label className="text-sm font-medium text-gray-700 flex flex-col">
                    Billing Cycle
                    <select
                      value={draft?.billingCycle ?? "monthly"}
                      onChange={(e) => handleDraftChange(plan.id, "billingCycle", e.target.value)}
                      className="mt-1 rounded-lg border-gray-300 focus:border-primary-500 focus:ring-primary-500 text-sm px-3 py-2"
                    >
                      <option value="monthly">Monthly</option>
                      <option value="annual">Annual</option>
                    </select>
                  </label>
                )}
              </div>

              <button
                type="button"
                onClick={() => handleSave(plan.id)}
                disabled={isSaving}
                className="mt-auto rounded-lg bg-primary-600 text-white text-sm font-semibold px-4 py-2.5 hover:bg-blue-700 transition disabled:opacity-50"
              >
                {isSaving ? "Saving..." : "Save Pricing"}
              </button>

              {plan.features?.length > 0 && (
                <div className="pt-3 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Included Features</p>
                  <ul className="space-y-1 text-sm text-gray-600">
                    {plan.features.slice(0, 5).map((feature, idx) => (
                      <li key={idx} className="flex items-center gap-2">
                        <span className="text-green-500"> - </span>
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="border border-gray-200 rounded-2xl p-5 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Promo Codes & Discounts</h3>
            <p className="text-sm text-gray-600">Create campaigns for plan upgrades, custom deals, or temporary promotions.</p>
          </div>
          {promoStatus && (
            <div
              className={`rounded-lg px-4 py-2 text-sm font-medium ${
                promoStatus.type === "success"
                  ? "bg-green-50 text-green-800 border border-green-200"
                  : "bg-red-50 text-red-800 border border-red-200"
              }`}
            >
              {promoStatus.text}
            </div>
          )}
        </div>

        <form onSubmit={handleCreatePromo} className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-medium text-gray-700 flex flex-col">
            Promo Code
            <input
              type="text"
              value={promoForm.code}
              onChange={(e) => handlePromoInput('code', e.target.value.toUpperCase())}
              className="mt-1 rounded-lg border-gray-300 focus:border-primary-500 focus:ring-primary-500 text-sm px-3 py-2 uppercase"
              placeholder="E.g. EASTER25"
              required
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm font-medium text-gray-700 flex flex-col">
              Type
              <select
                value={promoForm.type}
                onChange={(e) => handlePromoInput('type', e.target.value)}
                className="mt-1 rounded-lg border-gray-300 focus:border-primary-500 focus:ring-primary-500 text-sm px-3 py-2"
              >
                <option value="percentage">Percentage</option>
                <option value="flat">Flat Amount</option>
              </select>
            </label>
            <label className="text-sm font-medium text-gray-700 flex flex-col">
              Value
              <input
                type="number"
                min="0"
                step="0.01"
                value={promoForm.value}
                onChange={(e) => handlePromoInput('value', e.target.value)}
                className="mt-1 rounded-lg border-gray-300 focus:border-primary-500 focus:ring-primary-500 text-sm px-3 py-2"
              />
            </label>
          </div>

          <label className="text-sm font-medium text-gray-700 flex flex-col">
            Applies To
            <select
              value={promoForm.appliesTo}
              onChange={(e) => handlePromoInput('appliesTo', e.target.value)}
              className="mt-1 rounded-lg border-gray-300 focus:border-primary-500 focus:ring-primary-500 text-sm px-3 py-2"
            >
              <option value="plan">Specific Plans</option>
              <option value="church">Specific Churches</option>
              <option value="global">Global</option>
            </select>
          </label>

 		
          {promoForm.appliesTo === 'plan' && (
            <label className="text-sm font-medium text-gray-700 flex flex-col md:col-span-2">
              Select Plans
              <select
                multiple
                value={promoForm.planIds}
                onChange={(e) =>
                  handlePromoInput(
                    'planIds',
                    Array.from(e.target.selectedOptions).map((option) => option.value),
                  )
                }
                className="mt-1 rounded-lg border-gray-300 focus:border-primary-500 focus:ring-primary-500 text-sm px-3 py-2 h-32"
              >
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name}
                  </option>
                ))}
              </select>
              <span className="text-xs text-gray-500 mt-1">Hold Ctrl/Cmd to select multiple plans.</span>
            </label>
          )}

          {promoForm.appliesTo === 'church' && (
            <label className="text-sm font-medium text-gray-700 flex flex-col md:col-span-2">
              Church IDs (comma separated)
              <textarea
                value={promoForm.churchIds}
                onChange={(e) => handlePromoInput('churchIds', e.target.value)}
                className="mt-1 rounded-lg border-gray-300 focus:border-primary-500 focus:ring-primary-500 text-sm px-3 py-2"
                rows={2}
                placeholder="churchId-1, churchId-2"
              />
            </label>
          )}

          <div className="grid grid-cols-2 gap-3 md:col-span-2">
            <label className="text-sm font-medium text-gray-700 flex flex-col">
              Valid From
              <input
                type="date"
                value={promoForm.validFrom}
                onChange={(e) => handlePromoInput('validFrom', e.target.value)}
                className="mt-1 rounded-lg border-gray-300 focus:border-primary-500 focus:ring-primary-500 text-sm px-3 py-2"
              />
            </label>
            <label className="text-sm font-medium text-gray-700 flex flex-col">
              Valid To
              <input
                type="date"
                value={promoForm.validTo}
                onChange={(e) => handlePromoInput('validTo', e.target.value)}
                className="mt-1 rounded-lg border-gray-300 focus:border-primary-500 focus:ring-primary-500 text-sm px-3 py-2"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3 md:col-span-2">
            <label className="text-sm font-medium text-gray-700 flex flex-col">
              Max Redemptions (optional)
              <input
                type="number"
                min="1"
                value={promoForm.maxRedemptions}
                onChange={(e) => handlePromoInput('maxRedemptions', e.target.value)}
                className="mt-1 rounded-lg border-gray-300 focus:border-primary-500 focus:ring-primary-500 text-sm px-3 py-2"
              />
            </label>
            <label className="text-sm font-medium text-gray-700 flex flex-col">
              Notes
              <input
                type="text"
                value={promoForm.notes}
                onChange={(e) => handlePromoInput('notes', e.target.value)}
                className="mt-1 rounded-lg border-gray-300 focus:border-primary-500 focus:ring-primary-500 text-sm px-3 py-2"
                placeholder="Internal notes"
              />
            </label>
          </div>

          <div className="md:col-span-2 flex justify-end">
            <button
              type="submit"
              disabled={savingPromo}
              className="rounded-lg bg-emerald-600 text-white text-sm font-semibold px-4 py-2.5 hover:bg-emerald-700 transition disabled:opacity-50"
            >
              {savingPromo ? 'Saving promo...' : 'Create Promo'}
            </button>
          </div>
        </form>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Code</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Scope</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Validity</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Usage</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {promos.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-sm text-gray-500">
                    No promo codes yet.
                  </td>
                </tr>
              ) : (
                promos.map((promo) => (
                  <tr key={promo.code}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900">{promo.code}</span>
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            promo.status === 'inactive'
                              ? 'bg-gray-100 text-gray-600'
                              : 'bg-green-100 text-green-700'
                          }`}
                        >
                          {promo.status === 'inactive' ? 'Paused' : 'Active'}
                        </span>
                      </div>
                      {promo.notes && <p className="text-xs text-gray-500 mt-1">{promo.notes}</p>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {promo.type === 'percentage' ? `${promo.value}% off` : `-${promo.value}`}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 capitalize">
                      {promo.appliesTo}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      <div className="flex flex-col">
                        <span>From: {formatDateBadge(promo.validFrom)}</span>
                        <span>To: {formatDateBadge(promo.validTo)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {promo.redeemedCount ?? 0}
                      {promo.maxRedemptions ? ` / ${promo.maxRedemptions}` : ''}
                    </td>
                    <td className="px-4 py-3 text-right text-sm">
                      <button
                        type="button"
                        onClick={() => handleTogglePromoStatus(promo)}
                        className="text-sm font-semibold text-primary-600 hover:text-primary-700 mr-3"
                      >
                        {promo.status === 'inactive' ? 'Activate' : 'Pause'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}