import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db/postgres'
import { youtubeAPI, getYouTubeToken } from '@/lib/integrations/youtube'
import { instagramAPI, getInstagramToken } from '@/lib/integrations/instagram'
import { redditAPI, getRedditToken } from '@/lib/integrations/reddit'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const connections = await prisma.connection.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
    })

    // Check token validity and permissions
    const connectionsWithStatus = await Promise.all(
      connections.map(async (connection) => {
        let status = 'connected'
        let permissions = { canReadComments: false, canPostReplies: false }
        let errors: string[] = []

        try {
          if (connection.platform === 'YOUTUBE') {
            const { accessToken } = await getYouTubeToken(session.user.id)
            const result = await youtubeAPI.checkPermissions(accessToken)
            permissions = result
            errors = result.errors
          } else if (connection.platform === 'REDDIT') {
            const { accessToken } = await getRedditToken(session.user.id)
            const result = await redditAPI.checkPermissions(accessToken, connection.channelId || undefined)
            permissions = result
            errors = result.errors
          } else if (connection.platform === 'INSTAGRAM') {
            const { accessToken } = await getInstagramToken(session.user.id)
            const result = await instagramAPI.checkPermissions(accessToken, connection.channelId!)
            permissions = result
            errors = result.errors
          }

          // Check if token is expired
          if (connection.expiresAt && connection.expiresAt < new Date()) {
            status = 'expired'
          }
        } catch (error: any) {
          status = 'error'
          errors.push(error.message || 'Connection check failed')
        }

        return {
          id: connection.id,
          platform: connection.platform,
          channelName: connection.channelName,
          status,
          permissions,
          errors,
          createdAt: connection.createdAt,
        }
      })
    )

    return NextResponse.json({
      connections: connectionsWithStatus,
    })

  } catch (error) {
    console.error('Get connections error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch connections' },
      { status: 500 }
    )
  }
}
