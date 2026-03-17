import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db/postgres'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user settings from database
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        aiTone: true,
        autoReplyEnabled: true,
        replyDelay: true,
        maxRepliesPerHour: true,
        businessContext: true,
        notificationEmail: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({
      settings: {
        aiTone: user.aiTone || 'friendly',
        autoReplyEnabled: user.autoReplyEnabled || false,
        replyDelay: user.replyDelay || 30,
        maxRepliesPerHour: user.maxRepliesPerHour || 10,
        businessContext: user.businessContext || '',
        notificationEmail: user.notificationEmail || session.user.email || '',
      },
    })

  } catch (error) {
    console.error('Error fetching settings:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { settings } = await request.json()

    // Update user settings
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        aiTone: settings.aiTone,
        autoReplyEnabled: settings.autoReplyEnabled,
        replyDelay: settings.replyDelay,
        maxRepliesPerHour: settings.maxRepliesPerHour,
        businessContext: settings.businessContext,
        notificationEmail: settings.notificationEmail,
      },
    })

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error saving settings:', error)
    return NextResponse.json(
      { error: 'Failed to save settings' },
      { status: 500 }
    )
  }
}
