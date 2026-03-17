import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/lib/db/postgres'
import { firestoreService } from '@/lib/db/firestore'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { platform: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const platform = params.platform.toUpperCase()

    if (!['YOUTUBE', 'INSTAGRAM', 'FACEBOOK'].includes(platform)) {
      return NextResponse.json(
        { error: 'Invalid platform' },
        { status: 400 }
      )
    }

    // Find and delete the connection
    const connection = await prisma.connection.findFirst({
      where: {
        userId: session.user.id,
        platform: platform as any,
      },
    })

    if (!connection) {
      return NextResponse.json(
        { error: 'Connection not found' },
        { status: 404 }
      )
    }

    // Delete the connection
    await prisma.connection.delete({
      where: { id: connection.id },
    })

    // Optionally clean up related data
    // Delete monitored content for this platform
    await prisma.monitoredContent.deleteMany({
      where: {
        userId: session.user.id,
        platform: platform as any,
      },
    })

    // Note: We keep Firestore comments for historical reporting
    // They can be cleaned up separately if needed

    return NextResponse.json({
      success: true,
      message: `${platform} disconnected successfully`,
    })

  } catch (error) {
    console.error('Disconnect error:', error)
    return NextResponse.json(
      { error: 'Failed to disconnect platform' },
      { status: 500 }
    )
  }
}