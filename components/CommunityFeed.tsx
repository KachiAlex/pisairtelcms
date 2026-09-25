'use client'

import { useState, useEffect, useRef, useCallback, FormEvent, useMemo } from 'react'
import { formatDate } from '@/lib/utils'

interface Post {
  id: string
  content: string
  type: string
  images: string[]
  createdAt: string
  user: {
    id: string
    firstName: string
    lastName: string
    profileImage?: string
  }
  isLiked: boolean
  _count: {
    likes: number
    comments: number
  }
}

interface User {
  id: string
  firstName: string
  lastName: string
  profileImage?: string
  role?: string
}

interface Comment {
  id: string
  postId: string
  content: string
  createdAt: string
  parentCommentId?: string
  user: {
    id: string
    firstName: string
    lastName: string
    profileImage?: string
  } | null

  isLiked?: boolean
  _count?: {
    likes: number
  }
}

interface ShareUnit {
  id: string
  name: string
  unitTypeId: string
  myRole?: string
}

export default function CommunityFeed() {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const isAdmin = useMemo(() => {
    if (!currentUser?.role) return false
    return ['ADMIN', 'SUPER_ADMIN', 'BRANCH_ADMIN'].includes(currentUser.role)
  }, [currentUser])

  const [shareOpen, setShareOpen] = useState(false)
  const [sharePostId, setSharePostId] = useState<string | null>(null)
  const [shareUnits, setShareUnits] = useState<ShareUnit[]>([])
  const [shareSelectedUnitIds, setShareSelectedUnitIds] = useState<string[]>([])
  const [shareNote, setShareNote] = useState('')
  const [shareLoadingUnits, setShareLoadingUnits] = useState(false)
  const [shareSubmitting, setShareSubmitting] = useState(false)
  const [shareError, setShareError] = useState('')
  const [shareSuccess, setShareSuccess] = useState('')

  const feedFilters: { key: 'all' | 'Update' | 'Testimony' | 'Announcement' | 'Prayer Request'; label: string }[] = [
    { key: 'all', label: 'All updates' },
    { key: 'Update', label: 'Team updates' },
    { key: 'Testimony', label: 'Testimonies' },
    { key: 'Announcement', label: 'Announcements' },
    { key: 'Prayer Request', label: 'Prayer requests' },
  ]
  const [activeFeedFilter, setActiveFeedFilter] = useState<'all' | 'Update' | 'Testimony' | 'Announcement' | 'Prayer Request'>('all')
  const [feedRefreshing, setFeedRefreshing] = useState(false)
  const [hasLoadedPosts, setHasLoadedPosts] = useState(false)

  const [showBroadcast, setShowBroadcast] = useState(false)
  const [broadcastTargets, setBroadcastTargets] = useState<{ departments: { id: string; name: string }[]; groups: { id: string; name: string; type: string }[] }>({ departments: [], groups: [] })

  const [openCommentsPostId, setOpenCommentsPostId] = useState<string | null>(null)
  const [commentsByPostId, setCommentsByPostId] = useState<Record<string, Comment[]>>({})
  const [commentDraftByPostId, setCommentDraftByPostId] = useState<Record<string, string>>({})
  const [commentsLoadingByPostId, setCommentsLoadingByPostId] = useState<Record<string, boolean>>({})
  const [commentPostingByPostId, setCommentPostingByPostId] = useState<Record<string, boolean>>({})

  const [replyDraftByCommentId, setReplyDraftByCommentId] = useState<Record<string, string>>({})
  const [replyPostingByCommentId, setReplyPostingByCommentId] = useState<Record<string, boolean>>({})
  const [openReplyCommentId, setOpenReplyCommentId] = useState<string | null>(null)

  const loadComments = async (postId: string) => {
    setCommentsLoadingByPostId((p) => ({ ...p, [postId]: true }))
    try {
      const res = await fetch(`/api/posts/${postId}/comments`, { cache: 'no-store' })
      if (!res.ok) {
        setCommentsByPostId((p) => ({ ...p, [postId]: [] }))
        return
      }
      const data = await res.json()
      const comments = Array.isArray(data) ? data : []
      const normalized = comments.map((c: any) => {
        const count = c?._count || {}
        return {
          ...c,
          parentCommentId: c?.parentCommentId || undefined,
          isLiked: Boolean(c?.isLiked),
          _count: {
            likes: Number(count.likes || 0),
          },
        } as Comment
      })
      setCommentsByPostId((p) => ({ ...p, [postId]: normalized }))
    } catch (error) {
      console.error('Error loading comments:', error)
      setCommentsByPostId((p) => ({ ...p, [postId]: [] }))
    } finally {
      setCommentsLoadingByPostId((p) => ({ ...p, [postId]: false }))
    }
  }

  const submitComment = async (postId: string) => {
    const content = (commentDraftByPostId[postId] || '').trim()
    if (!content) return

    setCommentPostingByPostId((p) => ({ ...p, [postId]: true }))
    try {
      const res = await fetch(`/api/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content }),
      })

      if (!res.ok) return

      const createdRaw = await res.json()
      const created: Comment = {
        ...createdRaw,
        parentCommentId: createdRaw?.parentCommentId || undefined,
        isLiked: Boolean(createdRaw?.isLiked),
        _count: { likes: Number(createdRaw?._count?.likes || 0) },
      }
      setCommentsByPostId((p) => ({
        ...p,
        [postId]: [...(p[postId] || []), created],
      }))
      setCommentDraftByPostId((p) => ({ ...p, [postId]: '' }))

      setPosts((prev) =>
        prev.map((post) =>
          post.id === postId
            ? {
                ...post,
                _count: {
                  ...post._count,
                  comments: post._count.comments + 1,
                },
              }
            : post
        )
      )
    } catch (error) {
      console.error('Error creating comment:', error)
    } finally {
      setCommentPostingByPostId((p) => ({ ...p, [postId]: false }))
    }
  }

  const submitReply = async (postId: string, parentCommentId: string) => {
    const content = (replyDraftByCommentId[parentCommentId] || '').trim()
    if (!content) return

    setReplyPostingByCommentId((p) => ({ ...p, [parentCommentId]: true }))
    try {
      const res = await fetch(`/api/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content, parentCommentId }),
      })

      if (!res.ok) return

      const createdRaw = await res.json()
      const created: Comment = {
        ...createdRaw,
        parentCommentId: createdRaw?.parentCommentId || undefined,
        isLiked: Boolean(createdRaw?.isLiked),
        _count: { likes: Number(createdRaw?._count?.likes || 0) },
      }

      setCommentsByPostId((p) => ({
        ...p,
        [postId]: [...(p[postId] || []), created],
      }))

      setReplyDraftByCommentId((p) => ({ ...p, [parentCommentId]: '' }))
      setOpenReplyCommentId(null)

      setPosts((prev) =>
        prev.map((post) =>
          post.id === postId
            ? {
                ...post,
                _count: {
                  ...post._count,
                  comments: post._count.comments + 1,
                },
              }
            : post
        )
      )
    } catch (error) {
      console.error('Error creating reply:', error)
    } finally {
      setReplyPostingByCommentId((p) => ({ ...p, [parentCommentId]: false }))
    }
  }

  const toggleCommentLike = async (postId: string, commentId: string) => {
    try {
      const res = await fetch(`/api/posts/${postId}/comments/${commentId}/like`, { method: 'POST' })
      if (!res.ok) return
      const data = await res.json().catch(() => ({}))
      const liked = Boolean(data?.liked)

      setCommentsByPostId((prev) => {
        const list = prev[postId] || []
        return {
          ...prev,
          [postId]: list.map((c) =>
            c.id === commentId
              ? {
                  ...c,
                  isLiked: liked,
                  _count: {
                    likes: (c._count?.likes || 0) + (liked ? 1 : -1),
                  },
                }
              : c
          ),
        }
      })
    } catch (error) {
      console.error('Error toggling comment like:', error)
    }
  }
  
  // Post creation states
  const [postContent, setPostContent] = useState('')
  const [postType, setPostType] = useState('Update')
  const [images, setImages] = useState<string[]>([])
  const [imageUrl, setImageUrl] = useState('')
  const [isPosting, setIsPosting] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [charCount, setCharCount] = useState(0)

  const [broadcastContent, setBroadcastContent] = useState('')
  const availableRoles = ['MEMBER', 'HEAD', 'BRANCH_ADMIN', 'ADMIN', 'SUPER_ADMIN']
  const [broadcastTargetRole, setBroadcastTargetRole] = useState('')
  const [broadcastTargetDepartmentId, setBroadcastTargetDepartmentId] = useState('')
  const [broadcastTargetGroupId, setBroadcastTargetGroupId] = useState('')
  const [broadcastSubmitting, setBroadcastSubmitting] = useState(false)
  const [broadcastError, setBroadcastError] = useState('')
  const [broadcastSuccess, setBroadcastSuccess] = useState('')

  const toggleBroadcast = async () => {
    const next = !showBroadcast
    setShowBroadcast(next)
    if (next && broadcastTargets.departments.length === 0 && broadcastTargets.groups.length === 0) {
      try {
        const res = await fetch('/api/messages/broadcast/targets')
        if (res.ok) {
          const data = await res.json()
          setBroadcastTargets({
            departments: data?.departments || [],
            groups: data?.groups || [],
          })
        }
      } catch {}
    }
  }

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const loadPosts = useCallback(async () => {
    setLoading(true)
    setFeedRefreshing(true)
    try {
      const params = new URLSearchParams()
      if (activeFeedFilter !== 'all') {
        params.append('type', activeFeedFilter)
      }
      const response = await fetch(`/api/posts?${params.toString()}`)
      if (response.ok) {
        const data = await response.json()
        const rawPosts = Array.isArray(data?.posts) ? data.posts : []
        const normalized = rawPosts.map((p: any) => {
          const images = Array.isArray(p?.images) ? p.images : []
          const count = p?._count || {}
          return {
            ...p,
            images,
            isLiked: Boolean(p?.isLiked),
            _count: {
              likes: Number(count.likes || 0),
              comments: Number(count.comments || 0),
            },
          } as Post
        })
        setPosts(normalized)
        setHasLoadedPosts(true)
      } else {
        setPosts([])
      }
    } catch (error) {
      console.error('Error loading posts:', error)
      setPosts([])
    } finally {
      setLoading(false)
      setFeedRefreshing(false)
    }
  }, [activeFeedFilter])

  const loadMyUnits = useCallback(async () => {
    setShareLoadingUnits(true)
    setShareError('')
    try {
      const res = await fetch('/api/units/mine')
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to load units')
      }
      setShareUnits(Array.isArray(data?.units) ? data.units : [])
    } catch (e: any) {
      setShareUnits([])
      setShareError(e?.message || 'Failed to load units')
    } finally {
      setShareLoadingUnits(false)
    }
  }, [])

  const openShare = async (postId: string) => {
    setSharePostId(postId)
    setShareSelectedUnitIds([])
    setShareNote('')
    setShareError('')
    setShareOpen(true)
    await loadMyUnits()
  }

  const submitShare = async () => {
    if (!sharePostId) return
    if (shareSelectedUnitIds.length === 0) return
    setShareSubmitting(true)
    setShareError('')
    setShareSuccess('')
    try {
      const res = await fetch(`/api/posts/${sharePostId}/share`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ unitIds: shareSelectedUnitIds, note: shareNote || undefined }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Failed to share')
      setShareOpen(false)
      setSharePostId(null)
      setShareSuccess('Shared with selected units')
    } catch (e: any) {
      setShareError(e?.message || 'Failed to share')
    } finally {
      setShareSubmitting(false)
    }
  }

  useEffect(() => {
    setCharCount(postContent.length)
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'
    }
  }, [postContent])

  const loadCurrentUser = async () => {
    try {
      const response = await fetch('/api/users/me')
      if (response.ok) {
        const data = await response.json()
        setCurrentUser(data)
      }
    } catch (error) {
      console.error('Error loading user:', error)
    }
  }

  useEffect(() => {
    loadCurrentUser()
  }, [])

  useEffect(() => {
    loadPosts()
  }, [loadPosts])

  const handleCreatePost = async () => {
    if (!postContent.trim()) return

    setIsPosting(true)
    try {
      const response = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: postContent,
          type: postType,
          images,
        }),
      })

      if (response.ok) {
        setPostContent('')
        setImages([])
        setPostType('Update')
        setIsExpanded(false)
        loadPosts()
      }
    } catch (error) {
      console.error('Error creating post:', error)
    } finally {
      setIsPosting(false)
    }
  }

  const handleLike = async (postId: string) => {
    try {
      const response = await fetch(`/api/posts/${postId}/like`, {
        method: 'POST',
      })

      if (response.ok) {
        const data = await response.json()
        setPosts((prev) =>
          prev.map((post) =>
            post.id === postId
              ? {
                  ...post,
                  isLiked: data.liked,
                  _count: {
                    ...post._count,
                    likes: data.liked
                      ? post._count.likes + 1
                      : post._count.likes - 1,
                  },
                }
              : post
          )
        )
      }
    } catch (error) {
      console.error('Error liking post:', error)
    }
  }

  const addImage = () => {
    if (imageUrl.trim() && !images.includes(imageUrl.trim())) {
      setImages([...images, imageUrl.trim()])
      setImageUrl('')
    }
  }

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index))
  }

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName[0]}${lastName[0]}`.toUpperCase()
  }

  const postTypes = [
    { value: 'Update', icon: '🗂️', color: 'bg-blue-50 text-blue-700' },
    { value: 'Testimony', icon: '✨', color: 'bg-purple-50 text-purple-700' },
    { value: 'Announcement', icon: '📣', color: 'bg-orange-50 text-orange-700' },
    { value: 'Prayer Request', icon: '🙏', color: 'bg-green-50 text-green-700' },
  ]

  return (
    <div className="container mx-auto px-4 py-6 max-w-5xl space-y-6">
      {/* Admin broadcast toggle */}
      {isAdmin && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={toggleBroadcast}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              showBroadcast
                ? 'bg-primary-600 text-white hover:bg-primary-700'
                : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            📣 {showBroadcast ? 'Close broadcast' : 'Broadcast'}
          </button>
        </div>
      )}

      {/* Admin Broadcast Panel — collapsed by default */}
      {isAdmin && showBroadcast && (
        <div id="broadcast" className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Broadcast to Community</h2>
              <p className="text-sm text-gray-600">Push an announcement across roles, departments, or a specific unit.</p>
            </div>
            {broadcastSuccess && <span className="text-xs font-medium text-green-600">{broadcastSuccess}</span>}
          </div>

          {broadcastError && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">{broadcastError}</div>
          )}

          <form
            onSubmit={async (e) => {
              e.preventDefault()
              if (!broadcastContent.trim()) {
                setBroadcastError('Message content is required')
                return
              }
              setBroadcastSubmitting(true)
              setBroadcastError('')
              setBroadcastSuccess('')
              try {
                const res = await fetch('/api/messages/broadcast', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    content: broadcastContent.trim(),
                    targetRole: broadcastTargetRole || undefined,
                    targetDepartmentId: broadcastTargetDepartmentId || undefined,
                    targetGroupId: broadcastTargetGroupId || undefined,
                  }),
                })
                const data = await res.json().catch(() => ({}))
                if (!res.ok) throw new Error(data?.error || 'Failed to send broadcast')
                setBroadcastContent('')
                setBroadcastTargetRole('')
                setBroadcastTargetDepartmentId('')
                setBroadcastTargetGroupId('')
                setBroadcastSuccess(`Sent to ${data?.sentTo ?? data?.messages ?? 'community'} recipients`)
              } catch (error: any) {
                setBroadcastError(error?.message || 'Failed to send broadcast')
              } finally {
                setBroadcastSubmitting(false)
              }
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
              <textarea
                value={broadcastContent}
                onChange={(e) => setBroadcastContent(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                rows={3}
                placeholder="Share a church-wide update..."
              />
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role Filter</label>
                <select
                  value={broadcastTargetRole}
                  onChange={(e) => setBroadcastTargetRole(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2"
                >
                  <option value="">Everyone</option>
                  {availableRoles.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department (optional)</label>
                <select
                  value={broadcastTargetDepartmentId}
                  onChange={(e) => setBroadcastTargetDepartmentId(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2"
                >
                  <option value="">All departments</option>
                  {broadcastTargets.departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Group (optional)</label>
                <select
                  value={broadcastTargetGroupId}
                  onChange={(e) => setBroadcastTargetGroupId(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2"
                >
                  <option value="">All groups</option>
                  {broadcastTargets.groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}{g.type ? ` · ${g.type}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setBroadcastContent('')
                  setBroadcastTargetRole('')
                  setBroadcastTargetDepartmentId('')
                  setBroadcastTargetGroupId('')
                  setBroadcastError('')
                  setBroadcastSuccess('')
                }}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
                disabled={broadcastSubmitting}
              >
                Clear
              </button>
              <button
                type="submit"
                disabled={broadcastSubmitting || !broadcastContent.trim()}
                className="px-5 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium disabled:opacity-60"
              >
                {broadcastSubmitting ? 'Sending...' : 'Send Broadcast'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Create Post Box */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex gap-4">
          {/* User Avatar */}
          <div className="flex-shrink-0">
            {currentUser?.profileImage ? (
              <img
                src={currentUser.profileImage}
                alt={`${currentUser.firstName} ${currentUser.lastName}`}
                className="w-12 h-12 rounded-full object-cover"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-500 to-indigo-600 flex items-center justify-center text-white font-semibold shadow-md">
                {currentUser && getInitials(currentUser.firstName, currentUser.lastName)}
              </div>
            )}
          </div>

          {/* Post Input */}
          <div className="flex-1">
            <textarea
              ref={textareaRef}
              value={postContent}
              onChange={(e) => setPostContent(e.target.value)}
              onFocus={() => setIsExpanded(true)}
              placeholder={`What's on your mind, ${currentUser?.firstName}?`}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl resize-none focus:outline-none focus:border-primary-500 transition-all text-gray-800 placeholder-gray-400"
              rows={isExpanded ? 4 : 1}
              style={{ minHeight: isExpanded ? '100px' : '48px' }}
            />

            {/* Expanded Options */}
            {isExpanded && (
              <div className="mt-4 space-y-4">
                {/* Post Type Pills */}
                <div className="flex flex-wrap gap-2">
                  {postTypes.map((type) => (
                    <button
                      key={type.value}
                      onClick={() => setPostType(type.value)}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                        postType === type.value
                          ? type.color + ' ring-2 ring-offset-2 ring-primary-500'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {type.value}
                    </button>
                  ))}
                </div>

                {/* Add Image Section */}
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="Paste image URL..."
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <button
                    type="button"
                    onClick={addImage}
                    className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors text-gray-700 font-medium"
                  >
                     Add Photo
                  </button>
                </div>

                {/* Image Previews */}
                {images.length > 0 && (
                  <div className="grid grid-cols-3 gap-3">
                    {images.map((img, idx) => (
                      <div key={idx} className="relative group">
                        <img
                          src={img}
                          alt={`Preview ${idx + 1}`}
                          className="w-full h-32 object-cover rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={() => removeImage(idx)}
                          className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                  <div className="text-sm text-gray-500">
                    {charCount > 0 && (
                      <span className={charCount > 500 ? 'text-red-500 font-medium' : ''}>
                        {charCount} {charCount > 500 && '/ 500'}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setIsExpanded(false)
                        setPostContent('')
                        setImages([])
                        setPostType('Update')
                      }}
                      className="px-5 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCreatePost}
                      disabled={!postContent.trim() || isPosting || charCount > 500}
                      className="px-6 py-2 bg-gradient-to-r from-primary-600 to-indigo-600 text-white rounded-lg hover:shadow-lg hover:scale-105 disabled:opacity-50 disabled:hover:scale-100 disabled:hover:shadow-none transition-all font-semibold"
                    >
                      {isPosting ? 'Posting...' : 'Post'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Feed filter bar — slim pills only */}
      <div className="bg-white rounded-xl shadow-sm px-4 py-3 flex flex-wrap gap-2 items-center overflow-x-auto">
        {feedFilters.map((filter) => (
          <button
            key={filter.key}
            onClick={() => setActiveFeedFilter(filter.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition whitespace-nowrap ${
              activeFeedFilter === filter.key ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* Posts Feed */}
      <div className="space-y-6">
        {posts.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md p-12 text-center">
            <div className="text-6xl mb-4"></div>
            <p className="text-gray-600 text-lg">No posts yet. Be the first to share something!</p>
          </div>
        ) : (
          posts.map((post) => (
            <div key={post.id} className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow">
              {/* Post Header */}
              <div className="p-6 pb-4">
                <div className="flex items-start gap-4">
                  {/* User Avatar */}
                  {post.user.profileImage ? (
                    <img
                      src={post.user.profileImage}
                      alt={`${post.user.firstName} ${post.user.lastName}`}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-500 to-indigo-600 flex items-center justify-center text-white font-semibold shadow-md">
                      {getInitials(post.user.firstName, post.user.lastName)}
                    </div>
                  )}

                  {/* User Info */}
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {post.user.firstName} {post.user.lastName}
                        </h3>
                        <p className="text-sm text-gray-500">{formatDate(post.createdAt)}</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        postTypes.find(t => t.value === post.type)?.color || 'bg-gray-100 text-gray-600'
                      }`}>
                        {postTypes.find(t => t.value === post.type)?.icon} {post.type}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Post Content */}
                <div className="mt-4">
                  <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">{post.content}</p>
                </div>
              </div>

              {/* Post Images */}
              {((post as any)?.images || []).length > 0 && (
                <div className={`grid ${((post as any)?.images || []).length === 1 ? 'grid-cols-1' : ((post as any)?.images || []).length === 2 ? 'grid-cols-2' : 'grid-cols-2'} gap-1`}>
                  {((post as any)?.images || []).slice(0, 4).map((img: string, idx: number) => (
                    <div key={idx} className="relative aspect-square">
                      <img
                        src={img}
                        alt={`Post image ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                      {idx === 3 && ((post as any)?.images || []).length > 4 && (
                        <div className="absolute inset-0 bg-black bg-opacity-60 flex items-center justify-center">
                          <span className="text-white text-2xl font-bold">
                            +{((post as any)?.images || []).length - 4}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Post Actions */}
              <div className="p-6 pt-4">
                <div className="flex items-center justify-between text-sm text-gray-500 mb-3">
                  <span>{post._count.likes} likes</span>
                  <button
                    type="button"
                    onClick={async () => {
                      const next = openCommentsPostId === post.id ? null : post.id
                      setOpenCommentsPostId(next)
                      if (next && !(commentsByPostId[post.id]?.length)) {
                        await loadComments(post.id)
                      }
                    }}
                    className="flex items-center gap-1 hover:text-primary-600 transition-colors"
                  >
                    {post._count.comments} comments
                    <svg
                      className={`w-4 h-4 transition-transform ${openCommentsPostId === post.id ? 'rotate-180 text-primary-600' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>

                <div className="flex items-center gap-2 pt-3 border-t border-gray-200">
                  <button
                    onClick={() => handleLike(post.id)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium transition-all ${
                      post.isLiked
                        ? 'text-primary-600 bg-primary-50 hover:bg-primary-100'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {post.isLiked ? '' : ''} Like
                  </button>
                  <button
                    onClick={async () => {
                      const next = openCommentsPostId === post.id ? null : post.id
                      setOpenCommentsPostId(next)
                      if (next) {
                        await loadComments(post.id)
                      }
                    }}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium transition-all ${
                      openCommentsPostId === post.id ? 'text-primary-600 bg-primary-50 hover:bg-primary-100' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    Comment
                  </button>
                  <button
                    onClick={() => openShare(post.id)}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium text-gray-600 hover:bg-gray-100 transition-all"
                  >
                    Share
                  </button>
                </div>

                {openCommentsPostId === post.id && (
                  <div className="mt-4 border-t border-gray-200 pt-4 space-y-3">
                    {commentsLoadingByPostId[post.id] ? (
                      <div className="text-sm text-gray-500">Loading comments...</div>
                    ) : (
                      <div className="space-y-3">
                        {(commentsByPostId[post.id] || []).length === 0 ? (
                          <div className="text-sm text-gray-500">No comments yet.</div>
                        ) : (
                          (() => {
                            const all = commentsByPostId[post.id] || []
                            const roots = all.filter((c) => !c.parentCommentId)
                            const repliesByParentId = all.reduce((acc: Record<string, Comment[]>, c) => {
                              if (!c.parentCommentId) return acc
                              acc[c.parentCommentId] = acc[c.parentCommentId] || []
                              acc[c.parentCommentId].push(c)
                              return acc
                            }, {})
                            return roots.map((c) => (
                              <div key={c.id} className="space-y-2">
                                <div className="flex gap-3">
                                  <div className="flex-shrink-0">
                                    {c.user?.profileImage ? (
                                      <img src={c.user.profileImage} className="w-8 h-8 rounded-full object-cover" alt="" />
                                    ) : (
                                      <div className="w-8 h-8 rounded-full bg-gray-200" />
                                    )}
                                  </div>
                                  <div className="flex-1">
                                    <div className="text-sm">
                                      <span className="font-semibold text-gray-900">
                                        {c.user ? `${c.user.firstName} ${c.user.lastName}` : 'Unknown'}
                                      </span>
                                      <span className="text-gray-700">{' '}{c.content}</span>
                                    </div>
                                    <div className="text-xs text-gray-500">{formatDate(c.createdAt)}</div>

                                    <div className="mt-1 flex items-center gap-3 text-xs">
                                      <button
                                        onClick={() => toggleCommentLike(post.id, c.id)}
                                        className={`font-medium ${c.isLiked ? 'text-primary-700' : 'text-gray-600'} hover:underline`}
                                      >
                                        Like{(c._count?.likes || 0) > 0 ? ` (${c._count?.likes || 0})` : ''}
                                      </button>
                                      <button
                                        onClick={() => setOpenReplyCommentId((prev) => (prev === c.id ? null : c.id))}
                                        className="font-medium text-gray-600 hover:underline"
                                      >
                                        Reply
                                      </button>
                                    </div>

                                    {openReplyCommentId === c.id && (
                                      <div className="mt-2 flex gap-2">
                                        <input
                                          value={replyDraftByCommentId[c.id] || ''}
                                          onChange={(e) => setReplyDraftByCommentId((p) => ({ ...p, [c.id]: e.target.value }))}
                                          placeholder="Write a reply..."
                                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                                        />
                                        <button
                                          onClick={() => submitReply(post.id, c.id)}
                                          disabled={replyPostingByCommentId[c.id] || !(replyDraftByCommentId[c.id] || '').trim()}
                                          className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
                                        >
                                          {replyPostingByCommentId[c.id] ? 'Posting...' : 'Reply'}
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {(repliesByParentId[c.id] || []).map((r) => (
                                  <div key={r.id} className="flex gap-3 pl-11">
                                    <div className="flex-shrink-0">
                                      {r.user?.profileImage ? (
                                        <img src={r.user.profileImage} className="w-7 h-7 rounded-full object-cover" alt="" />
                                      ) : (
                                        <div className="w-7 h-7 rounded-full bg-gray-200" />
                                      )}
                                    </div>
                                    <div className="flex-1">
                                      <div className="text-sm">
                                        <span className="font-semibold text-gray-900">
                                          {r.user ? `${r.user.firstName} ${r.user.lastName}` : 'Unknown'}
                                        </span>
                                        <span className="text-gray-700">{' '}{r.content}</span>
                                      </div>
                                      <div className="text-xs text-gray-500">{formatDate(r.createdAt)}</div>

                                      <div className="mt-1 flex items-center gap-3 text-xs">
                                        <button
                                          onClick={() => toggleCommentLike(post.id, r.id)}
                                          className={`font-medium ${r.isLiked ? 'text-primary-700' : 'text-gray-600'} hover:underline`}
                                        >
                                          Like{(r._count?.likes || 0) > 0 ? ` (${r._count?.likes || 0})` : ''}
                                        </button>
                                        <button
                                          onClick={() => setOpenReplyCommentId((prev) => (prev === r.id ? null : r.id))}
                                          className="font-medium text-gray-600 hover:underline"
                                        >
                                          Reply
                                        </button>
                                      </div>

                                      {openReplyCommentId === r.id && (
                                        <div className="mt-2 flex gap-2">
                                          <input
                                            value={replyDraftByCommentId[r.id] || ''}
                                            onChange={(e) => setReplyDraftByCommentId((p) => ({ ...p, [r.id]: e.target.value }))}
                                            placeholder="Write a reply..."
                                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                                          />
                                          <button
                                            onClick={() => submitReply(post.id, r.id)}
                                            disabled={replyPostingByCommentId[r.id] || !(replyDraftByCommentId[r.id] || '').trim()}
                                            className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
                                          >
                                            {replyPostingByCommentId[r.id] ? 'Posting...' : 'Reply'}
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ))
                          })()
                        )}
                      </div>
                    )}

                    <div className="flex gap-2">
                      <input
                        value={commentDraftByPostId[post.id] || ''}
                        onChange={(e) => setCommentDraftByPostId((p) => ({ ...p, [post.id]: e.target.value }))}
                        placeholder="Write a comment..."
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                      <button
                        onClick={() => submitComment(post.id)}
                        disabled={commentPostingByPostId[post.id] || !(commentDraftByPostId[post.id] || '').trim()}
                        className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
                      >
                        {commentPostingByPostId[post.id] ? 'Posting...' : 'Post'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {shareOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => {
              if (shareSubmitting) return
              setShareOpen(false)
              setSharePostId(null)
            }}
          />
          <div className="relative bg-white w-full max-w-lg mx-4 rounded-xl shadow-xl p-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <div className="text-lg font-semibold text-gray-900">Share to Groups</div>
                <div className="text-sm text-gray-600">Select one or more units to share this post.</div>
              </div>
              <button
                onClick={() => {
                  if (shareSubmitting) return
                  setShareOpen(false)
                  setSharePostId(null)
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            {shareError && (
              <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
                {shareError}
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Message (optional)</label>
              <input
                value={shareNote}
                onChange={(e) => setShareNote(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                placeholder="Add a note for the group..."
              />
            </div>

            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium text-gray-700">Your Units</div>
                <button
                  onClick={loadMyUnits}
                  disabled={shareLoadingUnits}
                  className="text-xs text-primary-700 hover:underline disabled:opacity-60"
                >
                  Refresh
                </button>
              </div>

              {shareLoadingUnits ? (
                <div className="text-sm text-gray-600">Loading units...</div>
              ) : shareUnits.length === 0 ? (
                <div className="text-sm text-gray-600">You are not a member of any units yet.</div>
              ) : (
                <div className="max-h-60 overflow-auto border border-gray-200 rounded-lg">
                  {shareUnits.map((u) => {
                    const checked = shareSelectedUnitIds.includes(u.id)
                    return (
                      <label key={u.id} className="flex items-center gap-3 px-3 py-2 border-b border-gray-100 last:border-b-0 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            setShareSelectedUnitIds((prev) =>
                              e.target.checked ? Array.from(new Set([...prev, u.id])) : prev.filter((id) => id !== u.id)
                            )
                          }}
                        />
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">{u.name}</div>
                          {u.myRole && <div className="text-xs text-gray-500">Role: {u.myRole}</div>}
                        </div>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  if (shareSubmitting) return
                  setShareOpen(false)
                  setSharePostId(null)
                }}
                className="px-4 py-2 bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={submitShare}
                disabled={shareSubmitting || shareSelectedUnitIds.length === 0}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm disabled:opacity-60"
              >
                {shareSubmitting ? 'Sharing...' : 'Share'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


