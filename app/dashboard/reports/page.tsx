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
      const response = await fetch(`/api/reports?timeRange=${timeRange}`)
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
          <p className="mt-1 text-sm text-gray-600">
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
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : '90 Days'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-sm text-gray-600">Loading reports...</span>
        </div>
      ) : reportData ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Total Comments */}
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">Total Comments</dt>
                    <dd className="text-lg font-medium text-gray-900">{reportData.totalComments}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </div>

          {/* Sentiment Breakdown */}
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <h3 className="text-sm font-medium text-gray-500">Sentiment Breakdown</h3>
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-green-600">Positive</span>
                  <span className="text-sm font-medium">{reportData.sentimentBreakdown.positive}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Neutral</span>
                  <span className="text-sm font-medium">{reportData.sentimentBreakdown.neutral}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-red-600">Negative</span>
                  <span className="text-sm font-medium">{reportData.sentimentBreakdown.negative}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Platform Stats */}
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <h3 className="text-sm font-medium text-gray-500">Platform Distribution</h3>
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-red-600">YouTube</span>
                  <span className="text-sm font-medium">{reportData.platformStats.youtube}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-pink-600">Instagram</span>
                  <span className="text-sm font-medium">{reportData.platformStats.instagram}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Top Questions */}
          <div className="bg-white overflow-hidden shadow rounded-lg md:col-span-2">
            <div className="p-5">
              <h3 className="text-sm font-medium text-gray-500">Top Questions</h3>
              <div className="mt-3">
                {reportData.topQuestions.length > 0 ? (
                  <ul className="space-y-2">
                    {reportData.topQuestions.map((question, index) => (
                      <li key={index} className="text-sm text-gray-900">• {question}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-500">No questions identified yet.</p>
                )}
              </div>
            </div>
          </div>

          {/* Top Concerns */}
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <h3 className="text-sm font-medium text-gray-500">Top Concerns</h3>
              <div className="mt-3">
                {reportData.topConcerns.length > 0 ? (
                  <ul className="space-y-2">
                    {reportData.topConcerns.map((concern, index) => (
                      <li key={index} className="text-sm text-gray-900">• {concern}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-500">No concerns identified yet.</p>
                )}
              </div>
            </div>
          </div>

          {/* Recent Activity Chart Placeholder */}
          <div className="bg-white overflow-hidden shadow rounded-lg md:col-span-3">
            <div className="p-5">
              <h3 className="text-sm font-medium text-gray-500">Recent Activity</h3>
              <div className="mt-3">
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <p className="mt-2 text-sm text-gray-500">Activity chart will be implemented in Phase 6</p>
                </div>
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