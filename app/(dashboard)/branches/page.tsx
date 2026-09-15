'use client'

import Link from 'next/link'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSession } from 'next-auth/react'

import CreateBranchModal, {
  type BranchCreationContext as ModalBranchCreationContext,
  type BranchLevel as ModalBranchLevel,
} from '@/components/branches/CreateBranchModal'
import BranchAdminModal from '@/components/branches/BranchAdminModal'

type BranchLevel = ModalBranchLevel

type HierarchyLevelDefinition = {
  key: BranchLevel
  label: string
  order?: number
}

function SkeletonNode() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <div className="h-5 w-48 bg-slate-200 rounded" />
            <div className="h-4 w-32 bg-slate-100 rounded" />
          </div>
          <div className="flex gap-2">
            <div className="h-9 w-28 bg-slate-100 rounded-xl" />
            <div className="h-9 w-32 bg-slate-200 rounded-xl" />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3 mt-5">
          {[1, 2, 3].map((col) => (
            <div key={col} className="rounded-xl bg-slate-50 p-4 space-y-2">
              <div className="h-3 w-20 bg-slate-200 rounded" />
              <div className="h-6 w-24 bg-slate-300 rounded" />
              <div className="h-3 w-32 bg-slate-200 rounded" />
            </div>
          ))}
        </div>
      </div>
      <div className="pl-6 md:pl-10 border-l border-dashed border-gray-200 space-y-4">
        <div className="h-20 bg-white border border-gray-100 rounded-2xl" />
      </div>
    </div>
  )
}

type HierarchyLevelInput = {
  key?: string
  label?: string
  order?: number
}

const DEFAULT_LEVEL_DEFINITIONS: HierarchyLevelDefinition[] = [
  { key: 'LEVEL_1', label: 'Global Headquarters', order: 0 },
  { key: 'LEVEL_2', label: 'Level 2', order: 1 },
  { key: 'LEVEL_3', label: 'Level 3', order: 2 },
  { key: 'LEVEL_4', label: 'Level 4', order: 3 },
]

const normalizeLevelDefinitions = (
  levels?: HierarchyLevelInput[]
): HierarchyLevelDefinition[] => {
  if (!Array.isArray(levels) || levels.length === 0) {
    return DEFAULT_LEVEL_DEFINITIONS
  }

  const sanitized = levels
    .map((level, index) => {
      const key = typeof level.key === 'string' ? level.key.trim().toUpperCase() : ''
      const label = typeof level.label === 'string' ? level.label.trim() : ''
      return {
        key: key || `LEVEL_${index + 1}`,
        label: label || `Level ${index + 1}`,
        order: typeof level.order === 'number' ? level.order : index,
      }
    })
    .filter((level) => level.key.length > 0 && level.label.length > 0)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

  const unique: HierarchyLevelDefinition[] = []
  const seen = new Set<string>()
  sanitized.forEach((level) => {
    if (seen.has(level.key)) return
    seen.add(level.key)
    unique.push(level)
  })

  return unique.length > 0 ? unique : DEFAULT_LEVEL_DEFINITIONS
}

const buildChildLevelMap = (
  definitions: HierarchyLevelDefinition[]
): Record<BranchLevel, BranchLevel | null> => {
  const childMap: Record<BranchLevel, BranchLevel | null> = {}
  definitions.forEach((level, index) => {
    childMap[level.key] = definitions[index + 1]?.key ?? null
  })
  return childMap
}

const buildLevelCodes = (definitions: HierarchyLevelDefinition[]): Record<BranchLevel, string> => {
  const map: Record<BranchLevel, string> = {}
  definitions.forEach((definition, index) => {
    map[definition.key] = `Level ${index + 1}`
  })
  return map
}

const resolveLevelLabels = (
  definitions: HierarchyLevelDefinition[],
  overrides?: Record<BranchLevel, string>
): Record<BranchLevel, string> => {
  const map: Record<BranchLevel, string> = {}
  definitions.forEach((definition, index) => {
    const override = overrides?.[definition.key]
    if (typeof override === 'string' && override.trim().length > 0) {
      map[definition.key] = override.trim()
    } else if (index === 0) {
      map[definition.key] = 'Global Headquarters'
    } else {
      map[definition.key] = ''
    }
  })
  return map
}

