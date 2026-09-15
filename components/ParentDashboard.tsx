'use client'

import { useState, useEffect } from 'react'
import { formatDate } from '@/lib/utils'
import ChildrenCheckIn from './ChildrenCheckIn'
import FamilyManager from './FamilyManager'

interface Child {
  id: string
  firstName: string
  lastName: string
  dateOfBirth?: string
  profileImage?: string
  role: string
  xp: number
  level: number
  isCheckedIn: boolean
  checkInInfo?: {
    id: string
    checkedInAt: string
    qrCode: string
  } | null
  _count: {
    childrenCheckIns: number
    readingPlans: number
    badges: number
  }
}

export default function ParentDashboard() {
  const [children, setChildren] = useState<Child[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedChild, setSelectedChild] = useState<Child | null>(null)

  useEffect(() => {
    loadChildren()
  }, [])

  const loadChildren = async () => {
    try {
      const response = await fetch('/api/children/list')
      if (response.ok) {
        const data = await response.json()
        setChildren(data)
      }
    } catch (error) {
      console.error('Error loading children:', error)
    } finally {
      setLoading(false)
    }
  }

  const calculateAge = (dateOfBirth?: string) => {
    if (!dateOfBirth) return null
    const today = new Date()
    const birth = new Date(dateOfBirth)
    let age = today.getFullYear() - birth.getFullYear()
    const monthDiff = today.getMonth() - birth.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--
    }
    return age
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">Loading...</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Parent Dashboard</h1>

      {children.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-600 mb-4">No children registered</p>
          <p className="text-sm text-gray-500">
            Contact your church admin to register your children
          </p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {children.map((child) => (
            <div
              key={child.id}
              className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow"
            >
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center overflow-hidden">
                  {child.profileImage ? (
                    <img
                      src={child.profileImage}
                      alt={`${child.firstName} ${child.lastName}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-primary-600 text-xl font-bold">
                      {child.firstName[0]}{child.lastName[0]}
                    </span>
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold">
                    {child.firstName} {child.lastName}
                  </h3>
                  {child.dateOfBirth && (
                    <p className="text-sm text-gray-600">
                      Age {calculateAge(child.dateOfBirth)}
                    </p>
                  )}
                </div>
              </div>

              {/* Check-in Status */}
              {child.isCheckedIn && child.checkInInfo && (
                <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-sm font-medium text-green-800 mb-1">
                    ✓ Checked In
                  </p>
                  <p className="text-xs text-green-700">
                    Since {formatDate(child.checkInInfo.checkedInAt)}
                  </p>
                </div>
              )}

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2 mb-4 text-center">
                <div className="bg-gray-50 rounded p-2">
                  <div className="text-lg font-bold text-primary-600">
                    {child._count.badges}
                  </div>
                  <div className="text-xs text-gray-600">Badges</div>
                </div>
                <div className="bg-gray-50 rounded p-2">
                  <div className="text-lg font-bold text-primary-600">
                    {child._count.readingPlans}
                  </div>
                  <div className="text-xs text-gray-600">Plans</div>
                </div>
                <div className="bg-gray-50 rounded p-2">
                  <div className="text-lg font-bold text-primary-600">
                    Level {child.level}
                  </div>
                  <div className="text-xs text-gray-600">Level</div>
                </div>
              </div>

              {/* Actions */}
              <button
                onClick={() => setSelectedChild(child)}
                className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                {child.isCheckedIn ? 'Check Out' : 'Check In'}
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-8">
        <FamilyManager onChanged={loadChildren} />
      </div>

      {/* Check-in Modal */}
      {selectedChild && (
        <ChildrenCheckIn
          child={selectedChild}
          onClose={() => {
            setSelectedChild(null)
            loadChildren()
          }}
        />
      )}
    </div>
  )
}

