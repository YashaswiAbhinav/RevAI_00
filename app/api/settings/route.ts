import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db/postgres'
import { firestore } from '@/lib/db/firestore'

const ALLOWED_TONES = new Set(['professional', 'friendly', 'casual'])

function parseOptionalEmail(value: unknown) {
  if (typeof value !== 'string') {
    return ''
  }

  return value.trim()
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const [user, connectionsCount, monitoredContentCount, commentsSnapshot] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.user.id },
        include: {
          replySettings: true,
        },
      }),
      prisma.connection.count({
        where: { userId: session.user.id },
      }),
      prisma.monitoredContent.count({
        where: { userId: session.user.id, isMonitored: true },
      }),
      firestore
        .collection('comments')
        .where('userId', '==', session.user.id)
        .limit(500)
        .get(),
    ])

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const actionableStatuses = new Set(['pending', 'classified', 'ready_to_post'])
    const commentsAwaitingReview = commentsSnapshot.docs.reduce((count, doc) => {
      const commentStatus = String(doc.data().status || 'pending')
      return actionableStatuses.has(commentStatus) ? count + 1 : count
    }, 0)

    return NextResponse.json({
      settings: {
        aiTone: user.replySettings?.tone || user.aiTone || 'friendly',
        autoReplyEnabled: user.autoReplyEnabled ?? false,
        replyDelay: user.replyDelay ?? 30,
        maxRepliesPerHour: user.maxRepliesPerHour ?? 10,
        businessContext: user.replySettings?.businessContext || user.businessContext || '',
        notificationEmail: user.notificationEmail || session.user.email || '',
      },
      stats: {
        connectedPlatforms: connectionsCount,
        monitoredContent: monitoredContentCount,
        commentsAwaitingReview,
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

    const aiTone = String(settings?.aiTone || 'friendly')
    const autoReplyEnabled = Boolean(settings?.autoReplyEnabled)
    const replyDelay = Number(settings?.replyDelay)
    const maxRepliesPerHour = Number(settings?.maxRepliesPerHour)
    const businessContext = String(settings?.businessContext || '').trim()
    const notificationEmail = parseOptionalEmail(settings?.notificationEmail)

    if (!ALLOWED_TONES.has(aiTone)) {
      return NextResponse.json({ error: 'Invalid AI tone' }, { status: 400 })
    }

    if (!Number.isFinite(replyDelay) || replyDelay < 0 || replyDelay > 1440) {
      return NextResponse.json({ error: 'Reply delay must be between 0 and 1440 minutes' }, { status: 400 })
    }

    if (!Number.isFinite(maxRepliesPerHour) || maxRepliesPerHour < 1 || maxRepliesPerHour > 100) {
      return NextResponse.json({ error: 'Max replies per hour must be between 1 and 100' }, { status: 400 })
    }

    if (notificationEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(notificationEmail)) {
      return NextResponse.json({ error: 'Notification email is invalid' }, { status: 400 })
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: session.user.id },
        data: {
          aiTone,
          autoReplyEnabled,
          replyDelay,
          maxRepliesPerHour,
          businessContext,
          notificationEmail,
        },
      }),
      prisma.replySettings.upsert({
        where: { userId: session.user.id },
        update: {
          businessContext,
          tone: aiTone,
        },
        create: {
          userId: session.user.id,
          businessContext,
          tone: aiTone,
          replyToTypes: ['question', 'complaint', 'praise', 'general'],
        },
      }),
    ])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error saving settings:', error)
    return NextResponse.json(
      { error: 'Failed to save settings' },
      { status: 500 }
    )
  }
}