type AttendanceMetrics = {
  sessions: number
  headcount: number
  firstTimers: number
}

type MemberMetrics = {
  total: number
}

type FinanceMetrics = {
  income: number
  expenses: number
  net: number
}

type BranchAdminSummary = {
  userId: string
  name: string
  email: string
  role: string
  capabilities: string[]
}

type BranchReportNode = {
  id: string
  name: string
  level: BranchLevel
  levelLabel?: string
  levelCode?: string
  parentBranchId: string | null
  status: 'ACTIVE' | 'INACTIVE'
  admins: BranchAdminSummary[]
  location: {
    city: string | null
    state: string | null
    country: string | null
  }
  metrics: {
    attendance: {
      own: AttendanceMetrics
      subtree: AttendanceMetrics
    }
    members: {
      own: MemberMetrics
      subtree: MemberMetrics
    }
    finances: {
      own: FinanceMetrics
      subtree: FinanceMetrics
    }
  }
  children: BranchReportNode[]
}

type BranchSummary = {
  attendance: AttendanceMetrics
  members: MemberMetrics
  finances: FinanceMetrics
}

type ExistingBranchOption = {
  id: string
  name: string
  level: BranchLevel
  levelLabel?: string
  levelCode?: string
  parentBranchId?: string | null
}

type FilterState = {
  start: string
  end: string
  includeInactive: boolean
}

type BranchCreationContext = ModalBranchCreationContext
type BranchCreationContextInput = Partial<BranchCreationContext>

const DEFAULT_FILTERS: FilterState = {
  start: '',
  end: '',
  includeInactive: false,
}

const formatNumber = (value: number) => value.toLocaleString()

