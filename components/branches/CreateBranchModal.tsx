'use client'

import { Combobox } from '@headlessui/react'
import { useEffect, useMemo, useState } from 'react'

export type BranchLevel = string

export type BranchCreationContext = {
  level: BranchLevel
  levelLabel: string
  levelCode: string
  parentBranchId?: string | null
  parentName?: string
}

type ExistingBranchOption = {
  id: string
  name: string
  level: BranchLevel
  levelLabel?: string
  levelCode?: string
  parentBranchId?: string | null
}

interface CreateBranchModalProps {
  churchId: string
  context: BranchCreationContext
  onClose: () => void
  onSuccess: () => void
  existingBranches?: ExistingBranchOption[]
  allowExistingSelection?: boolean
}

export default function CreateBranchModal({
  churchId,
  context,
  onClose,
  onSuccess,
  existingBranches = [],
  allowExistingSelection = false,
}: CreateBranchModalProps) {
  const canUseExisting = allowExistingSelection && existingBranches.length > 0
  const [mode, setMode] = useState<'existing' | 'new'>(canUseExisting ? 'existing' : 'new')
  const [selectedExistingId, setSelectedExistingId] = useState<string | null>(null)
  const [existingSearch, setExistingSearch] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    country: '',
    phone: '',
    email: '',
    description: '',
    adminId: '',
  })
  const levelCode = context.levelCode || 'Level'
  const levelCodeLower = levelCode.toLowerCase()

  const [displayName, setDisplayName] = useState(
    context.levelLabel?.trim() || (levelCode === 'Level 1' ? 'Global Headquarters' : '')
  )

  useEffect(() => {
    setDisplayName(
      context.levelLabel?.trim() || (levelCode === 'Level 1' ? 'Global Headquarters' : '')
    )
    setExistingSearch('')
  }, [context.level, context.levelLabel, context.parentBranchId, levelCode])

  const filteredExistingBranches = useMemo(() => {
    if (!canUseExisting) return []
    const query = existingSearch.trim().toLowerCase()
    return [...existingBranches]
      .filter((branch) => branch.id !== context.parentBranchId)
      .filter((branch) => {
        if (!query) return true
        const haystack = `${branch.name} ${branch.levelLabel ?? branch.level}`.toLowerCase()
        return haystack.includes(query)
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [canUseExisting, context.parentBranchId, existingBranches, existingSearch])

  useEffect(() => {
    if (!canUseExisting) {
      setMode('new')
      setSelectedExistingId(null)
      return
    }
    setSelectedExistingId((prev) => {
      if (prev && filteredExistingBranches.some((branch) => branch.id === prev)) {
        return prev
      }
      return filteredExistingBranches[0]?.id ?? null
    })
  }, [canUseExisting, filteredExistingBranches])

  const handleExistingSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (!selectedExistingId) {
        throw new Error('Please select an existing branch')
      }
      if (!displayName.trim()) {
        throw new Error('Display name is required')
      }

      const res = await fetch(
        `/api/churches/${churchId}/branches/${selectedExistingId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            level: context.level,
            levelLabel: displayName.trim(),
            parentBranchId: context.parentBranchId ?? null,
          }),
        }
      )

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update branch')
      }

      onSuccess()
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (!displayName.trim()) {
        throw new Error('Display name is required')
      }

      const payload = {
        ...formData,
        level: context.level,
        levelLabel: displayName.trim(),
        parentBranchId: context.parentBranchId ?? null,
      }

      const res = await fetch(`/api/churches/${churchId}/branches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create branch')
      }

      onSuccess()
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {mode === 'existing'
                ? `Designate existing ${levelCodeLower}`
                : `Create new ${levelCodeLower}`}
            </h2>
            <p className="text-sm text-gray-500">
              {context.parentBranchId
                ? `${levelCode} under ${context.parentName ?? 'selected parent'}.`
                : `${levelCode} entries define the hierarchy tier.`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form
          onSubmit={mode === 'existing' ? handleExistingSubmit : handleSubmit}
          className="p-6 space-y-6"
        >
          {canUseExisting && (
            <div className="rounded-xl border border-slate-200 p-2 bg-slate-50 flex gap-2 text-sm font-semibold text-slate-600">
              <button
                type="button"
                onClick={() => setMode('existing')}
                className={`flex-1 rounded-lg py-2 transition-colors ${
                  mode === 'existing'
                    ? 'bg-white text-primary-700 border border-primary-200 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Use existing branch
              </button>
              <button
                type="button"
                onClick={() => setMode('new')}
                className={`flex-1 rounded-lg py-2 transition-colors ${
                  mode === 'new'
                    ? 'bg-white text-primary-700 border border-primary-200 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Create new
              </button>
            </div>
          )}

          <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-sm text-slate-600">
            <p className="font-semibold text-slate-800 mb-1 uppercase text-xs tracking-wide">Hierarchy context</p>
            <p>
              Level code:{' '}
              <span className="font-semibold">{levelCode}</span>
            </p>
            {context.levelLabel?.trim() && (
              <p>
                Display name:{' '}
                <span className="font-semibold">{context.levelLabel}</span>
              </p>
            )}
            {context.parentBranchId ? (
              <p>
                Parent:{' '}
                <span className="font-semibold">
                  {context.parentName ?? context.parentBranchId}
                </span>
              </p>
            ) : (
              <p>This tier will be visible to tenant admins and downstream levels.</p>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4">
              {error}
            </div>
          )}

          {mode === 'existing' ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Choose an existing branch <span className="text-red-500">*</span>
                </label>
                <Combobox
                  value={selectedExistingId ?? null}
                  onChange={(value: string | null) => setSelectedExistingId(value || null)}
                >
                  <div className="relative">
                    <Combobox.Input
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white text-gray-900"
                      placeholder="Search by branch name or label"
                      displayValue={(value?: string | null) => {
                        if (!value) return ''
                        const selected = existingBranches.find((branch) => branch.id === value)
                        if (!selected) return ''
                        const label = selected.levelLabel?.trim() || selected.levelCode || ''
                        return label ? `${selected.name} Â· ${label}` : selected.name
                      }}
                      onChange={(event) => setExistingSearch(event.target.value)}
                    />
                    <Combobox.Button className="absolute inset-y-0 right-0 flex items-center pr-4 text-gray-500">
                      <svg
                        className="w-4 h-4"
                        viewBox="0 0 20 20"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={1.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M6 8l4 4 4-4"
                        />
                      </svg>
                    </Combobox.Button>
                    <Combobox.Options className="absolute z-10 mt-2 max-h-60 w-full overflow-auto rounded-xl bg-white py-2 shadow-lg ring-1 ring-black/5 focus:outline-none">
                      {filteredExistingBranches.length === 0 && existingSearch.trim().length > 0 ? (
                        <div className="px-4 py-2 text-sm text-slate-500">
                          No branches match "{existingSearch.trim()}".
                        </div>
                      ) : filteredExistingBranches.length === 0 ? (
                        <div className="px-4 py-2 text-sm text-slate-500">No branches available.</div>
                      ) : (
                        filteredExistingBranches.map((branch) => {
                          const label = branch.levelLabel?.trim() || branch.levelCode || ''
                          return (
                            <Combobox.Option
                              key={branch.id}
                              value={branch.id}
                              className={({ active, selected }) =>
                                `px-4 py-2 cursor-pointer text-sm ${
                                  active
                                    ? 'bg-primary-50 text-primary-900'
                                    : selected
                                    ? 'bg-slate-100 text-slate-900'
                                    : 'text-slate-700'
                                }`
                              }
                            >
                              <div className="flex flex-col">
                                <span className="font-medium">{branch.name}</span>
                                {label && <span className="text-xs text-slate-500">{label}</span>}
                              </div>
                            </Combobox.Option>
                          )
                        })
                      )}
                    </Combobox.Options>
                  </div>
                </Combobox>
                <p className="text-xs text-slate-500 mt-2">
                  This will update the selected branch to serve as the designated {levelCodeLower}.
                </p>
              </div>
              <div>
                <label htmlFor="newDisplayName" className="block text-sm font-semibold text-gray-700 mb-2">
                  Display name for this level <span className="text-red-500">*</span>
                </label>
                <input
                  id="newDisplayName"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all bg-gray-50 focus:bg-white text-gray-900"
                  placeholder={`e.g., ${context.levelLabel || levelCode}`}
                  style={{ color: '#111827', WebkitTextFillColor: '#111827' }}
                />
                <p className="text-xs text-slate-500 mt-2">
                  This label will appear across the hierarchy wherever this {levelCodeLower} is referenced.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Branch Name */}
              <div>
                <label htmlFor="name" className="block text-sm font-semibold text-gray-700 mb-2">
                  Branch Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all bg-gray-50 focus:bg-white text-gray-900"
                  placeholder="e.g., Downtown Campus, North Branch"
                  style={{ color: '#111827', WebkitTextFillColor: '#111827' }}
                />
              </div>

              {/* Display Name */}
              <div>
                <label htmlFor="newBranchDisplay" className="block text-sm font-semibold text-gray-700 mb-2">
                  Display name for this level <span className="text-red-500">*</span>
                </label>
                <input
                  id="newBranchDisplay"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all bg-gray-50 focus:bg-white text-gray-900"
                  placeholder={`e.g., ${context.levelLabel || levelCode}`}
                  style={{ color: '#111827', WebkitTextFillColor: '#111827' }}
                />
                <p className="text-xs text-slate-500 mt-2">
                  This label is shown throughout the hierarchy wherever this {levelCodeLower} appears.
                </p>
              </div>
              {/* Address */}
              <div>
                <label htmlFor="address" className="block text-sm font-semibold text-gray-700 mb-2">
                  Address
                </label>
                <input
                  id="address"
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all bg-gray-50 focus:bg-white text-gray-900"
                  placeholder="123 Main Street"
                  style={{ color: '#111827', WebkitTextFillColor: '#111827' }}
                />
              </div>

              {/* City, State, Zip */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label htmlFor="city" className="block text-sm font-semibold text-gray-700 mb-2">
                    City
                  </label>
                  <input
                    id="city"
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all bg-gray-50 focus:bg-white text-gray-900"
                    placeholder="City"
                    style={{ color: '#111827', WebkitTextFillColor: '#111827' }}
                  />
                </div>
                <div>
                  <label htmlFor="state" className="block text-sm font-semibold text-gray-700 mb-2">
                    State
                  </label>
                  <input
                    id="state"
                    type="text"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all bg-gray-50 focus:bg-white text-gray-900"
                    placeholder="State"
                    style={{ color: '#111827', WebkitTextFillColor: '#111827' }}
                  />
                </div>
                <div>
                  <label htmlFor="zipCode" className="block text-sm font-semibold text-gray-700 mb-2">
                    Zip Code
                  </label>
                  <input
                    id="zipCode"
                    type="text"
                    value={formData.zipCode}
                    onChange={(e) => setFormData({ ...formData, zipCode: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all bg-gray-50 focus:bg-white text-gray-900"
                    placeholder="12345"
                    style={{ color: '#111827', WebkitTextFillColor: '#111827' }}
                  />
                </div>
              </div>

              {/* Country */}
              <div>
                <label htmlFor="country" className="block text-sm font-semibold text-gray-700 mb-2">
                  Country
                </label>
                <input
                  id="country"
                  type="text"
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all bg-gray-50 focus:bg-white text-gray-900"
                  placeholder="United States"
                  style={{ color: '#111827', WebkitTextFillColor: '#111827' }}
                />
              </div>

              {/* Phone & Email */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="phone" className="block text-sm font-semibold text-gray-700 mb-2">
                    Phone
                  </label>
                  <input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all bg-gray-50 focus:bg-white text-gray-900"
                    placeholder="+1 (555) 000-0000"
                    style={{ color: '#111827', WebkitTextFillColor: '#111827' }}
                  />
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all bg-gray-50 focus:bg-white text-gray-900"
                    placeholder="branch@church.com"
                    style={{ color: '#111827', WebkitTextFillColor: '#111827' }}
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label htmlFor="description" className="block text-sm font-semibold text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all bg-gray-50 focus:bg-white text-gray-900"
                  placeholder="Tell us about this branch..."
                  style={{ color: '#111827', WebkitTextFillColor: '#111827' }}
                />
              </div>
            </>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end space-x-4 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 border border-gray-300 rounded-xl font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || (mode === 'existing' && (!selectedExistingId || filteredExistingBranches.length === 0))}
              className="px-6 py-3 bg-primary-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading
                ? mode === 'existing'
                  ? 'Saving...'
                  : 'Creating...'
                : mode === 'existing'
                ? `Set ${levelCode}`
                : `Create ${levelCode}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
