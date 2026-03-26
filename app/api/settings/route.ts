import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db/postgres'
import { firestore } from '@/lib/db/firestore'

export const dynamic = 'force-dynamic'

const ALLOWED_TONES = new Set(['professional', 'friendly', 'casual'])

function parseOptionalEmail(value: unknown) {
  if (typeof value !== 'string') return ''
  return value.trim()
}

/**
 * Push a variable to Airflow via its REST API.
 * Silently logs on failure — Airflow may not be running in dev.
 */
async function setAirflowVariable(key: string, value: string): Promise<void> {
  const airflowUrl = process.env.AIRFLOW_API_URL || 'http://localhost:8080'
  const airflowUser = process.env.AIRFLOW_API_USER || 'admin'
  const airflowPass = process.env.AIRFLOW_API_PASS || 'admin'

  const credentials = Buffer.from(`${airflowUser}:${airflowPass}`).toString('base64')

  try {
    const res = await fetch(`${airflowUrl}/api/v1/variables/${key}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${credentials}`,
      },
      body: JSON.stringify({ key, value }),
      // Short timeout — don't block the settings save if Airflow is down
      signal: AbortSignal.timeout(3000),
    })

    if (res.status === 404) {
      await fetch(`${airflowUrl}/api/v1/variables`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${credentials}`,
        },
        body: JSON.stringify({ key, value }),
        signal: AbortSignal.timeout(3000),
      })
      return
    }

    if (!res.ok) {
      throw new Error(`Airflow variable sync failed with status ${res.status}`)
    }
  } catch (err) {
    // Airflow not reachable — log and continue, don't fail the settings save
    console.warn(`Could not sync Airflow variable "${key}":`, (err as Error).message)
  }
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
        include: { replySettings: true },
      }),
      prisma.connection.count({ where: { userId: session.user.id } }),
      prisma.monitoredContent.count({ where: { userId: session.user.id, isMonitored: true } }),
      firestore.collection('comments').where('userId', '==', session.user.id).limit(500).get(),
    ])

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const actionableStatuses = new Set(['pending', 'classified', 'ready_to_post'])
    const commentsAwaitingReview = commentsSnapshot.docs.reduce((count, doc) => {
      return actionableStatuses.has(String(doc.data().status || 'pending')) ? count + 1 : count
    }, 0)

    return NextResponse.json({
      settings: {
        aiTone: user.replySettings?.tone || user.aiTone || 'friendly',
        autoReplyEnabled: user.autoReplyEnabled ?? false,
        replyDelay: user.replyDelay ?? 30,
        maxRepliesPerHour: user.maxRepliesPerHour ?? 10,
        businessContext: user.replySettings?.businessContext || user.businessContext || '',
        notificationEmail: user.notificationEmail || session.user.email || '',
        fetchIntervalMinutes: user.fetchIntervalMinutes ?? 30,
        processIntervalMinutes: user.processIntervalMinutes ?? 60,
        postIntervalMinutes: user.postIntervalMinutes ?? 15,
      },
      stats: {
        connectedPlatforms: connectionsCount,
        monitoredContent: monitoredContentCount,
        commentsAwaitingReview,
      },
    })
  } catch (error) {
    console.error('Error fetching settings:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
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
    const fetchIntervalMinutes = Number(settings?.fetchIntervalMinutes)
    const processIntervalMinutes = Number(settings?.processIntervalMinutes)
    const postIntervalMinutes = Number(settings?.postIntervalMinutes)

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
    if (!Number.isFinite(fetchIntervalMinutes) || fetchIntervalMinutes < 5 || fetchIntervalMinutes > 1440) {
      return NextResponse.json({ error: 'Fetch interval must be between 5 and 1440 minutes' }, { status: 400 })
    }
    if (!Number.isFinite(processIntervalMinutes) || processIntervalMinutes < 5 || processIntervalMinutes > 1440) {
      return NextResponse.json({ error: 'Process interval must be between 5 and 1440 minutes' }, { status: 400 })
    }
    if (!Number.isFinite(postIntervalMinutes) || postIntervalMinutes < 5 || postIntervalMinutes > 1440) {
      return NextResponse.json({ error: 'Post interval must be between 5 and 1440 minutes' }, { status: 400 })
    }

    // Save to PostgreSQL
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
          fetchIntervalMinutes,
          processIntervalMinutes,
          postIntervalMinutes,
        },
      }),
      prisma.replySettings.upsert({
        where: { userId: session.user.id },
        update: { businessContext, tone: aiTone },
        create: {
          userId: session.user.id,
          businessContext,
          tone: aiTone,
          replyToTypes: ['question', 'complaint', 'praise', 'general'],
        },
      }),
    ])

    // Sync intervals to Airflow Variables (best-effort, non-blocking)
    await Promise.all([
      setAirflowVariable('revai_fetch_interval_minutes', String(fetchIntervalMinutes)),
      setAirflowVariable('revai_process_interval_minutes', String(processIntervalMinutes)),
      setAirflowVariable('revai_post_interval_minutes', String(postIntervalMinutes)),
    ])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error saving settings:', error)
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
  }
}
