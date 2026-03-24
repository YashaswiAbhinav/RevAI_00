'use client'

import { useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  CheckCircle2,
  Clock3,
  Filter,
  MessageSquare,
  RefreshCcw,
  Search,
  Sparkles,
  Wand2,
  XCircle,
} from 'lucide-react'

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
        setComments((previous) => previous.map((comment) =>
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
        setComments((previous) => previous.map((comment) =>
          comment.id === commentId ? { ...comment, status: 'ready_to_post' } : comment
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
        setComments((previous) => previous.map((comment) =>
          comment.id === commentId ? { ...comment, status: 'rejected' } : comment
        ))
      }
    } catch (error) {
      console.error('Failed to reject reply:', error)
    }
  }

  const summary = {
    total: comments.length,
    queued: comments.filter((comment) => comment.status === 'ready_to_post').length,
    posted: comments.filter((comment) => comment.status === 'replied').length,
    failed: comments.filter((comment) => comment.status === 'failed').length,
  }

  const getSentimentStyle = (sentiment?: string) => {
    switch (sentiment) {
      case 'positive':
        return 'bg-emerald-50 text-emerald-700'
      case 'neutral':
        return 'bg-slate-100 text-slate-600'
      case 'negative':
        return 'bg-rose-50 text-rose-700'
      default:
        return 'bg-slate-100 text-slate-600'
    }
  }

  const getStatusStyle = (statusValue: string) => {
    switch (statusValue) {
      case 'pending':
        return 'bg-amber-50 text-amber-700'
      case 'classified':
        return 'bg-indigo-50 text-indigo-700'
      case 'ready_to_post':
        return 'bg-sky-50 text-sky-700'
      case 'replied':
        return 'bg-emerald-50 text-emerald-700'
      case 'failed':
        return 'bg-rose-50 text-rose-700'
      case 'rejected':
        return 'bg-slate-200 text-slate-700'
      default:
        return 'bg-slate-100 text-slate-600'
    }
  }

  if (status === 'loading') {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="rev-panel flex items-center gap-4 px-8 py-6">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-[color:var(--rev-primary)]" />
          <div>
            <p className="text-sm font-semibold text-slate-900">Loading comments</p>
            <p className="text-sm text-slate-500">Preparing the comment command center...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section className="rev-panel-strong px-6 py-8 sm:px-8">
        <div className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
          <div>
            <p className="rev-kicker">Comment Pipeline</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">Track every comment from intake to posted reply.</h1>
            <p className="mt-4 max-w-2xl text-base leading-8 text-slate-600">
              This page is the operational heart of the product. It shows what arrived, what the AI generated, what is queued next, and which items still need attention.
            </p>
            {autoReplyEnabled && (
              <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700">
                <Sparkles className="h-4 w-4" />
                Automatic replies are enabled for eligible comments.
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { label: 'Visible comments', value: summary.total, note: 'After filters are applied.' },
              { label: 'Queued', value: summary.queued, note: 'Ready for the posting step.' },
              { label: 'Posted', value: summary.posted, note: 'Already marked as replied.' },
              { label: 'Failed', value: summary.failed, note: 'Needs a retry or follow-up.' },
            ].map((item) => (
              <div key={item.label} className="rev-stat-card">
                <p className="text-sm text-slate-500">{item.label}</p>
                <p className="mt-3 text-4xl font-semibold text-slate-950">{item.value}</p>
                <p className="mt-3 text-sm text-slate-500">{item.note}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rev-panel p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="rev-kicker">Filter Console</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950">Narrow the live queue</h2>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
            {refreshing && (
              <span className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-2 text-sky-700">
                <RefreshCcw className="h-4 w-4" />
                Refreshing
              </span>
            )}
            {autoProcessing && (
              <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-2 text-amber-700">
                <Sparkles className="h-4 w-4" />
                Auto-processing new comments
              </span>
            )}
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-2 text-sm font-medium text-slate-700">
            <span className="inline-flex items-center gap-2">
              <Filter className="h-4 w-4 text-slate-400" />
              Platform
            </span>
            <select
              value={filters.platform}
              onChange={(event) => setFilters((previous) => ({ ...previous, platform: event.target.value }))}
              className="rev-input"
            >
              <option value="">All platforms</option>
              <option value="youtube">YouTube</option>
              <option value="instagram">Instagram</option>
            </select>
          </label>

          <label className="space-y-2 text-sm font-medium text-slate-700">
            Sentiment
            <select
              value={filters.sentiment}
              onChange={(event) => setFilters((previous) => ({ ...previous, sentiment: event.target.value }))}
              className="rev-input"
            >
              <option value="">All sentiments</option>
              <option value="positive">Positive</option>
              <option value="neutral">Neutral</option>
              <option value="negative">Negative</option>
            </select>
          </label>

          <label className="space-y-2 text-sm font-medium text-slate-700">
            Status
            <select
              value={filters.status}
              onChange={(event) => setFilters((previous) => ({ ...previous, status: event.target.value }))}
              className="rev-input"
            >
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="classified">Classified</option>
              <option value="ready_to_post">Ready to post</option>
              <option value="replied">Posted</option>
              <option value="failed">Failed</option>
              <option value="rejected">Rejected</option>
            </select>
          </label>

          <label className="space-y-2 text-sm font-medium text-slate-700">
            <span className="inline-flex items-center gap-2">
              <Search className="h-4 w-4 text-slate-400" />
              Search
            </span>
            <input
              type="text"
              value={filters.search}
              onChange={(event) => setFilters((previous) => ({ ...previous, search: event.target.value }))}
              placeholder="Search author or comment"
              className="rev-input"
            />
          </label>
        </div>
      </section>

      <section className="space-y-4">
        {loading ? (
          <div className="rev-panel flex items-center justify-center gap-4 px-6 py-14">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-[color:var(--rev-primary)]" />
            <span className="text-sm text-slate-600">Loading comments...</span>
          </div>
        ) : comments.length === 0 ? (
          <div className="rev-empty">
            No comments match your current filters. Connect platforms and monitor content to feed this queue.
          </div>
        ) : (
          comments.map((comment) => (
            <article key={comment.id} className="rev-panel-strong p-5 sm:p-6">
              <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex min-w-0 items-start gap-4">
                    {comment.authorAvatar ? (
                      <img
                        src={comment.authorAvatar}
                        alt={comment.author}
                        className="h-12 w-12 rounded-2xl object-cover shadow-sm"
                      />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white">
                        <MessageSquare className="h-5 w-5" />
                      </div>
                    )}

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-slate-950">{comment.author}</p>
                        <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white">
                          {comment.platform}
                        </span>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${getStatusStyle(comment.status)}`}>
                          {comment.status.replace(/_/g, ' ')}
                        </span>
                        {comment.sentiment && (
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${getSentimentStyle(comment.sentiment)}`}>
                            {comment.sentiment}
                          </span>
                        )}
                      </div>
                      <p className="mt-2 text-sm text-slate-500">
                        {new Date(comment.publishedAt).toLocaleString()} • {comment.contentTitle}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    {!autoReplyEnabled && !comment.aiReply && (comment.status === 'pending' || comment.status === 'classified') && (
                      <button
                        onClick={() => generateAIReply(comment.id)}
                        disabled={generating === comment.id}
                        className="rev-button-secondary disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Wand2 className="h-4 w-4" />
                        {generating === comment.id ? 'Generating...' : 'Generate reply'}
                      </button>
                    )}

                    {!autoReplyEnabled && comment.aiReply && (comment.status === 'pending' || comment.status === 'classified') && (
                      <>
                        <button
                          onClick={() => approveReply(comment.id)}
                          disabled={approving === comment.id}
                          className="rev-button-primary disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {approving === comment.id ? 'Approving...' : 'Queue for posting'}
                        </button>
                        <button
                          onClick={() => rejectReply(comment.id)}
                          className="rev-button-secondary"
                        >
                          <XCircle className="h-4 w-4" />
                          Reject
                        </button>
                      </>
                    )}

                    {comment.status === 'ready_to_post' && (
                      <span className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-4 py-2 text-sm font-medium text-sky-700">
                        <Clock3 className="h-4 w-4" />
                        Queued for posting
                      </span>
                    )}

                    {comment.status === 'replied' && (
                      <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700">
                        <CheckCircle2 className="h-4 w-4" />
                        Posted
                      </span>
                    )}

                    {comment.status === 'failed' && (
                      <button
                        onClick={() => generateAIReply(comment.id)}
                        disabled={generating === comment.id}
                        className="rev-button-secondary disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <RefreshCcw className="h-4 w-4" />
                        {generating === comment.id ? 'Retrying...' : 'Retry'}
                      </button>
                    )}
                  </div>
                </div>

                <div className="rounded-[1.5rem] border border-slate-200/70 bg-white/80 px-4 py-4">
                  <p className="text-sm leading-7 text-slate-700">{comment.text}</p>
                </div>

                {comment.aiReply && (
                  <div className="rounded-[1.5rem] border border-orange-200 bg-orange-50/80 px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--rev-primary-strong)]">
                      AI generated reply
                    </p>
                    <p className="mt-2 text-sm leading-7 text-slate-700">{comment.aiReply}</p>
                  </div>
                )}
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  )
}
