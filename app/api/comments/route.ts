import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db/postgres'
import { firestore } from '@/lib/db/firestore'
import { decryptToken } from '@/lib/security/encryption'
import { getYouTubeComments } from '@/lib/integrations/youtube'
import { getInstagramComments } from '@/lib/integrations/instagram'
import { classifyComment } from '@/lib/integrations/gemini'

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

    // Get all monitored content for the user
    const monitoredContent = await prisma.monitoredContent.findMany({
      where: {
        connection: {
          userId: session.user.id,
          status: 'connected',
        },
      },
      include: {
        connection: true,
      },
    })

    const comments: any[] = []

    // Fetch comments from each monitored content
    for (const content of monitoredContent) {
      try {
        const accessToken = decryptToken(content.connection.accessToken)

        let contentComments: any[] = []

        if (content.platform === 'youtube') {
          const result = await getYouTubeComments(accessToken, content.contentId)
          contentComments = result.comments.map(comment => ({
            id: comment.id,
            text: comment.snippet.textDisplay,
            author: comment.snippet.authorDisplayName,
            authorAvatar: comment.snippet.authorProfileImageUrl,
            publishedAt: comment.snippet.publishedAt,
            platform: 'youtube',
            contentId: content.contentId,
            contentTitle: content.contentId, // We'll need to store this
          }))
        } else if (content.platform === 'instagram') {
          const result = await getInstagramComments(accessToken, content.contentId)
          contentComments = result.comments.map(comment => ({
            id: comment.id,
            text: comment.text,
            author: comment.username,
            publishedAt: comment.timestamp,
            platform: 'instagram',
            contentId: content.contentId,
            contentTitle: content.contentId, // We'll need to store this
          }))
        }

        // Classify sentiment for new comments
        for (const comment of contentComments) {
          try {
            const classification = await classifyComment(comment.text)
            comment.sentiment = classification.sentiment
          } catch (error) {
            comment.sentiment = 'neutral' // fallback
          }
        }

        comments.push(...contentComments)
      } catch (error) {
        console.error(`Failed to fetch comments for content ${content.contentId}:`, error)
      }
    }

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
