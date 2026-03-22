'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

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

export default function ReportsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState('7d') // 7d, 30d, 90d

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
    } catch (error) {
      console.error('Failed to fetch reports:', error)
    } finally {
      setLoading(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  const visibleRecentActivity =
    reportData?.recentActivity.filter((activity) => activity.comments > 0 || activity.replies > 0) ?? []

  const sentimentPositive = reportData?.sentimentBreakdown.positive ?? 0
  const sentimentNeutral = reportData?.sentimentBreakdown.neutral ?? 0
  const sentimentNegative = reportData?.sentimentBreakdown.negative ?? 0
  const sentimentTotal = sentimentPositive + sentimentNeutral + sentimentNegative

  const normalizedPositive = sentimentTotal > 0 ? (sentimentPositive / sentimentTotal) * 100 : 0
  const normalizedNeutral = sentimentTotal > 0 ? (sentimentNeutral / sentimentTotal) * 100 : 0
  const normalizedNegative = Math.max(0, 100 - normalizedPositive - normalizedNeutral)

  const sentimentPieStyle = {
    background: `conic-gradient(
      rgb(74 222 128) 0% ${normalizedPositive}%,
      rgb(148 163 184) ${normalizedPositive}% ${normalizedPositive + normalizedNeutral}%,
      rgb(248 113 113) ${normalizedPositive + normalizedNeutral}% 100%
    )`,
  }

  const youtubeCount = reportData?.platformStats.youtube ?? 0
  const instagramCount = reportData?.platformStats.instagram ?? 0
  const platformTotal = youtubeCount + instagramCount
  const youtubePercent = platformTotal > 0 ? (youtubeCount / platformTotal) * 100 : 0
  const instagramPercent = Math.max(0, 100 - youtubePercent)

  const platformPieStyle = {
    background: `conic-gradient(
      rgb(248 113 113) 0% ${youtubePercent}%,
      rgb(244 114 182) ${youtubePercent}% 100%
    )`,
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reports & Analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Insights into your comment engagement and AI performance.
          </p>
        </div>

        <div className="flex space-x-2">
          {['7d', '30d', '90d'].map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-2 text-sm font-medium rounded-md ${
                timeRange === range
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card text-foreground border border-border hover:bg-muted'
              }`}
            >
              {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : '90 Days'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <span className="ml-2 text-sm text-muted-foreground">Loading reports...</span>
        </div>
      ) : reportData ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Total Comments */}
          <div className="bg-card overflow-hidden shadow rounded-lg gradient-card">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-muted-foreground truncate">Total Comments</dt>
                    <dd className="text-lg font-medium text-foreground">{reportData.totalComments}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          {/* Sentiment Breakdown */}
          <div className="bg-card overflow-hidden shadow rounded-lg gradient-card">
            <div className="p-5">
              <h3 className="text-sm font-medium text-muted-foreground">Sentiment Breakdown</h3>
              <div className="mt-4 flex items-center gap-4">
                <div className="relative h-24 w-24 shrink-0 rounded-full" style={sentimentPieStyle}>
                  <div className="absolute inset-4 rounded-full bg-card" />
                </div>

                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-green-400">Positive</span>
                    <span className="text-sm font-medium text-foreground">{sentimentPositive}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Neutral</span>
                    <span className="text-sm font-medium text-foreground">{sentimentNeutral}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-red-400">Negative</span>
                    <span className="text-sm font-medium text-foreground">{sentimentNegative}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Platform Stats */}
          <div className="bg-card overflow-hidden shadow rounded-lg gradient-card">
            <div className="p-5">
              <h3 className="text-sm font-medium text-muted-foreground">Platform Distribution</h3>
              <div className="mt-4 flex items-center gap-4">
                <div className="relative h-24 w-24 shrink-0 rounded-full" style={platformPieStyle}>
                  <div className="absolute inset-4 rounded-full bg-card" />
                </div>

                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-red-400">YouTube</span>
                    <span className="text-sm font-medium text-foreground">{youtubePercent.toFixed(1)}% ({youtubeCount})</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-pink-400">Instagram</span>
                    <span className="text-sm font-medium text-foreground">{instagramPercent.toFixed(1)}% ({instagramCount})</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Top Questions */}
          <div className="bg-card overflow-hidden shadow rounded-lg gradient-card md:col-span-2">
            <div className="p-5">
              <h3 className="text-sm font-medium text-muted-foreground">Top Questions</h3>
              <div className="mt-3">
                {reportData.topQuestions.length > 0 ? (
                  <ul className="space-y-2">
                    {reportData.topQuestions.map((question, index) => (
                      <li key={index} className="text-sm text-foreground">• {decodeHtmlEntities(question)}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No questions identified yet.</p>
                )}
              </div>
            </div>
          </div>

          {/* Top Concerns */}
          <div className="bg-card overflow-hidden shadow rounded-lg gradient-card">
            <div className="p-5">
              <h3 className="text-sm font-medium text-muted-foreground">Top Concerns</h3>
              <div className="mt-3">
                {reportData.topConcerns.length > 0 ? (
                  <ul className="space-y-2">
                    {reportData.topConcerns.map((concern, index) => (
                      <li key={index} className="text-sm text-foreground">• {decodeHtmlEntities(concern)}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No concerns identified yet.</p>
                )}
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-card overflow-hidden shadow rounded-lg gradient-card md:col-span-3">
            <div className="p-5">
              <h3 className="text-sm font-medium text-muted-foreground">Recent Activity</h3>
              <div className="mt-3">
                {visibleRecentActivity.length > 0 ? (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {visibleRecentActivity.map((activity) => (
                        <div key={activity.date} className="rounded-lg border border-border bg-muted p-4">
                          <p className="text-sm font-medium text-foreground">
                          {new Date(`${activity.date}T00:00:00`).toLocaleDateString()}
                        </p>
                        <div className="mt-3 flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Comments</span>
                            <span className="font-medium text-foreground">{activity.comments}</span>
                        </div>
                        <div className="mt-2 flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Replies Posted</span>
                            <span className="font-medium text-foreground">{activity.replies}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                    <p className="text-sm text-muted-foreground">No recent activity in this date range yet.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">No data available</h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>Start monitoring content and responding to comments to see analytics here.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
