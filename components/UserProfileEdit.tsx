'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const PAY_FREQUENCIES = ['weekly', 'biweekly', 'monthly', 'annual'] as const

const userSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  phone: z.string().optional(),
  bio: z.string().optional(),
  dateOfBirth: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  country: z.string().optional(),
  spiritualMaturity: z.string().optional(),
  role: z.string().optional(),
  profileImage: z.string().url().optional().or(z.literal('')),
  password: z.string().min(8, 'Password must be at least 8 characters').optional().or(z.literal('')),
  isStaff: z.boolean().optional(),
  staffLevelId: z.string().optional(),
  useCustomWage: z.boolean().optional(),
  customWageAmount: z.string().optional(),
  customWageCurrency: z.string().optional(),
  customWagePayFrequency: z.enum(PAY_FREQUENCIES).optional(),
})

type UserFormData = z.infer<typeof userSchema>

interface UserProfileEditProps {
  userId: string
}

export default function UserProfileEdit({ userId }: UserProfileEditProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [canEditRole, setCanEditRole] = useState(false)
  const [currentUserRole, setCurrentUserRole] = useState('')
  const [availableRoles, setAvailableRoles] = useState<string[]>([])
  const [staffLevels, setStaffLevels] = useState<
    { id: string; name: string; description?: string }[]
  >([])
  const [loadingStaffLevels, setLoadingStaffLevels] = useState(false)
  const [staffLevelError, setStaffLevelError] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
  })

  const isStaffSelected = watch('isStaff')
  const useCustomWage = watch('useCustomWage')

  const getAvailableRoles = (userRole: string): string[] => {
    switch (userRole) {
      case 'SUPER_ADMIN':
        return ['VISITOR', 'MEMBER', 'VOLUNTEER', 'LEADER', 'BRANCH_ADMIN', 'PASTOR', 'ADMIN', 'SUPER_ADMIN']
      case 'ADMIN':
        return ['VISITOR', 'MEMBER', 'VOLUNTEER', 'LEADER', 'BRANCH_ADMIN', 'PASTOR', 'ADMIN']
      case 'PASTOR':
        return ['VISITOR', 'MEMBER', 'VOLUNTEER', 'LEADER', 'BRANCH_ADMIN']
      case 'BRANCH_ADMIN':
        return ['VISITOR', 'MEMBER', 'VOLUNTEER', 'LEADER']
      default:
        return []
    }
  }

  const getRoleDisplayName = (role: string): string => {
    switch (role) {
      case 'VISITOR': return 'Visitor'
      case 'MEMBER': return 'Member'
      case 'VOLUNTEER': return 'Volunteer'
      case 'LEADER': return 'Leader'
      case 'STAFF': return 'Staff'
      case 'BRANCH_ADMIN': return 'Branch Admin'
      case 'PASTOR': return 'Pastor'
      case 'ADMIN': return 'Admin'
      case 'SUPER_ADMIN': return 'Super Admin'
      default: return role
    }
  }

  const loadUser = useCallback(async () => {
    try {
      const response = await fetch(`/api/users/${userId}`)
      if (!response.ok) {
        throw new Error('Failed to load user')
      }
      const user = await response.json()

      // Check if user can edit role
      const currentUserResponse = await fetch('/api/users/me')
      if (currentUserResponse.ok) {
        const currentUser = await currentUserResponse.json()
        const userRole = currentUser.role
        setCurrentUserRole(userRole)
        const canEdit = ['ADMIN', 'SUPER_ADMIN', 'PASTOR', 'BRANCH_ADMIN'].includes(userRole)
        setCanEditRole(canEdit)
        if (canEdit) {
          setAvailableRoles(getAvailableRoles(userRole))
        }
      }

      reset({
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone || '',
        bio: user.bio || '',
        dateOfBirth: user.dateOfBirth
          ? new Date(user.dateOfBirth).toISOString().split('T')[0]
          : '',
        address: user.address || '',
        city: user.city || '',
        state: user.state || '',
        zipCode: user.zipCode || '',
        country: user.country || '',
        spiritualMaturity: user.spiritualMaturity || '',
        role: user.role || '',
        profileImage: user.profileImage || '',
        password: '',
        isStaff: Boolean(user.isStaff),
        staffLevelId: user.staffLevelId || '',
        useCustomWage: Boolean(user.customWage),
        customWageAmount: user.customWage?.amount
          ? user.customWage.amount.toString()
          : '',
        customWageCurrency: user.customWage?.currency || 'NGN',
        customWagePayFrequency:
          (user.customWage?.payFrequency as typeof PAY_FREQUENCIES[number]) ||
          'monthly',
      })
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [reset, userId])

  useEffect(() => {
    loadUser()
  }, [loadUser])

  useEffect(() => {
    const fetchStaffLevels = async () => {
      setLoadingStaffLevels(true)
      setStaffLevelError('')
      try {
        const response = await fetch('/api/staff-levels')
        if (!response.ok) throw new Error('Failed to load staff levels')
        const data = await response.json()
        setStaffLevels(Array.isArray(data) ? data : [])
      } catch (err: any) {
        setStaffLevelError(err?.message || 'Unable to load staff levels.')
      } finally {
        setLoadingStaffLevels(false)
      }
    }
    fetchStaffLevels()
  }, [])

  const onSubmit = async (data: UserFormData) => {
    setError('')
    setSuccess(false)
    setSaving(true)

    try {
      // Remove empty password
      const updateData: Record<string, any> = { ...data }

      const isStaffFlag = Boolean(data.isStaff)
      updateData.isStaff = isStaffFlag

      if (isStaffFlag) {
        if (!data.staffLevelId) {
          throw new Error('Select a staff level for this member.')
        }
        updateData.staffLevelId = data.staffLevelId
        if (data.useCustomWage) {
          const amountValue = Number(data.customWageAmount)
          if (!Number.isFinite(amountValue) || amountValue <= 0) {
            throw new Error('Enter a valid custom wage amount greater than 0.')
          }
          const currency = (data.customWageCurrency || '').trim().toUpperCase()
          if (!/^[A-Z]{3}$/.test(currency)) {
            throw new Error('Custom wage currency must be a 3-letter code.')
          }
          const frequency =
            data.customWagePayFrequency || ('monthly' as typeof PAY_FREQUENCIES[number])
          updateData.customWage = {
            amount: amountValue,
            currency,
            payFrequency: frequency,
          }
        } else {
          updateData.customWage = null
        }
      } else {
        updateData.staffLevelId = null
        updateData.customWage = null
      }

      delete updateData.useCustomWage
      delete updateData.customWageAmount
      delete updateData.customWageCurrency
      delete updateData.customWagePayFrequency
      delete updateData.staffLevelId

      if (!updateData.password) {
        delete updateData.password
      }

      const response = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update profile')
      }

      setSuccess(true)
      setTimeout(() => {
        router.push(`/users/${userId}`)
      }, 1500)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">Loading...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-4 sm:py-8">
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="text-primary-600 hover:underline text-sm sm:text-base"
        >
          ← Back
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-lg p-4 sm:p-8">
        <h1 className="text-2xl sm:text-3xl font-bold mb-6">Edit Profile</h1>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 text-green-700 rounded text-sm">
            Profile updated successfully! Redirecting...
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-2">
                First Name *
              </label>
              <input
                {...register('firstName')}
                type="text"
                id="firstName"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm sm:text-base"
              />
              {errors.firstName && (
                <p className="mt-1 text-sm text-red-600">{errors.firstName.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-2">
                Last Name *
              </label>
              <input
                {...register('lastName')}
                type="text"
                id="lastName"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm sm:text-base"
              />
              {errors.lastName && (
                <p className="mt-1 text-sm text-red-600">{errors.lastName.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                Phone
              </label>
              <input
                {...register('phone')}
                type="tel"
                id="phone"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            <div>
              <label htmlFor="dateOfBirth" className="block text-sm font-medium text-gray-700 mb-2">
                Date of Birth
              </label>
              <input
                {...register('dateOfBirth')}
                type="date"
                id="dateOfBirth"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label htmlFor="bio" className="block text-sm font-medium text-gray-700 mb-2">
              Bio
            </label>
            <textarea
              {...register('bio')}
              id="bio"
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-2">
                Address
              </label>
              <input
                {...register('address')}
                type="text"
                id="address"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            <div>
              <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-2">
                City
              </label>
              <input
                {...register('city')}
                type="text"
                id="city"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <label htmlFor="state" className="block text-sm font-medium text-gray-700 mb-2">
                State
              </label>
              <input
                {...register('state')}
                type="text"
                id="state"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            <div>
              <label htmlFor="zipCode" className="block text-sm font-medium text-gray-700 mb-2">
                Zip Code
              </label>
              <input
                {...register('zipCode')}
                type="text"
                id="zipCode"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            <div>
              <label htmlFor="country" className="block text-sm font-medium text-gray-700 mb-2">
                Country
              </label>
              <input
                {...register('country')}
                type="text"
                id="country"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="spiritualMaturity" className="block text-sm font-medium text-gray-700 mb-2">
                Spiritual Maturity
              </label>
              <select
                {...register('spiritualMaturity')}
                id="spiritualMaturity"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="">Select...</option>
                <option value="NEW_BELIEVER">New Believer</option>
                <option value="GROWING">Growing</option>
                <option value="MATURE">Mature</option>
                <option value="LEADER">Leader</option>
              </select>
            </div>

            {canEditRole && (
              <div>
                <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-2">
                  Role
                </label>
                <select
                  {...register('role')}
                  id="role"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  {availableRoles.map((roleOption) => (
                    <option key={roleOption} value={roleOption}>
                      {getRoleDisplayName(roleOption)}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  You can assign roles based on your current permissions.
                </p>
              </div>
            )}
          </div>

          <div className="border border-gray-200 rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Staff assignment</h3>
                <p className="text-sm text-gray-500">
                  Assign this member to a staff tier to include them in payroll calculations.
                </p>
              </div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <input
                  type="checkbox"
                  {...register('isStaff')}
                  className="h-4 w-4 text-primary-600 border-gray-300 rounded"
                />
                Mark as staff
              </label>
            </div>

            {isStaffSelected ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Staff level
                  </label>
                  <select
                    {...register('staffLevelId')}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    disabled={loadingStaffLevels || staffLevels.length === 0}
                  >
                    <option value="">
                      {loadingStaffLevels
                        ? 'Loading staff levels...'
                        : staffLevels.length === 0
                        ? 'Create a staff level in Settings > Roles & Designations'
                        : 'Select staff level'}
                    </option>
                    {staffLevels.map((level) => (
                      <option key={level.id} value={level.id}>
                        {level.name}
                      </option>
                    ))}
                  </select>
                  {staffLevelError && (
                    <p className="mt-1 text-sm text-red-600">{staffLevelError}</p>
                  )}
                </div>

                <div className="rounded-lg border border-gray-100 bg-gray-50 p-4 space-y-3">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <input
                      type="checkbox"
                      {...register('useCustomWage')}
                      className="h-4 w-4 text-primary-600 border-gray-300 rounded"
                    />
                    Override default wage
                  </label>
                  {useCustomWage && (
                    <div className="grid md:grid-cols-3 gap-4">
                      <label className="text-sm text-gray-600 flex flex-col gap-1">
                        Amount
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          {...register('customWageAmount')}
                          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        />
                      </label>
                      <label className="text-sm text-gray-600 flex flex-col gap-1">
                        Currency
                        <input
                          type="text"
                          maxLength={3}
                          {...register('customWageCurrency')}
                          onChange={(event) =>
                            setValue('customWageCurrency', event.target.value.toUpperCase())
                          }
                          className="px-3 py-2 uppercase border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        />
                      </label>
                      <label className="text-sm text-gray-600 flex flex-col gap-1">
                        Pay frequency
                        <select
                          {...register('customWagePayFrequency')}
                          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        >
                          {PAY_FREQUENCIES.map((freq) => (
                            <option key={freq} value={freq}>
                              {freq === 'biweekly'
                                ? 'Bi-weekly'
                                : freq.charAt(0).toUpperCase() + freq.slice(1)}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  )}
                  {!useCustomWage && (
                    <p className="text-sm text-gray-500">
                      Default wage from the selected staff level will be used unless you override it.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">
                This member is currently not part of the staff payroll list.
              </p>
            )}
          </div>

          <div>
            <label htmlFor="profileImage" className="block text-sm font-medium text-gray-700 mb-2">
              Profile Image URL
            </label>
            <input
              {...register('profileImage')}
              type="url"
              id="profileImage"
              placeholder="https://example.com/image.jpg"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            {errors.profileImage && (
              <p className="mt-1 text-sm text-red-600">{errors.profileImage.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              New Password (leave blank to keep current)
            </label>
            <input
              {...register('password')}
              type="password"
              id="password"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            {errors.password && (
              <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
            )}
          </div>

          <div className="flex gap-4">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

