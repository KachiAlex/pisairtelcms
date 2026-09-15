'use client'

type AnalyticsBadgeProps = {
  label: string
  value: number
  tone: 'slate' | 'gray' | 'amber' | 'emerald'
}

const courseActionLabel = (course: Course, enrollment?: ApiEnrollmentResponse) => {
  const snapshot = deriveEnrollmentSnapshot(enrollment, course)
  return snapshot.actionLabel
}

const TONE_STYLES: Record<AnalyticsBadgeProps['tone'], { bg: string; text: string }> = {
  slate: { bg: 'bg-slate-100', text: 'text-slate-900' },
  gray: { bg: 'bg-gray-100', text: 'text-gray-900' },
  amber: { bg: 'bg-amber-100', text: 'text-amber-900' },
  emerald: { bg: 'bg-emerald-100', text: 'text-emerald-900' },
}

const AnalyticsBadge = ({ label, value, tone }: AnalyticsBadgeProps) => {
  const style = TONE_STYLES[tone]
  return (
    <div className={`rounded-2xl ${style.bg} p-4`}>
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${style.text}`}>{value}</p>
    </div>
  )
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ChangeEvent, FormEvent, ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ImageUpload } from './ImageUpload'
import { SignatureUpload } from './SignatureUpload'

type AccessType = 'open' | 'request' | 'invite'
type ProgressState = 'not-started' | 'in-progress' | 'completed'

type CoursePricing =
  | { type: 'free' }
  | { type: 'paid'; amount: number; currency?: string }

const COURSE_MANAGER_ROLES = new Set(['ADMIN', 'SUPER_ADMIN', 'BRANCH_ADMIN', 'PASTOR'])
type QuestionFilter = 'all' | 'correct' | 'incorrect'

type Course = {
  id: string
  title: string
  description: string
  access: AccessType
  modules: number
  hours: number
  mentors: string[]
  format: string[]
  status: ProgressState
  progress: number
  badgeColor: string
  pricing: CoursePricing
  rawStatus?: ApiCourseResponse['status']
}

type ResumeMetadata = {
  courseId: string
  courseTitle: string
  sectionIds: string[]
  modulesBySection: Record<string, string[]>
  examIdsBySection: Record<string, string[]>
}

type EnrollmentQueueItem = {
  enrollmentId: string
  courseId: string
  moduleTitle: string
  due: string
  action: string
  progressPercent?: number
  isCompleted: boolean
  certificateUrl?: string
}

type CourseAnalyticsRow = {
  enrollmentId: string
  userId: string
  memberName: string
  churchLevel: string
  branch: string
  designation: string
  progressPercent: number
  status: string
  examScore: number | null
  lastExamAt: string | null
}

type CourseAnalyticsSummary = {
  total: number
  notStarted: number
  inProgress: number
  completed: number
}

type AdminAction = {
  title: string
  status: string
  updatedBy: string
  timestamp: string
}

type ExamAttemptRow = {
  id: string
  examId: string
  courseId: string
  status: 'in_progress' | 'submitted'
  score: number | null
  totalQuestions: number | null
  startedAt: string
  submittedAt?: string | null
  responses?: Array<{ questionId: string; answerIndex: number; correct: boolean }>
  examMeta?: {
    id: string
    title: string
    sectionId?: string | null
  } | null
  questionSummaries?: ExamQuestionSummary[]
}

type ExamQuestionSummary = {
  id: string
  question: string
  options: string[]
  correctOption: number
}

type AccessRequest = {
  id: string
  userLabel: string
  courseTitle: string
  reason: string
  status: string
}

type ProgressRow = {
  member: string
  course: string
  completion: number
  examScore: string
}

type ExamUpload = {
  title: string
  questions: number
  status: string
  owner: string
}

type ExamParseSummaryState = {
  status: 'idle' | 'parsing' | 'success' | 'error'
  summary?: {
    totalRows: number
    createdCount: number
    skipped: { rowNumber: number; reason: string }[]
    warnings: string[]
  }
  error?: string
}

type SectionGatingSummary = {
  enrollmentId: string
  courseId: string
  courseTitle: string
  progress: number
  lockedModules: number
  unlockedModules: number
  statusLabel: string
  nextAction: string
  isCompleted: boolean
  certificateUrl?: string
}

type LeaderboardBadge = {
  badge: {
    name: string
    icon?: string
  }
}

type LeaderboardEntry = {
  rank: number
  id: string
  firstName: string
  lastName: string
  profileImage?: string | null
  xp: number
  level: number
  badges: LeaderboardBadge[]
}

type LeaderboardScope = 'global' | 'department' | 'group' | 'family'

type ModuleContentType = 'video' | 'audio' | 'text'

type ModuleDraft = {
  id: string
  persistedId?: string
  title: string
  description: string
  estimatedMinutes: number
  videoUrl: string
  audioUrl: string
  bookUrl: string
  audioFileName?: string
  bookFileName?: string
  audioStoragePath?: string
  bookStoragePath?: string
  contentType: ModuleContentType
  textContent: string
}

type SectionExamDraft = {
  persistedId?: string
  title: string
  description: string
  timeLimitMinutes: number
  questionCount: number
  status: 'draft' | 'ready' | 'published'
  uploadPlaceholder?: string
  uploadUrl?: string
  uploadStoragePath?: string
  retakeMaxAttempts: number | null
  retakeCooldownHours: number | null
}

type SectionDraft = {
  id: string
  persistedId?: string
  title: string
  description: string
  modules: ModuleDraft[]
  exam: SectionExamDraft
}

type CourseDraft = {
  title: string
  access: AccessType
  mentors: string
  summary: string
  estimatedHours: number
  format: string
  pricing: CoursePricing
  sections: SectionDraft[]
  certificateTheme: CertificateThemeDraft
}

type CertificateTemplate = 'classic' | 'modern' | 'minimal'

type CertificateThemeDraft = {
  template: CertificateTemplate
  accentColor: string
  secondaryColor: string
  logoUrl: string
  backgroundImageUrl: string
  signatureText: string
  sealText: string
  issuedBy: string
}

type ModalProps = {
  isOpen: boolean
  onClose: () => void
  labelledBy: string
  children: ReactNode
}

const Modal = ({ isOpen, onClose, labelledBy, children }: ModalProps) => {
  if (!isOpen || typeof document === 'undefined') return null

  const handleContentClick = (event: React.MouseEvent) => {
    event.stopPropagation()
  }

  return createPortal(
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby={labelledBy} onClick={onClose}>
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" aria-hidden="true" />
      <div
        className="relative z-10 flex min-h-full w-full items-center justify-center px-4 py-8"
        onClick={handleContentClick}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}

const DEFAULT_CERTIFICATE_THEME: CertificateThemeDraft = {
  template: 'classic',
  accentColor: '#4338ca',
  secondaryColor: '#0f172a',
  logoUrl: '',
  backgroundImageUrl: '',
  signatureText: 'Lead Pastor',
  sealText: 'pi-CMS Training Institute',
  issuedBy: 'pi-CMS',
}

const mergeCertificateTheme = (theme?: Partial<CertificateThemeDraft>): CertificateThemeDraft => ({
  ...DEFAULT_CERTIFICATE_THEME,
  ...theme,
})

const createModuleDraft = (overrides: Partial<ModuleDraft> = {}): ModuleDraft => ({
  id:
    overrides.id ??
    (typeof crypto !== 'undefined' ? crypto.randomUUID() : `module-${Date.now()}-${Math.random()}`),
  persistedId: overrides.persistedId,
  title: overrides.title ?? '',
  description: overrides.description ?? '',
  estimatedMinutes: overrides.estimatedMinutes ?? 30,
  videoUrl: overrides.videoUrl ?? '',
  audioUrl: overrides.audioUrl ?? '',
  bookUrl: overrides.bookUrl ?? '',
  audioFileName: overrides.audioFileName,
  bookFileName: overrides.bookFileName,
  audioStoragePath: overrides.audioStoragePath,
  bookStoragePath: overrides.bookStoragePath,
  contentType: overrides.contentType ?? 'video',
  textContent: overrides.textContent ?? '',
})

const createExamDraft = (overrides: Partial<SectionExamDraft> = {}): SectionExamDraft => ({
  persistedId: overrides.persistedId,
  title: overrides.title ?? '',
  description: overrides.description ?? '',
  timeLimitMinutes: overrides.timeLimitMinutes ?? 30,
  questionCount: overrides.questionCount ?? 20,
  status: overrides.status ?? 'draft',
  uploadPlaceholder: overrides.uploadPlaceholder ?? '',
  uploadUrl: overrides.uploadUrl,
  uploadStoragePath: overrides.uploadStoragePath,
  retakeMaxAttempts:
    overrides.retakeMaxAttempts !== undefined ? overrides.retakeMaxAttempts : null,
  retakeCooldownHours:
    overrides.retakeCooldownHours !== undefined ? overrides.retakeCooldownHours : null,
})

const buildRetakePolicyPayload = (exam: SectionExamDraft) =>
  exam.retakeMaxAttempts != null || exam.retakeCooldownHours != null
    ? {
        maxAttempts: exam.retakeMaxAttempts,
        cooldownHours: exam.retakeCooldownHours,
      }
    : null

const createSectionDraft = (overrides: Partial<SectionDraft> = {}): SectionDraft => ({
  id:
    overrides.id ??
    (typeof crypto !== 'undefined' ? crypto.randomUUID() : `section-${Date.now()}-${Math.random()}`),
  persistedId: overrides.persistedId,
  title: overrides.title ?? '',
  description: overrides.description ?? '',
  modules: overrides.modules ?? [createModuleDraft()],
  exam: overrides.exam ?? createExamDraft(),
})

const createCourseDraft = (): CourseDraft => ({
  title: '',
  access: 'open',
  mentors: '',
  summary: 'Outline what learners should expect from this discipleship track.',
  estimatedHours: 6,
  format: 'Video lessons, Audio reflections',
  pricing: { type: 'free' },
  sections: [createSectionDraft()],
  certificateTheme: mergeCertificateTheme(),
})

const CERTIFICATE_TEMPLATES: { value: CertificateTemplate; label: string; description: string }[] = [
  {
    value: 'classic',
    label: 'Classic',
    description: 'Traditional typography with bold borders and seal.',
  },
  {
    value: 'modern',
    label: 'Modern',
    description: 'Minimal layout with accent blocks and sans-serif fonts.',
  },
  {
    value: 'minimal',
    label: 'Minimal',
    description: 'Clean monochrome layout with subtle dividers.',
  },
]

const MODULE_CONTENT_TYPES: { value: ModuleContentType; label: string; description: string }[] = [
  { value: 'video', label: 'Video lesson', description: 'Embed a sermon or teaching clip.' },
  { value: 'audio', label: 'Audio reflection', description: 'Upload sermon audio or guided prayer.' },
  { value: 'text', label: 'Text-based study', description: 'Paste a devotional, transcript, or study notes.' },
]

const LEADERBOARD_SCOPES: LeaderboardScope[] = ['global', 'department', 'group', 'family']
const LEADERBOARD_SCOPE_LABELS: Record<LeaderboardScope, string> = {
  global: 'Global',
  department: 'Department',
  group: 'Group',
  family: 'Family',
}
const LEADERBOARD_SCOPE_HINTS: Record<LeaderboardScope, string> = {
  global: 'Shows every active member in your church digital school.',
  department: 'Focus on a ministry department. Enter the department document ID below.',
  group: 'Zoom into a small group or cohort.',
  family: 'Track progress across household/family clusters.',
}
const LEADERBOARD_FILTER_LABELS: Record<Exclude<LeaderboardScope, 'global'>, string> = {
  department: 'Department ID',
  group: 'Group ID',
  family: 'Family ID',
}

const formatPricingLabel = (pricing?: CoursePricing) => {
  if (!pricing || pricing.type === 'free') return 'Free access'
  const amount = typeof pricing.amount === 'number' ? pricing.amount : 0
  const formatted = amount.toLocaleString()
  const currency = pricing.currency ?? 'NGN'
  return `${currency} ${formatted}`
}

const formatDateTime = (value?: string | null) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

const optionLetter = (index: number) => String.fromCharCode(65 + index)

const badgeColorForAccess = (access: AccessType) => {
  switch (access) {
    case 'open':
      return 'bg-emerald-500'
    case 'request':
      return 'bg-amber-500'
    default:
      return 'bg-indigo-500'
  }
}

const formatMemberName = (entry: LeaderboardEntry) => {
  const first = entry.firstName?.trim() ?? ''
  const last = entry.lastName?.trim() ?? ''
  const resolved = `${first} ${last}`.trim()
  return resolved || 'Member'
}

const memberInitials = (entry: LeaderboardEntry) => {
  const first = entry.firstName?.trim().charAt(0) ?? ''
  const last = entry.lastName?.trim().charAt(0) ?? ''
  const initials = `${first}${last}`.toUpperCase()
  return initials || 'DS'
}

const formatXP = (xp: number) => {
  if (!Number.isFinite(xp)) return '0'
  return xp.toLocaleString()
}

const formatRankIcon = (rank: number) => {
  switch (rank) {
    case 1:
      return '🥇'
    case 2:
      return '🥈'
    case 3:
      return '🥉'
    default:
      return `#${rank}`
  }
}

const clampProgress = (value?: number) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0
  return Math.max(0, Math.min(100, Math.round(value)))
}

const deriveEnrollmentSnapshot = (enrollment: ApiEnrollmentResponse | undefined, course?: Course) => {
  if (!enrollment) {
    return {
      progressPercent: 0,
      status: 'not-started' as ProgressState,
      isCompleted: false,
      actionLabel: 'Begin course',
      moduleLabel: `${course?.title ?? 'Digital Course'} · Ready to start`,
      dueLabel: 'Ready to begin',
    }
  }

  const progressPercent = clampProgress(enrollment.progressPercent)
  const isCompleted = enrollment.status === 'completed'
  const status: ProgressState = isCompleted ? 'completed' : progressPercent > 0 ? 'in-progress' : 'not-started'

  const moduleLabel = isCompleted
    ? `${course?.title ?? 'Digital Course'} · Completed`
    : `${course?.title ?? 'Digital Course'} · ${progressPercent}% done`
  const dueLabel = isCompleted ? 'Certificate ready' : progressPercent > 0 ? `${progressPercent}% complete` : 'Can start now'
  const actionLabel = isCompleted ? 'View certificate' : progressPercent > 0 ? 'Continue course' : 'Begin course'

  return {
    progressPercent,
    status,
    isCompleted,
    moduleLabel,
    dueLabel,
    actionLabel,
  }
}

