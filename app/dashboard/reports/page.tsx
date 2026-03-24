'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, ArrowUpRight, BarChart3, HelpCircle, Sparkles, TrendingUp } from 'lucide-react'

interface ReportData {
  totalComments: number
  sentimentBreakdown: {
    positive: number
    neutral: number
    negative: number
  }
  topQuestions: string[]
  topConcerns: string[]
  platformStats: {
    youtube: number
    instagram: number
  }
  recentActivity: Array<{
    date: string
    comments: number
    replies: number
  }>
}

export default function ReportsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState('7d')

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
    }
  }, [status, router])

  useEffect(() => {
    if (session?.user) {
      fetchReports()
    }
  }, [session, timeRange])

  const fetchReports = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/reports?timeRange=${timeRange}`, {
        cache: 'no-store',
      })
      if (response.ok) {
        const data = await response.json()
        setReportData(data)
      }
    } catch (fetchError) {
      console.error('Failed to fetch reports:', fetchError)
    } finally {
      setLoading(false)
    }
  }

  const activityHighlights = useMemo(() => {
    if (!reportData?.recentActivity?.length) {
      return []
    }

    return [...reportData.recentActivity]
      .sort((left, right) => (right.comments + right.replies) - (left.comments + left.replies))
      .slice(0, 3)
  }, [reportData])

  if (status === 'loading') {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="rev-panel flex items-center gap-4 px-8 py-6">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-[color:var(--rev-primary)]" />
          <div>
            <p className="text-sm font-semibold text-slate-900">Loading reports</p>
            <p className="text-sm text-slate-500">Collecting analytics and insights...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section className="rev-panel-strong px-6 py-8 sm:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="rev-kicker">Analytics Workspace</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">See what the audience is actually telling you.</h1>
            <p className="mt-4 max-w-2xl text-base leading-8 text-slate-600">
              Reports turn raw comment activity into a clearer story: how many interactions are arriving, what the emotional tone looks like, and which questions or concerns deserve attention.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {['7d', '30d', '90d'].map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={timeRange === range ? 'rev-button-primary' : 'rev-button-secondary'}
              >
                {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : '90 Days'}
              </button>
            ))}
          </div>
        </div>
      </section>

      {loading ? (
        <div className="rev-panel flex items-center justify-center gap-4 px-6 py-14">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-[color:var(--rev-primary)]" />
          <span className="text-sm text-slate-600">Generating the latest report view...</span>
        </div>
      ) : reportData ? (
        <>
          <section className="rev-grid">
            {[
              {
                label: 'Total comments',
                value: reportData.totalComments,
                note: 'Across the selected reporting window.',
              },
              {
                label: 'Positive sentiment',
                value: `${reportData.sentimentBreakdown.positive}%`,
                note: 'Share of comments classified as positive.',
              },
              {
                label: 'Top platform',
                value: reportData.platformStats.youtube >= reportData.platformStats.instagram ? 'YouTube' : 'Instagram',
                note: 'The most active source in this time range.',
              },
              {
                label: 'Recent activity points',
                value: reportData.recentActivity.length,
                note: 'Daily buckets available in the selected window.',
              },
            ].map((item) => (
              <div key={item.label} className="rev-stat-card">
                <p className="text-sm text-slate-500">{item.label}</p>
                <p className="mt-3 text-4xl font-semibold text-slate-950">{item.value}</p>
                <p className="mt-3 text-sm text-slate-500">{item.note}</p>
              </div>
            ))}
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-6">
              <div className="rev-panel p-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white">
                    <BarChart3 className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="rev-kicker">Sentiment Map</p>
                    <h2 className="mt-1 text-2xl font-semibold text-slate-950">Emotional split</h2>
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
                          style={{ width: `${Math.max(item.value, 4)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rev-panel p-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[color:var(--rev-primary)] text-white">
                    <HelpCircle className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="rev-kicker">Top Questions</p>
                    <h2 className="mt-1 text-2xl font-semibold text-slate-950">What people keep asking</h2>
                  </div>
                </div>

                <div className="mt-6 space-y-3">
                  {reportData.topQuestions.length > 0 ? reportData.topQuestions.map((question, index) => (
                    <div key={`${question}-${index}`} className="rounded-[1.5rem] border border-slate-200/70 bg-white/78 p-4 text-sm leading-7 text-slate-700">
                      {question}
                    </div>
                  )) : (
                    <div className="rounded-[1.5rem] border border-dashed border-slate-200 px-5 py-6 text-sm text-slate-500">
                      No recurring questions were detected yet in this period.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="rev-panel p-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="rev-kicker">Top Concerns</p>
                    <h2 className="mt-1 text-2xl font-semibold text-slate-950">Friction points surfacing now</h2>
                  </div>
                </div>

                <div className="mt-6 space-y-3">
                  {reportData.topConcerns.length > 0 ? reportData.topConcerns.map((concern, index) => (
                    <div key={`${concern}-${index}`} className="rounded-[1.5rem] border border-slate-200/70 bg-white/78 p-4 text-sm leading-7 text-slate-700">
                      {concern}
                    </div>
                  )) : (
                    <div className="rounded-[1.5rem] border border-dashed border-slate-200 px-5 py-6 text-sm text-slate-500">
                      No major concern clusters were detected yet.
                    </div>
                  )}
                </div>
              </div>

              <div className="rev-panel p-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[color:var(--rev-secondary)] text-white">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="rev-kicker">Platform Split</p>
                    <h2 className="mt-1 text-2xl font-semibold text-slate-950">Where engagement is happening</h2>
                  </div>
                </div>

                <div className="mt-6 grid gap-3">
                  {[
                    { label: 'YouTube', value: reportData.platformStats.youtube },
                    { label: 'Instagram', value: reportData.platformStats.instagram },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between rounded-2xl bg-slate-950/4 px-4 py-3">
                      <span className="text-sm text-slate-600">{item.label}</span>
                      <span className="text-sm font-semibold text-slate-950">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="rev-panel p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="rev-kicker">Recent Activity</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-950">Daily movement in the selected range</h2>
              </div>
              <div className="rounded-full bg-slate-950 px-4 py-2 text-sm text-white">
                {activityHighlights.length} strongest activity windows
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {reportData.recentActivity.length > 0 ? reportData.recentActivity.map((activity) => (
                <div key={activity.date} className="rounded-[1.75rem] border border-slate-200/70 bg-white/78 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">
                        {new Date(`${activity.date}T00:00:00`).toLocaleDateString()}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">Daily engagement snapshot</p>
                    </div>
                    <ArrowUpRight className="h-5 w-5 text-slate-300" />
                  </div>
                  <div className="mt-5 grid gap-3">
                    <div className="flex items-center justify-between rounded-2xl bg-slate-950/4 px-4 py-3 text-sm">
                      <span className="text-slate-600">Comments</span>
                      <span className="font-semibold text-slate-950">{activity.comments}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl bg-slate-950/4 px-4 py-3 text-sm">
                      <span className="text-slate-600">Replies posted</span>
                      <span className="font-semibold text-slate-950">{activity.replies}</span>
                    </div>
                  </div>
                </div>
              )) : (
                <div className="rounded-[1.5rem] border border-dashed border-slate-200 px-5 py-8 text-sm text-slate-500">
                  No recent activity in this date range yet.
                </div>
              )}
            </div>
          </section>
        </>
      ) : (
        <div className="rev-panel px-6 py-10 text-center">
          <Sparkles className="mx-auto h-10 w-10 text-[color:var(--rev-primary)]" />
          <h2 className="mt-4 text-2xl font-semibold text-slate-950">No analytics yet</h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            Start monitoring content and moving comments through the pipeline to populate the reports screen.
          </p>
        </div>
      )}
    </div>
  )
}
