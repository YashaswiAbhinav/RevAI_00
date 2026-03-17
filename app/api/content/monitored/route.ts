import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db/postgres'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const monitoredContent = await prisma.monitoredContent.findMany({
      where: {
        userId: session.user.id,
        isMonitored: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
      select: {
        id: true,
        platform: true,
        platformContentId: true,
        title: true,
        updatedAt: true,
      },
    })

    const normalized = monitoredContent.map((item) => ({
      ...item,
      platform: item.platform.toLowerCase(),
    }))

    return NextResponse.json({ content: normalized })
  } catch (error) {
    console.error('Error fetching monitored content:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
