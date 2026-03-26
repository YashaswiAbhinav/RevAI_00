import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db/postgres'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { connectionId, contentId, title, isMonitored } = await request.json()

    if (!connectionId || !contentId) {
      return NextResponse.json(
        { error: 'Connection ID and Content ID required' },
        { status: 400 }
      )
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

    if (isMonitored) {
      // Start monitoring - create or reactivate record
      await prisma.monitoredContent.upsert({
        where: {
          userId_platform_platformContentId: {
            userId: session.user.id,
            platform: connection.platform,
            platformContentId: contentId,
          },
        },
        update: {
          title: title || null,
          isMonitored: true,
          updatedAt: new Date(),
        },
        create: {
          userId: session.user.id,
          platform: connection.platform,
          platformContentId: contentId,
          title: title || null,
          isMonitored: true,
        },
      })
    } else {
      // Stop monitoring - keep record but disable it
      await prisma.monitoredContent.updateMany({
        where: {
          userId: session.user.id,
          platform: connection.platform,
          platformContentId: contentId,
        },
        data: {
          isMonitored: false,
          updatedAt: new Date(),
        }
      })
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error updating monitoring status:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