const buildEnrollmentQueue = (enrollments: ApiEnrollmentResponse[], courses: Course[]): EnrollmentQueueItem[] => {
  if (!enrollments.length) return []
  const courseMap = new Map(courses.map((course) => [course.id, course]))

  return enrollments.map((enrollment) => {
    const course = courseMap.get(enrollment.courseId)
    const snapshot = deriveEnrollmentSnapshot(enrollment, course)
    return {
      enrollmentId: enrollment.id,
      courseId: enrollment.courseId,
      moduleTitle: snapshot.moduleLabel,
      due: snapshot.dueLabel,
      action: snapshot.actionLabel,
      progressPercent: enrollment.progressPercent,
      isCompleted: snapshot.isCompleted,
      certificateUrl: enrollment.certificateUrl,
    }
  })
}

const buildGatingSummaries = (enrollments: ApiEnrollmentResponse[], courses: Course[]): SectionGatingSummary[] => {
  if (!enrollments.length) return []
  const courseMap = new Map(courses.map((course) => [course.id, course]))

  return enrollments.map((enrollment) => {
    const course = courseMap.get(enrollment.courseId)
    const totalModules = course?.modules ?? 0
    const completedModules = Math.min(
      totalModules,
      Math.round(((enrollment.progressPercent ?? 0) / 100) * totalModules),
    )

    const unlockedModules = Math.max(completedModules, 0)
    const lockedModules = Math.max(totalModules - unlockedModules, 0)
    const progress = clampProgress(enrollment.progressPercent)
    const snapshot = deriveEnrollmentSnapshot(enrollment, course)

    const nextAction = snapshot.isCompleted
      ? 'Download certificate'
      : lockedModules > 0
        ? 'Pass section exam to unlock next modules'
        : 'All modules unlocked'

    const statusLabel = snapshot.isCompleted
      ? 'Completed'
      : lockedModules > 0
        ? `${lockedModules} modules locked`
        : 'Unlocked'

    return {
      enrollmentId: enrollment.id,
      courseId: enrollment.courseId,
      courseTitle: course?.title ?? 'Digital Course',
      progress,
      lockedModules,
      unlockedModules,
      statusLabel,
      nextAction,
      isCompleted: snapshot.isCompleted,
      certificateUrl: enrollment.certificateUrl,
    }
  })
}

const buildProgressRows = (enrollments: ApiEnrollmentResponse[], courses: Course[]): ProgressRow[] => {
  if (!enrollments.length) return []
  const courseMap = new Map(courses.map((course) => [course.id, course]))

  return enrollments.map((enrollment) => {
    const course = courseMap.get(enrollment.courseId)
    const completion = clampProgress(enrollment.progressPercent)
    const examScore =
      enrollment.status === 'completed'
        ? 'Passed'
        : completion >= 80
          ? 'Ready for exam'
          : '-'

    return {
      member: 'You',
      course: course?.title ?? 'Digital Course',
      completion,
      examScore,
    }
  })
}

type ApiCourseResponse = {
  id: string
  title: string
  summary?: string
  accessType?: AccessType
  mentors?: string[]
  estimatedHours?: number
  tags?: string[]
  status?: 'draft' | 'published' | 'archived'
  pricing?: CoursePricing
  moduleCount?: number
  modules?: number
  progressPercent?: number
  certificateTheme?: Partial<CertificateThemeDraft>
}

const mapApiCourseToUi = (apiCourse: ApiCourseResponse): Course => {
  const access = apiCourse.accessType ?? 'open'
  const format = apiCourse.tags && apiCourse.tags.length ? apiCourse.tags : ['Video lessons']
  const mentors = apiCourse.mentors && apiCourse.mentors.length ? apiCourse.mentors : ['Training Team']
  const status: ProgressState =
    apiCourse.status === 'published' ? 'in-progress' : apiCourse.status === 'archived' ? 'completed' : 'not-started'
  const progress =
    status === 'completed' ? 100 : status === 'in-progress' ? apiCourse.progressPercent ?? 20 : 0

  return {
    id: apiCourse.id,
    title: apiCourse.title,
    description: apiCourse.summary || 'New discipleship modules launching soon.',
    access,
    modules: typeof apiCourse.moduleCount === 'number' ? apiCourse.moduleCount : apiCourse.modules ?? 0,
    hours: apiCourse.estimatedHours ?? 1,
    mentors,
    format,
    status,
    progress,
    badgeColor: badgeColorForAccess(access),
    pricing: apiCourse.pricing ?? { type: 'free' },
    rawStatus: apiCourse.status ?? 'draft',
  }
}

type ApiSectionResponse = {
  id: string
  courseId: string
  title: string
  description?: string
  order: number
}

type ApiModuleResponse = {
  id: string
  sectionId: string
  title: string
  description?: string
  order?: number
  estimatedMinutes?: number
  videoUrl?: string
  audioUrl?: string
  audioFileName?: string
  audioStoragePath?: string
  bookUrl?: string
  bookFileName?: string
  bookStoragePath?: string
  contentType?: ModuleContentType
  textContent?: string
}

type ApiExamResponse = {
  id: string
  sectionId: string
  title: string
  description?: string
  status: string
  timeLimitMinutes?: number
  questionCount?: number
  uploadMetadata?: {
    source?: string
    originalFileName?: string
    fileUrl?: string
    storagePath?: string
  }
  retakePolicy?: {
    maxAttempts?: number | null
    cooldownHours?: number | null
  }
}

type ApiEnrollmentResponse = {
  id: string
  courseId: string
  userId: string
  status: 'active' | 'completed' | 'withdrawn'
  progressPercent?: number
  moduleProgress?: Record<string, number>
  badgeIssuedAt?: string
  certificateUrl?: string
}

type DigitalSchoolUploadResponse = {
  success: boolean
  url: string
  path: string
  fileName: string
  originalName?: string
  size: number
  contentType: string
  metadata?: {
    courseId?: string
    sectionId?: string
    moduleId?: string
    type?: string
  }
}

const requestJson = async <T,>(url: string, init: RequestInit = {}): Promise<T> => {
  const response = await fetch(url, {
    credentials: 'include',
    ...init,
  })

  let data: any = null
  try {
    data = await response.json()
  } catch {
    data = null
  }

  if (!response.ok) {
    throw new Error((data && data.error) || 'Request failed')
  }

  return data as T
}

async function uploadDigitalSchoolFile(
  file: File,
  params: {
    type: 'moduleAudio' | 'moduleBook' | 'examUpload'
    courseId?: string
    sectionId?: string
    moduleId?: string
  },
): Promise<DigitalSchoolUploadResponse> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('type', params.type)
  if (params.courseId) formData.append('courseId', params.courseId)
  if (params.sectionId) formData.append('sectionId', params.sectionId)
  if (params.moduleId) formData.append('moduleId', params.moduleId)

  const response = await fetch('/api/digital-school/uploads', {
    method: 'POST',
    body: formData,
    credentials: 'include',
  })

  let data: any = null
  try {
    data = await response.json()
  } catch {
    data = null
  }

  if (!response.ok) {
    throw new Error((data && data.error) || 'File upload failed')
  }

  return data as DigitalSchoolUploadResponse
}

const TODO_ITEMS = [
  {
    title: 'Course catalog UI',
    description: 'Display Foundation Class / School of Ministry tiles with access type + mentors.',
    status: 'Complete',
  },
  {
    title: 'Module layout',
    description: 'Group embedded videos + uploaded audio lessons inside sections.',
    status: 'Pending',
  },
  {
    title: 'CBT exam engine',
    description: 'Multiple-choice test UI with timers, parsing upload tool, and detailed results.',
    status: 'Pending',
  },
  {
    title: 'Admin workflows',
    description: 'Course creator, invite/request flows, exam/question uploads, result exports.',
    status: 'Pending',
  },
  {
    title: 'Leaderboard integration',
    description: 'Badge issuance after completion and visibility on member profiles.',
    status: 'Pending',
  },
]

