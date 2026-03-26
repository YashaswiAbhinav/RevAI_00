'use client'

import Image from 'next/image'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  RefreshCcw,
  Search,
  Send,
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

const STATUS_TABS = [
  { label: 'All', value: '' },
  { label: 'Pending', value: 'pending' },
  { label: 'Queued', value: 'ready_to_post' },
  { label: 'Posted', value: 'replied' },
]

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
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(null)
  const [reviewFeedback, setReviewFeedback] = useState('')
  const hasLoadedRef = useRef(false)
  const hasAutoProcessedRef = useRef(false)
  const [filters, setFilters] = useState<FilterOptions>({
    platform: '',
    sentiment: '',
    status: '',
    search: '',
  })

  const fetchComments = useCallback(async (signal?: AbortSignal) => {
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
  }, [filters])

  const autoProcessComments = useCallback(async (signal?: AbortSignal) => {
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
  }, [fetchComments])

  const loadAutomationSettings = useCallback(async (signal?: AbortSignal) => {
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
  }, [autoProcessComments])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
    }
  }, [status, router])

  useEffect(() => {
    if (session?.user) {
      const controller = new AbortController()
      const loadPageData = async () => {
        await Promise.all([
          fetchComments(controller.signal),
          loadAutomationSettings(controller.signal),
        ])
      }

      loadPageData()
      return () => controller.abort()
    }
  }, [session, fetchComments, loadAutomationSettings])

  useEffect(() => {
    if (comments.length === 0) {
      setSelectedCommentId(null)
      return
    }

    if (!selectedCommentId || !comments.some((comment) => comment.id === selectedCommentId)) {
      setSelectedCommentId(comments[0].id)
    }
  }, [comments, selectedCommentId])

  useEffect(() => {
    setReviewFeedback('')
  }, [selectedCommentId])

  const generateAIReply = async (
    commentId: string,
    options: { feedback?: string; queueAfterGeneration?: boolean } = {}
  ) => {
    setGenerating(commentId)
    try {
      const response = await fetch('/api/comments/generate-reply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          commentId,
          feedback: options.feedback || '',
          queueAfterGeneration: options.queueAfterGeneration || false,
        }),
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
        setReviewFeedback('')
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

  const selectedComment = useMemo(
    () => comments.find((comment) => comment.id === selectedCommentId) || null,
    [comments, selectedCommentId]
  )

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

  const formatStatusLabel = (statusValue: string) => statusValue.replace(/_/g, ' ')

  if (status === 'loading') {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="rev-panel flex items-center gap-4 px-8 py-6">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-[color:var(--rev-primary)]" />
          <div>
            <p className="text-sm font-semibold text-slate-900">Loading comments</p>
            <p className="text-sm text-slate-500">Opening queue...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <section className="rev-panel-strong overflow-hidden px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <p className="rev-kicker">Comments</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">Inbox</h1>
            </div>
            {autoReplyEnabled && (
              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
                <Sparkles className="h-4 w-4" />
                Auto
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'All', value: summary.total },
              { label: 'Queued', value: summary.queued },
              { label: 'Posted', value: summary.posted },
              { label: 'Failed', value: summary.failed },
            ].map((item) => (
              <div key={item.label} className="rounded-[1.35rem] bg-white/70 px-4 py-3 shadow-sm rev-hover-lift">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">{item.label}</p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          {refreshing && (
            <span className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-2 font-medium text-sky-700">
              <RefreshCcw className="h-4 w-4 animate-spin" />
              Refreshing
            </span>
          )}
          {autoProcessing && (
            <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-2 font-medium text-amber-700">
              <Sparkles className="h-4 w-4" />
              Processing
            </span>
          )}
        </div>
      </section>

      <section className="rev-panel p-4 sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap gap-2">
            {STATUS_TABS.map((tab) => {
              const active = filters.status === tab.value
              return (
                <button
                  key={tab.label}
                  type="button"
                  onClick={() => setFilters((previous) => ({ ...previous, status: tab.value }))}
                  className={`rounded-full px-4 py-2 text-sm font-medium ${
                    active
                      ? 'bg-slate-950 text-white shadow-sm'
                      : 'bg-white text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {tab.label}
                </button>
              )
            })}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="relative min-w-[240px]">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={filters.search}
                onChange={(event) => setFilters((previous) => ({ ...previous, search: event.target.value }))}
                placeholder="Search"
                className="rev-input pl-11"
              />
            </label>

            <div className="flex gap-3">
              <select
                value={filters.platform}
                onChange={(event) => setFilters((previous) => ({ ...previous, platform: event.target.value }))}
                className="rev-input min-w-[135px]"
              >
                <option value="">Platform</option>
                <option value="youtube">YouTube</option>
                <option value="reddit">Reddit</option>
                <option value="instagram">Instagram</option>
              </select>

              <select
                value={filters.sentiment}
                onChange={(event) => setFilters((previous) => ({ ...previous, sentiment: event.target.value }))}
                className="rev-input min-w-[135px]"
              >
                <option value="">Sentiment</option>
                <option value="positive">Positive</option>
                <option value="neutral">Neutral</option>
                <option value="negative">Negative</option>
              </select>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
        <div className="rev-panel-strong min-h-[560px] overflow-hidden p-0">
          {loading ? (
            <div className="flex h-full items-center justify-center gap-4 px-6 py-14">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-[color:var(--rev-primary)]" />
              <span className="text-sm text-slate-600">Loading queue...</span>
            </div>
          ) : comments.length === 0 ? (
            <div className="flex h-full items-center justify-center px-6 text-center text-sm text-slate-500">
              No comments match the current filters.
            </div>
          ) : (
            <div className="divide-y divide-slate-200/70">
              {comments.map((comment, index) => {
                const selected = comment.id === selectedCommentId
                return (
                  <button
                    key={comment.id}
                    type="button"
                    onClick={() => setSelectedCommentId(comment.id)}
                    className={`group flex w-full items-start gap-3 px-4 py-4 text-left transition ${
                      selected
                        ? 'bg-[linear-gradient(135deg,rgba(255,123,84,0.12),rgba(255,255,255,0.95))] rev-active-ring'
                        : 'bg-white/50 hover:bg-white/85'
                    } rev-fade-up`}
                    style={{ animationDelay: `${Math.min(index * 32, 180)}ms` }}
                  >
                    {comment.authorAvatar ? (
                      <Image
                        unoptimized
                        loader={({ src }) => src}
                        src={comment.authorAvatar}
                        alt={comment.author}
                        width={40}
                        height={40}
                        className="mt-0.5 h-10 w-10 rounded-2xl object-cover shadow-sm"
                      />
                    ) : (
                      <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-white">
                        <span className="text-xs font-semibold">{comment.author.slice(0, 1).toUpperCase()}</span>
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate text-sm font-semibold text-slate-950">{comment.author}</p>
                        <span className="text-xs text-slate-400">
                          {new Date(comment.publishedAt).toLocaleDateString()}
                        </span>
                      </div>

                      <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">{comment.text}</p>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="rounded-full bg-slate-950 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white">
                          {comment.platform}
                        </span>
                        <span className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${getStatusStyle(comment.status)}`}>
                          {formatStatusLabel(comment.status)}
                        </span>
                        {comment.sentiment && (
                          <span className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${getSentimentStyle(comment.sentiment)}`}>
                            {comment.sentiment}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="rev-panel-strong min-h-[560px] p-5 sm:p-6">
          {selectedComment ? (
            <div className="rev-scale-in flex h-full flex-col">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-2xl font-semibold text-slate-950">{selectedComment.author}</h2>
                    <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${getStatusStyle(selectedComment.status)}`}>
                      {formatStatusLabel(selectedComment.status)}
                    </span>
                    {selectedComment.sentiment && (
                      <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${getSentimentStyle(selectedComment.sentiment)}`}>
                        {selectedComment.sentiment}
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-slate-500">
                    {selectedComment.platform} • {selectedComment.contentTitle}
                  </p>
                </div>

                <div className="text-right text-sm text-slate-400">
                  {new Date(selectedComment.publishedAt).toLocaleString()}
                </div>
              </div>

              <div className="mt-6 flex-1 space-y-4">
                <div className="rounded-[1.6rem] bg-white px-5 py-5 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Comment</p>
                  <p className="mt-3 text-[15px] leading-8 text-slate-700">{selectedComment.text}</p>
                </div>

                {selectedComment.aiReply ? (
                  <div className="rounded-[1.6rem] border border-orange-200 bg-[linear-gradient(180deg,rgba(255,245,238,0.95),rgba(255,250,246,0.98))] px-5 py-5 shadow-sm">
                    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--rev-primary-strong)]">
                      <Sparkles className="h-3.5 w-3.5" />
                      AI reply
                    </div>
                    <p className="mt-3 text-[15px] leading-8 text-slate-700">{selectedComment.aiReply}</p>
                  </div>
                ) : (
                  <div className="flex h-[180px] items-center justify-center rounded-[1.6rem] border border-dashed border-slate-200 bg-white/60 text-sm text-slate-400">
                    No reply generated yet
                  </div>
                )}

                {(selectedComment.aiReply || selectedComment.status === 'failed') && selectedComment.status !== 'replied' && (
                  <div className="rounded-[1.6rem] border border-slate-200/80 bg-white px-5 py-5 shadow-sm">
                    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      <RefreshCcw className="h-3.5 w-3.5" />
                      Review
                    </div>
                    <textarea
                      value={reviewFeedback}
                      onChange={(event) => setReviewFeedback(event.target.value)}
                      rows={3}
                      className="rev-input mt-4"
                      placeholder="Optional note for AI: e.g. make it shorter, warmer, less promotional, or more specific."
                    />
                  </div>
                )}
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                {!selectedComment.aiReply && (selectedComment.status === 'pending' || selectedComment.status === 'classified') && (
                  <button
                    onClick={() => generateAIReply(selectedComment.id)}
                    disabled={generating === selectedComment.id}
                    className="rev-button-secondary px-4 py-2 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Wand2 className={`h-4 w-4 ${generating === selectedComment.id ? 'animate-spin' : ''}`} />
                    {generating === selectedComment.id ? 'Generating' : 'Generate'}
                  </button>
                )}

                {selectedComment.aiReply && selectedComment.status === 'classified' && (
                  <>
                    <button
                      onClick={() => approveReply(selectedComment.id)}
                      disabled={approving === selectedComment.id}
                      className="rev-button-primary px-4 py-2 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Send className="h-4 w-4" />
                      {approving === selectedComment.id ? 'Queueing' : 'Queue'}
                    </button>
                    <button
                      onClick={() => rejectReply(selectedComment.id)}
                      className="rev-button-secondary px-4 py-2"
                    >
                      <XCircle className="h-4 w-4" />
                      Cancel
                    </button>
                    <button
                      onClick={() => generateAIReply(selectedComment.id, { feedback: reviewFeedback })}
                      disabled={generating === selectedComment.id}
                      className="rev-button-secondary px-4 py-2 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <RefreshCcw className={`h-4 w-4 ${generating === selectedComment.id ? 'animate-spin' : ''}`} />
                      {generating === selectedComment.id ? 'Retrying' : 'Retry'}
                    </button>
                  </>
                )}

                {selectedComment.status === 'ready_to_post' && (
                  <>
                    <span className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-4 py-2 text-sm font-medium text-sky-700">
                      <Clock3 className="h-4 w-4" />
                      Queued for posting
                    </span>
                    <button
                      onClick={() => rejectReply(selectedComment.id)}
                      className="rev-button-secondary px-4 py-2"
                    >
                      <XCircle className="h-4 w-4" />
                      Cancel
                    </button>
                    <button
                      onClick={() => generateAIReply(selectedComment.id, {
                        feedback: reviewFeedback,
                        queueAfterGeneration: true,
                      })}
                      disabled={generating === selectedComment.id}
                      className="rev-button-secondary px-4 py-2 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <RefreshCcw className={`h-4 w-4 ${generating === selectedComment.id ? 'animate-spin' : ''}`} />
                      {generating === selectedComment.id ? 'Retrying' : 'Retry'}
                    </button>
                  </>
                )}

                {selectedComment.status === 'replied' && (
                  <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" />
                    Posted
                  </span>
                )}

                {selectedComment.status === 'failed' && (
                  <>
                    <button
                      onClick={() => generateAIReply(selectedComment.id, {
                        feedback: reviewFeedback,
                        queueAfterGeneration: autoReplyEnabled,
                      })}
                      disabled={generating === selectedComment.id}
                      className="rev-button-secondary px-4 py-2 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <RefreshCcw className={`h-4 w-4 ${generating === selectedComment.id ? 'animate-spin' : ''}`} />
                      {generating === selectedComment.id ? 'Retrying' : 'Retry'}
                    </button>
                    <button
                      onClick={() => rejectReply(selectedComment.id)}
                      className="rev-button-secondary px-4 py-2"
                    >
                      <XCircle className="h-4 w-4" />
                      Cancel
                    </button>
                  </>
                )}

                {selectedComment.status === 'rejected' && (
                  <>
                    <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600">
                      <AlertCircle className="h-4 w-4" />
                      Cancelled
                    </span>
                    <button
                      onClick={() => generateAIReply(selectedComment.id, { feedback: reviewFeedback })}
                      disabled={generating === selectedComment.id}
                      className="rev-button-secondary px-4 py-2 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <RefreshCcw className={`h-4 w-4 ${generating === selectedComment.id ? 'animate-spin' : ''}`} />
                      {generating === selectedComment.id ? 'Retrying' : 'Retry'}
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-500">
              Select a comment to view details.
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
