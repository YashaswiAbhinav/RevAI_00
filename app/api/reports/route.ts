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
        topQuestions: [],
        topConcerns: [],
        platformStats: { youtube: 0, instagram: 0, facebook: 0 },
        platformActivity: [],
        sentimentPlatformStats: {
          positive: { youtube: 0, instagram: 0, facebook: 0 },
          neutral: { youtube: 0, instagram: 0, facebook: 0 },
          negative: { youtube: 0, instagram: 0, facebook: 0 },
        },
        sentimentPlatformActivity: {
          positive: [],
          neutral: [],
          negative: [],
        },
        recentActivity: [],
      })
    }

    const sentimentCounts = { positive: 0, neutral: 0, negative: 0 }
    const platformStats = { youtube: 0, instagram: 0, facebook: 0 }
    const sentimentPlatformStats = {
      positive: { youtube: 0, instagram: 0, facebook: 0 },
      neutral: { youtube: 0, instagram: 0, facebook: 0 },
      negative: { youtube: 0, instagram: 0, facebook: 0 },
    }
    const activityMap = new Map<string, { date: string; comments: number; replies: number }>()
    const platformActivityMap = new Map<string, { date: string; youtube: number; instagram: number; facebook: number }>()
    const sentimentPlatformActivityMap = {
      positive: new Map<string, { date: string; youtube: number; instagram: number; facebook: number }>(),
      neutral: new Map<string, { date: string; youtube: number; instagram: number; facebook: number }>(),
      negative: new Map<string, { date: string; youtube: number; instagram: number; facebook: number }>(),
    }

    for (let offset = 0; offset < days; offset += 1) {
      const day = new Date(reportStartDay)
      day.setUTCDate(reportStartDay.getUTCDate() + offset)
      const key = formatDayKey(day)
      activityMap.set(key, { date: key, comments: 0, replies: 0 })
      platformActivityMap.set(key, { date: key, youtube: 0, instagram: 0, facebook: 0 })
      sentimentPlatformActivityMap.positive.set(key, { date: key, youtube: 0, instagram: 0, facebook: 0 })
      sentimentPlatformActivityMap.neutral.set(key, { date: key, youtube: 0, instagram: 0, facebook: 0 })
      sentimentPlatformActivityMap.negative.set(key, { date: key, youtube: 0, instagram: 0, facebook: 0 })
    }

    for (const comment of filteredComments) {
      if (comment.sentiment) {
        sentimentCounts[comment.sentiment] += 1
      }

      if (comment.platform === 'youtube') {
        platformStats.youtube += 1
      } else if (comment.platform === 'instagram') {
        platformStats.instagram += 1
      } else if (comment.platform === 'facebook') {
        platformStats.facebook += 1
      }

      const dayKey = formatDayKey(startOfUtcDay(comment.publishedAt))
      const bucket = activityMap.get(dayKey)
      if (bucket) {
        bucket.comments += 1
        if (comment.status === 'replied' || comment.posted) {
          bucket.replies += 1
        }
      }

      const platformBucket = platformActivityMap.get(dayKey)
      if (platformBucket) {
        if (comment.platform === 'youtube') {
          platformBucket.youtube += 1
        } else if (comment.platform === 'instagram') {
          platformBucket.instagram += 1
        } else if (comment.platform === 'facebook') {
          platformBucket.facebook += 1
        }
      }

      if (comment.sentiment) {
        const sentimentStats = sentimentPlatformStats[comment.sentiment]
        if (comment.platform === 'youtube') {
          sentimentStats.youtube += 1
        } else if (comment.platform === 'instagram') {
          sentimentStats.instagram += 1
        } else if (comment.platform === 'facebook') {
          sentimentStats.facebook += 1
        }

        const sentimentBucket = sentimentPlatformActivityMap[comment.sentiment].get(dayKey)
        if (sentimentBucket) {
          if (comment.platform === 'youtube') {
            sentimentBucket.youtube += 1
          } else if (comment.platform === 'instagram') {
            sentimentBucket.instagram += 1
          } else if (comment.platform === 'facebook') {
            sentimentBucket.facebook += 1
          }
        }
      }
    }

    const fallbackInsights = buildFallbackInsights(filteredComments)

    let topQuestions = fallbackInsights.topQuestions
    let topConcerns = fallbackInsights.topConcerns

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
    } catch (error) {
      console.error('Gemini insights fallback used for reports:', error)
    }

    const sentimentBreakdown = {
      positive: Math.round((sentimentCounts.positive / totalComments) * 100),
      neutral: Math.round((sentimentCounts.neutral / totalComments) * 100),
      negative: Math.round((sentimentCounts.negative / totalComments) * 100),
    }

    const recentActivity = Array.from(activityMap.values()).sort((a, b) => b.date.localeCompare(a.date))
    const platformActivity = Array.from(platformActivityMap.values()).sort((a, b) => a.date.localeCompare(b.date))
    const sentimentPlatformActivity = {
      positive: Array.from(sentimentPlatformActivityMap.positive.values()).sort((a, b) => a.date.localeCompare(b.date)),
      neutral: Array.from(sentimentPlatformActivityMap.neutral.values()).sort((a, b) => a.date.localeCompare(b.date)),
      negative: Array.from(sentimentPlatformActivityMap.negative.values()).sort((a, b) => a.date.localeCompare(b.date)),
    }

    return NextResponse.json({
      totalComments,
      sentimentBreakdown,
      topQuestions,
      topConcerns,
      platformStats,
      platformActivity,
      sentimentPlatformStats,
      sentimentPlatformActivity,
      recentActivity,
    })
  } catch (error) {
    console.error('Error fetching reports:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