export default function DigitalSchool() {
  const router = useRouter()
  const [courses, setCourses] = useState<Course[]>([])
  const [draftCourses, setDraftCourses] = useState<ApiCourseResponse[]>([])
  const [enrollments, setEnrollments] = useState<EnrollmentQueueItem[]>([])
  const [adminActions, setAdminActions] = useState<AdminAction[]>([])
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([])
  const [examUploads, setExamUploads] = useState<ExamUpload[]>([])
  const [examParseSummaries, setExamParseSummaries] = useState<Record<string, ExamParseSummaryState>>({})
  const [pendingExamImports, setPendingExamImports] = useState<
    Record<string, { fileUrl: string; originalName: string }>
  >({})
  const [progressRows, setProgressRows] = useState<ProgressRow[]>([])
  const [selectedProgress, setSelectedProgress] = useState<ProgressRow | null>(null)
  const [courseAnalytics, setCourseAnalytics] = useState<{
    summary: CourseAnalyticsSummary
    rows: CourseAnalyticsRow[]
  } | null>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [analyticsError, setAnalyticsError] = useState<string | null>(null)
  const [analyticsCourseId, setAnalyticsCourseId] = useState<string | null>(null)
  const [courseDraft, setCourseDraft] = useState<CourseDraft>(createCourseDraft())
  const [resumeMetadata, setResumeMetadata] = useState<ResumeMetadata | null>(null)
  const [draftMessage, setDraftMessage] = useState<string | null>(null)
  const [uploadMessage, setUploadMessage] = useState<string | null>(null)
  const [certificateMessage, setCertificateMessage] = useState<string | null>(null)
  const [reminderMessages, setReminderMessages] = useState<Record<string, string>>({})
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' } | null>(null)
  const [certificateLoading, setCertificateLoading] = useState<Record<string, boolean>>({})
  const [isLoadingCourses, setIsLoadingCourses] = useState(false)
  const [isLoadingEnrollments, setIsLoadingEnrollments] = useState(false)
  const [isSavingCourse, setIsSavingCourse] = useState(false)
  const [submitIntent, setSubmitIntent] = useState<'draft' | 'published'>('draft')
  const [isBuilderOpen, setIsBuilderOpen] = useState(false)
  const [resumingCourseId, setResumingCourseId] = useState<string | null>(null)
  const [deletingCourseId, setDeletingCourseId] = useState<string | null>(null)
  const [isCourseManager, setIsCourseManager] = useState(false)
  const [reviewCourseId, setReviewCourseId] = useState<string | null>(null)
  const [examAttempts, setExamAttempts] = useState<ExamAttemptRow[]>([])
  const [attemptsLoading, setAttemptsLoading] = useState(false)
  const [attemptsError, setAttemptsError] = useState<string | null>(null)
  const [selectedExamAttempt, setSelectedExamAttempt] = useState<ExamAttemptRow | null>(null)
  const [questionFilter, setQuestionFilter] = useState<QuestionFilter>('all')
  const [isExamReviewOpen, setIsExamReviewOpen] = useState(false)
  const examUploadInputRef = useRef<HTMLInputElement | null>(null)
  const fileInputsRef = useRef<Record<string, HTMLInputElement | null>>({})
  const [uploadingTargets, setUploadingTargets] = useState<Record<string, boolean>>({})
  const [enrollmentRecords, setEnrollmentRecords] = useState<ApiEnrollmentResponse[]>([])
  const [gatingSummaries, setGatingSummaries] = useState<SectionGatingSummary[]>([])
  const [leaderboardEntries, setLeaderboardEntries] = useState<LeaderboardEntry[]>([])
  const [leaderboardScope, setLeaderboardScope] = useState<LeaderboardScope>('global')
  const [leaderboardFilterId, setLeaderboardFilterId] = useState<string | null>(null)
  const [leaderboardFilterDraft, setLeaderboardFilterDraft] = useState('')
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(true)
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null)

  const supportsCourseArchive = false // TODO: replace deletions with archive/undo flow when audit requirements land.

  const setUploadingState = useCallback((key: string, value: boolean) => {
    setUploadingTargets((prev) => {
      if (value) {
        return {
          ...prev,
          [key]: true,
        }
      }
      const next = { ...prev }
      delete next[key]
      return next
    })
  }, [])

  const loadCourseAnalytics = useCallback(
    async (courseId: string) => {
      if (!courseId) return
      setAnalyticsLoading(true)
      setAnalyticsError(null)
      try {
        const data = await requestJson<{
          summary: CourseAnalyticsSummary
          rows: CourseAnalyticsRow[]
        }>(`/api/digital-school/courses/${courseId}/analytics`)
        setCourseAnalytics({
          summary: data.summary,
          rows: data.rows,
        })
      } catch (error) {
        console.error('DigitalSchool.loadCourseAnalytics', error)
        setCourseAnalytics(null)
        setAnalyticsError(error instanceof Error ? error.message : 'Unable to load analytics.')
      } finally {
        setAnalyticsLoading(false)
      }
    },
    [],
  )

  const handleAnalyticsCourseChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      const courseId = event.target.value || null
      setAnalyticsCourseId(courseId)
      if (courseId) {
        void loadCourseAnalytics(courseId)
      } else {
        setCourseAnalytics(null)
      }
    },
    [loadCourseAnalytics],
  )

  const isUploading = useCallback((key: string) => Boolean(uploadingTargets[key]), [uploadingTargets])
  const setCertificateLoadingState = useCallback((id: string, value: boolean) => {
    setCertificateLoading((prev) => {
      if (value) {
        return {
          ...prev,
          [id]: true,
        }
      }
      const next = { ...prev }
      delete next[id]
      return next
    })
  }, [])

  const loadCourses = useCallback(async () => {
    setIsLoadingCourses(true)
    try {
      const apiCourses = await requestJson<ApiCourseResponse[]>('/api/digital-school/courses')
      if (Array.isArray(apiCourses) && apiCourses.length) {
        // For course managers, show all courses. For members, show only published courses
        const allCourses = apiCourses.map(mapApiCourseToUi)
        const publishedCourses = allCourses.filter(course => course.rawStatus === 'published')
        
        setCourses(isCourseManager ? allCourses : publishedCourses)
        setDraftCourses(apiCourses.filter((course) => course.status === 'draft'))
      } else {
        setDraftCourses([])
      }
    } catch (error) {
      console.error('DigitalSchool.loadCourses', error)
    } finally {
      setIsLoadingCourses(false)
    }
  }, [isCourseManager])

  const loadEnrollments = useCallback(async () => {
    setIsLoadingEnrollments(true)
    try {
      const apiEnrollments = await requestJson<ApiEnrollmentResponse[]>('/api/digital-school/enrollments')
      setEnrollmentRecords(Array.isArray(apiEnrollments) ? apiEnrollments : [])
    } catch (error) {
      console.error('DigitalSchool.loadEnrollments', error)
    } finally {
      setIsLoadingEnrollments(false)
    }
  }, [])

  const loadLeaderboard = useCallback(async () => {
    setIsLoadingLeaderboard(true)
    setLeaderboardError(null)
    if (leaderboardScope !== 'global' && !leaderboardFilterId) {
      setLeaderboardEntries([])
      setIsLoadingLeaderboard(false)
      return
    }
    try {
      const params = new URLSearchParams({ type: leaderboardScope })
      if (leaderboardScope !== 'global' && leaderboardFilterId) {
        params.set('filterId', leaderboardFilterId)
      }
      const response = await fetch(`/api/gamification/leaderboard?${params.toString()}`, {
        credentials: 'include',
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data?.error || 'Unable to load leaderboard')
      }
      const data = (await response.json()) as LeaderboardEntry[]
      setLeaderboardEntries(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('DigitalSchool.loadLeaderboard', error)
      setLeaderboardEntries([])
      setLeaderboardError(error instanceof Error ? error.message : 'Unable to load leaderboard.')
    } finally {
      setIsLoadingLeaderboard(false)
    }
  }, [leaderboardFilterId, leaderboardScope])

  const handleLeaderboardScopeChange = useCallback((scope: LeaderboardScope) => {
    setLeaderboardScope(scope)
    setLeaderboardFilterDraft('')
    if (scope === 'global') {
      setLeaderboardFilterId(null)
    }
  }, [])

  const handleLeaderboardFilterDraftChange = useCallback(
    (value: string) => {
      setLeaderboardFilterDraft(value)
      if (leaderboardError) {
        setLeaderboardError(null)
      }
    },
    [leaderboardError],
  )

  const handleApplyLeaderboardFilter = useCallback(
    (event?: FormEvent<HTMLFormElement>) => {
      event?.preventDefault()
      const trimmed = leaderboardFilterDraft.trim()
      if (!trimmed) {
        setLeaderboardError('Enter an ID before applying this filter.')
        return
      }
      if (trimmed === leaderboardFilterId) {
        void loadLeaderboard()
        return
      }
      setLeaderboardFilterId(trimmed)
    },
    [leaderboardFilterDraft, leaderboardFilterId, loadLeaderboard],
  )

  const handleClearLeaderboardFilter = useCallback(() => {
    setLeaderboardFilterDraft('')
    setLeaderboardFilterId(null)
    setLeaderboardError(null)
  }, [])

  const handleDownloadTemplate = useCallback(() => {
    const instructions = [
      '# Digital School CBT Template',
      '# Columns: question | optionA | optionB | optionC | optionD | correctOption | durationSeconds | explanation | weight',
      '# Accepted formats:',
      '#   • correctOption: letter (A/B/C/D), 1-based index, or the exact option text.',
      '#   • durationSeconds: number of seconds or mm:ss (e.g., 90 or 01:30). Defaults to 60 if empty.',
      '#   • Add more option columns (optionE, optionF, …) if needed. Leave blanks for unused options.',
      '#   • Rows starting with # are ignored. Header row optional.',
      '#   • Spreadsheet/JSON uploads follow the same column names.',
      '#',
      'question,optionA,optionB,optionC,optionD,correctOption,durationSeconds,explanation,weight',
      '"Who is the Holy Spirit?","Comforter","Friend","Guide","All of the above","D","60","Helper promised by Jesus","1"',
    ].join('\n')

    const csv = `${instructions}\n`
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', 'digital-school-cbt-template.csv')
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }, [])

  useEffect(() => {
    loadCourses()
  }, [loadCourses])

  useEffect(() => {
    loadEnrollments()
  }, [loadEnrollments])

  useEffect(() => {
    loadLeaderboard()
  }, [loadLeaderboard])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch('/api/users/me', { credentials: 'include' })
        if (!res.ok) return
        const data = await res.json()
        if (!cancelled) {
          const role = String(data?.role || '').toUpperCase()
          setIsCourseManager(COURSE_MANAGER_ROLES.has(role))
        }
      } catch (error) {
        console.error('DigitalSchool.loadViewerRole', error)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(null), 5000)
    return () => window.clearTimeout(id)
  }, [toast])

  useEffect(() => {
    setEnrollments(buildEnrollmentQueue(enrollmentRecords, courses))
    setProgressRows(buildProgressRows(enrollmentRecords, courses))
    setGatingSummaries(buildGatingSummaries(enrollmentRecords, courses))
  }, [enrollmentRecords, courses])

  useEffect(() => {
    if (!isBuilderOpen) return
    if (typeof document === 'undefined') return
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [isBuilderOpen])

  const closeBuilder = useCallback(() => {
    setIsBuilderOpen(false)
  }, [])

  useEffect(() => {
    if (!isBuilderOpen) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeBuilder()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [closeBuilder, isBuilderOpen])

  const resetBuilderState = useCallback((options?: { message?: string | null }) => {
    setCourseDraft(createCourseDraft())
    setResumeMetadata(null)
    setDraftMessage(options?.message ?? null)
    fileInputsRef.current = {}
  }, [])

  const closeAndResetBuilder = useCallback(
    (options?: { message?: string | null }) => {
      resetBuilderState({ message: options?.message ?? null })
      setIsBuilderOpen(false)
    },
    [resetBuilderState],
  )

  const handleResetBuilder = useCallback(() => {
    resetBuilderState({ message: 'Started a fresh draft builder.' })
  }, [resetBuilderState])

  const handleOpenNewCourse = useCallback(() => {
    resetBuilderState({ message: null })
    setIsBuilderOpen(true)
  }, [resetBuilderState])

  const handleResumeDraft = useCallback(
    async (courseId: string) => {
      setResumingCourseId(courseId)
      setDraftMessage(null)
      setIsBuilderOpen(true)
      try {
        const courseDetails = await requestJson<ApiCourseResponse>(`/api/digital-school/courses/${courseId}`)
        const sections = await requestJson<ApiSectionResponse[]>(`/api/digital-school/sections?courseId=${courseId}`)

        const builtSections = await Promise.all(
          (sections ?? []).map(async (section) => {
            const [modules, exams] = await Promise.all([
              requestJson<ApiModuleResponse[]>(
                `/api/digital-school/modules?courseId=${courseId}&sectionId=${section.id}`,
              ),
              requestJson<ApiExamResponse[]>(
                `/api/digital-school/exams?courseId=${courseId}&sectionId=${section.id}`,
              ),
            ])

            const moduleDrafts =
              Array.isArray(modules) && modules.length
                ? modules.map((module) =>
                    createModuleDraft({
                      id: module.id,
                      persistedId: module.id,
                      title: module.title,
                      description: module.description ?? '',
                      estimatedMinutes: module.estimatedMinutes ?? 30,
                      videoUrl: module.videoUrl ?? '',
                      audioUrl: module.audioUrl ?? '',
                      audioFileName: module.audioFileName,
                      audioStoragePath: module.audioStoragePath,
                      bookUrl: module.bookUrl ?? '',
                      bookFileName: module.bookFileName,
                      bookStoragePath: module.bookStoragePath,
                      contentType: module.contentType ?? 'video',
                      textContent: module.textContent ?? '',
                    }),
                  )
                : [createModuleDraft()]

            const examPayload = Array.isArray(exams) ? exams[0] : undefined
            const examDraft = createExamDraft({
              persistedId: examPayload?.id,
              title: examPayload?.title ?? '',
              description: examPayload?.description ?? '',
              timeLimitMinutes: examPayload?.timeLimitMinutes ?? 30,
              questionCount: examPayload?.questionCount ?? 20,
              status: (examPayload?.status as SectionExamDraft['status']) ?? 'draft',
              uploadPlaceholder: examPayload?.uploadMetadata?.originalFileName ?? '',
              uploadUrl: examPayload?.uploadMetadata?.fileUrl,
              uploadStoragePath: examPayload?.uploadMetadata?.storagePath,
              retakeMaxAttempts: examPayload?.retakePolicy?.maxAttempts ?? null,
              retakeCooldownHours: examPayload?.retakePolicy?.cooldownHours ?? null,
            })

            return createSectionDraft({
              id: section.id,
              persistedId: section.id,
              title: section.title,
              description: section.description ?? '',
              modules: moduleDrafts,
              exam: examDraft,
            })
          }),
        )

        const nextSections = builtSections.length ? builtSections : [createSectionDraft()]
        const mentors = courseDetails.mentors?.join(', ') ?? ''
        const formatTags = courseDetails.tags?.join(', ') ?? ''

        setCourseDraft({
          title: courseDetails.title ?? '',
          access: courseDetails.accessType ?? 'open',
          mentors,
          summary: courseDetails.summary ?? '',
          estimatedHours: courseDetails.estimatedHours ?? 6,
          format: formatTags,
          pricing: courseDetails.pricing ?? { type: 'free' },
          sections: nextSections,
          certificateTheme: mergeCertificateTheme(courseDetails.certificateTheme),
        })

        const modulesBySection: ResumeMetadata['modulesBySection'] = {}
        const examIdsBySection: ResumeMetadata['examIdsBySection'] = {}

        nextSections.forEach((section) => {
          const sectionKey = section.persistedId ?? section.id
          modulesBySection[sectionKey] = section.modules
            .map((module) => module.persistedId)
            .filter((id): id is string => Boolean(id))
          if (section.exam.persistedId) {
            examIdsBySection[sectionKey] = [section.exam.persistedId]
          }
        })

        setResumeMetadata({
          courseId,
          courseTitle: courseDetails.title ?? 'Draft course',
          sectionIds: nextSections.map((section) => section.persistedId ?? section.id),
          modulesBySection,
          examIdsBySection,
        })
        fileInputsRef.current = {}
        setDraftMessage(`Loaded "${courseDetails.title}" draft — continue editing then save to update.`)
      } catch (error) {
        console.error('DigitalSchool.handleResumeDraft', error)
        setDraftMessage(null)
        const message =
          error instanceof Error && /requires an index/i.test(error.message)
            ? 'Unable to load draft due to a missing database index. Please contact support.'
            : error instanceof Error
              ? `Unable to load draft: ${error.message}`
              : 'Unable to load draft right now.'
        setToast({ message, tone: 'error' })
      } finally {
        setResumingCourseId(null)
      }
    },
    [],
  )

  const handleEditCourse = useCallback(
    (courseId: string) => {
      void handleResumeDraft(courseId)
    },
    [handleResumeDraft],
  )

  const handleDeleteCourse = useCallback(
    async (courseId: string) => {
      if (deletingCourseId || supportsCourseArchive) return
      const course = courses.find((item) => item.id === courseId)
      const confirmed = window.confirm(
        course ? `Delete "${course.title}" and its draft data? This cannot be undone.` : 'Delete this course draft?',
      )
      if (!confirmed) return
      setDeletingCourseId(courseId)
      try {
        await requestJson(`/api/digital-school/courses/${courseId}`, { method: 'DELETE' })
        if (resumeMetadata?.courseId === courseId) {
          closeAndResetBuilder({ message: 'Deleted draft builder.' })
        }
        await loadCourses()
        setToast({
          message: `Removed "${course?.title ?? 'draft'}" from catalog.`,
          tone: 'success',
        })
      } catch (error) {
        console.error('DigitalSchool.handleDeleteCourse', error)
        setToast({
          message: error instanceof Error ? `Unable to delete: ${error.message}` : 'Unable to delete course.',
          tone: 'error',
        })
      } finally {
        setDeletingCourseId(null)
      }
    },
    [closeAndResetBuilder, courses, deletingCourseId, loadCourses, resumeMetadata?.courseId, supportsCourseArchive],
  )

  const reviewableCourses = useMemo(() => {
    if (!enrollmentRecords.length) return []
    const courseMap = new Map(courses.map((course) => [course.id, course]))
    const seen = new Set<string>()
    return enrollmentRecords.reduce<Array<{ courseId: string; title: string; isCompleted: boolean }>>((acc, enrollment) => {
      if (seen.has(enrollment.courseId)) return acc
      const course = courseMap.get(enrollment.courseId)
      if (!course) return acc
      seen.add(enrollment.courseId)
      acc.push({
        courseId: course.id,
        title: course.title,
        isCompleted: enrollment.status === 'completed',
      })
      return acc
    }, [])
  }, [courses, enrollmentRecords])

  useEffect(() => {
    if (!reviewableCourses.length) {
      if (reviewCourseId !== null) {
        setReviewCourseId(null)
      }
      return
    }
    if (!reviewCourseId || !reviewableCourses.some((course) => course.courseId === reviewCourseId)) {
      setReviewCourseId(reviewableCourses[0].courseId)
    }
  }, [reviewableCourses, reviewCourseId])

  useEffect(() => {
    if (!reviewCourseId || !isExamReviewOpen) {
      setExamAttempts([])
      setSelectedExamAttempt(null)
      return
    }
    let cancelled = false
    ;(async () => {
      setAttemptsLoading(true)
      try {
        const attempts = await requestJson<ExamAttemptRow[]>(
          `/api/digital-school/attempts?courseId=${reviewCourseId}&includeQuestionSummaries=1`,
        )
        if (cancelled) return
        setExamAttempts(attempts)
        setSelectedExamAttempt((prev) =>
          prev ? attempts.find((attempt) => attempt.id === prev.id) ?? null : attempts[0] ?? null,
        )
        setAttemptsError(null)
      } catch (error) {
        if (cancelled) return
        console.error('DigitalSchool.loadExamAttempts', error)
        setAttemptsError(error instanceof Error ? error.message : 'Unable to load attempts.')
        setExamAttempts([])
        setSelectedExamAttempt(null)
      } finally {
        if (!cancelled) {
          setAttemptsLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [isExamReviewOpen, reviewCourseId])

  useEffect(() => {
    setQuestionFilter('all')
  }, [selectedExamAttempt?.id])

  const selectedAttemptQuestionEntries = useMemo(() => {
    if (!selectedExamAttempt?.questionSummaries?.length) return []
    const responseMap = new Map(
      (selectedExamAttempt.responses ?? []).map((response) => [response.questionId, response]),
    )
    return selectedExamAttempt.questionSummaries.map((question, index) => ({
      question,
      index,
      response: responseMap.get(question.id),
    }))
  }, [selectedExamAttempt])

  const filteredQuestionEntries = useMemo(() => {
    if (questionFilter === 'all') return selectedAttemptQuestionEntries
    return selectedAttemptQuestionEntries.filter(({ response }) =>
      questionFilter === 'correct' ? response?.correct : !(response?.correct),
    )
  }, [questionFilter, selectedAttemptQuestionEntries])

  const accessBadge = (access: AccessType) => {
    switch (access) {
      case 'open':
        return 'bg-emerald-100 text-emerald-700'
      case 'request':
        return 'bg-amber-100 text-amber-700'
      case 'invite':
      default:
        return 'bg-indigo-100 text-indigo-700'
    }
  }

  const handleDraftChange = (field: keyof CourseDraft, value: string | number | AccessType | CoursePricing) => {
    setCourseDraft((prev) => ({
      ...prev,
      [field]:
        field === 'pricing'
          ? (value as CoursePricing)
          : typeof value === 'string'
            ? value
            : Number(value),
    }))
  }

  const handleCertificateThemeChange = useCallback(
    (field: keyof CertificateThemeDraft, value: string | CertificateTemplate) => {
      setCourseDraft((prev) => ({
        ...prev,
        certificateTheme: {
          ...prev.certificateTheme,
          [field]: value,
        },
      }))
    },
    []
  )

  const updateSections = (updater: (sections: SectionDraft[]) => SectionDraft[]) => {
    setCourseDraft((prev) => ({
      ...prev,
      sections: updater(prev.sections),
    }))
  }

  const handleAddSection = () => {
    updateSections((sections) => [...sections, createSectionDraft()])
  }

  const handleRemoveSection = (sectionId: string) => {
    updateSections((sections) => (sections.length > 1 ? sections.filter((section) => section.id !== sectionId) : sections))
  }

  const handleSectionChange = (sectionId: string, field: 'title' | 'description', value: string) => {
    updateSections((sections) =>
      sections.map((section) => (section.id === sectionId ? { ...section, [field]: value } : section)),
    )
  }

  const handleAddModule = (sectionId: string) => {
    updateSections((sections) =>
      sections.map((section) =>
        section.id === sectionId ? { ...section, modules: [...section.modules, createModuleDraft()] } : section,
      ),
    )
  }

  const handleRemoveModule = (sectionId: string, moduleId: string) => {
    updateSections((sections) =>
      sections.map((section) =>
        section.id === sectionId && section.modules.length > 1
          ? { ...section, modules: section.modules.filter((module) => module.id !== moduleId) }
          : section,
      ),
    )
  }

  type ModuleEditableField =
    | 'title'
    | 'description'
    | 'videoUrl'
    | 'audioUrl'
    | 'bookUrl'
    | 'estimatedMinutes'
    | 'contentType'
    | 'textContent'

  const handleModuleChange = (sectionId: string, moduleId: string, field: ModuleEditableField, value: string) => {
    updateSections((sections) =>
      sections.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              modules: section.modules.map((module) =>
                module.id === moduleId
                  ? (() => {
                      if (field === 'estimatedMinutes') {
                        return {
                          ...module,
                          estimatedMinutes: Math.max(5, Number(value) || 0),
                        }
                      }

                      if (field === 'contentType') {
                        const nextType = value as ModuleContentType
                        const resets: Partial<ModuleDraft> =
                          nextType === 'video'
                            ? {
                                audioUrl: '',
                                audioFileName: undefined,
                                audioStoragePath: undefined,
                                textContent: '',
                              }
                            : nextType === 'audio'
                              ? {
                                  videoUrl: '',
                                  textContent: '',
                                }
                              : {
                                  videoUrl: '',
                                  audioUrl: '',
                                  audioFileName: undefined,
                                  audioStoragePath: undefined,
                                }

                        return {
                          ...module,
                          ...resets,
                          contentType: nextType,
                        }
                      }

                      return {
                        ...module,
                        [field]: value,
                      }
                    })()
                  : module,
              ),
            }
          : section,
      ),
    )
  }

  const handleModuleFileChange = async (sectionId: string, moduleId: string, type: 'audio' | 'book', file: File | null) => {
    if (!file) return
    const uploadKey = `${moduleId}-${type}`
    setUploadingState(uploadKey, true)
    try {
      const upload = await uploadDigitalSchoolFile(file, {
        type: type === 'audio' ? 'moduleAudio' : 'moduleBook',
        sectionId,
        moduleId,
      })

      updateSections((sections) =>
        sections.map((section) =>
          section.id === sectionId
            ? {
                ...section,
                modules: section.modules.map((module) =>
                  module.id === moduleId
                    ? {
                        ...module,
                        audioFileName: type === 'audio' ? upload.originalName || upload.fileName : module.audioFileName,
                        bookFileName: type === 'book' ? upload.originalName || upload.fileName : module.bookFileName,
                        audioUrl: type === 'audio' ? upload.url : module.audioUrl,
                        bookUrl: type === 'book' ? upload.url : module.bookUrl,
                        audioStoragePath: type === 'audio' ? upload.path : module.audioStoragePath,
                        bookStoragePath: type === 'book' ? upload.path : module.bookStoragePath,
                      }
                    : module,
                ),
              }
            : section,
        ),
      )
      setUploadMessage(`Uploaded ${file.name}`)
    } catch (error) {
      console.error('DigitalSchool.handleModuleFileChange', error)
      setUploadMessage(error instanceof Error ? `Upload failed: ${error.message}` : 'Unable to upload file.')
    } finally {
      setUploadingState(uploadKey, false)
    }
  }

  const handleExamChange = (sectionId: string, field: keyof SectionExamDraft, value: string | number) => {
    updateSections((sections) =>
      sections.map((section) => {
        if (section.id !== sectionId) return section

        let resolvedValue: string | number | null = value
        if (field === 'timeLimitMinutes' || field === 'questionCount') {
          const numeric = typeof value === 'number' ? value : Number(value)
          const minimum = field === 'questionCount' ? 1 : 1
          resolvedValue = Math.max(minimum, Number.isFinite(numeric) ? numeric : minimum)
        } else if (field === 'retakeMaxAttempts' || field === 'retakeCooldownHours') {
          if (value === '' || value === null) {
            resolvedValue = null
          } else {
            const numeric = typeof value === 'number' ? value : Number(value)
            resolvedValue = Number.isFinite(numeric) && numeric > 0 ? Math.round(numeric) : null
          }
        }

        return {
          ...section,
          exam: {
            ...section.exam,
            [field]: resolvedValue,
          },
        }
      }),
    )
  }

  const getExamIdForSection = useCallback(
    (sectionId: string) => {
      return courseDraft.sections.find((section) => section.id === sectionId)?.exam.persistedId
    },
    [courseDraft.sections],
  )

  const handleExamFileChange = async (sectionId: string, file: File | null) => {
    if (!file) return
    const uploadKey = `exam-${sectionId}`
    setUploadingState(uploadKey, true)
    try {
      const examId = getExamIdForSection(sectionId)
      const upload = await uploadDigitalSchoolFile(file, { type: 'examUpload', sectionId })
      updateSections((sections) =>
        sections.map((section) =>
          section.id === sectionId
            ? {
                ...section,
                exam: {
                  ...section.exam,
                  uploadPlaceholder: upload.originalName || upload.fileName,
                  uploadUrl: upload.url,
                  uploadStoragePath: upload.path,
                },
              }
            : section,
        ),
      )
      setUploadMessage(`Uploaded ${file.name}`)

      if (examId) {
        setPendingExamImports((prev) => ({
          ...prev,
          [sectionId]: {
            fileUrl: upload.url,
            originalName: upload.originalName || upload.fileName,
          },
        }))
        setExamParseSummaries((prev) => ({
          ...prev,
          [sectionId]: {
            status: 'idle',
          },
        }))
        setToast({
          message: 'Exam file ready. Click “Import questions” to parse and replace existing items.',
          tone: 'success',
        })
      } else {
        setExamParseSummaries((prev) => ({
          ...prev,
          [sectionId]: {
            status: 'error',
            error: 'Save draft to generate an exam ID before parsing.',
          },
        }))
        setToast({
          message: 'Save your draft before importing questions — exam ID is missing.',
          tone: 'error',
        })
      }
    } catch (error) {
      console.error('DigitalSchool.handleExamFileChange', error)
      setUploadMessage(error instanceof Error ? `Upload failed: ${error.message}` : 'Unable to upload exam file.')
      setExamParseSummaries((prev) => ({
        ...prev,
        [sectionId]: {
          status: 'error',
          error: error instanceof Error ? error.message : 'Unable to upload exam file.',
        },
      }))
      setToast({
        message: error instanceof Error ? `Exam upload failed: ${error.message}` : 'Exam upload failed.',
        tone: 'error',
      })
    } finally {
      setUploadingState(uploadKey, false)
    }
  }

  const registerFileInput = (key: string) => (element: HTMLInputElement | null) => {
    if (!element) {
      delete fileInputsRef.current[key]
      return
    }
    fileInputsRef.current[key] = element
  }

  const triggerFilePicker = (key: string) => {
    fileInputsRef.current[key]?.click()
  }

  const clearPendingExamImport = useCallback((sectionId: string) => {
    setPendingExamImports((prev) => {
      const next = { ...prev }
      delete next[sectionId]
      return next
    })
  }, [])

  const handleImportExamQuestions = useCallback(
    async (sectionId: string) => {
      const examId = getExamIdForSection(sectionId)
      const pending = pendingExamImports[sectionId]
      if (!examId) {
        setToast({
          message: 'Save your draft to create an exam before importing questions.',
          tone: 'error',
        })
        return
      }
      if (!pending) {
        setToast({
          message: 'Upload an exam file first before importing.',
          tone: 'error',
        })
        return
      }

      setExamParseSummaries((prev) => ({
        ...prev,
        [sectionId]: { status: 'parsing' },
      }))

      try {
        const summaryResponse = await requestJson<{
          summary: ExamParseSummaryState['summary']
        }>(`/api/digital-school/exams/${examId}/parse-upload`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileUrl: pending.fileUrl,
            originalName: pending.originalName,
            replaceExisting: true,
          }),
        })

        const summary = summaryResponse.summary
        setExamParseSummaries((prev) => ({
          ...prev,
          [sectionId]: {
            status: 'success',
            summary,
          },
        }))

        const importedCount =
          typeof summary?.createdCount === 'number'
            ? summary.createdCount
            : typeof summary?.totalRows === 'number'
              ? summary.totalRows - (summary.skipped?.length ?? 0)
              : 0

        if (importedCount > 0) {
          setCourseDraft((prev) => ({
            ...prev,
            sections: prev.sections.map((section) =>
              section.id === sectionId
                ? {
                    ...section,
                    exam: {
                      ...section.exam,
                      questionCount: importedCount,
                      status: 'published',
                    },
                  }
                : section,
            ),
          }))
        }

        clearPendingExamImport(sectionId)

        const sectionMeta = courseDraft.sections.find((section) => section.id === sectionId)
        setToast({
          message:
          importedCount > 0
            ? `Imported ${importedCount} question${importedCount === 1 ? '' : 's'} for “${sectionMeta?.exam.title || 'Section exam'}”.`
            : `No questions were imported for “${sectionMeta?.exam.title || 'Section exam'}”. Check skipped rows and template formatting.`,
        tone: importedCount > 0 ? 'success' : 'error',
      })
      } catch (error) {
        console.error('DigitalSchool.handleImportExamQuestions', error)
        setExamParseSummaries((prev) => ({
          ...prev,
          [sectionId]: {
            status: 'error',
            error: error instanceof Error ? error.message : 'Unable to parse exam file.',
          },
        }))
        setToast({
          message:
            error instanceof Error ? `Unable to import questions: ${error.message}` : 'Unable to import questions.',
          tone: 'error',
        })
      }
    },
    [courseDraft.sections, pendingExamImports, getExamIdForSection, clearPendingExamImport, setToast],
  )

  const handleModuleFileInput =
    (sectionId: string, moduleId: string, type: 'audio' | 'book') => async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0] ?? null
      event.target.value = ''
      if (!file) return
      await handleModuleFileChange(sectionId, moduleId, type, file)
    }

  const handleExamFileInput = (sectionId: string) => async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    event.target.value = ''
    if (!file) return
    await handleExamFileChange(sectionId, file)
  }

  const handleSendReminder = (courseId: string) => {
    const course = courses.find((item) => item.id === courseId)
    const courseTitle = course?.title ?? 'this course'
    setReminderMessages((prev) => ({
      ...prev,
      [courseId]: `Reminder scheduled — we’ll nudge you to resume ${courseTitle}.`,
    }))
  }

  const handleSaveDraft = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isSavingCourse) return

    const submitEvent = event.nativeEvent as SubmitEvent
    const submitter = submitEvent?.submitter as HTMLButtonElement | null
    const desiredIntent = (submitter?.dataset.intent as 'draft' | 'published') ?? submitIntent ?? 'draft'

    if (!courseDraft.title.trim()) {
      setDraftMessage('Course title is required before saving.')
      return
    }

    const mentors = courseDraft.mentors
      .split(',')
      .map((mentor) => mentor.trim())
      .filter(Boolean)
    const formatTags = courseDraft.format
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)

    const moduleCount = courseDraft.sections.reduce((total, section) => total + section.modules.length, 0)
    const headers = {
      'Content-Type': 'application/json',
    }

    const coursePayload = {
      title: courseDraft.title.trim(),
      summary: courseDraft.summary?.trim() || 'New discipleship modules launching soon.',
      accessType: courseDraft.access,
      mentors,
      estimatedHours: Math.max(1, Math.round(courseDraft.estimatedHours)),
      tags: formatTags,
      status: desiredIntent,
      pricing: courseDraft.pricing,
      certificateTheme: courseDraft.certificateTheme,
    }

    setIsSavingCourse(true)
    setSubmitIntent(desiredIntent)
    setDraftMessage(null)

    try {
      if (resumeMetadata?.courseId) {
        const courseId = resumeMetadata.courseId
        await requestJson<ApiCourseResponse>(`/api/digital-school/courses/${courseId}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(coursePayload),
        })

        const existingSectionIds = new Set(resumeMetadata.sectionIds)
        const nextSectionIds: string[] = []
        const nextModulesBySection: ResumeMetadata['modulesBySection'] = {}
        const nextExamIdsBySection: ResumeMetadata['examIdsBySection'] = {}
        const sectionPersistedMap: Record<string, string> = {}
        const modulePersistedMap: Record<string, string> = {}
        const examPersistedMap: Record<string, string | undefined> = {}

        for (const [sectionIndex, section] of courseDraft.sections.entries()) {
          const sectionMinutes = section.modules.reduce((total, module) => total + module.estimatedMinutes, 0)
          const sectionHours = Math.max(1, Math.round(sectionMinutes / 60) || 1)
          const baseSectionPayload = {
            title: section.title.trim() || `Section ${sectionIndex + 1}`,
            description: section.description,
            order: sectionIndex + 1,
            estimatedHours: sectionHours,
          }

          let persistedSectionId = section.persistedId
          if (persistedSectionId) {
            await requestJson<ApiSectionResponse>(`/api/digital-school/sections/${persistedSectionId}`, {
              method: 'PUT',
              headers,
              body: JSON.stringify(baseSectionPayload),
            })
            existingSectionIds.delete(persistedSectionId)
          } else {
            const createdSection = await requestJson<ApiSectionResponse>('/api/digital-school/sections', {
              method: 'POST',
              headers,
              body: JSON.stringify({
                ...baseSectionPayload,
                courseId,
              }),
            })
            persistedSectionId = createdSection.id
          }

          if (!persistedSectionId) continue
          sectionPersistedMap[section.id] = persistedSectionId
          nextSectionIds.push(persistedSectionId)

          const existingModuleIds = new Set(resumeMetadata.modulesBySection[persistedSectionId] ?? [])
          const moduleIdsForMetadata: string[] = []

          for (const [moduleIndex, module] of section.modules.entries()) {
            const modulePayload = {
              title: module.title.trim() || `Module ${moduleIndex + 1}`,
              description: module.description,
              order: moduleIndex + 1,
              estimatedMinutes: module.estimatedMinutes,
              videoUrl: module.videoUrl || undefined,
              audioUrl: module.audioUrl || undefined,
              audioFileName: module.audioFileName,
              audioStoragePath: module.audioStoragePath,
              bookUrl: module.bookUrl || undefined,
              bookFileName: module.bookFileName,
              bookStoragePath: module.bookStoragePath,
              contentType: module.contentType,
              textContent: module.textContent || undefined,
            }

            if (module.persistedId) {
              await requestJson<ApiModuleResponse>(`/api/digital-school/modules/${module.persistedId}`, {
                method: 'PUT',
                headers,
                body: JSON.stringify(modulePayload),
              })
              existingModuleIds.delete(module.persistedId)
              moduleIdsForMetadata.push(module.persistedId)
              modulePersistedMap[module.id] = module.persistedId
            } else {
              const createdModule = await requestJson<ApiModuleResponse>('/api/digital-school/modules', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                  ...modulePayload,
                  courseId,
                  sectionId: persistedSectionId,
                }),
              })
              moduleIdsForMetadata.push(createdModule.id)
              modulePersistedMap[module.id] = createdModule.id
            }
          }

          for (const orphanModuleId of existingModuleIds) {
            await requestJson(`/api/digital-school/modules/${orphanModuleId}`, {
              method: 'DELETE',
            })
          }

          nextModulesBySection[persistedSectionId] = moduleIdsForMetadata

          const previousExamId = resumeMetadata.examIdsBySection[persistedSectionId]?.[0]
          const retakePolicyPayload = buildRetakePolicyPayload(section.exam)
          const examPayload = {
            title: section.exam.title.trim() || `${section.title || `Section ${sectionIndex + 1}`} exam`,
            description: section.exam.description,
            timeLimitMinutes: section.exam.timeLimitMinutes,
            status: section.exam.status,
            questionCount: section.exam.questionCount,
            uploadMetadata: section.exam.uploadPlaceholder
              ? {
                  source: 'admin-upload',
                  originalFileName: section.exam.uploadPlaceholder,
                  fileUrl: section.exam.uploadUrl,
                  storagePath: section.exam.uploadStoragePath,
                }
              : undefined,
            retakePolicy: retakePolicyPayload,
          }

          let resolvedExamId = section.exam.persistedId
          if (resolvedExamId) {
            await requestJson<ApiExamResponse>(`/api/digital-school/exams/${resolvedExamId}`, {
              method: 'PUT',
              headers,
              body: JSON.stringify(examPayload),
            })
          } else {
            if (previousExamId) {
              await requestJson(`/api/digital-school/exams/${previousExamId}`, {
                method: 'DELETE',
              })
            }
            const createdExam = await requestJson<ApiExamResponse>('/api/digital-school/exams', {
              method: 'POST',
              headers,
              body: JSON.stringify({
                ...examPayload,
                courseId,
                sectionId: persistedSectionId,
              }),
            })
            resolvedExamId = createdExam.id
          }

          if (resolvedExamId) {
            nextExamIdsBySection[persistedSectionId] = [resolvedExamId]
            examPersistedMap[section.id] = resolvedExamId
          } else {
            nextExamIdsBySection[persistedSectionId] = []
          }
        }

        for (const orphanSectionId of existingSectionIds) {
          const orphanModuleIds = resumeMetadata.modulesBySection[orphanSectionId] ?? []
          for (const moduleId of orphanModuleIds) {
            await requestJson(`/api/digital-school/modules/${moduleId}`, { method: 'DELETE' })
          }
          const orphanExamIds = resumeMetadata.examIdsBySection[orphanSectionId] ?? []
          for (const examId of orphanExamIds) {
            await requestJson(`/api/digital-school/exams/${examId}`, { method: 'DELETE' })
          }
          await requestJson(`/api/digital-school/sections/${orphanSectionId}`, { method: 'DELETE' })
        }

        await loadCourses()

        setResumeMetadata({
          courseId,
          courseTitle: coursePayload.title,
          sectionIds: nextSectionIds,
          modulesBySection: nextModulesBySection,
          examIdsBySection: nextExamIdsBySection,
        })

        setCourseDraft((prev) => ({
          ...prev,
          sections: prev.sections.map((section) => ({
            ...section,
            persistedId: sectionPersistedMap[section.id] ?? section.persistedId,
            modules: section.modules.map((module) => ({
              ...module,
              persistedId: modulePersistedMap[module.id] ?? module.persistedId,
            })),
            exam: {
              ...section.exam,
              persistedId: examPersistedMap[section.id] ?? section.exam.persistedId,
            },
          })),
        }))

        setDraftMessage(`Updated "${coursePayload.title}" draft – ${courseDraft.sections.length} sections synced.`)
      } else {
        const createdCourse = await requestJson<ApiCourseResponse>('/api/digital-school/courses', {
          method: 'POST',
          headers,
          body: JSON.stringify(coursePayload),
        })

        const courseId = createdCourse.id

        for (const [sectionIndex, section] of courseDraft.sections.entries()) {
          const sectionMinutes = section.modules.reduce((total, module) => total + module.estimatedMinutes, 0)
          const sectionHours = Math.max(1, Math.round(sectionMinutes / 60) || 1)

          const createdSection = await requestJson<ApiSectionResponse>('/api/digital-school/sections', {
            method: 'POST',
            headers,
            body: JSON.stringify({
              courseId,
              title: section.title.trim() || `Section ${sectionIndex + 1}`,
              description: section.description,
              order: sectionIndex + 1,
              estimatedHours: sectionHours,
            }),
          })

          for (const [moduleIndex, module] of section.modules.entries()) {
            await requestJson<ApiModuleResponse>('/api/digital-school/modules', {
              method: 'POST',
              headers,
              body: JSON.stringify({
                courseId,
                sectionId: createdSection.id,
                title: module.title.trim() || `Module ${moduleIndex + 1}`,
                description: module.description,
                order: moduleIndex + 1,
                estimatedMinutes: module.estimatedMinutes,
                videoUrl: module.videoUrl || undefined,
                audioUrl: module.audioUrl || undefined,
                audioFileName: module.audioFileName,
                audioStoragePath: module.audioStoragePath,
                bookUrl: module.bookUrl || undefined,
                bookFileName: module.bookFileName,
                bookStoragePath: module.bookStoragePath,
                contentType: module.contentType,
                textContent: module.textContent || undefined,
              }),
            })
          }

          const retakePolicyPayload = buildRetakePolicyPayload(section.exam)
          await requestJson<ApiExamResponse>('/api/digital-school/exams', {
            method: 'POST',
            headers,
            body: JSON.stringify({
              courseId,
              sectionId: createdSection.id,
              title: section.exam.title.trim() || `${section.title || `Section ${sectionIndex + 1}`} exam`,
              description: section.exam.description,
              timeLimitMinutes: section.exam.timeLimitMinutes,
              status: section.exam.status,
              questionCount: section.exam.questionCount,
              uploadMetadata: section.exam.uploadPlaceholder
                ? {
                    source: 'admin-upload',
                    originalFileName: section.exam.uploadPlaceholder,
                    fileUrl: section.exam.uploadUrl,
                    storagePath: section.exam.uploadStoragePath,
                  }
                : undefined,
              retakePolicy: retakePolicyPayload,
            }),
          })
        }

        await loadCourses()

        setAdminActions((prev) => [
          {
            title: `${coursePayload.title} · Module Builder`,
            status:
              desiredIntent === 'published'
                ? `Published (${courseDraft.sections.length} sections · ${moduleCount} modules)`
                : `Draft saved (${courseDraft.sections.length} sections · ${moduleCount} modules)`,
            updatedBy: 'You',
            timestamp: 'Just now',
          },
          ...prev,
        ])

        setCourseDraft(createCourseDraft())
        setResumeMetadata(null)
        fileInputsRef.current = {}
        setDraftMessage(
          desiredIntent === 'published'
            ? `Published "${coursePayload.title}" — now visible in the catalog.`
            : `Saved "${coursePayload.title}" draft – ready for scheduled reminders and exams.`,
        )
      }

      setToast({
        message:
          desiredIntent === 'published' ? `Published "${coursePayload.title}".` : `Saved "${coursePayload.title}" as draft.`,
        tone: 'success',
      })

      if (desiredIntent === 'published') {
        closeAndResetBuilder()
      }
    } catch (error) {
      console.error('DigitalSchool.handleSaveDraft', error)
      setDraftMessage(error instanceof Error ? `Unable to save draft: ${error.message}` : 'Unable to save draft right now.')
    } finally {
      setIsSavingCourse(false)
      setSubmitIntent('draft')
    }
  }

  const builderModal =
    isCourseManager && isBuilderOpen ? (
      <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="course-builder-title">
        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" aria-hidden="true" onClick={closeBuilder} />
        <div className="relative z-10 flex h-full w-full items-center justify-center p-4 md:p-8">
          <div className="relative flex w-full max-w-5xl max-h-full flex-col overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-2xl">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-100 bg-white/95 px-6 py-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-gray-400">Admin cockpit</p>
                <h2 id="course-builder-title" className="text-xl font-semibold text-gray-900">
                  Course creation workflow
                </h2>
                <p className="mt-1 text-xs text-gray-500">
                  {resumeMetadata ? `Resuming "${resumeMetadata.courseTitle}"` : 'Starting a new draft'}
                </p>
              </div>

              <button
                type="button"
                onClick={closeBuilder}
                className="ml-auto inline-flex items-center rounded-full border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
              >
                Close
                <span className="ml-1 text-base leading-none">&times;</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6">
              <div className="space-y-6">
                <div className="rounded-2xl border border-dashed border-gray-200 p-4 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs uppercase tracking-[0.3em] text-gray-400">Resume draft</p>
                      <p className="text-sm text-gray-600">
                        Pull an existing Digital School draft into this builder without losing your latest edits.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleResetBuilder}
                      className="px-3 py-1.5 rounded-lg border text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-60"
                      disabled={!resumeMetadata}
                    >
                      Start fresh
                    </button>
                  </div>

                  {draftCourses.length === 0 ? (
                    <p className="text-xs text-gray-500">
                      No saved drafts yet—click <span className="font-semibold text-gray-700">Save draft</span> after filling the form to
                      store your progress.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {draftCourses.map((draft) => {
                        const isActive = resumeMetadata?.courseId === draft.id
                        const isLoading = resumingCourseId === draft.id
                        return (
                          <div
                            key={draft.id}
                            className={`rounded-2xl border p-3 flex flex-col gap-1 ${
                              isActive ? 'border-primary-300 bg-primary-50/40' : 'border-gray-200 bg-white'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                <p className="text-sm font-semibold text-gray-900">{draft.title}</p>
                                <p className="text-xs text-gray-500">
                                  {draft.estimatedHours ?? '—'} hrs · {(draft.tags?.length ?? 0) + (draft.moduleCount ?? 0)} items
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => void handleResumeDraft(draft.id)}
                                disabled={isLoading}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-60"
                              >
                                {isLoading ? 'Loading…' : isActive ? 'Draft loaded' : 'Resume draft'}
                              </button>
                            </div>
                            <p className="text-xs text-gray-600 line-clamp-2">{draft.summary || 'Draft summary pending.'}</p>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                <form className="space-y-4" onSubmit={handleSaveDraft}>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="text-sm text-gray-600 flex flex-col gap-1">
                      Course title
                      <input
                        type="text"
                        placeholder="Foundation Class"
                        value={courseDraft.title}
                        onChange={(event) => handleDraftChange('title', event.target.value)}
                        className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200"
                      />
                    </label>
                    <label className="text-sm text-gray-600 flex flex-col gap-1">
                      Access mode
                      <select
                        className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200"
                        value={courseDraft.access}
                        onChange={(event) => handleDraftChange('access', event.target.value as AccessType)}
                      >
                        <option value="open">Open</option>
                        <option value="request">Request</option>
                        <option value="invite">Invitation</option>
                      </select>
                    </label>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="text-sm text-gray-600 flex flex-col gap-1">
                      Estimated hours
                      <input
                        type="number"
                        min={1}
                        value={courseDraft.estimatedHours}
                        onChange={(event) => handleDraftChange('estimatedHours', Number(event.target.value))}
                        className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200"
                      />
                    </label>
                    <label className="text-sm text-gray-600 flex flex-col gap-1">
                      Format tags (comma separated)
                      <input
                        type="text"
                        value={courseDraft.format}
                        onChange={(event) => handleDraftChange('format', event.target.value)}
                        className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200"
                      />
                    </label>
                  </div>
                  <label className="text-sm text-gray-600 flex flex-col gap-1">
                    Mentor roster
                    <input
                      type="text"
                      placeholder="Ada, Ben, Daniel"
                      value={courseDraft.mentors}
                      onChange={(event) => handleDraftChange('mentors', event.target.value)}
                      className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200"
                    />
                  </label>
                  <label className="text-sm text-gray-600 flex flex-col gap-1">
                    Course summary
                    <textarea
                      placeholder="Outline what learners should expect from this discipleship journey..."
                      value={courseDraft.summary}
                      onChange={(event) => handleDraftChange('summary', event.target.value)}
                      className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200"
                      rows={3}
                    />
                  </label>
                  <div className="space-y-6">
                    <div className="border rounded-2xl p-4 space-y-4 bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs uppercase tracking-[0.3em] text-gray-400">Certificate branding</p>
                          <h3 className="text-sm font-semibold text-gray-900">Customize completion certificates</h3>
                        </div>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <label className="text-sm text-gray-600 flex flex-col gap-1">
                          Certificate template
                          <select
                            value={courseDraft.certificateTheme.template}
                            onChange={(event) =>
                              handleCertificateThemeChange('template', event.target.value as CertificateTemplate)
                            }
                            className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200"
                          >
                            {CERTIFICATE_TEMPLATES.map((template) => (
                              <option key={template.value} value={template.value}>
                                {template.label}
                              </option>
                            ))}
                          </select>
                          <span className="text-xs text-gray-500">
                            {CERTIFICATE_TEMPLATES.find((item) => item.value === courseDraft.certificateTheme.template)?.description}
                          </span>
                        </label>
                        <label className="text-sm text-gray-600 flex flex-col gap-1">
                          Issued by
                          <input
                            type="text"
                            value={courseDraft.certificateTheme.issuedBy}
                            onChange={(event) => handleCertificateThemeChange('issuedBy', event.target.value)}
                            placeholder="pi-CMS Digital School"
                            className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200"
                          />
                        </label>
                      </div>
                      <div className="grid gap-4 md:grid-cols-3">
                        <label className="text-sm text-gray-600 flex flex-col gap-1">
                          Accent color
                          <input
                            type="color"
                            value={courseDraft.certificateTheme.accentColor}
                            onChange={(event) => handleCertificateThemeChange('accentColor', event.target.value)}
                            className="h-10 rounded-xl border border-gray-200 px-2 py-1"
                          />
                        </label>
                        <label className="text-sm text-gray-600 flex flex-col gap-1">
                          Secondary color
                          <input
                            type="color"
                            value={courseDraft.certificateTheme.secondaryColor}
                            onChange={(event) => handleCertificateThemeChange('secondaryColor', event.target.value)}
                            className="h-10 rounded-xl border border-gray-200 px-2 py-1"
                          />
                        </label>
                        <label className="text-sm text-gray-600 flex flex-col gap-1">
                          Seal text
                          <input
                            type="text"
                            value={courseDraft.certificateTheme.sealText}
                            onChange={(event) => handleCertificateThemeChange('sealText', event.target.value)}
                            placeholder="pi-CMS Training Institute"
                            className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200"
                          />
                        </label>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        <label className="text-sm text-gray-600 flex flex-col gap-1">
                          Signature text
                          <input
                            type="text"
                            value={courseDraft.certificateTheme.signatureText}
                            onChange={(event) => handleCertificateThemeChange('signatureText', event.target.value)}
                            placeholder="Lead Pastor"
                            className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200"
                          />
                        </label>
                        <label className="text-sm text-gray-600 flex flex-col gap-1">
                          Background image
                          <ImageUpload
                            label=""
                            value={courseDraft.certificateTheme.backgroundImageUrl}
                            onChange={(url) => handleCertificateThemeChange('backgroundImageUrl', url)}
                            placeholder="Upload background image or enter URL"
                          />
                        </label>
                      </div>
                      <label className="text-sm text-gray-600 flex flex-col gap-1">
                        Logo
                        <ImageUpload
                          label=""
                          value={courseDraft.certificateTheme.logoUrl}
                          onChange={(url) => handleCertificateThemeChange('logoUrl', url)}
                          placeholder="Upload logo or enter URL"
                        />
                      </label>
                    </div>

                    {/* Church Signature Settings */}
                    <SignatureUpload 
                      onSignatureChange={(signature) => {
                        // Update the course draft with signature info if needed
                        console.log('Signature updated:', signature)
                      }}
                    />

                    <div className="flex items-center justify-between">
                      <p className="text-xs uppercase tracking-wide text-gray-400">Sections, modules & exams</p>
                      <button
                        type="button"
                        className="text-xs font-semibold text-primary-600"
                        onClick={handleAddSection}
                      >
                        + Add section
                      </button>
                    </div>

                    <div className="space-y-4">
                      {courseDraft.sections.map((section, sectionIndex) => (
                        <div key={section.id} className="border rounded-2xl p-4 space-y-4">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="text-xs uppercase tracking-wide text-gray-400">Section {sectionIndex + 1}</p>
                              <p className="text-sm text-gray-500">
                                Every section ends with an exam that must be passed to unlock the next stage.
                              </p>
                            </div>
                            {courseDraft.sections.length > 1 && (
                              <button
                                type="button"
                                className="text-sm text-gray-500 hover:text-gray-800"
                                onClick={() => handleRemoveSection(section.id)}
                              >
                                Remove
                              </button>
                            )}
                          </div>

                          <div className="grid gap-3 md:grid-cols-2">
                            <label className="text-sm text-gray-600 flex flex-col gap-1">
                              Section title
                              <input
                                type="text"
                                value={section.title}
                                onChange={(event) => handleSectionChange(section.id, 'title', event.target.value)}
                                className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200"
                                placeholder="Orientation & pi-CMS story"
                              />
                            </label>
                            <label className="text-sm text-gray-600 flex flex-col gap-1">
                              Section description
                              <input
                                type="text"
                                value={section.description}
                                onChange={(event) => handleSectionChange(section.id, 'description', event.target.value)}
                                className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200"
                                placeholder="Video walkthrough + discussion prompts"
                              />
                            </label>
                          </div>

                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <p className="text-xs uppercase tracking-wide text-gray-400">Modules in this section</p>
                              <button
                                type="button"
                                className="text-xs font-semibold text-primary-600"
                                onClick={() => handleAddModule(section.id)}
                              >
                                + Add module
                              </button>
                            </div>

                            <div className="space-y-3">
                              {section.modules.map((module, moduleIndex) => (
                                <div key={module.id} className="rounded-2xl border border-gray-100 bg-gray-50 p-4 space-y-3">
                                  <div className="flex items-center justify-between">
                                    <p className="text-sm font-semibold text-gray-800">Module {moduleIndex + 1}</p>
                                    {section.modules.length > 1 && (
                                      <button
                                        type="button"
                                        className="text-xs text-gray-500 hover:text-gray-800"
                                        onClick={() => handleRemoveModule(section.id, module.id)}
                                      >
                                        Remove
                                      </button>
                                    )}
                                  </div>

                                  <div className="grid gap-3 md:grid-cols-2">
                                    <label className="text-sm text-gray-600 flex flex-col gap-1">
                                      Module title
                                      <input
                                        type="text"
                                        value={module.title}
                                        onChange={(event) => handleModuleChange(section.id, module.id, 'title', event.target.value)}
                                        className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200"
                                        placeholder="Welcome to pi-CMS"
                                      />
                                    </label>
                                    <label className="text-sm text-gray-600 flex flex-col gap-1">
                                      Module description
                                      <input
                                        type="text"
                                        value={module.description}
                                        onChange={(event) => handleModuleChange(section.id, module.id, 'description', event.target.value)}
                                        className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200"
                                        placeholder="Context for this lesson"
                                      />
                                    </label>
                                  </div>

                                  <div className="grid gap-3 md:grid-cols-2">
                                    <label className="text-sm text-gray-600 flex flex-col gap-1">
                                      Content format
                                      <select
                                        value={module.contentType}
                                        onChange={(event) => handleModuleChange(section.id, module.id, 'contentType', event.target.value)}
                                        className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200"
                                      >
                                        {MODULE_CONTENT_TYPES.map((type) => (
                                          <option key={type.value} value={type.value}>
                                            {type.label}
                                          </option>
                                        ))}
                                      </select>
                                    </label>
                                    <div className="text-xs text-gray-500 bg-white rounded-xl border border-dashed border-gray-200 px-3 py-3">
                                      {MODULE_CONTENT_TYPES.find((type) => type.value === module.contentType)?.description ??
                                        'Select the media format for this module.'}
                                    </div>
                                  </div>

                                  {module.contentType === 'video' && (
                                    <label className="text-sm text-gray-600 flex flex-col gap-1">
                                      Video URL
                                      <input
                                        type="url"
                                        value={module.videoUrl}
                                        onChange={(event) => handleModuleChange(section.id, module.id, 'videoUrl', event.target.value)}
                                        className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200"
                                        placeholder="https://..."
                                      />
                                    </label>
                                  )}

                                  {module.contentType === 'audio' && (
                                    <div className="grid gap-3 md:grid-cols-2">
                                      <label className="text-sm text-gray-600 flex flex-col gap-1">
                                        Audio URL
                                        <input
                                          type="url"
                                          value={module.audioUrl}
                                          onChange={(event) => handleModuleChange(section.id, module.id, 'audioUrl', event.target.value)}
                                          className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200"
                                          placeholder="https://..."
                                        />
                                      </label>
                                      <div className="flex flex-col gap-2">
                                        <p className="text-sm text-gray-600">Attach audio</p>
                                        <div className="flex flex-wrap gap-2">
                                          <input
                                            type="file"
                                            accept="audio/*"
                                            ref={registerFileInput(`${module.id}-audio`)}
                                            className="hidden"
                                            onChange={handleModuleFileInput(section.id, module.id, 'audio')}
                                          />
                                          <button
                                            type="button"
                                            className="px-3 py-2 rounded-lg border text-xs text-gray-700 hover:bg-gray-100"
                                            onClick={() => triggerFilePicker(`${module.id}-audio`)}
                                          >
                                            Upload audio
                                          </button>
                                          {module.audioFileName && (
                                            <span className="text-xs text-gray-500">{module.audioFileName}</span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  {module.contentType === 'text' && (
                                    <label className="text-sm text-gray-600 flex flex-col gap-1">
                                      Lesson text
                                      <textarea
                                        value={module.textContent}
                                        onChange={(event) =>
                                          handleModuleChange(section.id, module.id, 'textContent', event.target.value)
                                        }
                                        placeholder="Paste your devotional, transcript, or study outline…"
                                        className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200"
                                        rows={4}
                                      />
                                    </label>
                                  )}

                                  <div className="grid gap-3 md:grid-cols-3">
                                    <label className="text-sm text-gray-600 flex flex-col gap-1">
                                      Estimated minutes
                                      <input
                                        type="number"
                                        min={5}
                                        value={module.estimatedMinutes}
                                        onChange={(event) =>
                                          handleModuleChange(section.id, module.id, 'estimatedMinutes', event.target.value)
                                        }
                                        className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200"
                                      />
                                    </label>
                                    <div className="flex flex-col gap-2">
                                      <p className="text-sm text-gray-600">Attach workbook / notes</p>
                                      <div className="flex flex-wrap gap-2">
                                        <input
                                          type="file"
                                          accept=".pdf,.doc,.docx"
                                          ref={registerFileInput(`${module.id}-book`)}
                                          className="hidden"
                                          onChange={handleModuleFileInput(section.id, module.id, 'book')}
                                        />
                                        <button
                                          type="button"
                                          className="px-3 py-2 rounded-lg border text-xs text-gray-700 hover:bg-gray-100"
                                          onClick={() => triggerFilePicker(`${module.id}-book`)}
                                        >
                                          Upload file
                                        </button>
                                        {module.bookFileName && (
                                          <span className="text-xs text-gray-500">{module.bookFileName}</span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="rounded-2xl border border-dashed border-gray-200 p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-semibold text-gray-900">Section exam</p>
                                <p className="text-xs text-gray-500">
                                  Learners must pass this exam to unlock Section {sectionIndex + 2}.
                                </p>
                              </div>
                              <select
                                className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200"
                                value={section.exam.status}
                                onChange={(event) =>
                                  handleExamChange(section.id, 'status', event.target.value as SectionExamDraft['status'])
                                }
                              >
                                <option value="draft">Draft</option>
                                <option value="ready">Ready</option>
                                <option value="published">Published</option>
                              </select>
                            </div>

                            <div className="grid gap-3 md:grid-cols-2">
                              <label className="text-sm text-gray-600 flex flex-col gap-1">
                                Exam title
                                <input
                                  type="text"
                                  value={section.exam.title}
                                  onChange={(event) => handleExamChange(section.id, 'title', event.target.value)}
                                  className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200"
                                  placeholder="Orientation checkpoint"
                                />
                              </label>
                              <label className="text-sm text-gray-600 flex flex-col gap-1">
                                Exam description
                                <input
                                  type="text"
                                  value={section.exam.description}
                                  onChange={(event) => handleExamChange(section.id, 'description', event.target.value)}
                                  className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200"
                                  placeholder="CBT with 20 questions"
                                />
                              </label>
                            </div>

                            <div className="grid gap-3 md:grid-cols-2">
                              <label className="text-sm text-gray-600 flex flex-col gap-1">
                                Max attempts allowed
                                <input
                                  type="number"
                                  min={1}
                                  value={section.exam.retakeMaxAttempts ?? ''}
                                  onChange={(event) =>
                                    handleExamChange(
                                      section.id,
                                      'retakeMaxAttempts',
                                      event.target.value === '' ? '' : Number(event.target.value),
                                    )
                                  }
                                  className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200"
                                  placeholder="Leave blank for unlimited"
                                />
                                <span className="text-xs text-gray-500">
                                  Leave blank to allow unlimited attempts.
                                </span>
                              </label>
                              <label className="text-sm text-gray-600 flex flex-col gap-1">
                                Cooldown between attempts (hours)
                                <input
                                  type="number"
                                  min={1}
                                  value={section.exam.retakeCooldownHours ?? ''}
                                  onChange={(event) =>
                                    handleExamChange(
                                      section.id,
                                      'retakeCooldownHours',
                                      event.target.value === '' ? '' : Number(event.target.value),
                                    )
                                  }
                                  className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200"
                                  placeholder="Leave blank for no delay"
                                />
                                <span className="text-xs text-gray-500">
                                  Leave blank to allow immediate retakes.
                                </span>
                              </label>
                            </div>

                            <div className="grid gap-3 md:grid-cols-2">
                              <label className="text-sm text-gray-600 flex flex-col gap-1">
                                Time limit (minutes)
                                <input
                                  type="number"
                                  min={5}
                                  value={section.exam.timeLimitMinutes}
                                  onChange={(event) =>
                                    handleExamChange(section.id, 'timeLimitMinutes', Number(event.target.value))
                                  }
                                  className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200"
                                />
                              </label>
                              <label className="text-sm text-gray-600 flex flex-col gap-1">
                                Question count
                                <input
                                  type="number"
                                  min={1}
                                  value={section.exam.questionCount}
                                  onChange={(event) =>
                                    handleExamChange(section.id, 'questionCount', Number(event.target.value))
                                  }
                                  className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200"
                                />
                              </label>
                            </div>

                            <div className="flex flex-col gap-2">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-sm text-gray-600">Upload CBT file</p>
                                <button
                                  type="button"
                                  onClick={handleDownloadTemplate}
                                  className="text-xs font-semibold text-primary-600 hover:text-primary-700"
                                >
                                  Download template
                                </button>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <input
                                  type="file"
                                  accept=".csv,.xlsx,.xls,.json"
                                  ref={registerFileInput(`exam-${section.id}`)}
                                  className="hidden"
                                  onChange={handleExamFileInput(section.id)}
                                />
                                <button
                                  type="button"
                                  className="px-3 py-2 rounded-lg border text-xs text-gray-700 hover:bg-gray-100"
                                  onClick={() => triggerFilePicker(`exam-${section.id}`)}
                                >
                                  Upload exam file
                                </button>
                                {section.exam.uploadPlaceholder && (
                                  <span className="text-xs text-gray-500">{section.exam.uploadPlaceholder}</span>
                                )}
                              </div>
                              {pendingExamImports[section.id] && (
                                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                                  <span>File staged. Import questions to replace existing ones.</span>
                                  <button
                                    type="button"
                                    onClick={() => void handleImportExamQuestions(section.id)}
                                    disabled={examParseSummaries[section.id]?.status === 'parsing'}
                                    className="inline-flex items-center rounded-lg bg-amber-600 px-3 py-1 text-white hover:bg-amber-700 disabled:opacity-60"
                                  >
                                    {examParseSummaries[section.id]?.status === 'parsing' ? 'Importing…' : 'Import questions'}
                                  </button>
                                </div>
                              )}
                              {examParseSummaries[section.id]?.summary && (
                                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                                  <p>
                                    Imported{' '}
                                    <strong>
                                      {examParseSummaries[section.id]?.summary?.createdCount ??
                                        examParseSummaries[section.id]?.summary?.totalRows ??
                                        0}
                                    </strong>{' '}
                                    questions. {examParseSummaries[section.id]?.summary?.skipped.length || 0} skipped.
                                  </p>
                                </div>
                              )}
                              {examParseSummaries[section.id]?.status === 'error' &&
                                examParseSummaries[section.id]?.error && (
                                  <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                                    {examParseSummaries[section.id]?.error}
                                  </div>
                                )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="submit"
                      data-intent="draft"
                      className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-900 shadow-sm hover:bg-gray-50 disabled:opacity-60"
                      disabled={isSavingCourse}
                    >
                      {isSavingCourse && submitIntent === 'draft' ? 'Saving…' : 'Save as draft'}
                    </button>
                    <button
                      type="submit"
                      data-intent="published"
                      className="px-4 py-2 rounded-lg bg-primary-600 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 disabled:opacity-60"
                      disabled={isSavingCourse}
                    >
                      {isSavingCourse && submitIntent === 'published' ? 'Publishing…' : 'Publish course'}
                    </button>
                    <button type="button" className="px-4 py-2 rounded-lg border text-sm text-gray-700 hover:bg-gray-50">
                      Upload cover
                    </button>
                  </div>
                  {draftMessage && (
                    <p className={`text-sm ${draftMessage.startsWith('Unable') ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {draftMessage}
                    </p>
                  )}
                </form>

                <div className="space-y-3">
                  {adminActions.map((action) => (
                    <div key={action.title} className="border rounded-2xl p-4 flex flex-col gap-1 bg-gray-50">
                      <div className="flex items-center justify-between text-sm text-gray-500">
                        <span>{action.title}</span>
                        <span>{action.timestamp}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-700">{action.status}</span>
                        <span className="text-gray-500">by {action.updatedBy}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    ) : null

  const downloadCertificate = useCallback((url: string, fileName?: string) => {
    console.log('📥 Attempting to download certificate:', url)
    
    try {
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = fileName || 'certificate.pdf'
      anchor.style.display = 'none'
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
      console.log('✅ Certificate download initiated')
      
      setToast({
        message: 'Certificate download started!',
        tone: 'success'
      })
    } catch (error) {
      console.error('❌ Failed to download certificate:', error)
      setToast({
        message: 'Download failed. Please try opening the certificate link manually.',
        tone: 'error'
      })
    }
  }, [])

  const openCertificate = useCallback((url: string) => {
    console.log('🎓 Attempting to open certificate:', url)
    
    if (typeof window !== 'undefined') {
      // Try multiple methods to open the certificate
      
      // Method 1: Direct window.open
      try {
        const popup = window.open(url, '_blank', 'noopener,noreferrer')
        if (popup && !popup.closed) {
          console.log('✅ Certificate opened in popup')
          return
        }
        console.log('⚠️ Popup blocked or failed, trying method 2')
      } catch (error) {
        console.log('⚠️ Method 1 failed:', error)
      }

      // Method 2: Create and click anchor with user interaction
      try {
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.target = '_blank'
        anchor.rel = 'noopener noreferrer'
        anchor.style.display = 'none'
        document.body.appendChild(anchor)
        anchor.click()
        document.body.removeChild(anchor)
        console.log('✅ Certificate opened via enhanced anchor click')
        return
      } catch (error) {
        console.log('⚠️ Method 2 failed:', error)
      }

      // Method 3: Direct navigation (last resort)
      try {
        window.location.href = url
        console.log('✅ Certificate opened via direct navigation')
        return
      } catch (error) {
        console.log('⚠️ Method 3 failed:', error)
      }
    }

    // If all methods fail, show error with download option
    console.error('❌ All certificate opening methods failed')
    
    // Try download as final fallback
    console.log('🔄 Trying download as final fallback')
    downloadCertificate(url, `certificate-${Date.now()}.pdf`)
  }, [downloadCertificate])

  const handleGenerateCertificate = async (enrollmentId: string) => {
    console.log('🔄 Starting certificate generation for:', enrollmentId)
    setCertificateMessage(null)
    setCertificateLoadingState(enrollmentId, true)
    const previewWindow =
      typeof window !== 'undefined' ? window.open('', '_blank', 'noopener,noreferrer') : null
    if (previewWindow) {
      previewWindow.document.write('<p style="font-family:sans-serif;padding:16px;">Preparing certificate…</p>')
      previewWindow.document.close()
      console.log('📱 Preview window opened')
    } else {
      console.log('⚠️ Could not open preview window (popup blocked?)')
    }
    try {
      console.log('🌐 Calling certificate API...')
      const response = await requestJson<{ url: string; path: string }>(
        `/api/digital-school/enrollments/${enrollmentId}/certificate`,
        {
          method: 'POST',
        },
      )
      console.log('✅ Certificate API response:', response)
      setCertificateMessage('Certificate ready — opening in a new tab.')
      if (previewWindow) {
        console.log('📱 Redirecting preview window to certificate')
        previewWindow.location.replace(response.url)
      } else {
        console.log('🔗 Opening certificate via openCertificate function')
        openCertificate(response.url)
      }
      await loadEnrollments()
    } catch (error) {
      console.error('❌ DigitalSchool.handleGenerateCertificate', error)
      if (previewWindow) {
        previewWindow.close()
      }
      setCertificateMessage(
        error instanceof Error ? `Unable to load certificate: ${error.message}` : 'Unable to load certificate.',
      )
    } finally {
      setCertificateLoadingState(enrollmentId, false)
    }
  }

  const handleEnrollAction = (
    courseId: string,
    options?: {
      enrollmentId?: string
      isCompleted?: boolean
      certificateUrl?: string
    },
  ) => {
    console.log('🎯 handleEnrollAction called:', { courseId, options })
    
    const course = courses.find((item) => item.id === courseId)
    if (!course) {
      console.log('❌ Course not found:', courseId)
      return
    }

    const enrollment =
      (options?.enrollmentId && enrollmentRecords.find((record) => record.id === options.enrollmentId)) ||
      enrollmentRecords.find((record) => record.courseId === courseId)

    const enrollmentId = options?.enrollmentId ?? enrollment?.id
    const snapshot = deriveEnrollmentSnapshot(enrollment, course)
    const isCompleted = options?.isCompleted ?? snapshot.isCompleted
    const certificateUrl = options?.certificateUrl ?? enrollment?.certificateUrl

    console.log('📊 Enrollment data:', {
      enrollment: enrollment?.id,
      enrollmentId,
      isCompleted,
      certificateUrl,
      courseStatus: course.status
    })

    if (course.status === 'completed' || isCompleted) {
      console.log('✅ Course is completed, checking certificate...')
      if (certificateUrl) {
        console.log('📜 Opening existing certificate:', certificateUrl)
        openCertificate(certificateUrl)
        return
      }
      if (enrollmentId) {
        console.log('🔄 Generating new certificate for enrollment:', enrollmentId)
        void handleGenerateCertificate(enrollmentId)
        return
      }
      console.log('⚠️ No certificate URL or enrollment ID found')
      const row = progressRows.find((progress) => progress.course === course.title)
      if (row) setSelectedProgress(row)
      return
    }

    if (!enrollmentId && enrollment?.id) {
      router.push(`/digital-school/courses/${enrollment.courseId}`)
      return
    }

    if (!enrollmentId) {
      void (async () => {
        try {
          const created = await requestJson<ApiEnrollmentResponse>('/api/digital-school/enrollments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ courseId }),
          })
          await loadEnrollments()
          router.push(`/digital-school/courses/${created.courseId}`)
        } catch (error) {
          console.error('DigitalSchool.handleEnrollAction', error)
          setToast({
            message: error instanceof Error ? `Unable to start course: ${error.message}` : 'Unable to start course.',
            tone: 'error',
          })
        }
      })()
      return
    }

    router.push(`/digital-school/courses/${courseId}`)
  }

  const handleExamUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const estimatedQuestions = Math.max(10, Math.round(file.size / 1500))
    setExamUploads((prev) => [
      {
        title: file.name.replace(/\.[^/.]+$/, ''),
        questions: estimatedQuestions,
        status: 'Awaiting validation',
        owner: 'You',
      },
      ...prev,
    ])
    setUploadMessage(`Uploaded ${file.name} (${estimatedQuestions} questions detected).`)
    event.target.value = ''
  }

  const promoteExamUpload = (title: string) => {
    setExamUploads((prev) =>
      prev.map((upload) =>
        upload.title === title ? { ...upload, status: 'Validated' } : upload,
      ),
    )
  }

  const handleAccessDecision = (
    userLabel: string,
    decision: 'Approved' | 'Invite sent' | 'More info requested',
  ) => {
    setAccessRequests((prev) =>
      prev.map((request) =>
        request.userLabel === userLabel ? { ...request, status: decision } : request,
      ),
    )
  }
  const handleTimelineView = (row: ProgressRow) => {
    setSelectedProgress(row)
  }

  const handleProgressComplete = (member: string) => {
    setProgressRows((prev) =>
      prev.map((row) =>
        row.member === member
          ? { ...row, completion: 100, examScore: row.examScore === '-' ? 'Pending grading' : row.examScore }
          : row,
      ),
    )
    setSelectedProgress((prev) =>
      prev && prev.member === member
        ? { ...prev, completion: 100, examScore: prev.examScore === '-' ? 'Pending grading' : prev.examScore }
        : prev,
    )
  }

  const latestDraftId = draftCourses[0]?.id ?? null

  const markExamScore = (member: string, score: string) => {
    setProgressRows((prev) =>
      prev.map((row) => (row.member === member ? { ...row, examScore: score } : row)),
    )
    setSelectedProgress((prev) => (prev && prev.member === member ? { ...prev, examScore: score } : prev))
  }

  const nonGlobalLeaderboardScope: Exclude<LeaderboardScope, 'global'> | null =
    leaderboardScope === 'global' ? null : leaderboardScope
  const leaderboardFilterLabel = nonGlobalLeaderboardScope ? LEADERBOARD_FILTER_LABELS[nonGlobalLeaderboardScope] : null
  const leaderboardScopeHint = LEADERBOARD_SCOPE_HINTS[leaderboardScope]
  const leaderboardRequiresFilter = Boolean(nonGlobalLeaderboardScope)
  const leaderboardFilterActive = Boolean(leaderboardFilterId)
  const leaderboardReady = !leaderboardRequiresFilter || leaderboardFilterActive
  const hasLeaderboardEntries = leaderboardEntries.length > 0
  const topLeaderboardEntry = hasLeaderboardEntries ? leaderboardEntries[0] : null

  const analyticsPanel = !isCourseManager
    ? null
    : (
        <div className="space-y-4 rounded-2xl sm:rounded-3xl border border-gray-100 bg-white p-4 sm:p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-gray-400">Analytics</p>
              <h2 className="text-base sm:text-lg font-semibold text-gray-900">Learner progress & exams</h2>
              <p className="text-sm text-gray-500">Track who has started, completed, and how they scored.</p>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <select
                value={analyticsCourseId ?? ''}
                onChange={handleAnalyticsCourseChange}
                className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200"
              >
                <option value="">Select course</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.title}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => analyticsCourseId && loadCourseAnalytics(analyticsCourseId)}
                className="inline-flex items-center justify-center rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60 whitespace-nowrap"
                disabled={!analyticsCourseId || analyticsLoading}
              >
                {analyticsLoading ? 'Refreshing…' : 'Refresh'}
              </button>
            </div>
          </div>

          {analyticsError && (
            <div className="rounded-xl sm:rounded-2xl border border-rose-200 bg-rose-50 px-3 sm:px-4 py-2 sm:py-3 text-sm text-rose-700">
              {analyticsError}
            </div>
          )}

          {!analyticsCourseId ? (
            <div className="rounded-xl sm:rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-3 sm:px-4 py-4 sm:py-6 text-center text-sm text-gray-500">
              Select a course to view analytics.
            </div>
          ) : analyticsLoading ? (
            <div className="rounded-xl sm:rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-3 sm:px-4 py-4 sm:py-6 text-center text-sm text-gray-500">
              Loading analytics…
            </div>
          ) : courseAnalytics ? (
            <div className="space-y-4">
              <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
                <AnalyticsBadge label="Total enrolled" value={courseAnalytics.summary.total} tone="slate" />
                <AnalyticsBadge label="Not started" value={courseAnalytics.summary.notStarted} tone="gray" />
                <AnalyticsBadge label="In progress" value={courseAnalytics.summary.inProgress} tone="amber" />
                <AnalyticsBadge label="Completed" value={courseAnalytics.summary.completed} tone="emerald" />
              </div>

              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <div className="min-w-full inline-block align-middle">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      <tr>
                        <th className="px-3 sm:px-4 py-3 whitespace-nowrap">Member</th>
                        <th className="px-3 sm:px-4 py-3 whitespace-nowrap hidden sm:table-cell">Church level</th>
                        <th className="px-3 sm:px-4 py-3 whitespace-nowrap hidden md:table-cell">Branch</th>
                        <th className="px-3 sm:px-4 py-3 whitespace-nowrap hidden lg:table-cell">Designation</th>
                        <th className="px-3 sm:px-4 py-3 whitespace-nowrap">Progress</th>
                        <th className="px-3 sm:px-4 py-3 whitespace-nowrap">Exam score</th>
                        <th className="px-3 sm:px-4 py-3 whitespace-nowrap hidden sm:table-cell">Last exam</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {courseAnalytics.rows.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-3 sm:px-4 py-4 sm:py-6 text-center text-gray-500">
                            No enrollments yet.
                          </td>
                        </tr>
                      ) : (
                        courseAnalytics.rows.map((row) => (
                          <tr key={row.enrollmentId}>
                            <td className="px-3 sm:px-4 py-3 text-gray-900 font-medium">{row.memberName}</td>
                            <td className="px-3 sm:px-4 py-3 text-gray-600 hidden sm:table-cell">{row.churchLevel}</td>
                            <td className="px-3 sm:px-4 py-3 text-gray-600 hidden md:table-cell">{row.branch}</td>
                            <td className="px-3 sm:px-4 py-3 text-gray-600 hidden lg:table-cell">{row.designation}</td>
                            <td className="px-3 sm:px-4 py-3">
                              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                                <span className="text-sm font-semibold text-gray-900">{row.progressPercent}%</span>
                                <span
                                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                                    row.status === 'completed'
                                      ? 'bg-emerald-100 text-emerald-700'
                                      : row.status === 'active'
                                        ? 'bg-amber-100 text-amber-700'
                                        : 'bg-gray-100 text-gray-600'
                                  }`}
                                >
                                  {row.status}
                                </span>
                              </div>
                            </td>
                            <td className="px-3 sm:px-4 py-3 text-gray-900 font-medium">
                              {typeof row.examScore === 'number' ? `${row.examScore}%` : '—'}
                            </td>
                            <td className="px-3 sm:px-4 py-3 text-gray-600 hidden sm:table-cell">
                              {row.lastExamAt ? new Date(row.lastExamAt).toLocaleDateString() : '—'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl sm:rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-3 sm:px-4 py-4 sm:py-6 text-center text-sm text-gray-500">
              Analytics unavailable for this course.
            </div>
          )}
        </div>
      )

  const examReviewPanel = (
    <div className="space-y-4 rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-gray-400">Exam review</p>
          <h2 className="text-lg font-semibold text-gray-900">Revisit every answer</h2>
          <p className="text-sm text-gray-500">See how you performed and what to improve on before the next attempt.</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={reviewCourseId ?? ''}
            onChange={(event) => setReviewCourseId(event.target.value || null)}
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200"
            disabled={!reviewableCourses.length}
          >
            {reviewableCourses.length === 0 ? (
              <option value="">No courses yet</option>
            ) : (
              reviewableCourses.map((course) => (
                <option key={course.courseId} value={course.courseId}>
                  {course.title}
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      {reviewableCourses.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
          Enroll in a course and complete an exam to unlock detailed review insights.
        </div>
      ) : (
        <>
          {attemptsError && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {attemptsError}
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-3 rounded-2xl border border-gray-100 bg-gray-50 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-gray-400">Exam attempts</p>
              {attemptsLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="animate-pulse rounded-xl bg-white p-4 shadow-sm">
                      <div className="h-4 w-3/4 rounded bg-gray-200" />
                      <div className="mt-2 h-3 w-1/2 rounded bg-gray-200" />
                    </div>
                  ))}
                </div>
              ) : examAttempts.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-200 bg-white p-4 text-sm text-gray-600">
                  No graded attempts yet. Submit an exam to see detailed feedback.
                </div>
              ) : (
                <div className="space-y-2">
                  {examAttempts.map((attempt) => {
                    const active = selectedExamAttempt?.id === attempt.id
                    return (
                      <button
                        key={attempt.id}
                        type="button"
                        onClick={() => setSelectedExamAttempt(attempt)}
                        className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                          active
                            ? 'border-primary-500 bg-primary-50 text-primary-900 shadow-sm'
                            : 'border-gray-200 bg-white text-gray-800 hover:border-primary-200'
                        }`}
                      >
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-semibold">
                            {attempt.score != null ? `${attempt.score}%` : 'Pending score'}
                          </span>
                          <span className="text-xs uppercase tracking-wide text-gray-500">
                            {attempt.status === 'submitted' ? 'Submitted' : 'In progress'}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500">{formatDateTime(attempt.submittedAt ?? attempt.startedAt)}</p>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="lg:col-span-2 space-y-4 rounded-2xl border border-gray-100 bg-white p-4">
              {!selectedExamAttempt ? (
                <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
                  Select an attempt to review your question-by-question performance.
                </div>
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                      <p className="text-xs uppercase tracking-[0.3em] text-gray-400">Score</p>
                      <p className="mt-2 text-2xl font-semibold text-gray-900">
                        {typeof selectedExamAttempt.score === 'number' ? `${selectedExamAttempt.score}%` : 'Pending'}
                      </p>
                    </div>
                    <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                      <p className="text-xs uppercase tracking-[0.3em] text-gray-400">Questions</p>
                      <p className="mt-2 text-2xl font-semibold text-gray-900">
                        {selectedExamAttempt.totalQuestions ?? selectedExamAttempt.questionSummaries?.length ?? '—'}
                      </p>
                    </div>
                    <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                      <p className="text-xs uppercase tracking-[0.3em] text-gray-400">Submitted</p>
                      <p className="mt-2 text-sm font-medium text-gray-900">{formatDateTime(selectedExamAttempt.submittedAt)}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <span>Filter:</span>
                      {(['all', 'correct', 'incorrect'] as QuestionFilter[]).map((filter) => (
                        <button
                          key={filter}
                          type="button"
                          onClick={() => setQuestionFilter(filter)}
                          className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                            questionFilter === filter
                              ? 'border-primary-500 bg-primary-50 text-primary-700'
                              : 'border-gray-200 text-gray-600 hover:border-primary-200'
                          }`}
                        >
                          {filter === 'all'
                            ? 'All'
                            : filter === 'correct'
                              ? 'Correct'
                              : 'Incorrect'}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500">
                      Showing {filteredQuestionEntries.length} of {selectedAttemptQuestionEntries.length} questions
                    </p>
                  </div>

                  {selectedAttemptQuestionEntries.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
                      Question summaries are not available for this attempt.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {filteredQuestionEntries.map(({ question, response, index }) => {
                        const isCorrect = response?.correct
                        const userAnswerText =
                          typeof response?.answerIndex === 'number'
                            ? `${optionLetter(response.answerIndex)}. ${question.options[response.answerIndex] ?? '—'}`
                            : 'No answer selected'
                        const correctAnswerText = `${optionLetter(question.correctOption)}. ${
                          question.options[question.correctOption] ?? '—'
                        }`
                        return (
                          <div
                            key={question.id}
                            className={`rounded-2xl border p-4 ${
                              isCorrect === true
                                ? 'border-emerald-200 bg-emerald-50'
                                : 'border-rose-200 bg-rose-50'
                            }`}
                          >
                            <div className="flex items-center justify-between text-xs uppercase tracking-wide">
                              <span className="font-semibold text-gray-500">Question {index + 1}</span>
                              <span
                                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                  isCorrect === true
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-rose-100 text-rose-700'
                                }`}
                              >
                                {isCorrect === true ? 'Correct' : 'Incorrect'}
                              </span>
                            </div>
                            <p className="mt-2 text-sm font-medium text-gray-900">{question.question}</p>
                            <div className="mt-3 space-y-1 text-sm">
                              <p className="text-gray-500">Your answer</p>
                              <p className={`font-medium ${isCorrect === true ? 'text-emerald-900' : 'text-rose-900'}`}>
                                {userAnswerText}
                              </p>
                            </div>
                            <div className="mt-2 space-y-1 text-sm">
                              <p className="text-gray-500">Correct answer</p>
                              <p className="font-semibold text-emerald-900">{correctAnswerText}</p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )

  const renderCourseGrid = () => {
    if (isLoadingCourses) {
      return Array.from({ length: 6 }).map((_, index) => (
        <div
          key={`skeleton-${index}`}
          className="border rounded-2xl sm:rounded-3xl p-4 sm:p-5 flex flex-col gap-3 sm:gap-4 shadow-sm animate-pulse bg-gray-50"
        >
          <div className="flex items-center justify-between">
            <span className="h-5 sm:h-6 w-16 sm:w-20 rounded-full bg-gray-200" />
            <span className="h-3 sm:h-4 w-12 sm:w-16 rounded bg-gray-200" />
          </div>
          <div className="space-y-2">
            <div className="h-4 sm:h-5 w-3/4 rounded bg-gray-200" />
            <div className="h-3 sm:h-4 w-full rounded bg-gray-200" />
            <div className="h-3 sm:h-4 w-5/6 rounded bg-gray-200" />
          </div>
          <div className="flex gap-2">
            <span className="h-5 sm:h-6 w-12 sm:w-16 rounded-full bg-gray-200" />
            <span className="h-5 sm:h-6 w-16 sm:w-20 rounded-full bg-gray-200" />
          </div>
          <div className="h-2 w-full rounded bg-gray-200" />
          <div className="flex gap-2">
            <span className="h-8 sm:h-9 flex-1 rounded-lg bg-gray-200" />
            <span className="h-8 sm:h-9 w-16 sm:w-20 rounded-lg bg-gray-200" />
          </div>
        </div>
      ))
    }

    if (courses.length === 0) {
      return (
        <div className="col-span-full rounded-2xl sm:rounded-3xl border border-dashed border-gray-200 p-4 sm:p-6 text-center">
          <p className="text-sm text-gray-600">
            {isCourseManager 
              ? "No courses published yet. Start a builder draft to seed the catalog for your campus."
              : "No courses are available at the moment. Please check back later or contact your church administrator."
            }
          </p>
          {isCourseManager && (
            <div className="mt-4 flex flex-col sm:flex-row flex-wrap justify-center gap-2">
              <button
                type="button"
                className="px-4 py-2 rounded-lg bg-primary-600 text-white text-sm hover:bg-primary-700"
                onClick={handleOpenNewCourse}
              >
                + Create course
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded-lg border text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                onClick={() => latestDraftId && void handleResumeDraft(latestDraftId)}
                disabled={!latestDraftId || resumingCourseId === latestDraftId}
              >
                {latestDraftId ? (resumingCourseId === latestDraftId ? 'Loading draft…' : 'Resume latest draft') : 'No drafts yet'}
              </button>
            </div>
          )}
        </div>
      )
    }

    return courses.map((course) => {
      const enrollment = enrollmentRecords.find((en) => en.courseId === course.id)
      const snapshot = deriveEnrollmentSnapshot(enrollment, course)
      const progressPercent = snapshot.progressPercent
      const isCompleted = snapshot.isCompleted

      return (
        <div
          key={course.id}
          className="border rounded-2xl sm:rounded-3xl p-4 sm:p-5 flex flex-col gap-3 sm:gap-4 shadow-sm hover:shadow-md transition relative"
        >
          {isCourseManager && (
            <div className="absolute top-3 sm:top-4 right-3 sm:right-4 flex gap-1 sm:gap-2">
              <button
                type="button"
                className="rounded-full border px-2 sm:px-3 py-1 text-xs text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                onClick={() => handleEditCourse(course.id)}
                disabled={resumingCourseId === course.id}
              >
                {resumingCourseId === course.id ? 'Loading…' : 'Edit'}
              </button>
              <button
                type="button"
                className="rounded-full border px-2 sm:px-3 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                onClick={() => handleDeleteCourse(course.id)}
                disabled={deletingCourseId === course.id}
              >
                {deletingCourseId === course.id ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          )}
          <div className="flex items-center justify-between pr-16 sm:pr-20">
            <span className={`px-2 sm:px-3 py-1 rounded-full text-xs font-semibold ${accessBadge(course.access)}`}>
              {course.access === 'open'
                ? 'Open'
                : course.access === 'request'
                  ? 'Request access'
                  : 'Invitation only'}
            </span>
            {course.modules > 0 && (
              <span className="text-xs text-gray-400 uppercase tracking-wide">{course.modules} modules</span>
            )}
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 leading-tight">{course.title}</h3>
            <p className="text-sm text-gray-600 mt-1 line-clamp-2">{course.description}</p>
          </div>
          <div className="flex flex-wrap gap-1 sm:gap-2 text-xs text-gray-500">
            {course.format.slice(0, 3).map((item) => (
              <span key={item} className="bg-gray-100 px-2 py-1 rounded-full">
                {item}
              </span>
            ))}
            {course.format.length > 3 && (
              <span className="bg-gray-100 px-2 py-1 rounded-full">
                +{course.format.length - 3} more
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 text-sm">
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-400">Mentors</p>
              <p className="text-gray-800 truncate">{course.mentors.join(', ')}</p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-wide text-gray-400">Hours</p>
              <p className="text-gray-800">{course.hours} hrs</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 text-sm">
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-400">Format</p>
              <p className="text-gray-800 truncate">{course.format.join(', ')}</p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-wide text-gray-400">Pricing</p>
              <p className="text-sm font-semibold text-gray-900">{formatPricingLabel(course.pricing)}</p>
            </div>
          </div>
          <div className="space-y-2">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`${course.badgeColor} h-2 rounded-full transition-all`}
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>{isCompleted ? 'Completed' : `${progressPercent}% progress`}</span>
              {isCompleted && <span className="text-emerald-600 font-semibold">Badge issued</span>}
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              className="flex-1 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm hover:bg-primary-700"
              onClick={() => handleEnrollAction(course.id)}
            >
              {courseActionLabel(course, enrollment)}
            </button>
            <button className="px-4 py-2 rounded-lg border text-sm text-gray-700 hover:bg-gray-50 whitespace-nowrap">Details</button>
          </div>
        </div>
      )
    })
  }

  return (
    <>
      {builderModal}
      {isCourseManager ? (
        <div className="px-4 sm:px-6 py-6 sm:py-8 lg:py-12">
          <div className="max-w-6xl mx-auto space-y-6 sm:space-y-8 lg:space-y-10">
            <div className="rounded-2xl sm:rounded-3xl bg-slate-900 text-white px-4 sm:px-6 lg:px-10 py-6 sm:py-8 lg:py-12 shadow-xl">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Digital School</p>
                  <h1 className="text-xl sm:text-2xl lg:text-3xl font-semibold mt-2 sm:mt-3">Create and manage discipleship tracks</h1>
                  <p className="text-sm text-gray-100/80 mt-2 sm:mt-3 max-w-2xl">
                    Launch the builder to create a new course or resume a draft. Published courses appear in the catalog grid below.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-3 justify-center md:justify-end">
                  <button
                    type="button"
                    onClick={handleOpenNewCourse}
                    className="px-4 py-2 rounded-full bg-white text-slate-900 text-sm font-semibold shadow hover:bg-slate-100 whitespace-nowrap"
                  >
                    + Create course
                  </button>
                  {latestDraftId && (
                    <button
                      type="button"
                      onClick={() => void handleResumeDraft(latestDraftId)}
                      disabled={resumingCourseId === latestDraftId}
                      className="px-4 py-2 rounded-full border border-white/50 text-sm text-white hover:bg-white/10 disabled:opacity-60 whitespace-nowrap"
                    >
                      {resumingCourseId === latestDraftId ? 'Loading draft…' : 'Resume latest draft'}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {analyticsPanel}
            {examReviewPanel}

            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Course catalog</h2>
                  <p className="text-sm text-gray-600">Drafts stay private until you publish them.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleOpenNewCourse}
                    className="px-4 py-2 rounded-full bg-primary-100 text-primary-700 text-sm font-semibold hover:bg-primary-200 whitespace-nowrap"
                  >
                    New course
                  </button>
                </div>
              </div>

              <div className="grid gap-4 sm:gap-5 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">{renderCourseGrid()}</div>
            </div>
          </div>
        </div>
      ) : (
        // Member View - Course catalog for regular users
        <div className="px-4 sm:px-6 py-6 sm:py-8 lg:py-12">
          <div className="max-w-6xl mx-auto space-y-6 sm:space-y-8 lg:space-y-10">
            <div className="rounded-2xl sm:rounded-3xl bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 sm:px-6 lg:px-10 py-6 sm:py-8 lg:py-12 shadow-xl">
              <div className="text-center">
                <p className="text-xs uppercase tracking-[0.4em] text-blue-100">Digital School</p>
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-semibold mt-2 sm:mt-3">Discipleship & Training Courses</h1>
                <p className="text-sm text-blue-100 mt-2 sm:mt-3 max-w-2xl mx-auto">
                  Grow in your faith through our comprehensive discipleship tracks. Enroll in courses, complete modules, and earn certificates.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="text-center">
                <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Available Courses</h2>
                <p className="text-sm text-gray-600 mt-1">
                  {courses.length > 0 
                    ? `${courses.length} course${courses.length === 1 ? '' : 's'} available for enrollment`
                    : 'No courses available yet. Check back soon!'
                  }
                </p>
              </div>

              <div className="grid gap-4 sm:gap-5 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">{renderCourseGrid()}</div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