const getInitials = (value: string) => {
  if (!value) return '?'
  const parts = value.trim().split(/\s+/)
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase()
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

type DeleteConfirmModalProps = {
  branch: BranchReportNode
  onCancel: () => void
  onConfirm: () => void
  loading: boolean
}

function DeleteConfirmModal({ branch, onCancel, onConfirm, loading }: DeleteConfirmModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 py-8">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-branch-title"
        className="w-full max-w-lg rounded-3xl bg-white shadow-2xl border border-slate-200"
      >
        <div className="px-6 py-5 border-b border-slate-100 flex items-start gap-3">
          <div className="shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-50 text-red-600">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v4m0 4h.01M21 21l-4.35-4.35M18 8a6 6 0 11-12 0 6 6 0 0112 0z"
              />
            </svg>
          </div>
          <div>
            <h2 id="delete-branch-title" className="text-xl font-semibold text-gray-900">
              Delete {branch.name}?
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              This cannot be undone. Removing this node pauses reporting for{' '}
              {formatNumber(branch.metrics.members.subtree.total)} members tracked under it.
            </p>
          </div>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-xs uppercase font-semibold text-slate-500">Level</p>
              <p className="text-sm font-medium text-slate-900 mt-1">{branch.levelLabel || branch.level}</p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-xs uppercase font-semibold text-slate-500">Children</p>
              <p className="text-sm font-medium text-slate-900 mt-1">
                {branch.children.length > 0
                  ? `${branch.children.length} direct`
                  : 'No direct children'}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-xs uppercase font-semibold text-slate-500">Admins</p>
              <p className="text-sm font-medium text-slate-900 mt-1">
                {branch.admins.length > 0 ? `${branch.admins.length} assigned` : 'None'}
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="w-full sm:w-auto rounded-xl border border-slate-200 px-5 py-2.5 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className="w-full sm:w-auto rounded-xl bg-red-600 px-5 py-2.5 font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-60"
            >
              {loading ? 'Deleting...' : 'Delete branch'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function BranchesPage() {
  const { data: session } = useSession()
  const role = (session?.user as any)?.role as string | undefined

  const [churchId, setChurchId] = useState<string | null>(null)
  const [nodes, setNodes] = useState<BranchReportNode[]>([])
  const [summary, setSummary] = useState<BranchSummary | null>(null)
  const [meta, setMeta] = useState<{ generatedAt: string; totalBranches: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hierarchyLevels, setHierarchyLevels] =
    useState<HierarchyLevelDefinition[]>(DEFAULT_LEVEL_DEFINITIONS)
  const [levelLabels, setLevelLabels] = useState<Record<BranchLevel, string>>(
    resolveLevelLabels(DEFAULT_LEVEL_DEFINITIONS)
  )
  const levelCodes = useMemo(() => buildLevelCodes(hierarchyLevels), [hierarchyLevels])
  const childLevelMap = useMemo(
    () => buildChildLevelMap(hierarchyLevels),
    [hierarchyLevels]
  )
  const rootLevel = hierarchyLevels[0]
  const rootLevelDisplayName = rootLevel
    ? levelLabels[rootLevel.key]?.trim() || rootLevel.label?.trim() || 'Region'
    : 'Region'

  const [filterInputs, setFilterInputs] = useState<FilterState>(DEFAULT_FILTERS)
  const [activeFilters, setActiveFilters] = useState<FilterState>(DEFAULT_FILTERS)

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creationContext, setCreationContext] = useState<BranchCreationContext | null>(null)
  const [selectedBranch, setSelectedBranch] = useState<{ id: string; name: string } | null>(null)
  const [showAdminModal, setShowAdminModal] = useState(false)
  const [existingBranches, setExistingBranches] = useState<ExistingBranchOption[]>([])
  const [hasLoadedHierarchy, setHasLoadedHierarchy] = useState(false)
  const [hierarchyWarning, setHierarchyWarning] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'info' | 'error'; text: string } | null>(null)
  const [exporting, setExporting] = useState(false)
  const [branchPendingDeletion, setBranchPendingDeletion] = useState<BranchReportNode | null>(null)
  const [deletingBranchId, setDeletingBranchId] = useState<string | null>(null)
  const [collapsedNodes, setCollapsedNodes] = useState<Record<string, boolean>>({})

  const canManageHierarchy = ['SUPER_ADMIN', 'ADMIN', 'BRANCH_ADMIN'].includes(role || '')
  const canCreateRootLevel = ['SUPER_ADMIN', 'ADMIN'].includes(role || '')

  const presetRanges = [
    { label: 'Last 30 days', days: 30 },
    { label: 'Last 90 days', days: 90 },
    { label: 'Year to date', days: 365 },
  ]

  const applyLevelMetadata = useCallback(
    (input: BranchReportNode[]): BranchReportNode[] =>
      input.map((node) => {
        const resolvedChildren = Array.isArray(node.children) ? node.children : []
        const resolvedLabel = node.levelLabel ?? levelLabels[node.level] ?? ''
        const resolvedCode = node.levelCode ?? levelCodes[node.level] ?? 'Level'
        const resolvedAdmins = Array.isArray(node.admins) ? node.admins : []
        return {
          ...node,
          levelLabel: resolvedLabel,
          levelCode: resolvedCode,
          admins: resolvedAdmins,
          children: applyLevelMetadata(resolvedChildren),
        }
      }),
    [levelLabels, levelCodes]
  )

  const fetchChurchDetails = useCallback(async (targetChurchId: string) => {
    try {
      const res = await fetch(`/api/churches/${targetChurchId}`)
      if (!res.ok) {
        throw new Error('Unable to load church details')
      }
      const data = await res.json()
      const normalizedLevels = normalizeLevelDefinitions(data.hierarchyLevels)
      setHierarchyLevels(normalizedLevels)
      setLevelLabels(resolveLevelLabels(normalizedLevels, data.hierarchyLevelLabels))
      setHierarchyWarning(null)
    } catch (err) {
      console.error(err)
      setHierarchyLevels(DEFAULT_LEVEL_DEFINITIONS)
      setLevelLabels(resolveLevelLabels(DEFAULT_LEVEL_DEFINITIONS))
      setHierarchyWarning('Unable to load your custom hierarchy levels. Showing the default levels instead.')
    }
  }, [])

  const loadExistingBranches = useCallback(
    async (targetChurchId: string) => {
      try {
        const res = await fetch(`/api/churches/${targetChurchId}/branches?includeInactive=true`)
        if (!res.ok) {
          throw new Error('Unable to load existing branches')
        }
        const data = await res.json()
        if (Array.isArray(data)) {
          setExistingBranches(
            data.map((branch: any) => ({
              id: branch.id,
              name: branch.name,
              level: branch.level,
              levelLabel: typeof branch.levelLabel === 'string' ? branch.levelLabel : undefined,
              levelCode: levelCodes[branch.level] ?? undefined,
              parentBranchId: branch.parentBranchId ?? null,
            }))
          )
        } else {
          setExistingBranches([])
        }
      } catch (err) {
        console.error(err)
        setExistingBranches([])
      }
    },
    [levelCodes]
  )

  const loadChurchContext = useCallback(async () => {
    try {
      const res = await fetch('/api/users/me')
      if (!res.ok) {
        throw new Error('Unable to resolve user')
      }
      const data = await res.json()
      if (data.churchId) {
        setChurchId(data.churchId)
      } else {
        setError('No church found for your account.')
      }
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Failed to load user context')
    }
  }, [])

  const fetchHierarchy = useCallback(
    async (targetChurchId: string, filters: FilterState) => {
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams()
        if (filters.start) params.set('start', filters.start)
        if (filters.end) params.set('end', filters.end)
        if (filters.includeInactive) params.set('includeInactive', 'true')
        params.set('limit', '750')

        const res = await fetch(`/api/churches/${targetChurchId}/reports/branches?${params.toString()}`)
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || 'Failed to load hierarchy')
        }

        const data = await res.json()
        setNodes(Array.isArray(data.nodes) ? applyLevelMetadata(data.nodes) : [])
        setSummary(data.summary || null)
        setMeta(data.meta || null)
      } catch (err: any) {
        console.error(err)
        setError(err.message || 'Failed to load hierarchy')
        setNodes([])
        setSummary(null)
        setMeta(null)
      } finally {
        setHasLoadedHierarchy(true)
        setLoading(false)
      }
    },
    [applyLevelMetadata]
  )

  useEffect(() => {
    if (session) {
      loadChurchContext()
    }
  }, [session, loadChurchContext])

  useEffect(() => {
    if (churchId) {
      fetchHierarchy(churchId, activeFilters)
    }
  }, [churchId, activeFilters, fetchHierarchy])

  useEffect(() => {
    if (!churchId) return
    fetchChurchDetails(churchId)
  }, [churchId, fetchChurchDetails])

  useEffect(() => {
    if (!churchId) return
    loadExistingBranches(churchId)
  }, [churchId, loadExistingBranches])

  const handleApplyFilters = () => {
    if (filterInputs.start && filterInputs.end && filterInputs.end < filterInputs.start) {
      setError('End date must be after start date.')
      return
    }
    setActiveFilters(filterInputs)
  }

  const handleResetFilters = () => {
    setFilterInputs(DEFAULT_FILTERS)
    setActiveFilters(DEFAULT_FILTERS)
  }

  const handlePresetRange = (days: number) => {
    const end = new Date()
    const start = new Date()
    start.setDate(end.getDate() - (days - 1))
    const toInput = (date: Date) => date.toISOString().split('T')[0]
    setFilterInputs({
      start: toInput(start),
      end: toInput(end),
      includeInactive: filterInputs.includeInactive,
    })
  }

  const handleBranchCreated = () => {
    setShowCreateModal(false)
    if (churchId) {
      fetchHierarchy(churchId, activeFilters)
      loadExistingBranches(churchId)
    }
    setStatusMessage({ type: 'success', text: 'Branch saved successfully.' })
  }

  const handleOpenCreateModal = (context?: BranchCreationContextInput) => {
    if (churchId) {
      loadExistingBranches(churchId)
    }

    const fallbackContext: BranchCreationContext = rootLevel
      ? {
          level: rootLevel.key,
          levelLabel: levelLabels[rootLevel.key] ?? rootLevel.label ?? 'Global Headquarters',
          levelCode: levelCodes[rootLevel.key] ?? 'Level 1',
          parentBranchId: null,
        }
      : {
          level: 'LEVEL_1',
          levelLabel: 'Global Headquarters',
          levelCode: 'Level 1',
          parentBranchId: null,
        }

    const resolvedLevel = context?.level ?? fallbackContext.level
    const resolvedLevelLabel =
      (context?.levelLabel && context.levelLabel.trim().length > 0
        ? context.levelLabel
        : levelLabels[resolvedLevel]) ?? fallbackContext.levelLabel
    const resolvedLevelCode =
      context?.levelCode ?? levelCodes[resolvedLevel] ?? fallbackContext.levelCode

    setCreationContext({
      level: resolvedLevel,
      levelLabel: resolvedLevelLabel,
      levelCode: resolvedLevelCode,
      parentBranchId: context?.parentBranchId ?? fallbackContext.parentBranchId ?? null,
      parentName: context?.parentName ?? fallbackContext.parentName,
    })
    setShowCreateModal(true)
  }

  const handleManageAdmins = (branch: { id: string; name: string }) => {
    setSelectedBranch(branch)
    setShowAdminModal(true)
  }

  const handleRequestDelete = (branch: BranchReportNode) => {
    setBranchPendingDeletion(branch)
  }

  const handleConfirmDelete = async () => {
    if (!churchId || !branchPendingDeletion) return
    const target = branchPendingDeletion
    setDeletingBranchId(target.id)
    try {
      const res = await fetch(`/api/churches/${churchId}/branches/${target.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to delete branch')
      }
      fetchHierarchy(churchId, activeFilters)
      setStatusMessage({ type: 'success', text: `${target.name} was deleted.` })
      setBranchPendingDeletion(null)
    } catch (err: any) {
      console.error(err)
      const message = err.message || 'Failed to delete branch'
      setError(message)
      setStatusMessage({ type: 'error', text: message })
    } finally {
      setDeletingBranchId(null)
    }
  }

  const handleCancelDelete = () => {
    if (deletingBranchId) return
    setBranchPendingDeletion(null)
  }

  const toggleNodeCollapsed = (nodeId: string) => {
    setCollapsedNodes((prev) => ({
      ...prev,
      [nodeId]: !prev[nodeId],
    }))
  }

  const handleExportReport = async () => {
    if (!churchId) return
    try {
      setExporting(true)
      setStatusMessage({ type: 'info', text: 'Preparing branch report...' })
      const params = new URLSearchParams()
      if (activeFilters.start) params.set('start', activeFilters.start)
      if (activeFilters.end) params.set('end', activeFilters.end)
      if (activeFilters.includeInactive) params.set('includeInactive', 'true')
      params.set('limit', '750')

      const res = await fetch(`/api/churches/${churchId}/reports/branches?${params.toString()}`)
      if (!res.ok) {
        throw new Error('Unable to export hierarchy')
      }
      const data = await res.json()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `branch-report-${new Date().toISOString()}.json`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      setStatusMessage({ type: 'success', text: 'Branch report downloaded.' })
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Failed to export hierarchy')
      setStatusMessage({ type: 'error', text: err.message || 'Failed to export hierarchy.' })
    } finally {
      setExporting(false)
    }
  }

  const renderNode = (node: BranchReportNode, depth: number = 0) => {
    const childLevel = childLevelMap[node.level] ?? null
    const locationParts = [node.location.city, node.location.state, node.location.country].filter(Boolean)
    const location = locationParts.length > 0 ? locationParts.join(', ') : 'Location not specified'
    const nodeLevelCode = node.levelCode ?? levelCodes[node.level] ?? `Level ${depth + 1}`
    const nodeDisplayLabel = node.levelLabel?.trim() || levelLabels[node.level]?.trim() || ''
    const childLevelCode = childLevel ? levelCodes[childLevel] ?? null : null
    const childLevelLabel = childLevel ? levelLabels[childLevel]?.trim() || '' : ''
    const isCollapsed = collapsedNodes[node.id] ?? false
    const visibleAdmins = node.admins.slice(0, 3)
    const hiddenAdminCount = Math.max(node.admins.length - visibleAdmins.length, 0)

    return (
      <div key={node.id} className="space-y-3">
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h3 className="text-xl font-semibold text-gray-900">{node.name}</h3>
                <span className="px-3 py-1 text-xs font-semibold uppercase tracking-wide rounded-full bg-slate-100 text-slate-700">
                  {nodeLevelCode}
                </span>
                {nodeDisplayLabel && (
                  <span className="text-sm font-medium text-slate-500 italic">{nodeDisplayLabel}</span>
                )}
                <span
                  className={`px-3 py-1 text-xs font-semibold rounded-full ${
                    node.status === 'ACTIVE'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {node.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-1">{location}</p>
            </div>
            {canManageHierarchy && (
              <div className="flex flex-wrap gap-2 items-center justify-end">
                <button
                  type="button"
                  onClick={() => toggleNodeCollapsed(node.id)}
                  aria-label={isCollapsed ? `Expand ${node.name}` : `Collapse ${node.name}`}
                  aria-expanded={!isCollapsed}
                  className="rounded-full border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <span aria-hidden="true">{isCollapsed ? '+' : 'âˆ’'}</span>
                </button>
                {childLevel && (
                  <button
                    onClick={() =>
                      handleOpenCreateModal({
                        level: childLevel,
                        levelLabel: levelLabels[childLevel] ?? '',
                        levelCode: levelCodes[childLevel] ?? undefined,
                        parentBranchId: node.id,
                        parentName: node.name,
                      })
                    }
                    className="px-4 py-2 rounded-xl border border-primary-200 text-primary-700 text-sm font-semibold hover:bg-primary-50 transition-colors"
                  >
                    + Add {childLevelCode ?? 'next level'}
                    {childLevelLabel ? ` (${childLevelLabel.toLowerCase()})` : ''}
                  </button>
                )}
                <button
                  onClick={() => handleManageAdmins({ id: node.id, name: node.name })}
                  className="px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
                >
                  Manage admins
                </button>
                <button
                  onClick={() => handleRequestDelete(node)}
                  className="px-4 py-2 rounded-xl border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50 transition-colors"
                >
                  Delete
                </button>
              </div>
            )}
          </div>

          {!isCollapsed && (
            <>
              <div className="grid gap-4 md:grid-cols-3 mt-5">
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase text-slate-500">Attendance</p>
                  <p className="text-2xl font-bold text-slate-900 mt-1">
                    {formatNumber(node.metrics.attendance.subtree.headcount)}{' '}
                    <span className="text-base font-medium text-slate-500">people</span>
                  </p>
                  <p className="text-xs text-slate-500 mt-2">
                    {formatNumber(node.metrics.attendance.subtree.sessions)} sessions  - {' '}
                    {formatNumber(node.metrics.attendance.subtree.firstTimers)} first timers
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Own campus: {formatNumber(node.metrics.attendance.own.headcount)}
                  </p>
                </div>

                <div className="rounded-xl bg-emerald-50 p-4">
                  <p className="text-xs font-semibold uppercase text-emerald-600">Members</p>
                  <p className="text-2xl font-bold text-emerald-900 mt-1">
                    {formatNumber(node.metrics.members.subtree.total)}
                  </p>
                  <p className="text-xs text-emerald-600 mt-2">
                    Own campus: {formatNumber(node.metrics.members.own.total)}
                  </p>
                </div>

                <div className="rounded-xl bg-amber-50 p-4">
                  <p className="text-xs font-semibold uppercase text-amber-700">Finances</p>
                  <p className="text-2xl font-bold text-amber-900 mt-1">
                    ₦{formatNumber(Math.round(node.metrics.finances.subtree.net))}
                  </p>
                  <p className="text-xs text-amber-600 mt-2">
                    Income ₦{formatNumber(Math.round(node.metrics.finances.subtree.income))}  -  Expenses ₦
                    {formatNumber(Math.round(node.metrics.finances.subtree.expenses))}
                  </p>
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase text-slate-500">Admins</p>
                  <span className="text-xs font-medium text-slate-500">
                    {node.admins.length === 0
                      ? 'No admins assigned'
                      : `${node.admins.length} ${node.admins.length === 1 ? 'person' : 'people'}`}
                  </span>
                </div>
                {node.admins.length === 0 ? (
                  <p className="text-sm text-slate-500 mt-2">
                    Assign at least one admin to keep this branch accountable.
                  </p>
                ) : (
                  <div
                    className="mt-3 flex flex-wrap gap-2"
                    role="list"
                    aria-label={`Admins managing ${node.name}`}
                  >
                    {visibleAdmins.map((admin) => (
                      <span
                        key={`${node.id}-${admin.userId}`}
                        role="listitem"
                        className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700"
                        title={`${admin.name}${admin.email ? `  -  ${admin.email}` : ''}`}
                      >
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold uppercase text-white">
                          {getInitials(admin.name || admin.email || admin.role)}
                        </span>
                        <span className="flex flex-col leading-tight">
                          <span className="font-semibold">{admin.name || 'Branch admin'}</span>
                          <span className="text-xs text-slate-500">
                            {admin.capabilities.length > 0 ? admin.capabilities.join(' Â· ') : admin.role}
                          </span>
                        </span>
                      </span>
                    ))}
                    {hiddenAdminCount > 0 && (
                      <span className="inline-flex items-center rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
                        +{hiddenAdminCount} more
                      </span>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {!isCollapsed && node.children.length > 0 && (
          <div className="pl-6 md:pl-10 border-l border-dashed border-gray-300 space-y-4">
            {node.children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  const showInitialSkeleton = loading && !hasLoadedHierarchy
  const shouldShowEmptyState = !loading && hasLoadedHierarchy && nodes.length === 0 && !error
  const inactiveFilterEnabled = activeFilters.includeInactive

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Branch hierarchy</h1>
          <p className="text-gray-600 mt-1">
            Regions, states, zones, and branches with scoped reporting.
          </p>
          <div className="mt-3 rounded-2xl border border-slate-200 bg-white/80 p-4 text-sm text-slate-600">
            <p>
              Need to rename levels or restructure the tree? Update your hierarchy once in{' '}
              <Link href="/settings/hierarchy" className="font-semibold text-primary-600 hover:text-primary-700">
                Settings â†’ Hierarchy levels
              </Link>{' '}
              and every branch view will stay in sync.
            </p>
            <p className="mt-2">
              Role/designation titles live in{' '}
              <Link href="/settings/roles" className="font-semibold text-primary-600 hover:text-primary-700">
                Settings â†’ Roles &amp; designations
              </Link>{' '}
              so operators can keep this workspace focused on day-to-day branch management.
            </p>
          </div>
          {inactiveFilterEnabled && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-3 py-1 mt-2">
              Inactive branches included
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleExportReport}
            disabled={exporting}
            className={`px-5 py-2 rounded-xl border border-gray-300 text-gray-700 font-semibold transition-colors ${
              exporting ? 'opacity-60 cursor-not-allowed' : 'hover:bg-gray-50'
            }`}
          >
            {exporting ? 'Exporting...' : 'Export report'}
          </button>
          {rootLevel && canCreateRootLevel && churchId && (
            <button
              onClick={() => handleOpenCreateModal()}
              className="px-5 py-2 rounded-xl bg-primary-600 text-white font-semibold hover:bg-blue-700 transition-colors shadow-sm"
            >
              + New {rootLevelDisplayName.toLowerCase()}
            </button>
          )}
        </div>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 md:p-6">
        <div className="grid gap-4 md:grid-cols-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-600 uppercase">Start date</label>
            <input
              type="date"
              value={filterInputs.start}
              onChange={(e) => setFilterInputs((prev) => ({ ...prev, start: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 bg-white text-slate-900"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-600 uppercase">End date</label>
            <input
              type="date"
              value={filterInputs.end}
              onChange={(e) => setFilterInputs((prev) => ({ ...prev, end: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 bg-white text-slate-900"
            />
          </div>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={filterInputs.includeInactive}
              onChange={(e) =>
                setFilterInputs((prev) => ({ ...prev, includeInactive: e.target.checked }))
              }
              className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
            />
            Include inactive branches
          </label>
          <div className="flex gap-3 justify-end">
            <button
              onClick={handleResetFilters}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-white"
            >
              Reset
            </button>
            <button
              onClick={handleApplyFilters}
              className="px-4 py-2 rounded-xl bg-slate-900 text-white font-semibold hover:bg-slate-800"
            >
              Apply
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          {presetRanges.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => handlePresetRange(preset.days)}
              className="px-3 py-1 rounded-full border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-white"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl p-4 text-sm">
          {error}
        </div>
      )}
      {statusMessage && (
        <div
          role="status"
          aria-live="polite"
          className={`rounded-2xl p-4 text-sm flex items-start gap-2 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : statusMessage.type === 'error'
              ? 'bg-red-50 border border-red-200 text-red-800'
              : 'bg-primary-50 border border-primary-200 text-primary-800'
          }`}
        >
          <span className="font-semibold">
            {statusMessage.type === 'success'
              ? 'Success'
              : statusMessage.type === 'error'
              ? 'Error'
              : 'Info'}
            :
          </span>
          <span>{statusMessage.text}</span>
        </div>
      )}
      {hierarchyWarning && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-2xl p-4 text-sm flex items-start gap-2">
          <span className="font-semibold">Heads up:</span>
          <span>{hierarchyWarning}</span>
        </div>
      )}

      {summary && (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
            <p className="text-xs font-semibold text-slate-500 uppercase">Attendance (subtree)</p>
            <p className="text-3xl font-bold text-slate-900 mt-2">
              {formatNumber(summary.attendance.headcount)}
            </p>
            <p className="text-sm text-slate-500">
              {formatNumber(summary.attendance.sessions)} sessions  - {' '}
              {formatNumber(summary.attendance.firstTimers)} first timers
            </p>
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
            <p className="text-xs font-semibold text-slate-500 uppercase">Members</p>
            <p className="text-3xl font-bold text-slate-900 mt-2">
              {formatNumber(summary.members.total)}
            </p>
            <p className="text-sm text-slate-500">Across all visible branches</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
            <p className="text-xs font-semibold text-slate-500 uppercase">Financial net</p>
            <p className="text-3xl font-bold text-slate-900 mt-2">
              ₦{formatNumber(Math.round(summary.finances.net))}
            </p>
            <p className="text-sm text-slate-500">
              Income ₦{formatNumber(Math.round(summary.finances.income))}  -  Expenses ₦
              {formatNumber(Math.round(summary.finances.expenses))}
            </p>
          </div>
        </div>
      )}

      {meta && (
        <p className="text-xs text-slate-500">
          Snapshot generated {new Date(meta.generatedAt).toLocaleString()}  - {' '}
          {meta.totalBranches} branches in scope
        </p>
      )}

      {showInitialSkeleton ? (
        <div className="space-y-6">{Array.from({ length: 3 }).map((_, i) => <SkeletonNode key={`skeleton-${i}`} />)}</div>
      ) : shouldShowEmptyState ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-10 text-center">
          <div className="text-5xl mb-4">ðŸŒ±</div>
          <h3 className="text-xl font-semibold mb-2 text-gray-900">No branches to show</h3>
          <p className="text-gray-600 max-w-lg mx-auto">
            Create your first {rootLevelDisplayName.toLowerCase()} or request access to a parent branch to
            begin building the hierarchy.
          </p>
          {rootLevel && canCreateRootLevel && (
            <button
              onClick={() => handleOpenCreateModal()}
              className="mt-6 px-6 py-3 rounded-xl bg-primary-600 text-white font-semibold hover:bg-blue-700"
            >
              Create {rootLevelDisplayName.toLowerCase()}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">{nodes.map((node) => renderNode(node))}</div>
      )}

      {showCreateModal && churchId && creationContext && (
        <CreateBranchModal
          churchId={churchId}
          context={creationContext}
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleBranchCreated}
          existingBranches={existingBranches}
          allowExistingSelection={existingBranches.length > 0}
        />
      )}

      {showAdminModal && selectedBranch && churchId && (
        <BranchAdminModal
          churchId={churchId}
          branchId={selectedBranch.id}
          branchName={selectedBranch.name}
          onClose={() => {
            setShowAdminModal(false)
            setSelectedBranch(null)
          }}
        />
      )}

      {branchPendingDeletion && (
        <DeleteConfirmModal
          branch={branchPendingDeletion}
          loading={deletingBranchId === branchPendingDeletion.id}
          onCancel={handleCancelDelete}
          onConfirm={handleConfirmDelete}
        />
      )}
    </div>
  )
}
