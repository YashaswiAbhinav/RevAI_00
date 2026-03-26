import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db/postgres'
import { firestore } from '@/lib/db/firestore'

export const dynamic = 'force-dynamic'

function normalizeSentiment(value: unknown): 'positive' | 'neutral' | 'negative' | undefined {
  if (typeof value !== 'string') {
    return undefined
  }

  const normalized = value.toLowerCase()
  if (normalized === 'positive' || normalized === 'neutral' || normalized === 'negative') {
    return normalized
  }

  return undefined
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const platform = searchParams.get('platform')
    const sentiment = searchParams.get('sentiment')
    const status = searchParams.get('status')
    const search = searchParams.get('search')

    const contentRecords = await prisma.monitoredContent.findMany({
      where: { userId: session.user.id },
      select: {
        platform: true,
        platformContentId: true,
        title: true,
      },
    })

    const contentTitleMap = new Map(
      contentRecords.map((item) => [
        `${item.platform}:${item.platformContentId}`,
        item.title || item.platformContentId,
      ])
    )

    const snapshot = await firestore
      .collection('comments')
      .where('userId', '==', session.user.id)
      .limit(200)
      .get()

    const comments = snapshot.docs.map((doc) => {
      const data = doc.data()
      const platformValue = String(data.platform || '').toUpperCase()
      const contentId = String(data.contentId || '')
      const classification = typeof data.classification === 'object' && data.classification
        ? data.classification as Record<string, unknown>
        : null
      const publishedAt = data.publishedAt?.toDate?.()
        ? data.publishedAt.toDate().toISOString()
        : data.publishedAt || data.fetchedAt?.toDate?.()?.toISOString() || new Date().toISOString()

      return {
        id: doc.id,
        text: data.text || '',
        author: data.author?.name || 'Unknown',
        authorAvatar: data.author?.avatarUrl || '',
        publishedAt,
        platform: String(data.platform || ''),
        contentId,
        contentTitle: contentTitleMap.get(`${platformValue}:${contentId}`) || contentId,
        sentiment: normalizeSentiment(
          classification?.sentiment ??
          (data.sentiment as unknown)
        ),
        aiReply: data.generatedReply?.text || '',
        status: (['pending','classified','ready_to_post','replied','failed','rejected'].includes(data.status) ? data.status : 'pending'),
      }
    })

    // Apply filters
    let filteredComments = comments

    if (platform) {
      filteredComments = filteredComments.filter(c => c.platform === platform)
    }

    if (sentiment) {
      filteredComments = filteredComments.filter(c => c.sentiment === sentiment)
    }

    if (status) {
      filteredComments = filteredComments.filter(c => c.status === status)
    }

    if (search) {
      const searchLower = search.toLowerCase()
      filteredComments = filteredComments.filter(c =>
        c.text.toLowerCase().includes(searchLower) ||
        c.author.toLowerCase().includes(searchLower)
      )
    }

    // Sort by published date (newest first)
    filteredComments.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())

    return NextResponse.json({ comments: filteredComments })

  } catch (error) {
    console.error('Error fetching comments:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
