import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db/postgres'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { connectionId, contentId, isMonitored } = await request.json()

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
        status: 'connected',
      },
    })

    if (!connection) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
    }

    if (isMonitored) {
      // Start monitoring - create record
      await prisma.monitoredContent.upsert({
        where: {
          connectionId_contentId: {
            connectionId,
            contentId,
          },
        },
        update: {
          updatedAt: new Date(),
        },
        create: {
          connectionId,
          contentId,
          platform: connection.platform,
        },
      })
    } else {
      // Stop monitoring - delete record
      await prisma.monitoredContent.deleteMany({
        where: {
          connectionId,
          contentId,
        },
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
