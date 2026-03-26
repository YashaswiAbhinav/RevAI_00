'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock3,
  MessageSquare,
  Send,
  Sparkles,
  TimerReset,
  XCircle,
} from 'lucide-react'

interface ReportData {
  totalComments: number
  sentimentBreakdown: {
    positive: number
    neutral: number
    negative: number
  }
  repliedCount: number
  queuedCount: number
  pendingCount: number
  failedCount: number
  rejectedCount: number
  responseRate: number
  averageDailyComments: number
  topQuestions: string[]
  topConcerns: string[]
  recommendations: string[]
  summary: string
  platformStats: {
    youtube: number
    reddit: number
    instagram: number
  }
  recentActivity: Array<{
    date: string
    comments: number
    replies: number
  }>
  recentComments: Array<{
    text: string
    author: string
    platform: string
    status: string
    publishedAt: string
  }>
}

const TIME_RANGES = [
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
  { value: '90d', label: '90 Days' },
]

function formatPlatform(platform: string) {
  if (platform === 'youtube') {
    return 'YouTube'
  }

  if (platform === 'instagram') {
    return 'Instagram'
  }

  if (platform === 'reddit') {
    return 'Reddit'
  }

  return 'Unknown'
}

function formatStatus(status: string) {
  return status.replace(/_/g, ' ')
}

function getStatusTone(status: string) {
  switch (status) {
    case 'replied':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
    case 'ready_to_post':
      return 'bg-amber-50 text-amber-700 border-amber-200/80'
    case 'failed':
      return 'bg-rose-50 text-rose-700 border-rose-200/80'
    case 'rejected':
      return 'bg-slate-100 text-slate-600 border-slate-200/80'
    default:
      return 'bg-sky-50 text-sky-700 border-sky-200/80'
  }
}

