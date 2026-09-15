'use client'

import { useCallback, useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import {
  getHierarchyLevelLabels,
  getHierarchyLevels,
  type HierarchyLevelDefinition,
} from '@/lib/services/branch-hierarchy'

type RoleCategory = 'Worker' | 'Leader' | 'Admin'

type BranchOption = {
  id: string
  name: string
  level?: string
  parentBranchId?: string | null
}

type MemberInviteState = {
  invite: any | null
  token: string
  url: string
  loading: boolean
  submitting: boolean
  error: string
}

interface User {
  id: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  role: string
  profileImage?: string
  spiritualMaturity?: string
  xp: number
  level: number
  createdAt: string
  salary?: {
    position: {
      name: string
    }
  }
  designationId?: string
  designationName?: string
  isStaff?: boolean
  staffLevelId?: string
  staffLevelName?: string
  customWage?: {
    amount: number
    currency: string
    payFrequency: PayFrequencyOption
  }
  isSuspended?: boolean
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

interface Designation {
  id: string
  name: string
  description?: string
  category?: RoleCategory
}

type PayFrequencyOption = 'weekly' | 'biweekly' | 'monthly' | 'annual'

interface PayrollPositionOption {
  id: string
  name: string
  department?: {
    name: string
  }
}

interface AssignPayrollForm {
  positionId: string
  amount: string
  currency: string
  payFrequency: PayFrequencyOption
  startDate: string
}

interface StaffLevelOption {
  id: string
  name: string
  description?: string
}

type RowActionType = 'designation' | 'suspend' | 'delete'

interface ManualFormState {
  firstName: string
  lastName: string
  email: string
  password: string
  phone: string
  role: string
  designationId: string
  isStaff: boolean
  staffLevelId: string
  useCustomWage: boolean
  customWageAmount: string
  customWageCurrency: string
  customWagePayFrequency: PayFrequencyOption
}

const PAY_FREQUENCY_OPTIONS: PayFrequencyOption[] = ['weekly', 'biweekly', 'monthly', 'annual']
const CURRENCY_OPTIONS = ['USD', 'NGN', 'EUR', 'GBP']

const getDefaultAssignPayrollForm = (): AssignPayrollForm => ({
  positionId: '',
  amount: '',
  currency: 'USD',
  payFrequency: 'monthly',
  startDate: new Date().toISOString().slice(0, 10),
})

const getDefaultManualForm = (): ManualFormState => ({
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  phone: '',
  role: 'MEMBER',
  designationId: '',
  isStaff: false,
  staffLevelId: '',
  useCustomWage: false,
  customWageAmount: '',
  customWageCurrency: 'NGN',
  customWagePayFrequency: 'monthly',
})

const formatPayFrequencyLabel = (frequency?: PayFrequencyOption | string | null) => {
  if (!frequency) return ''
  const normalized = frequency.toLowerCase()
  return normalized === 'biweekly'
    ? 'Bi-weekly'
    : normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

const formatCurrency = (amount?: number, currency?: string) => {
  if (amount === undefined || amount === null || !currency) return ''
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount)
  } catch {
    return `${currency} ${amount.toLocaleString()}`
  }
}

export default function MemberDirectory() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [roleCategoryFilter, setRoleCategoryFilter] = useState<RoleCategory | ''>('')
  const [branchFilter, setBranchFilter] = useState('')
  const [designationFilter, setDesignationFilter] = useState('')
  const [branches, setBranches] = useState<BranchOption[]>(() => [])
  const [currentBranchId, setCurrentBranchId] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [addTab, setAddTab] = useState<'manual' | 'invite'>('manual')
  const [addError, setAddError] = useState('')
  const [hierarchyLevels, setHierarchyLevels] = useState<HierarchyLevelDefinition[]>(() => [])
  const [levelLabels, setLevelLabels] = useState<Record<string, string>>({})
  const [inviteLevelSelections, setInviteLevelSelections] = useState<Record<string, string>>({})
  const [savingManual, setSavingManual] = useState(false)
  const [manualForm, setManualForm] = useState<ManualFormState>(() => getDefaultManualForm())
  const [designations, setDesignations] = useState<Designation[]>([])
  const [isLoadingDesignations, setIsLoadingDesignations] = useState(false)
  const [staffLevels, setStaffLevels] = useState<StaffLevelOption[]>([])
  const [loadingStaffLevels, setLoadingStaffLevels] = useState(false)
  const [designationModalOpen, setDesignationModalOpen] = useState(false)
  const [designationForm, setDesignationForm] = useState({
    name: '',
    description: '',
    category: 'Leader' as RoleCategory,
  })
  const [designationError, setDesignationError] = useState('')
  const [savingDesignation, setSavingDesignation] = useState(false)
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  })
  const [memberInvite, setMemberInvite] = useState<MemberInviteState>({
    invite: null,
    token: '',
    url: '',
    loading: false,
    submitting: false,
    error: '',
  })
  const [inviteBranchId, setInviteBranchId] = useState<string>('')
  const [assignPayrollUser, setAssignPayrollUser] = useState<User | null>(null)
  const [payrollPositions, setPayrollPositions] = useState<PayrollPositionOption[]>([])
  const [assignForm, setAssignForm] = useState<AssignPayrollForm>(getDefaultAssignPayrollForm)
  const [loadingPayrollData, setLoadingPayrollData] = useState(false)
  const [savingPayroll, setSavingPayroll] = useState(false)
  const [payrollError, setPayrollError] = useState('')
  const [staffFilter, setStaffFilter] = useState('')
  const [rowAction, setRowAction] = useState<{ userId: string; type: RowActionType } | null>(null)
  const [rowActionError, setRowActionError] = useState('')
  const noStaffLevelsAvailable = !loadingStaffLevels && staffLevels.length === 0
  const staffToggleDisabled = loadingStaffLevels || noStaffLevelsAvailable

  const memberInviteLink = useMemo(() => {
    if (memberInvite.url) return memberInvite.url
    if (memberInvite.token && typeof window !== 'undefined') {
      return `${window.location.origin}/invite/${memberInvite.token}`
    }
    return ''
  }, [memberInvite.token, memberInvite.url])

  const canSaveManual = useMemo(() => {
    if (
      !manualForm.firstName.trim() ||
      !manualForm.lastName.trim() ||
      !manualForm.email.trim() ||
      !manualForm.password.trim()
    ) {
      return false
    }

    if (manualForm.isStaff) {
      if (!manualForm.staffLevelId) return false
      if (
        manualForm.useCustomWage &&
        (!manualForm.customWageAmount ||
          Number(manualForm.customWageAmount) <= 0 ||
          !manualForm.customWageCurrency.trim())
      ) {
        return false
      }
    }

    return true
  }, [manualForm])

  const branchesByParent = useMemo(() => {
    const map: Record<string, BranchOption[]> = {}
    branches.forEach((branch) => {
      const key = branch.parentBranchId ?? 'ROOT'
      if (!map[key]) map[key] = []
      map[key].push(branch)
    })
    return map
  }, [branches])

  const determineDeepestSelection = useCallback(
    (selections: Record<string, string>) => {
      let final = ''
      for (const level of hierarchyLevels) {
        const value = selections[level.key]
        if (value) {
          final = value
        } else {
          break
        }
      }
      return final
    },
    [hierarchyLevels]
  )

  const handleLevelSelection = useCallback(
    (levelKey: string, value: string) => {
      setInviteLevelSelections((prev) => {
        const next = { ...prev, [levelKey]: value }
        const levelIndex = hierarchyLevels.findIndex((level) => level.key === levelKey)
        if (levelIndex !== -1) {
          for (let i = levelIndex + 1; i < hierarchyLevels.length; i += 1) {
            delete next[hierarchyLevels[i].key]
          }
        }
        const deepest = determineDeepestSelection(next)
        setInviteBranchId(deepest)
        return next
      })
    },
    [determineDeepestSelection, hierarchyLevels]
  )

  const getLevelOptions = useCallback(
    (levelIndex: number): BranchOption[] => {
      const level = hierarchyLevels[levelIndex]
      if (!level) return []
      const parentKey =
        levelIndex === 0
          ? 'ROOT'
          : inviteLevelSelections[hierarchyLevels[levelIndex - 1].key] ?? 'ROOT'
      const normalizedParentKey = parentKey || 'ROOT'
      return (branchesByParent[normalizedParentKey] || []).filter(
        (branch) => branch.level === level.key
      )
    },
    [branchesByParent, hierarchyLevels, inviteLevelSelections]
  )

  const selectedInviteBranch = useMemo(
    () => branches.find((branch) => branch.id === inviteBranchId) ?? null,
    [branches, inviteBranchId]
  )

  const fetchMemberInvite = useCallback(async (branchId?: string | null) => {
    setMemberInvite((prev) => ({ ...prev, loading: true, error: '' }))
    try {
      const params = new URLSearchParams({ purpose: 'MEMBER_SIGNUP' })
      if (branchId !== undefined) {
        params.set('branchId', branchId ?? '')
      }
      const res = await fetch(`/api/church-invites?${params.toString()}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to load invite')
      }
      setMemberInvite((prev) => ({
        ...prev,
        invite: data.invite ?? null,
        token: '',
        url: '',
      }))
    } catch (error: any) {
      setMemberInvite((prev) => ({
        ...prev,
        invite: null,
        error: error?.message || 'Failed to load invite',
      }))
    } finally {
      setMemberInvite((prev) => ({ ...prev, loading: false }))
    }
  }, [])

  const openAdd = () => {
    setAddError('')
    setAddTab('manual')
    setAddOpen(true)
  }

  const loadDesignations = useCallback(async () => {
    setIsLoadingDesignations(true)
    try {
      const response = await fetch('/api/designations')
      if (!response.ok) throw new Error('Failed to load designations')
      const data = await response.json()
      setDesignations(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error loading designations:', error)
      setDesignations([])
    } finally {
      setIsLoadingDesignations(false)
    }
  }, [])

  useEffect(() => {
    loadDesignations()
  }, [loadDesignations])

  const loadStaffLevels = useCallback(async () => {
    setLoadingStaffLevels(true)
    try {
      const response = await fetch('/api/staff-levels')
      if (!response.ok) throw new Error('Failed to load staff levels')
      const data = await response.json()
      setStaffLevels(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error loading staff levels:', error)
      setStaffLevels([])
    } finally {
      setLoadingStaffLevels(false)
    }
  }, [])

  useEffect(() => {
    loadStaffLevels()
  }, [loadStaffLevels])

  const resetDesignationForm = () => {
    setDesignationForm({
      name: '',
      description: '',
      category: 'Leader',
    })
  }

  const openDesignationModal = () => {
    setDesignationError('')
    resetDesignationForm()
    setDesignationModalOpen(true)
  }

  const handleSaveDesignation = async () => {
    if (!designationForm.name.trim()) {
      setDesignationError('Designation name is required.')
      return
    }
    setSavingDesignation(true)
    setDesignationError('')
    try {
      const res = await fetch('/api/designations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: designationForm.name.trim(),
          description: designationForm.description?.trim() || undefined,
          category: designationForm.category,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Failed to create designation')
      await loadDesignations()
      setDesignationModalOpen(false)
    } catch (error: any) {
      setDesignationError(error?.message || 'Unable to create designation.')
    } finally {
      setSavingDesignation(false)
    }
  }

  const createManual = async () => {
    setSavingManual(true)
    setAddError('')
    try {
      const payload: Record<string, any> = {
        firstName: manualForm.firstName,
        lastName: manualForm.lastName,
        email: manualForm.email,
        password: manualForm.password,
        phone: manualForm.phone || undefined,
        role: manualForm.role,
        designationId: manualForm.designationId || undefined,
        isStaff: manualForm.isStaff,
      }

      if (manualForm.isStaff) {
        if (!manualForm.staffLevelId) {
          throw new Error('Select a staff level for staff members.')
        }
        payload.staffLevelId = manualForm.staffLevelId

        if (manualForm.useCustomWage) {
          const amountValue = Number(manualForm.customWageAmount)
          if (!Number.isFinite(amountValue) || amountValue <= 0) {
            throw new Error('Enter a valid custom wage amount greater than 0.')
          }
          payload.customWage = {
            amount: amountValue,
            currency: manualForm.customWageCurrency.trim().toUpperCase(),
            payFrequency: manualForm.customWagePayFrequency,
          }
        }
      } else {
        payload.staffLevelId = undefined
        payload.customWage = undefined
      }

      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Failed to create user')

      setManualForm(getDefaultManualForm())
      await loadUsers()
      setAddOpen(false)
    } catch (e: any) {
      setAddError(e?.message || 'Failed to create user')
    } finally {
      setSavingManual(false)
    }
  }

  const handleCreateMemberInvite = useCallback(async () => {
    setAddError('')
    setMemberInvite((prev) => ({ ...prev, submitting: true }))
    try {
      const res = await fetch('/api/church-invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purpose: 'MEMBER_SIGNUP',
          branchId: inviteBranchId || null,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to create invite')
      }
      setMemberInvite((prev) => ({
        ...prev,
        invite: data.invite ?? null,
        token: data.token || '',
        url: data.url || '',
      }))
    } catch (error: any) {
      setAddError(error?.message || 'Failed to create invite')
    } finally {
      setMemberInvite((prev) => ({ ...prev, submitting: false }))
    }
  }, [inviteBranchId])

  const handleRevokeMemberInvite = useCallback(async () => {
    if (!memberInvite.invite?.id) return
    setAddError('')
    setMemberInvite((prev) => ({ ...prev, submitting: true }))
    try {
      const res = await fetch(`/api/church-invites/${memberInvite.invite.id}/revoke`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to revoke invite')
      }
      await fetchMemberInvite(undefined)
    } catch (error: any) {
      setAddError(error?.message || 'Failed to revoke invite')
    } finally {
      setMemberInvite((prev) => ({ ...prev, submitting: false }))
    }
  }, [fetchMemberInvite, memberInvite.invite?.id])

  useEffect(() => {
    if (!addOpen || addTab !== 'invite') return
    setInviteBranchId('')
    setInviteLevelSelections({})
  }, [addOpen, addTab])

  useEffect(() => {
    if (!addOpen || addTab !== 'invite') return
    fetchMemberInvite(inviteBranchId || undefined)
  }, [addOpen, addTab, inviteBranchId, fetchMemberInvite])

  const loadHierarchy = useCallback(async (churchId: string) => {
    try {
      const res = await fetch(`/api/churches/${churchId}`)
      if (!res.ok) {
        throw new Error('Unable to load church configuration')
      }
      const data = await res.json()
      const normalizedLevels = getHierarchyLevels(data)
      setHierarchyLevels(normalizedLevels)
      setLevelLabels(getHierarchyLevelLabels(data))
    } catch (error) {
      console.error('Error loading hierarchy:', error)
      setHierarchyLevels([])
      setLevelLabels({})
    }
  }, [])

  const loadBranches = useCallback(async () => {
    try {
      const userRes = await fetch('/api/users/me')
      const userData = await userRes.json()
      
      if (userData.churchId) {
        setCurrentBranchId(userData.branchId || null)

        await loadHierarchy(userData.churchId)

        const res = await fetch(`/api/churches/${userData.churchId}/branches`)
        if (res.ok) {
          const data = await res.json()
          setBranches(data)
        }
      }
    } catch (error) {
      console.error('Error loading branches:', error)
    }
  }, [loadHierarchy])

  const roleCategoryFor = useCallback((role: string): RoleCategory => {
    const normalized = role?.toUpperCase()
    if (['ADMIN', 'BRANCH_ADMIN', 'SUPER_ADMIN'].includes(normalized)) return 'Admin'
    if (['PASTOR', 'LEADER', 'ASSISTANT_PASTOR', 'ASSOCIATE_PASTOR', 'SENIOR_PASTOR', 'RESIDENT_PASTOR', 'LEAD_PASTOR'].includes(normalized))
      return 'Leader'
    return 'Worker'
  }, [])

  const loadUsers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      })
      if (search) params.append('search', search)
      if (roleFilter) params.append('role', roleFilter)
      if (branchFilter) params.append('branchId', branchFilter)
      if (designationFilter) params.append('designationId', designationFilter)
      if (staffFilter) params.append('isStaff', staffFilter)
      if (roleCategoryFilter) {
        const categoryRoles: Record<RoleCategory, string[]> = {
          Admin: ['ADMIN', 'BRANCH_ADMIN', 'SUPER_ADMIN'],
          Leader: ['PASTOR', 'LEADER'],
          Worker: ['MEMBER', 'VISITOR', 'VOLUNTEER'],
        }
        params.append('roles', categoryRoles[roleCategoryFilter].join(','))
      }

      const response = await fetch(`/api/users?${params}`)
      if (!response.ok) {
        throw new Error('Failed to load users')
      }
      const data = await response.json()
      setUsers(data.users as User[])
      setPagination(data.pagination)
    } catch (error) {
      console.error('Error loading users:', error)
    } finally {
      setLoading(false)
    }
  }, [branchFilter, designationFilter, pagination.limit, pagination.page, roleFilter, roleCategoryFilter, roleCategoryFor, search, staffFilter])

  useEffect(() => {
    loadBranches()
  }, [loadBranches])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  useEffect(() => {
    if (!assignPayrollUser || assignForm.positionId) return
    if (payrollPositions.length > 0) {
      setAssignForm((prev) => ({ ...prev, positionId: payrollPositions[0].id }))
    }
  }, [assignForm.positionId, assignPayrollUser, payrollPositions])

  const openAssignPayroll = useCallback(
    async (user: User) => {
      setAssignPayrollUser(user)
      setAssignForm(getDefaultAssignPayrollForm())
      setPayrollError('')
      setLoadingPayrollData(true)
      try {
        const res = await fetch('/api/payroll/positions')
        if (!res.ok) throw new Error('Unable to load payroll positions')
        const data = await res.json()
        setPayrollPositions(Array.isArray(data) ? data : [])
      } catch (error: any) {
        setPayrollError(error?.message || 'Failed to load payroll positions')
        setPayrollPositions([])
      } finally {
        setLoadingPayrollData(false)
      }
    },
    []
  )

  const closeAssignPayroll = () => {
    setAssignPayrollUser(null)
    setPayrollPositions([])
    setAssignForm(getDefaultAssignPayrollForm())
    setPayrollError('')
  }

  const handleAssignPayroll = async () => {
    if (!assignPayrollUser) return
    if (!assignForm.positionId || !assignForm.amount) {
      setPayrollError('Position and amount are required.')
      return
    }

    const amountValue = Number(assignForm.amount)
    if (Number.isNaN(amountValue) || amountValue <= 0) {
      setPayrollError('Enter a valid amount greater than 0.')
      return
    }

    setSavingPayroll(true)
    setPayrollError('')
    try {
      const wageScaleRes = await fetch('/api/payroll/wage-scales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          positionId: assignForm.positionId,
          type: 'SALARY',
          amount: amountValue,
          currency: assignForm.currency,
          payFrequency: assignForm.payFrequency,
          effectiveFrom: assignForm.startDate,
        }),
      })
      const wageScaleData = await wageScaleRes.json().catch(() => ({}))
      if (!wageScaleRes.ok) {
        throw new Error(wageScaleData?.error || 'Failed to configure wage scale')
      }

      const salaryRes = await fetch('/api/payroll/salaries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: assignPayrollUser.id,
          positionId: assignForm.positionId,
          wageScaleId: wageScaleData.id,
          startDate: assignForm.startDate,
        }),
      })
      const salaryData = await salaryRes.json().catch(() => ({}))
      if (!salaryRes.ok) {
        throw new Error(salaryData?.error || 'Failed to assign salary')
      }

      await loadUsers()
      closeAssignPayroll()
    } catch (error: any) {
      setPayrollError(error?.message || 'Unable to save payroll assignment.')
    } finally {
      setSavingPayroll(false)
    }
  }

  const handleUpdateDesignation = async (userId: string, nextDesignationId: string) => {
    setRowActionError('')
    setRowAction({ userId, type: 'designation' })
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          designationId: nextDesignationId || null,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to update designation')
      }
      await loadUsers()
    } catch (error: any) {
      setRowActionError(error?.message || 'Unable to update designation.')
    } finally {
      setRowAction(null)
    }
  }

  const handleToggleSuspension = async (user: User) => {
    setRowActionError('')
    setRowAction({ userId: user.id, type: 'suspend' })
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isSuspended: !user.isSuspended,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to update user status')
      }
      await loadUsers()
    } catch (error: any) {
      setRowActionError(error?.message || 'Unable to update user status.')
    } finally {
      setRowAction(null)
    }
  }

  const handleDeleteUser = async (user: User) => {
    const confirmed = window.confirm(`Delete ${user.firstName} ${user.lastName}? This cannot be undone.`)
    if (!confirmed) {
      return
    }
    setRowActionError('')
    setRowAction({ userId: user.id, type: 'delete' })
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'DELETE',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to delete user')
      }
      await loadUsers()
    } catch (error: any) {
      setRowActionError(error?.message || 'Unable to delete user.')
    } finally {
      setRowAction(null)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPagination({ ...pagination, page: 1 })
  }

  return (
    <>
      <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-3xl font-bold">Member Directory</h1>
        <button
          type="button"
          onClick={openAdd}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          Add Members
        </button>
      </div>

      <div className="mb-6 rounded-2xl border border-gray-200 bg-white/90 p-5 text-sm text-gray-600">
        <p>
          Role titles, designation buckets, and staff levels are centralized in{' '}
          <Link href="/settings/roles" className="font-semibold text-primary-600 hover:text-primary-700">
            Settings → Roles &amp; designations
          </Link>
          . Update them there once and the directory, payroll, and invites stay consistent.
        </p>
        <p className="mt-2">
          Need to rename dioceses, regions, or zones for branch filters? Adjust your hierarchy labels under{' '}
          <Link href="/settings/hierarchy" className="font-semibold text-primary-600 hover:text-primary-700">
            Settings → Hierarchy levels
          </Link>
          .
        </p>
      </div>

      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl bg-white rounded-xl shadow-xl overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <div className="text-lg font-semibold">Add Members</div>
              <button
                type="button"
                onClick={() => setAddOpen(false)}
                className="px-3 py-1 rounded-lg bg-gray-100 hover:bg-gray-200"
              >
                Close
              </button>
            </div>

            <div className="p-5">
              {addError && (
                <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">
                  {addError}
                </div>
              )}

              <div className="flex gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => setAddTab('manual')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium ${addTab === 'manual' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`}
                >
                  Manual
                </button>
                <button
                  type="button"
                  onClick={() => setAddTab('invite')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium ${addTab === 'invite' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`}
                >
                  Invite Link
                </button>
              </div>

              {addTab === 'manual' ? (
                <div className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-3">
                    <input
                      value={manualForm.firstName}
                      onChange={(e) => setManualForm((p) => ({ ...p, firstName: e.target.value }))}
                      placeholder="First name"
                      className="px-3 py-2 border border-gray-300 rounded-lg"
                    />
                    <input
                      value={manualForm.lastName}
                      onChange={(e) => setManualForm((p) => ({ ...p, lastName: e.target.value }))}
                      placeholder="Last name"
                      className="px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div className="grid md:grid-cols-2 gap-3">
                    <input
                      type="email"
                      value={manualForm.email}
                      onChange={(e) => setManualForm((p) => ({ ...p, email: e.target.value }))}
                      placeholder="Email"
                      className="px-3 py-2 border border-gray-300 rounded-lg"
                    />
                    <input
                      value={manualForm.phone}
                      onChange={(e) => setManualForm((p) => ({ ...p, phone: e.target.value }))}
                      placeholder="Phone (optional)"
                      className="px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div className="grid md:grid-cols-2 gap-3">
                    <input
                      type="password"
                      value={manualForm.password}
                      onChange={(e) => setManualForm((p) => ({ ...p, password: e.target.value }))}
                      placeholder="Temporary password"
                      className="px-3 py-2 border border-gray-300 rounded-lg"
                    />
                    <select
                      value={manualForm.role}
                      onChange={(e) => setManualForm((p) => ({ ...p, role: e.target.value }))}
                      className="px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="MEMBER">Member</option>
                      <option value="LEADER">Leader</option>
                      <option value="PASTOR">Pastor</option>
                      <option value="ADMIN">Admin</option>
                      <option value="BRANCH_ADMIN">Branch Admin</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm text-gray-600 flex flex-col gap-1">
                      Designation (optional)
                      <select
                        value={manualForm.designationId}
                        onChange={(e) => setManualForm((p) => ({ ...p, designationId: e.target.value }))}
                        className="px-3 py-2 border border-gray-300 rounded-lg"
                      >
                        <option value="">{isLoadingDesignations ? 'Loading…' : 'Select designation'}</option>
                        {designations.map((designation) => (
                          <option key={designation.id} value={designation.id}>
                            {designation.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      onClick={openDesignationModal}
                      className="mt-2 text-xs text-primary-600 font-semibold hover:underline"
                    >
                      + Manage designations
                    </button>
                  </div>

                  <div className="rounded-xl border border-gray-200 p-4 space-y-4 bg-gray-50/60">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">Staff assignment</p>
                        <p className="text-xs text-gray-500">
                          Tag this member as staff to include them in payroll automatically.
                        </p>
                      </div>
                      <label className={`flex items-center gap-2 text-sm font-medium text-gray-700 ${staffToggleDisabled ? 'opacity-60 cursor-not-allowed' : ''}`}>
                        <input
                          type="checkbox"
                          checked={manualForm.isStaff}
                          disabled={staffToggleDisabled}
                          onChange={(e) =>
                            setManualForm((prev) => {
                              const next = {
                                ...prev,
                                isStaff: e.target.checked,
                              }
                              if (!e.target.checked) {
                                next.staffLevelId = ''
                                next.useCustomWage = false
                                next.customWageAmount = ''
                                next.customWageCurrency = 'NGN'
                                next.customWagePayFrequency = 'monthly'
                              }
                              return next
                            })
                          }
                          className="h-4 w-4 text-primary-600 border-gray-300 rounded"
                        />
                        Mark as staff
                      </label>
                    </div>

                    {staffToggleDisabled && (
                      <p className="text-xs text-amber-600">
                        {loadingStaffLevels
                          ? 'Loading staff levels...'
                          : 'Create staff levels in Settings → Roles & Designations before assigning staff.'}
                      </p>
                    )}

                    {manualForm.isStaff ? (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-semibold text-gray-600 mb-1">
                            Staff level
                          </label>
                          <select
                            value={manualForm.staffLevelId}
                            onChange={(e) => setManualForm((prev) => ({ ...prev, staffLevelId: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                            disabled={loadingStaffLevels || staffLevels.length === 0}
                          >
                            <option value="">
                              {loadingStaffLevels
                                ? 'Loading staff levels…'
                                : staffLevels.length === 0
                                ? 'No staff levels configured'
                                : 'Select staff level'}
                            </option>
                            {staffLevels.map((level) => (
                              <option key={level.id} value={level.id}>
                                {level.name}
                              </option>
                            ))}
                          </select>
                          {!loadingStaffLevels && staffLevels.length === 0 && (
                            <p className="mt-1 text-xs text-amber-600">
                              Create staff levels in <strong>Settings → Roles & Designations</strong>.
                            </p>
                          )}
                        </div>

                        <div className="rounded-lg border border-gray-100 bg-white p-3 space-y-3">
                          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                            <input
                              type="checkbox"
                              checked={manualForm.useCustomWage}
                              onChange={(e) =>
                                setManualForm((prev) => ({
                                  ...prev,
                                  useCustomWage: e.target.checked,
                                  customWageAmount: e.target.checked ? prev.customWageAmount : '',
                                }))
                              }
                              className="h-4 w-4 text-primary-600 border-gray-300 rounded"
                            />
                            Override default wage
                          </label>
                          {manualForm.useCustomWage ? (
                            <div className="grid gap-3 md:grid-cols-3">
                              <label className="text-xs font-semibold text-gray-600 flex flex-col gap-1">
                                Amount
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={manualForm.customWageAmount}
                                  onChange={(e) =>
                                    setManualForm((prev) => ({ ...prev, customWageAmount: e.target.value }))
                                  }
                                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                />
                              </label>
                              <label className="text-xs font-semibold text-gray-600 flex flex-col gap-1">
                                Currency
                                <input
                                  type="text"
                                  maxLength={3}
                                  value={manualForm.customWageCurrency}
                                  onChange={(e) =>
                                    setManualForm((prev) => ({
                                      ...prev,
                                      customWageCurrency: e.target.value.toUpperCase(),
                                    }))
                                  }
                                  className="px-3 py-2 border border-gray-300 rounded-lg uppercase focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                />
                              </label>
                              <label className="text-xs font-semibold text-gray-600 flex flex-col gap-1">
                                Pay frequency
                                <select
                                  value={manualForm.customWagePayFrequency}
                                  onChange={(e) =>
                                    setManualForm((prev) => ({
                                      ...prev,
                                      customWagePayFrequency: e.target.value as PayFrequencyOption,
                                    }))
                                  }
                                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                >
                                  {PAY_FREQUENCY_OPTIONS.map((frequency) => (
                                    <option key={frequency} value={frequency}>
                                      {frequency === 'biweekly'
                                        ? 'Bi-weekly'
                                        : frequency.charAt(0).toUpperCase() + frequency.slice(1)}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            </div>
                          ) : (
                            <p className="text-xs text-gray-500">
                              Default wage from the selected staff level will be applied.
                            </p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500">
                        Leave unchecked for regular members. You can promote them to staff later.
                      </p>
                    )}
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={createManual}
                      disabled={savingManual || !canSaveManual}
                      className="px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50"
                    >
                      {savingManual ? 'Saving...' : 'Create Member'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-sm text-gray-700">
                    Create a link members can use to sign up and join your church. You can revoke it anytime.
                  </div>

                  <div className="space-y-4 rounded-lg border border-gray-200 p-4 bg-gray-50">
                    <div className="text-xs font-semibold text-gray-500 uppercase">Choose branch destination</div>
                    {hierarchyLevels.length === 0 && (
                      <div className="text-sm text-gray-500">Loading hierarchy configuration…</div>
                    )}
                    {hierarchyLevels.length > 0 && (
                      <div className="space-y-3">
                        {hierarchyLevels.map((level, index) => {
                          const options = getLevelOptions(index)
                          const label = levelLabels[level.key] ?? level.label ?? `Level ${index + 1}`
                          if (options.length === 0) {
                            if (index === 0) {
                              return (
                                <div key={level.key} className="text-sm text-gray-500">
                                  No {label} branches found. Create branches first before generating branch-specific invites.
                                </div>
                              )
                            }
                            return null
                          }
                          return (
                            <div key={level.key} className="space-y-1">
                              <label className="text-xs font-semibold text-gray-600">{label}</label>
                              <select
                                value={inviteLevelSelections[level.key] ?? ''}
                                onChange={(e) => handleLevelSelection(level.key, e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
                              >
                                <option value="">Select {label}</option>
                                {options.map((option) => (
                                  <option key={option.id} value={option.id}>
                                    {option.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )
                        })}
                      </div>
                    )}
                    <div className="text-xs text-gray-500">
                      {inviteBranchId
                        ? `Members will be added directly to ${selectedInviteBranch?.name ?? 'the selected branch'}.`
                        : 'Leave selections blank to allow members to choose their branch during signup.'}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleCreateMemberInvite}
                      disabled={memberInvite.submitting}
                      className="px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50"
                    >
                      {memberInvite.submitting ? 'Generating…' : 'Generate Link'}
                    </button>
                    <button
                      type="button"
                      onClick={() => fetchMemberInvite(inviteBranchId || undefined)}
                      disabled={memberInvite.loading}
                      className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      {memberInvite.loading ? 'Refreshing…' : 'Refresh link'}
                    </button>
                    {memberInvite.invite?.id && (
                      <button
                        type="button"
                        onClick={handleRevokeMemberInvite}
                        disabled={memberInvite.submitting}
                        className="px-4 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        Revoke link
                      </button>
                    )}
                  </div>

                  {memberInvite.error && (
                    <div className="text-sm text-red-600 bg-red-100 border border-red-200 rounded-lg p-2">
                      {memberInvite.error}
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="text-xs text-gray-500">Share this link</div>
                    <div className="flex gap-2">
                      <input
                        readOnly
                        value={memberInviteLink || 'Generate a link to copy'}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      />
                      <button
                        type="button"
                        onClick={async () => {
                          if (!memberInviteLink) return
                          await navigator.clipboard.writeText(memberInviteLink)
                        }}
                        disabled={!memberInviteLink}
                        className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-sm disabled:opacity-50"
                      >
                        Copy
                      </button>
                    </div>
                    {!memberInvite.invite && (
                      <div className="text-sm text-gray-500">No active invite link.</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <form onSubmit={handleSearch} className="flex gap-4 flex-wrap items-center">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="flex-1 min-w-[200px] px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-gray-900"
            style={{ color: '#111827', WebkitTextFillColor: '#111827' }}
          />
          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value)
              setPagination({ ...pagination, page: 1 })
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="">All Roles</option>
            <option value="VISITOR">Visitor</option>
            <option value="MEMBER">Member</option>
            <option value="LEADER">Leader</option>
            <option value="PASTOR">Pastor</option>
            <option value="ADMIN">Admin</option>
            <option value="BRANCH_ADMIN">Branch Admin</option>
          </select>
          <select
            value={staffFilter}
            onChange={(e) => {
              setStaffFilter(e.target.value)
              setPagination({ ...pagination, page: 1 })
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="">All members</option>
            <option value="true">Staff</option>
            <option value="false">Non-staff</option>
          </select>
          {branches.length > 0 && (
            <select
              value={branchFilter}
              onChange={(e) => {
                setBranchFilter(e.target.value)
                setPagination({ ...pagination, page: 1 })
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="">All Branches</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          )}
          {designations.length > 0 && (
            <select
              value={designationFilter}
              onChange={(e) => {
                setDesignationFilter(e.target.value)
                setPagination({ ...pagination, page: 1 })
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="">All designations</option>
              {designations.map((designation) => (
                <option key={designation.id} value={designation.id}>
                  {designation.name}
                </option>
              ))}
            </select>
          )}
          <div className="flex flex-wrap gap-2">
            {(['Worker', 'Leader', 'Admin'] as RoleCategory[]).map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => {
                  setRoleCategoryFilter((prev) => (prev === category ? '' : category))
                  setPagination({ ...pagination, page: 1 })
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium border ${
                  roleCategoryFilter === category
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={openDesignationModal}
            className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
            disabled={isLoadingDesignations}
          >
            {isLoadingDesignations ? 'Loading…' : 'Manage designations'}
          </button>
          <button
            type="submit"
            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Search
          </button>
        </form>
      </div>

      {/* Users List */}
      {rowActionError && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {rowActionError}
        </div>
      )}
      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : users.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-600">No users found</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Member
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role & Category
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Designation
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Level
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Joined
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            {user.profileImage ? (
                              <img
                                className="h-10 w-10 rounded-full"
                                src={user.profileImage}
                                alt={`${user.firstName} ${user.lastName}`}
                              />
                            ) : (
                              <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                                <span className="text-primary-600 font-medium">
                                  {user.firstName[0]}{user.lastName[0]}
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {user.firstName} {user.lastName}
                            </div>
                            <div className="text-sm text-gray-500">
                              {user.email}
                            </div>
                            {user.isSuspended && (
                              <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-600">
                                Suspended
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-primary-100 text-primary-800">
                            {user.role}
                          </span>
                          <span className="px-2 py-1 inline-flex text-xs leading-5 font-medium rounded-full bg-gray-100 text-gray-700">
                            {roleCategoryFor(user.role)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {designations.length === 0 ? (
                          <span className="text-gray-500 text-xs">
                            Configure designations in Settings → Roles first
                          </span>
                        ) : (
                          <div className="space-y-1">
                            <select
                              value={user.designationId ?? ''}
                              onChange={(e) => handleUpdateDesignation(user.id, e.target.value)}
                              disabled={rowAction?.userId === user.id && rowAction.type === 'designation'}
                              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                            >
                              <option value="">Unassigned</option>
                              {designations.map((designation) => (
                                <option key={designation.id} value={designation.id}>
                                  {designation.name}
                                </option>
                              ))}
                            </select>
                            {rowAction?.userId === user.id && rowAction.type === 'designation' && (
                              <p className="text-xs text-gray-500">Saving designation…</p>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="space-y-2">
                          <div className="flex flex-col gap-1">
                            {user.isStaff ? (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary-700 bg-primary-50 px-2 py-1 rounded-full">
                                Staff
                                {user.staffLevelName && (
                                  <span className="text-primary-500">· {user.staffLevelName}</span>
                                )}
                              </span>
                            ) : (
                              <span className="inline-flex items-center text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                                Non-staff
                              </span>
                            )}
                            {user.isStaff && (
                              <p className="text-xs text-gray-500">
                                {user.customWage
                                  ? `${formatCurrency(user.customWage.amount, user.customWage.currency)} · ${formatPayFrequencyLabel(user.customWage.payFrequency)}`
                                  : 'Uses staff level wage'}
                              </p>
                            )}
                          </div>
                          <div>
                            <div className="text-sm text-gray-900">Level {user.level}</div>
                            <div className="text-xs text-gray-500">
                              {user.xp.toLocaleString()} XP
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(user.createdAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <Link
                            href={`/users/${user.id}`}
                            className="text-primary-600 hover:text-primary-900"
                          >
                            View
                          </Link>
                          <button
                            type="button"
                            onClick={() => handleToggleSuspension(user)}
                            disabled={rowAction?.userId === user.id && rowAction.type === 'suspend'}
                            className="inline-flex items-center rounded-full border border-amber-200 px-3 py-1 text-xs font-semibold text-amber-600 hover:bg-amber-50 disabled:opacity-50"
                          >
                            {rowAction?.userId === user.id && rowAction.type === 'suspend'
                              ? 'Updating…'
                              : user.isSuspended
                              ? 'Activate'
                              : 'Suspend'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteUser(user)}
                            disabled={rowAction?.userId === user.id && rowAction.type === 'delete'}
                            className="inline-flex items-center rounded-full border border-red-200 px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                          >
                            {rowAction?.userId === user.id && rowAction.type === 'delete' ? 'Deleting…' : 'Delete'}
                          </button>
                          {user.isStaff && (
                            <button
                              type="button"
                              onClick={() => openAssignPayroll(user)}
                              className="inline-flex items-center rounded-full border border-primary-200 px-3 py-1 text-xs font-semibold text-primary-600 hover:bg-primary-50 disabled:opacity-50"
                            >
                              Assign to payroll
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="mt-6 flex justify-center gap-2">
              <button
                onClick={() =>
                  setPagination({ ...pagination, page: pagination.page - 1 })
                }
                disabled={pagination.page === 1}
                className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Previous
              </button>
              <span className="px-4 py-2">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                onClick={() =>
                  setPagination({ ...pagination, page: pagination.page + 1 })
                }
                disabled={pagination.page >= pagination.totalPages}
                className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>

      {assignPayrollUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-500">
                  Payroll assignment
                </p>
                <h3 className="text-lg font-semibold text-gray-900">
                  Assign {assignPayrollUser.firstName} {assignPayrollUser.lastName} to payroll
                </h3>
                <p className="text-sm text-gray-500">
                  Configure their payout structure so they appear in payroll runs.
                </p>
              </div>
              <button
                type="button"
                onClick={closeAssignPayroll}
                className="rounded-full border border-gray-200 px-3 py-1 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Close
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-600">
                <div className="font-semibold text-gray-800">Current status</div>
                <p>
                  Role: <span className="font-medium">{assignPayrollUser.role}</span> · Level{' '}
                  {assignPayrollUser.level} · XP {assignPayrollUser.xp.toLocaleString()}
                </p>
              </div>

              {payrollError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {payrollError}
                </div>
              )}

              {loadingPayrollData ? (
                <div className="py-10 text-center text-sm text-gray-500">Loading positions…</div>
              ) : payrollPositions.length === 0 ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
                  No payroll positions found. Create at least one position before assigning staff.{' '}
                  <Link href="/dashboard/payroll/positions" className="font-semibold underline">
                    Manage positions
                  </Link>
                </div>
              ) : (
                <form
                  className="space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault()
                    handleAssignPayroll()
                  }}
                >
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-700">Position *</label>
                    <select
                      value={assignForm.positionId}
                      onChange={(e) => setAssignForm((prev) => ({ ...prev, positionId: e.target.value }))}
                      className="rounded-lg border border-gray-300 px-4 py-2 focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
                      required
                    >
                      {payrollPositions.map((position) => (
                        <option key={position.id} value={position.id}>
                          {position.name}
                          {position.department ? ` · ${position.department.name}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="flex flex-col gap-1">
                      <label className="text-sm font-medium text-gray-700">Amount *</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={assignForm.amount}
                        onChange={(e) => setAssignForm((prev) => ({ ...prev, amount: e.target.value }))}
                        placeholder="0.00"
                        className="rounded-lg border border-gray-300 px-4 py-2 focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-sm font-medium text-gray-700">Currency *</label>
                      <select
                        value={assignForm.currency}
                        onChange={(e) => setAssignForm((prev) => ({ ...prev, currency: e.target.value }))}
                        className="rounded-lg border border-gray-300 px-4 py-2 focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
                      >
                        {CURRENCY_OPTIONS.map((currency) => (
                          <option key={currency} value={currency}>
                            {currency}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="flex flex-col gap-1">
                      <label className="text-sm font-medium text-gray-700">Pay frequency *</label>
                      <select
                        value={assignForm.payFrequency}
                        onChange={(e) =>
                          setAssignForm((prev) => ({ ...prev, payFrequency: e.target.value as PayFrequencyOption }))
                        }
                        className="rounded-lg border border-gray-300 px-4 py-2 focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
                      >
                        {PAY_FREQUENCY_OPTIONS.map((frequency) => (
                          <option key={frequency} value={frequency}>
                            {frequency.replace(/^\w/, (c) => c.toUpperCase())}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-sm font-medium text-gray-700">Effective start *</label>
                      <input
                        type="date"
                        value={assignForm.startDate}
                        onChange={(e) => setAssignForm((prev) => ({ ...prev, startDate: e.target.value }))}
                        className="rounded-lg border border-gray-300 px-4 py-2 focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
                        required
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={closeAssignPayroll}
                      className="rounded-full border border-gray-300 px-5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
                      disabled={savingPayroll}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={savingPayroll}
                      className="rounded-full bg-primary-600 px-6 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
                    >
                      {savingPayroll ? 'Assigning…' : 'Assign to payroll'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
