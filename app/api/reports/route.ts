import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { firestore } from '@/lib/db/firestore'
import { prisma } from '@/lib/db/postgres'
import { geminiAPI } from '@/lib/integrations/gemini'

type NormalizedSentiment = 'positive' | 'neutral' | 'negative'
type NormalizedCommentType = 'question' | 'complaint' | 'praise' | 'spam' | 'general'

const TIME_RANGE_DAYS: Record<string, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
}

function toDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return value
  }

  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    const converted = value.toDate()
    return converted instanceof Date && !Number.isNaN(converted.getTime()) ? converted : null
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const converted = new Date(value)
    return Number.isNaN(converted.getTime()) ? null : converted
  }

  return null
}

function normalizeSentiment(value: unknown): NormalizedSentiment | null {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.toLowerCase()
  if (normalized === 'positive' || normalized === 'neutral' || normalized === 'negative') {
    return normalized
  }

  return null
}

function normalizeCommentType(value: unknown): NormalizedCommentType {
  if (typeof value !== 'string') {
    return 'general'
  }

  const normalized = value.toLowerCase()
  if (
    normalized === 'question' ||
    normalized === 'complaint' ||
    normalized === 'praise' ||
    normalized === 'spam' ||
    normalized === 'general'
  ) {
    return normalized
  }

  return 'general'
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function formatDayKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function buildFallbackInsights(
  comments: Array<{ text: string; type: NormalizedCommentType }>
) {
  const topQuestions = comments
    .filter((comment) => comment.type === 'question')
    .map((comment) => comment.text.trim())
    .filter(Boolean)
    .slice(0, 5)

  const topConcerns = comments
    .filter((comment) => comment.type === 'complaint')
    .map((comment) => comment.text.trim())
    .filter(Boolean)
    .slice(0, 5)

  return {
    topQuestions,
    topConcerns,
    summary: comments.length > 0
      ? `Analyzed ${comments.length} comments from the selected time range.`
      : 'No comments available for analysis.',
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const timeRange = searchParams.get('timeRange') || '7d'
    const days = TIME_RANGE_DAYS[timeRange] || TIME_RANGE_DAYS['7d']

    const endDate = new Date()
    const startDate = new Date(endDate)
    startDate.setUTCDate(startDate.getUTCDate() - (days - 1))
    const reportStartDay = startOfUtcDay(startDate)

    const [commentSnapshot, user] = await Promise.all([
      firestore
        .collection('comments')
        .where('userId', '==', session.user.id)
        .limit(1000)
        .get(),
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
          businessContext: true,
        },
      }),
    ])

    const filteredComments = commentSnapshot.docs
      .map((doc) => {
        const data = doc.data()
        const classification = typeof data.classification === 'object' && data.classification
          ? data.classification as Record<string, unknown>
          : {}
        const publishedAt = toDate(data.publishedAt) || toDate(data.fetchedAt) || toDate(data.updatedAt)
        if (!publishedAt || publishedAt < reportStartDay || publishedAt > endDate) {
          return null
        }

        return {
          text: String(data.text || ''),
          author: String(data.author?.name || 'Unknown'),
          platform: String(data.platform || '').toLowerCase(),
          status: String(data.status || 'pending'),
          publishedAt,
          type: normalizeCommentType(classification.type),
          sentiment: normalizeSentiment(classification.sentiment ?? data.sentiment),
          posted: Boolean(data.posted?.isPosted),
        }
      })
      .filter((comment): comment is NonNullable<typeof comment> => Boolean(comment))

    const totalComments = filteredComments.length
    if (totalComments === 0) {
      return NextResponse.json({
        totalComments: 0,
        sentimentBreakdown: { positive: 0, neutral: 0, negative: 0 },
        repliedCount: 0,
        queuedCount: 0,
        pendingCount: 0,
        failedCount: 0,
        rejectedCount: 0,
        responseRate: 0,
        averageDailyComments: 0,
        topQuestions: [],
        topConcerns: [],
        recommendations: [],
        summary: 'No comment data found for this time range.',
        platformStats: { youtube: 0, reddit: 0, instagram: 0 },
        recentActivity: [],
        recentComments: [],
      })
    }

    const sentimentCounts = { positive: 0, neutral: 0, negative: 0 }
    const platformStats = { youtube: 0, reddit: 0, instagram: 0 }
    const activityMap = new Map<string, { date: string; comments: number; replies: number }>()
    let repliedCount = 0
    let queuedCount = 0
    let pendingCount = 0
    let failedCount = 0
    let rejectedCount = 0

    for (let offset = 0; offset < days; offset += 1) {
      const day = new Date(reportStartDay)
      day.setUTCDate(reportStartDay.getUTCDate() + offset)
      const key = formatDayKey(day)
      activityMap.set(key, { date: key, comments: 0, replies: 0 })
    }

    for (const comment of filteredComments) {
      if (comment.sentiment) {
        sentimentCounts[comment.sentiment] += 1
      }

      if (comment.platform === 'youtube') {
        platformStats.youtube += 1
      } else if (comment.platform === 'reddit') {
        platformStats.reddit += 1
      } else if (comment.platform === 'instagram') {
        platformStats.instagram += 1
      }

      if (comment.status === 'replied' || comment.posted) {
        repliedCount += 1
      } else if (comment.status === 'ready_to_post') {
        queuedCount += 1
      } else if (comment.status === 'failed') {
        failedCount += 1
      } else if (comment.status === 'rejected') {
        rejectedCount += 1
      } else {
        pendingCount += 1
      }

      const dayKey = formatDayKey(startOfUtcDay(comment.publishedAt))
      const bucket = activityMap.get(dayKey)
      if (bucket) {
        bucket.comments += 1
        if (comment.status === 'replied' || comment.posted) {
          bucket.replies += 1
        }
      }
    }

    const fallbackInsights = buildFallbackInsights(filteredComments)

    let topQuestions = fallbackInsights.topQuestions
    let topConcerns = fallbackInsights.topConcerns
    let summary = fallbackInsights.summary
    let recommendations: string[] = []

    try {
      const insights = await geminiAPI.generateInsights({
        comments: filteredComments.slice(0, 200).map((comment) => ({
          text: comment.text,
          type: comment.type,
          sentiment: comment.sentiment || 'neutral',
          timestamp: comment.publishedAt,
        })),
        businessContext: user?.businessContext || '',
        timeRange: {
          start: reportStartDay,
          end: endDate,
        },
      })

      topQuestions = insights.topQuestions.length > 0 ? insights.topQuestions.slice(0, 5) : topQuestions
      topConcerns = insights.topConcerns.length > 0 ? insights.topConcerns.slice(0, 5) : topConcerns
      summary = insights.summary || summary
      recommendations = insights.recommendations.slice(0, 4)
    } catch (error) {
      console.error('Gemini insights fallback used for reports:', error)
    }

    const sentimentBreakdown = {
      positive: Math.round((sentimentCounts.positive / totalComments) * 100),
      neutral: Math.round((sentimentCounts.neutral / totalComments) * 100),
      negative: Math.round((sentimentCounts.negative / totalComments) * 100),
    }

    const recentActivity = Array.from(activityMap.values()).sort((a, b) => b.date.localeCompare(a.date))
    const recentComments = [...filteredComments]
      .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
      .slice(0, 6)
      .map((comment) => ({
        text: comment.text,
        author: comment.author,
        platform: comment.platform,
        status: comment.status,
        publishedAt: comment.publishedAt.toISOString(),
      }))
    const responseRate = Math.round((repliedCount / totalComments) * 100)
    const averageDailyComments = Number((totalComments / days).toFixed(1))

    return NextResponse.json({
      totalComments,
      sentimentBreakdown,
      repliedCount,
      queuedCount,
      pendingCount,
      failedCount,
      rejectedCount,
      responseRate,
      averageDailyComments,
      topQuestions,
      topConcerns,
      recommendations,
      summary,
      platformStats,
      recentActivity,
      recentComments,
    })
  } catch (error) {
    console.error('Error fetching reports:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