export default function ReportsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState('7d')
  const [selectedCommentIndex, setSelectedCommentIndex] = useState(0)
  const [selectedDayIndex, setSelectedDayIndex] = useState(0)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
    }
  }, [status, router])

  useEffect(() => {
    if (session?.user) {
      const loadReports = async () => {
        setLoading(true)

        try {
          const response = await fetch(`/api/reports?timeRange=${timeRange}`, {
            cache: 'no-store',
          })

          if (!response.ok) {
            setReportData(null)
            return
          }

          const data = await response.json()
          setReportData(data)
        } catch (fetchError) {
          console.error('Failed to fetch reports:', fetchError)
          setReportData(null)
        } finally {
          setLoading(false)
        }
      }

      loadReports()
    }
  }, [session, timeRange])

  useEffect(() => {
    setSelectedCommentIndex(0)
    setSelectedDayIndex(0)
  }, [reportData])

  const selectedComment = reportData?.recentComments?.[selectedCommentIndex] ?? null
  const selectedDay = reportData?.recentActivity?.[selectedDayIndex] ?? null

  const activityMax = useMemo(() => {
    if (!reportData?.recentActivity?.length) {
      return 1
    }

    return Math.max(...reportData.recentActivity.map((item) => Math.max(item.comments, item.replies)), 1)
  }, [reportData])

  const statusMetrics = useMemo(() => {
    if (!reportData) {
      return []
    }

    return [
      {
        label: 'Replied',
        value: reportData.repliedCount,
        icon: CheckCircle2,
        tone: 'text-emerald-600 bg-emerald-50',
      },
      {
        label: 'Queued',
        value: reportData.queuedCount,
        icon: Send,
        tone: 'text-amber-600 bg-amber-50',
      },
      {
        label: 'Pending',
        value: reportData.pendingCount,
        icon: Clock3,
        tone: 'text-sky-600 bg-sky-50',
      },
      {
        label: 'Failed',
        value: reportData.failedCount,
        icon: XCircle,
        tone: 'text-rose-600 bg-rose-50',
      },
    ]
  }, [reportData])

  const platformCards = useMemo(() => {
    if (!reportData) {
      return []
    }

    const total = Math.max(
      reportData.platformStats.youtube + reportData.platformStats.reddit + reportData.platformStats.instagram,
      1
    )

    return [
      {
        label: 'YouTube',
        value: reportData.platformStats.youtube,
        share: Math.round((reportData.platformStats.youtube / total) * 100),
        tone: 'from-rose-400 to-orange-400',
      },
      {
        label: 'Reddit',
        value: reportData.platformStats.reddit,
        share: Math.round((reportData.platformStats.reddit / total) * 100),
        tone: 'from-orange-400 to-amber-400',
      },
      {
        label: 'Instagram',
        value: reportData.platformStats.instagram,
        share: Math.round((reportData.platformStats.instagram / total) * 100),
        tone: 'from-cyan-400 to-emerald-400',
      },
    ]
  }, [reportData])

  if (status === 'loading') {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="rev-panel flex items-center gap-4 px-8 py-6">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-[color:var(--rev-primary)]" />
          <div>
            <p className="text-sm font-semibold text-slate-900">Loading reports</p>
            <p className="text-sm text-slate-500">Syncing live analytics...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section className="rev-panel-strong relative overflow-hidden px-6 py-7 sm:px-8">
        <div className="rev-orb right-[-40px] top-[-30px] h-32 w-32 bg-[rgba(255,123,84,0.18)]" />
        <div className="rev-orb bottom-[-50px] left-[28%] h-36 w-36 bg-[rgba(19,186,166,0.15)]" style={{ animationDelay: '1.6s' }} />

        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/72 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
              <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(34,197,94,0.14)]" />
              Live Report Feed
            </div>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950">Reports</h1>
            <p className="mt-3 text-sm text-slate-600 sm:text-base">
              Real comment volume, reply flow, and audience signals from Firestore.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {TIME_RANGES.map((range) => (
              <button
                key={range.value}
                onClick={() => setTimeRange(range.value)}
                className={timeRange === range.value ? 'rev-button-primary rev-scale-in' : 'rev-button-secondary'}
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {loading ? (
        <div className="rev-panel flex items-center justify-center gap-4 px-6 py-14">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-[color:var(--rev-primary)]" />
          <span className="text-sm text-slate-600">Refreshing real report data...</span>
        </div>
      ) : reportData ? (
        <>
          <section className="rev-grid">
            {[
              {
                label: 'Total Comments',
                value: reportData.totalComments,
                detail: `${reportData.averageDailyComments} avg / day`,
                icon: MessageSquare,
              },
              {
                label: 'Response Rate',
                value: `${reportData.responseRate}%`,
                detail: `${reportData.repliedCount} posted replies`,
                icon: Send,
              },
              {
                label: 'Queued Now',
                value: reportData.queuedCount,
                detail: `${reportData.pendingCount} still waiting`,
                icon: TimerReset,
              },
              {
                label: 'Negative Sentiment',
                value: `${reportData.sentimentBreakdown.negative}%`,
                detail: `${reportData.rejectedCount} rejected`,
                icon: AlertTriangle,
              },
            ].map((item, index) => {
              const Icon = item.icon

              return (
                <div
                  key={item.label}
                  className="rev-stat-card rev-fade-up rev-hover-lift"
                  style={{ animationDelay: `${index * 70}ms` }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-slate-500">{item.label}</p>
                      <p className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">{item.value}</p>
                    </div>
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white">
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>
                  <p className="mt-4 text-sm text-slate-500">{item.detail}</p>
                </div>
              )
            })}
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
            <div className="space-y-6">
              <div className="rev-panel overflow-hidden p-6">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="max-w-xl">
                    <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <h2 className="mt-4 text-2xl font-semibold text-slate-950">AI summary</h2>
                    <p className="mt-3 text-sm leading-7 text-slate-600">{reportData.summary}</p>
                  </div>

                  <div className="grid w-full gap-3 sm:grid-cols-2 lg:max-w-sm">
                    {statusMetrics.map((item) => {
                      const Icon = item.icon

                      return (
                        <div key={item.label} className="rounded-[1.5rem] border border-slate-200/70 bg-white/74 p-4 rev-hover-lift">
                          <div className="flex items-center justify-between gap-3">
                            <span className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl ${item.tone}`}>
                              <Icon className="h-5 w-5" />
                            </span>
                            <span className="text-2xl font-semibold text-slate-950">{item.value}</span>
                          </div>
                          <p className="mt-3 text-sm text-slate-500">{item.label}</p>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap gap-2">
                  {reportData.recommendations.length > 0 ? reportData.recommendations.map((item, index) => (
                    <div
                      key={`${item}-${index}`}
                      className="rounded-full border border-orange-200/80 bg-orange-50/80 px-4 py-2 text-sm text-slate-700 rev-scale-in"
                      style={{ animationDelay: `${index * 70}ms` }}
                    >
                      {item}
                    </div>
                  )) : (
                    <div className="rounded-full border border-slate-200/80 bg-white/75 px-4 py-2 text-sm text-slate-500">
                      More recommendations will appear as engagement volume grows.
                    </div>
                  )}
                </div>
              </div>

              <div className="rev-panel p-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[color:var(--rev-secondary)] text-white">
                    <BarChart3 className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="rev-kicker">Sentiment</p>
                    <h2 className="mt-1 text-xl font-semibold text-slate-950">Audience mood</h2>
                  </div>
                </div>

                <div className="mt-6 space-y-4">
                  {[
                    { label: 'Positive', value: reportData.sentimentBreakdown.positive, tone: 'from-emerald-400 to-emerald-600' },
                    { label: 'Neutral', value: reportData.sentimentBreakdown.neutral, tone: 'from-slate-400 to-slate-600' },
                    { label: 'Negative', value: reportData.sentimentBreakdown.negative, tone: 'from-rose-400 to-red-500' },
                  ].map((item) => (
                    <div key={item.label}>
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="font-medium text-slate-700">{item.label}</span>
                        <span className="font-semibold text-slate-950">{item.value}%</span>
                      </div>
                      <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full rounded-full bg-gradient-to-r ${item.tone}`}
                          style={{ width: `${Math.max(item.value, item.value > 0 ? 8 : 0)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 grid gap-3">
                  {platformCards.map((item) => (
                    <div key={item.label} className="rounded-[1.5rem] border border-slate-200/70 bg-white/72 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-slate-700">{item.label}</p>
                          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">{item.share}% share</p>
                        </div>
                        <span className="text-2xl font-semibold text-slate-950">{item.value}</span>
                      </div>
                      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className={`h-full rounded-full bg-gradient-to-r ${item.tone}`}
                          style={{ width: `${Math.max(item.share, item.value > 0 ? 8 : 0)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="rev-panel overflow-hidden p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="rev-kicker">Recent Comments</p>
                    <h2 className="mt-1 text-2xl font-semibold text-slate-950">Live queue</h2>
                  </div>
                  <div className="rounded-full bg-slate-950 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white">
                    {reportData.recentComments.length} latest
                  </div>
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-[0.96fr_1.04fr]">
                  <div className="space-y-3">
                    {reportData.recentComments.length > 0 ? reportData.recentComments.map((comment, index) => {
                      const isActive = index === selectedCommentIndex

                      return (
                        <button
                          key={`${comment.publishedAt}-${index}`}
                          onClick={() => setSelectedCommentIndex(index)}
                          className={`w-full rounded-[1.5rem] border p-4 text-left rev-hover-lift ${
                            isActive
                              ? 'rev-active-ring border-orange-200/80 bg-white'
                              : 'border-slate-200/70 bg-white/74'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-slate-950">{comment.author}</p>
                            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${getStatusTone(comment.status)}`}>
                              {formatStatus(comment.status)}
                            </span>
                          </div>
                          <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">{comment.text}</p>
                          <div className="mt-3 flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-slate-400">
                            <span>{formatPlatform(comment.platform)}</span>
                            <span className="h-1 w-1 rounded-full bg-slate-300" />
                            <span>{new Date(comment.publishedAt).toLocaleDateString()}</span>
                          </div>
                        </button>
                      )
                    }) : (
                      <div className="rev-empty">No recent comments found.</div>
                    )}
                  </div>

                  <div className="rounded-[1.75rem] border border-slate-200/70 bg-slate-950 p-5 text-white">
                    {selectedComment ? (
                      <>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/80">
                            {formatPlatform(selectedComment.platform)}
                          </span>
                          <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/80">
                            {new Date(selectedComment.publishedAt).toLocaleString()}
                          </span>
                        </div>
                        <p className="mt-5 text-sm uppercase tracking-[0.18em] text-white/50">Comment</p>
                        <p className="mt-3 text-lg leading-8 text-white/92">{selectedComment.text}</p>
                        <div className="mt-6 rounded-[1.5rem] bg-white/8 p-4">
                          <p className="text-xs uppercase tracking-[0.18em] text-white/50">Current state</p>
                          <div className="mt-3 flex items-center justify-between gap-3">
                            <p className="text-base font-semibold text-white">{selectedComment.author}</p>
                            <span className="rounded-full border border-white/12 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-white">
                              {formatStatus(selectedComment.status)}
                            </span>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-white/60">
                        Select a comment to inspect.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <div className="rev-panel p-6">
                  <p className="rev-kicker">Questions</p>
                  <h2 className="mt-2 text-xl font-semibold text-slate-950">Top asks</h2>
                  <div className="mt-5 space-y-3">
                    {reportData.topQuestions.length > 0 ? reportData.topQuestions.map((question, index) => (
                      <div key={`${question}-${index}`} className="rounded-[1.35rem] border border-slate-200/70 bg-white/76 p-4 text-sm leading-6 text-slate-700 rev-hover-lift">
                        {question}
                      </div>
                    )) : (
                      <div className="rev-empty">No recurring questions yet.</div>
                    )}
                  </div>
                </div>

                <div className="rev-panel p-6">
                  <p className="rev-kicker">Concerns</p>
                  <h2 className="mt-2 text-xl font-semibold text-slate-950">Top friction</h2>
                  <div className="mt-5 space-y-3">
                    {reportData.topConcerns.length > 0 ? reportData.topConcerns.map((concern, index) => (
                      <div key={`${concern}-${index}`} className="rounded-[1.35rem] border border-slate-200/70 bg-white/76 p-4 text-sm leading-6 text-slate-700 rev-hover-lift">
                        {concern}
                      </div>
                    )) : (
                      <div className="rev-empty">No concern clusters yet.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="rev-panel p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="rev-kicker">Activity</p>
                <h2 className="mt-1 text-2xl font-semibold text-slate-950">Daily flow</h2>
              </div>
              {selectedDay ? (
                <div className="rounded-full border border-slate-200/80 bg-white/80 px-4 py-2 text-sm text-slate-600">
                  {new Date(`${selectedDay.date}T00:00:00`).toLocaleDateString()} selected
                </div>
              ) : null}
            </div>

            <div className="mt-6">
              {reportData.recentActivity.length > 0 ? (
                <>
                  <div className="grid min-h-[18rem] grid-cols-4 items-end gap-3 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12">
                    {reportData.recentActivity
                      .slice()
                      .reverse()
                      .map((activity, index) => {
                        const originalIndex = reportData.recentActivity.findIndex((item) => item.date === activity.date)
                        const isActive = originalIndex === selectedDayIndex
                        const barHeight = `${Math.max((activity.comments / activityMax) * 100, activity.comments > 0 ? 14 : 6)}%`

                        return (
                          <button
                            key={activity.date}
                            onClick={() => setSelectedDayIndex(originalIndex)}
                            className={`group flex h-full min-h-[18rem] flex-col items-center justify-end gap-3 rounded-[1.6rem] border px-3 py-4 text-center rev-hover-lift ${
                              isActive
                                ? 'rev-active-ring border-orange-200/80 bg-white'
                                : 'border-transparent bg-slate-50/75 hover:border-slate-200/80'
                            }`}
                            style={{ animationDelay: `${index * 35}ms` }}
                          >
                            <div className="flex h-32 items-end">
                              <div
                                className={`w-10 rounded-full bg-gradient-to-t transition-all duration-300 ${
                                  isActive
                                    ? 'from-[color:var(--rev-primary-strong)] to-[color:var(--rev-primary)]'
                                    : 'from-slate-400 to-slate-300 group-hover:from-[color:var(--rev-primary)] group-hover:to-[color:var(--rev-primary-strong)]'
                                }`}
                                style={{ height: barHeight }}
                              />
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-slate-700">
                                {new Date(`${activity.date}T00:00:00`).toLocaleDateString(undefined, {
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </p>
                              <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-slate-400">
                                {activity.comments}
                              </p>
                            </div>
                          </button>
                        )
                      })}
                  </div>

                  {selectedDay ? (
                    <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="rounded-[1.5rem] bg-slate-950 px-4 py-4 text-white">
                        <p className="text-xs uppercase tracking-[0.18em] text-white/60">Selected day</p>
                        <p className="mt-2 text-lg font-semibold">
                          {new Date(`${selectedDay.date}T00:00:00`).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="rounded-[1.5rem] border border-slate-200/70 bg-white/76 px-4 py-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Comments</p>
                        <p className="mt-2 text-2xl font-semibold text-slate-950">{selectedDay.comments}</p>
                      </div>
                      <div className="rounded-[1.5rem] border border-slate-200/70 bg-white/76 px-4 py-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Replies</p>
                        <p className="mt-2 text-2xl font-semibold text-slate-950">{selectedDay.replies}</p>
                      </div>
                      <div className="rounded-[1.5rem] border border-slate-200/70 bg-white/76 px-4 py-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Reply rate</p>
                        <p className="mt-2 text-2xl font-semibold text-slate-950">
                          {selectedDay.comments > 0 ? Math.round((selectedDay.replies / selectedDay.comments) * 100) : 0}%
                        </p>
                      </div>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="rev-empty">No activity in this range.</div>
              )}
            </div>
          </section>
        </>
      ) : (
        <div className="rev-panel px-6 py-10 text-center">
          <Sparkles className="mx-auto h-10 w-10 text-[color:var(--rev-primary)]" />
          <h2 className="mt-4 text-2xl font-semibold text-slate-950">No analytics yet</h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            Start monitoring content and pulling comments to populate reports.
          </p>
        </div>
      )}
    </div>
  )
}
