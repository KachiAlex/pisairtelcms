'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { formatCurrency } from '@/lib/utils'
import DonateModal from './DonateModal'

interface Project {
  id: string
  name: string
  description?: string
  currency?: string
  goalAmount: number
  currentAmount: number
  imageUrl?: string
  progress: number
  remainingAmount: number
  _count: {
    giving: number
  }
}

interface GivingProjectsProps {
  isAdmin?: boolean
}

export default function GivingProjects({ isAdmin = false }: GivingProjectsProps) {
  const searchParams = useSearchParams()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [showDonateModal, setShowDonateModal] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    currency: 'USD',
    goalAmount: '',
    imageUrl: '',
    startDate: '',
    endDate: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [paymentMessage, setPaymentMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' } | null>(null)
  const [pendingDonations, setPendingDonations] = useState<any[]>([])
  const [reviewingId, setReviewingId] = useState<string | null>(null)

  const showToast = (message: string, tone: 'success' | 'error' = 'success') => {
    setToast({ message, tone })
    setTimeout(() => setToast(null), 5000)
  }

  const loadPending = async () => {
    if (!isAdmin) return
    try {
      const res = await fetch('/api/giving/pending', { cache: 'no-store' })
      if (res.ok) {
        const json = await res.json()
        setPendingDonations(json.pending || [])
      }
    } catch {
      // non-blocking
    }
  }

  const reviewDonation = async (givingId: string, action: 'confirm' | 'reject') => {
    setReviewingId(givingId)
    try {
      const res = await fetch(`/api/giving/${givingId}/review`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || 'Review failed')
      showToast(action === 'confirm' ? 'Donation confirmed and recorded as income' : 'Donation rejected')
      await Promise.all([loadPending(), loadProjects()])
    } catch (e: any) {
      showToast(e?.message || 'Review failed', 'error')
    } finally {
      setReviewingId(null)
    }
  }

  useEffect(() => {
    loadProjects()
    loadPending()
    
    // Check for payment callback messages
    const success = searchParams?.get('success')
    const error = searchParams?.get('error')
    const reference = searchParams?.get('reference')
    
    if (success === 'true') {
      setPaymentMessage({
        type: 'success',
        text: 'Payment successful! Your donation has been processed and a receipt will be sent to your email.',
      })
      // Clear URL params
      window.history.replaceState({}, '', '/giving')
      loadProjects() // Refresh projects to show updated amounts
    } else if (error) {
      setPaymentMessage({
        type: 'error',
        text: error === 'verification_failed' 
          ? 'Payment verification failed. Please contact support if you were charged.'
          : 'Payment failed. Please try again.',
      })
      window.history.replaceState({}, '', '/giving')
    }
  }, [searchParams])

  const loadProjects = async () => {
    try {
      const response = await fetch('/api/giving/projects')
      if (response.ok) {
        const data = await response.json()
        setProjects(data)
      }
    } catch (error) {
      console.error('Error loading projects:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDonate = (project: Project) => {
    setSelectedProject(project)
    setShowDonateModal(true)
  }

  const handleDonationSuccess = (info?: { pending?: boolean }) => {
    setShowDonateModal(false)
    setSelectedProject(null)
    showToast(
      info?.pending
        ? 'Donation recorded — it will appear as income once the transfer is confirmed.'
        : 'Thank you! Your donation has been recorded.'
    )
    loadProjects()
    loadPending()
  }

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const response = await fetch('/api/giving/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          goalAmount: parseFloat(formData.goalAmount),
        }),
      })

      if (response.ok) {
        setShowCreateModal(false)
        setFormData({
          name: '',
          description: '',
          currency: 'USD',
          goalAmount: '',
          imageUrl: '',
          startDate: '',
          endDate: '',
        })
        loadProjects()
        alert('Project created successfully!')
      } else {
        const error = await response.json()
        alert(`Error: ${error.error}`)
      }
    } catch (error) {
      console.error('Error creating project:', error)
      alert('Failed to create project')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">Loading projects...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6 flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold mb-2">Giving Projects</h1>
          <p className="text-gray-600">
            Support our church projects and see the impact of your giving
          </p>
        </div>
        
        {isAdmin && (
          <div className="flex gap-3">
            <a
              href="/admin/giving-config"
              className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
            >
              <span>⚙️</span>
              <span>Payment Setup</span>
            </a>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-2"
            >
              <span>+</span>
              <span>Create Project</span>
            </button>
          </div>
        )}
      </div>

      {/* Pending bank-transfer donations — admin review */}
      {isAdmin && pendingDonations.length > 0 && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-5">
          <h2 className="text-lg font-semibold text-amber-900 mb-1">
            Pending donations ({pendingDonations.length})
          </h2>
          <p className="text-sm text-amber-800 mb-4">
            Bank transfers awaiting confirmation — confirm to count them as income.
          </p>
          <div className="space-y-3">
            {pendingDonations.map((d) => (
              <div key={d.id} className="bg-white rounded-lg border border-amber-200 p-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-gray-900">
                    {d.user ? `${d.user.firstName} ${d.user.lastName}` : 'Member'} — {d.type}
                  </div>
                  <div className="text-xs text-gray-600 mt-0.5">
                    {formatCurrency(d.amount, d.currency || 'NGN')} • {new Date(d.createdAt).toLocaleString()}
                    {d.project?.name ? ` • ${d.project.name}` : ''}
                  </div>
                  {d.transferReceiptUrl && (
                    <a href={d.transferReceiptUrl} target="_blank" rel="noreferrer" className="text-xs text-primary-600 underline mt-1 inline-block">
                      View receipt
                    </a>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => reviewDonation(d.id, 'confirm')}
                    disabled={reviewingId === d.id}
                    className="px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => reviewDonation(d.id, 'reject')}
                    disabled={reviewingId === d.id}
                    className="px-3 py-1.5 border border-red-300 text-red-600 text-xs font-semibold rounded-lg hover:bg-red-50 disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payment Success/Error Messages */}
      {paymentMessage && (
        <div
          className={`mb-6 p-4 rounded-lg flex items-center justify-between ${
            paymentMessage.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          <p>{paymentMessage.text}</p>
          <button
            onClick={() => setPaymentMessage(null)}
            className="ml-4 text-lg font-bold hover:opacity-70"
          >
            ×
          </button>
        </div>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map((project) => (
          <div
            key={project.id}
            className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow"
          >
            {project.imageUrl && (
              <img
                src={project.imageUrl}
                alt={project.name}
                className="w-full h-48 object-cover"
              />
            )}
            <div className="p-6">
              <h3 className="text-xl font-semibold mb-2">{project.name}</h3>
              {project.description && (
                <p className="text-gray-600 mb-4 text-sm">{project.description}</p>
              )}

              {/* Progress Bar */}
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600">Progress</span>
                  <span className="font-medium">
                    {project.progress.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-primary-600 h-3 rounded-full transition-all"
                    style={{ width: `${project.progress}%` }}
                  ></div>
                </div>
                <div className="flex justify-between text-sm mt-2 text-gray-600">
                  <span>{formatCurrency(project.currentAmount, project.currency || 'USD')}</span>
                  <span>{formatCurrency(project.goalAmount, project.currency || 'USD')}</span>
                </div>
              </div>

              <div className="text-sm text-gray-600 mb-4">
                {project._count.giving} donors •{' '}
                {formatCurrency(project.remainingAmount, project.currency || 'USD')} remaining
              </div>

              <button
                onClick={() => handleDonate(project)}
                className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                Give Now
              </button>
            </div>
          </div>
        ))}
      </div>

      {projects.length === 0 && (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-600">No active projects at this time.</p>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-6 right-6 z-[70] flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-white shadow-lg ${
            toast.tone === 'success' ? 'bg-emerald-600' : 'bg-rose-600'
          }`}
        >
          <span>{toast.message}</span>
          <button
            type="button"
            className="text-white/80 transition hover:text-white"
            onClick={() => setToast(null)}
          >
            ×
          </button>
        </div>
      )}

      {/* Donate Modal */}
      {showDonateModal && selectedProject && (
        <DonateModal
          project={selectedProject}
          onClose={() => {
            setShowDonateModal(false)
            setSelectedProject(null)
          }}
          onSuccess={handleDonationSuccess}
        />
      )}

      {/* Create Project Modal (Admin Only) */}
      {isAdmin && showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl font-bold mb-4">Create Giving Project</h2>

              <form onSubmit={handleCreateProject} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Project Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="e.g., Building Fund, Mission Trip"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    rows={3}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="Describe the project and its purpose..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Goal Amount ($) *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={formData.goalAmount}
                    onChange={(e) => setFormData({ ...formData, goalAmount: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="10000"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Currency
                  </label>
                  <select
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="USD">USD</option>
                    <option value="NGN">NGN</option>
                    <option value="GHS">GHS</option>
                    <option value="KES">KES</option>
                    <option value="ZAR">ZAR</option>
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Image URL (optional)
                  </label>
                  <input
                    type="url"
                    value={formData.imageUrl}
                    onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="https://example.com/image.jpg"
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Start Date (optional)
                    </label>
                    <input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      End Date (optional)
                    </label>
                    <input
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
                  >
                    {submitting ? 'Creating...' : 'Create Project'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

