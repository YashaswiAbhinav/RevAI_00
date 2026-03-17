import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db/postgres'
import { decryptToken } from '@/lib/security/encryption'
import { getYouTubeContent } from '@/lib/integrations/youtube'
import { getInstagramContent } from '@/lib/integrations/instagram'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const connectionId = searchParams.get('connectionId')

    if (!connectionId) {
      return NextResponse.json({ error: 'Connection ID required' }, { status: 400 })
    }

    // Verify the connection belongs to the user
    const connection = await prisma.connection.findFirst({
      where: {
        id: connectionId,
        userId: session.user.id,
      },
    })

    if (!connection) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
    }

    // Get monitored content IDs for this connection's platform
    const monitoredContent = await prisma.monitoredContent.findMany({
      where: {
        userId: session.user.id,
        platform: connection.platform,
        isMonitored: true,
      },
      select: {
        platformContentId: true,
      },
    })

    const monitoredIds = new Set(monitoredContent.map(mc => mc.platformContentId))

    let content: any[] = []

    try {
      // Decrypt the access token
      const accessToken = decryptToken(connection.accessToken)

      if (!connection.channelId) {
        return NextResponse.json(
          { error: 'Connection is missing platform channel/account ID' },
          { status: 400 }
        )
      }

      if (connection.platform === 'YOUTUBE') {
        content = await getYouTubeContent(accessToken, connection.channelId)
      } else if (connection.platform === 'INSTAGRAM') {
        content = await getInstagramContent(accessToken, connection.channelId)
      }

      // Mark which content is already being monitored
      content = content.map(item => ({
        ...item,
        isMonitored: monitoredIds.has(item.id),
      }))

    } catch (error) {
      console.error('Failed to fetch content from platform:', error)
      return NextResponse.json(
        { error: 'Failed to fetch content from platform' },
        { status: 500 }
      )
    }

    return NextResponse.json({ content })

  } catch (error) {
    console.error('Error fetching content:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
