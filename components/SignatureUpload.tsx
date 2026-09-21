import { useState, useEffect, useCallback } from 'react'

import { Upload, X, PenTool, Save, Trash2 } from 'lucide-react'

interface SignatureData {
  url: string | null
  title: string
  name: string
}

interface SignatureUploadProps {
  onSignatureChange?: (signature: SignatureData) => void
}

export function SignatureUpload({ onSignatureChange }: SignatureUploadProps) {
  const [churchId, setChurchId] = useState<string | null>(null)
  const [signature, setSignature] = useState<SignatureData>({
    url: null,
    title: 'Lead Pastor',
    name: ''
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Get current user's church ID
  useEffect(() => {
    const getCurrentChurch = async () => {
      try {
        const response = await fetch('/api/me/permissions')
        if (response.ok) {
          const data = await response.json()
          if (data?.churchId) {
            setChurchId(data.churchId)
            return
          }
        }
      } catch (error) {
        console.error('Failed to get church context:', error)
      }
      // No church context — stop the loading skeleton
      setIsLoading(false)
    }
    getCurrentChurch()
  }, [])

  const loadSignature = useCallback(async () => {
    if (!churchId) return
    
    try {
      setIsLoading(true)
      const response = await fetch(`/api/churches/${churchId}/signature`)
      
      if (response.ok) {
        const data = await response.json()
        setSignature(data.signature)
        onSignatureChange?.(data.signature)
      }
    } catch (error) {
      console.error('Failed to load signature:', error)
    } finally {
      setIsLoading(false)
    }
  }, [churchId, onSignatureChange])

  // Load existing signature settings
  useEffect(() => {
    if (churchId) {
      loadSignature()
    }
  }, [churchId, loadSignature])

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file')
      return
    }

    if (file.size > 2 * 1024 * 1024) {
      setError('File size must be less than 2MB')
      return
    }

    setIsUploading(true)
    setError(null)
    setSuccess(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('title', signature.title)
      formData.append('name', signature.name)

      const response = await fetch(`/api/churches/${churchId}/signature`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Upload failed')
      }

      const data = await response.json()
      setSignature(data.signature)
      onSignatureChange?.(data.signature)
      setSuccess('Signature uploaded successfully!')
    } catch (error: any) {
      setError(error.message || 'Failed to upload signature')
    } finally {
      setIsUploading(false)
    }
  }

  const handleSaveSettings = async () => {
    if (!signature.url) {
      setError('Please upload a signature image first')
      return
    }

    setIsSaving(true)
    setError(null)
    setSuccess(null)

    try {
      // Create a dummy file to update settings
      const formData = new FormData()
      formData.append('title', signature.title)
      formData.append('name', signature.name)
      
      // We need to send the existing file or create a minimal update
      // For now, we'll create a simple endpoint update
      const response = await fetch(`/api/churches/${churchId}/signature-settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: signature.title,
          name: signature.name,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save settings')
      }

      setSuccess('Signature settings saved!')
      onSignatureChange?.(signature)
    } catch (error: any) {
      setError(error.message || 'Failed to save settings')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteSignature = async () => {
    if (!confirm('Are you sure you want to remove the signature? This will affect all future certificates.')) {
      return
    }

    setIsUploading(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch(`/api/churches/${churchId}/signature`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete signature')
      }

      setSignature({ url: null, title: 'Lead Pastor', name: '' })
      onSignatureChange?.({ url: null, title: 'Lead Pastor', name: '' })
      setSuccess('Signature removed successfully!')
    } catch (error: any) {
      setError(error.message || 'Failed to delete signature')
    } finally {
      setIsUploading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4 p-4 border rounded-lg">
        <div className="flex items-center space-x-2">
          <PenTool className="h-5 w-5 text-gray-400" />
          <span className="font-medium text-gray-700">Certificate Signature</span>
        </div>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 p-4 border rounded-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <PenTool className="h-5 w-5 text-gray-600" />
          <span className="font-medium text-gray-700">Certificate Signature</span>
        </div>
        {signature.url && (
          <button
            type="button"
            onClick={handleDeleteSignature}
            disabled={isUploading}
            className="text-red-600 hover:text-red-700 disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Current Signature Preview */}
      {signature.url && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">Current Signature</label>
          <div className="relative inline-block">
            <img
              src={signature.url}
              alt="Current signature"
              className="max-w-xs max-h-20 border rounded-lg bg-white p-2"
            />
          </div>
        </div>
      )}

      {/* Signature Settings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Signature Title
          </label>
          <input
            type="text"
            value={signature.title}
            onChange={(e) => setSignature(prev => ({ ...prev, title: e.target.value }))}
            placeholder="Lead Pastor"
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Signatory Name
          </label>
          <input
            type="text"
            value={signature.name}
            onChange={(e) => setSignature(prev => ({ ...prev, name: e.target.value }))}
            placeholder="Pastor John Doe"
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200"
          />
        </div>
      </div>

      {/* File Upload */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Upload New Signature
        </label>
        <input
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          disabled={isUploading}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
        />
        <p className="text-xs text-gray-500 mt-1">
          PNG, JPG up to 2MB. Transparent background recommended.
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex space-x-2">
        <button
          type="button"
          onClick={handleSaveSettings}
          disabled={isSaving || !signature.title.trim()}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
          ) : (
            <Save className="h-4 w-4" />
          )}
          <span>{isSaving ? 'Saving...' : 'Save Settings'}</span>
        </button>
      </div>

      {/* Status Messages */}
      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-2">
          {error}
        </div>
      )}
      {success && (
        <div className="text-sm text-green-600 bg-green-50 border border-green-200 rounded-lg p-2">
          {success}
        </div>
      )}
      {isUploading && (
        <div className="text-sm text-blue-600 bg-blue-50 border border-blue-200 rounded-lg p-2">
          Uploading signature...
        </div>
      )}
    </div>
  )
}