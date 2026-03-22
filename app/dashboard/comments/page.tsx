'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

interface Comment {
  id: string
  text: string
  author: string
  authorAvatar?: string
  publishedAt: string
  platform: string
  contentId: string
  contentTitle: string
  sentiment?: 'positive' | 'neutral' | 'negative'
  aiReply?: string
  status: 'pending' | 'classified' | 'ready_to_post' | 'replied' | 'failed' | 'rejected'
}

interface FilterOptions {
  platform: string
  sentiment: string
  status: string
  search: string
}

const decodeHtmlEntities = (apiText?: string) => {
  if (!apiText) return ''

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    const textarea = document.createElement('textarea')
    textarea.innerHTML = apiText
    const decoded = textarea.value
    return decoded
  }

  return apiText
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

export default function CommentsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [comments, setComments] = useState<Comment[]>([])
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [autoProcessing, setAutoProcessing] = useState(false)
  const [generating, setGenerating] = useState<string | null>(null)
  const [approving, setApproving] = useState<string | null>(null)
  const hasLoadedRef = useRef(false)
  const hasAutoProcessedRef = useRef(false)
  const [filters, setFilters] = useState<FilterOptions>({
    platform: '',
    sentiment: '',
    status: '',
    search: '',
  })

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
    }
  }, [status, router])

  useEffect(() => {
    if (session?.user) {
      const controller = new AbortController()
      loadCommentsPageData(controller.signal)
      return () => controller.abort()
    }
  }, [session, filters])

  const loadCommentsPageData = async (signal?: AbortSignal) => {
    await Promise.all([
      fetchComments(signal),
      loadAutomationSettings(signal),
    ])
  }

  const loadAutomationSettings = async (signal?: AbortSignal) => {
    try {
      const response = await fetch('/api/settings', {
        cache: 'no-store',
        signal,
      })

      if (!response.ok) {
        return
      }

      const data = await response.json()
      const enabled = Boolean(data.settings?.autoReplyEnabled)
      setAutoReplyEnabled(enabled)

      if (enabled && !hasAutoProcessedRef.current) {
        hasAutoProcessedRef.current = true
        await autoProcessComments(signal)
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        return
      }
      console.error('Failed to load automation settings:', error)
    }
  }

  const fetchComments = async (signal?: AbortSignal) => {
    if (hasLoadedRef.current) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }

    try {
      const queryParams = new URLSearchParams()
      if (filters.platform) queryParams.set('platform', filters.platform)
      if (filters.sentiment) queryParams.set('sentiment', filters.sentiment)
      if (filters.status) queryParams.set('status', filters.status)
      if (filters.search) queryParams.set('search', filters.search)

      const response = await fetch(`/api/comments?${queryParams}`, {
        cache: 'no-store',
        signal,
      })
      if (response.ok) {
        const data = await response.json()
        setComments(data.comments)
        hasLoadedRef.current = true
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        return
      }
      console.error('Failed to fetch comments:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const autoProcessComments = async (signal?: AbortSignal) => {
    setAutoProcessing(true)
    try {
      const response = await fetch('/api/comments/auto-process', {
        method: 'POST',
        cache: 'no-store',
        signal,
      })

      if (response.ok) {
        await fetchComments(signal)
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        return
      }
      console.error('Failed to auto-process comments:', error)
    } finally {
      setAutoProcessing(false)
    }
  }

  const generateAIReply = async (commentId: string) => {
    setGenerating(commentId)
    try {
      const response = await fetch('/api/comments/generate-reply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ commentId }),
      })

      if (response.ok) {
        const data = await response.json()
        setComments(prev => prev.map(comment =>
          comment.id === commentId
            ? {
                ...comment,
                aiReply: data.reply,
                sentiment: data.classification?.sentiment || comment.sentiment,
                status: data.status || 'classified',
              }
            : comment
        ))
      }
    } catch (error) {
      console.error('Failed to generate AI reply:', error)
    } finally {
      setGenerating(null)
    }
  }

  const approveReply = async (commentId: string) => {
    setApproving(commentId)
    try {
      const response = await fetch('/api/comments/approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ commentId }),
      })

      if (response.ok) {
        // Update the comment status
        setComments(prev => prev.map(comment =>
          comment.id === commentId
            ? { ...comment, status: 'ready_to_post' as const }
            : comment
        ))
      }
    } catch (error) {
      console.error('Failed to approve reply:', error)
    } finally {
      setApproving(null)
    }
  }

  const rejectReply = async (commentId: string) => {
    try {
      const response = await fetch('/api/comments/reject', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ commentId }),
      })

      if (response.ok) {
        // Update the comment status
        setComments(prev => prev.map(comment =>
          comment.id === commentId
            ? { ...comment, status: 'rejected' as const }
            : comment
        ))
      }
    } catch (error) {
      console.error('Failed to reject reply:', error)
    }
  }

  const getSentimentColor = (sentiment?: string) => {
    switch (sentiment) {
      case 'positive': return 'bg-green-100 text-green-800'
      case 'neutral': return 'bg-muted text-muted-foreground'
      case 'negative': return 'bg-red-100 text-red-800'
      default: return 'bg-muted text-muted-foreground'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'classified': return 'bg-indigo-100 text-indigo-800'
      case 'ready_to_post': return 'bg-blue-100 text-blue-800'
      case 'replied': return 'bg-green-100 text-green-800'
      case 'rejected': return 'bg-red-100 text-red-800'
      case 'failed': return 'bg-red-100 text-red-800'
      default: return 'bg-muted text-muted-foreground'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'ready_to_post': return 'ready to post'
      case 'replied': return 'posted'
      default: return status
    }
  }

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Comments Management</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review comments from your monitored content and track AI-generated replies.
        </p>
        {autoReplyEnabled && (
          <p className="mt-2 text-sm text-green-700">
            Automatic replies are enabled. Eligible comments are generated and queued for posting automatically.
          </p>
        )}
        {refreshing && (
          <p className="mt-2 text-sm text-blue-600">Refreshing comments...</p>
        )}
        {autoProcessing && (
          <p className="mt-2 text-sm text-blue-600">Auto-processing new comments...</p>
        )}
      </div>

      {/* Filters */}
      <div className="bg-card shadow rounded-lg gradient-card p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label htmlFor="platform" className="block text-sm font-medium text-foreground mb-1">
              Platform
            </label>
            <select
              id="platform"
              value={filters.platform}
              onChange={(e) => setFilters(prev => ({ ...prev, platform: e.target.value }))}
              className="w-full rounded-md border border-border bg-card text-foreground shadow-sm focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Platforms</option>
              <option value="youtube">YouTube</option>
              <option value="instagram">Instagram</option>
            </select>
          </div>

          <div>
            <label htmlFor="sentiment" className="block text-sm font-medium text-foreground mb-1">
              Sentiment
            </label>
            <select
              id="sentiment"
              value={filters.sentiment}
              onChange={(e) => setFilters(prev => ({ ...prev, sentiment: e.target.value }))}
              className="w-full rounded-md border border-border bg-card text-foreground shadow-sm focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Sentiments</option>
              <option value="positive">Positive</option>
              <option value="neutral">Neutral</option>
              <option value="negative">Negative</option>
            </select>
          </div>

          <div>
            <label htmlFor="status" className="block text-sm font-medium text-foreground mb-1">
              Status
            </label>
            <select
              id="status"
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
              className="w-full rounded-md border border-border bg-card text-foreground shadow-sm focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="classified">Classified</option>
              <option value="ready_to_post">Ready To Post</option>
              <option value="replied">Posted</option>
              <option value="failed">Failed</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          <div>
            <label htmlFor="search" className="block text-sm font-medium text-foreground mb-1">
              Search
            </label>
            <input
              type="text"
              id="search"
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              placeholder="Search comments..."
              className="w-full rounded-md border border-border bg-card text-foreground shadow-sm focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Comments List */}
      <div className="bg-card shadow rounded-lg gradient-card">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-sm text-muted-foreground">Loading comments...</span>
          </div>
        ) : comments.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No comments found matching your filters.</p>
            <p className="text-sm text-muted-foreground mt-1">
              Make sure you have connected accounts and selected content to monitor.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {comments.map((comment) => (
              <div key={comment.id} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      {comment.authorAvatar && (
                        <img
                          src={comment.authorAvatar}
                          alt={comment.author}
                          className="w-8 h-8 rounded-full"
                        />
                      )}
                      <div>
                        <p className="text-sm font-medium text-foreground">{comment.author}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(comment.publishedAt).toLocaleString()} • {comment.platform} • {decodeHtmlEntities(comment.contentTitle)}
                        </p>
                      </div>
                    </div>

                    <p className="text-foreground mb-3">{decodeHtmlEntities(comment.text)}</p>

                    <div className="flex items-center space-x-2 mb-4">
                      {comment.sentiment && (
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getSentimentColor(comment.sentiment)}`}>
                          {comment.sentiment}
                        </span>
                      )}
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(comment.status)}`}>
                        {getStatusLabel(comment.status)}
                      </span>
                    </div>

                    {comment.aiReply && (
                      <div className="bg-muted border border-border rounded-md p-4 mb-4">
                        <div className="flex items-start">
                          <div className="flex-shrink-0">
                            <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <div className="ml-3 flex-1">
                            <h4 className="text-sm font-medium text-foreground">AI Generated Reply</h4>
                            <p className="text-sm text-muted-foreground mt-1">{decodeHtmlEntities(comment.aiReply)}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex space-x-3">
                      {/* Manual generation remains available only when automation is disabled */}
                      {!autoReplyEnabled && !comment.aiReply && (comment.status === 'pending' || comment.status === 'classified') && (
                        <button
                          onClick={() => generateAIReply(comment.id)}
                          disabled={generating === comment.id}
                          className="inline-flex items-center px-3 py-2 border border-border shadow-sm text-sm leading-4 font-medium rounded-md text-foreground bg-card hover:bg-muted focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                        >
                          {generating === comment.id ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                              Generating...
                            </>
                          ) : (
                            <>
                              <svg className="-ml-0.5 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                              </svg>
                              Generate AI Reply
                            </>
                          )}
                        </button>
                      )}

                      {/* Manual approval remains available only when automation is disabled */}
                      {!autoReplyEnabled && comment.aiReply && (comment.status === 'pending' || comment.status === 'classified') && (
                        <>
                          <button
                            onClick={() => approveReply(comment.id)}
                            disabled={approving === comment.id}
                            className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                          >
                            {approving === comment.id ? 'Approving...' : 'Approve For Posting'}
                          </button>
                          <button
                            onClick={() => rejectReply(comment.id)}
                            className="inline-flex items-center px-3 py-2 border border-border shadow-sm text-sm leading-4 font-medium rounded-md text-foreground bg-card hover:bg-muted focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                          >
                            Reject
                          </button>
                        </>
                      )}

                      {/* Queued indicator */}
                      {comment.status === 'ready_to_post' && (
                        <span className="inline-flex items-center px-3 py-2 text-sm text-blue-600">
                          <svg className="-ml-0.5 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Queued for posting
                        </span>
                      )}

                      {/* Posted indicator */}
                      {comment.status === 'replied' && (
                        <span className="inline-flex items-center px-3 py-2 text-sm text-green-600">
                          <svg className="-ml-0.5 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Posted
                        </span>
                      )}

                      {/* Failed: allow regenerate */}
                      {comment.status === 'failed' && (
                        <button
                          onClick={() => generateAIReply(comment.id)}
                          disabled={generating === comment.id}
                          className="inline-flex items-center px-3 py-2 border border-border shadow-sm text-sm leading-4 font-medium rounded-md text-orange-400 bg-card hover:bg-muted focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50"
                        >
                          {generating === comment.id ? 'Retrying...' : 'Retry'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
