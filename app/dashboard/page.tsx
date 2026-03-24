import Link from 'next/link'
import { getServerSession } from 'next-auth/next'
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bot,
  CircleEllipsis,
  Link2,
  PlaySquare,
  Settings2,
} from 'lucide-react'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db/postgres'
import { firestoreService } from '@/lib/db/firestore'

type RecentComment = {
  id: string
  text?: string
  status?: string
  platform?: string
  author?: {
    name?: string
  }
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return null
  }

  const results = await Promise.allSettled([
    prisma.connection.findMany({
      where: { userId: session.user.id },
      select: {
        id: true,
        platform: true,
        channelName: true,
        expiresAt: true,
      },
    }),
    prisma.monitoredContent.count({
      where: { userId: session.user.id, isMonitored: true },
    }),
    firestoreService.getCollection('comments', [
      { field: 'userId', operator: '==', value: session.user.id },
    ], 6),
    prisma.replySettings.findUnique({
      where: { userId: session.user.id },
      select: {
        minConfidenceScore: true,
        tone: true,
      },
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        autoReplyEnabled: true,
        fetchIntervalMinutes: true,
        processIntervalMinutes: true,
        postIntervalMinutes: true,
      },
    }),
  ])

  const [
    connectionsResult,
    monitoredContentCountResult,
    recentCommentsRawResult,
    replySettingsResult,
    userResult,
  ] = results

  const connections = connectionsResult.status === 'fulfilled' ? connectionsResult.value : []
  const monitoredContentCount = monitoredContentCountResult.status === 'fulfilled' ? monitoredContentCountResult.value : 0
  const recentCommentsRaw = recentCommentsRawResult.status === 'fulfilled' ? recentCommentsRawResult.value : []
  const replySettings = replySettingsResult.status === 'fulfilled' ? replySettingsResult.value : null
  const user = userResult.status === 'fulfilled' ? userResult.value : null

  const postgresUnavailable =
    connectionsResult.status === 'rejected' ||
    monitoredContentCountResult.status === 'rejected' ||
    replySettingsResult.status === 'rejected' ||
    userResult.status === 'rejected'
  const firestoreUnavailable = recentCommentsRawResult.status === 'rejected'

  const recentComments = (recentCommentsRaw as RecentComment[]).map((comment) => ({
    id: comment.id,
    text: comment.text || 'Untitled comment',
    status: comment.status || 'pending',
    platform: (comment.platform || 'unknown').toLowerCase(),
    authorName: comment.author?.name || 'Unknown author',
  }))

  const queuedCount = recentComments.filter((comment) => comment.status === 'ready_to_post').length
  const postedCount = recentComments.filter((comment) => comment.status === 'replied').length
  const quickActions = [
    {
      href: '/dashboard/connections',
      title: 'Connect platforms',
      description: 'Add YouTube or Instagram and verify permissions.',
      icon: Link2,
    },
    {
      href: '/dashboard/content',
      title: 'Select content',
      description: 'Choose the exact videos or posts to monitor.',
      icon: PlaySquare,
    },
    {
      href: '/dashboard/comments',
      title: 'Review pipeline',
      description: 'Watch statuses move from incoming to queued to posted.',
      icon: CircleEllipsis,
    },
    {
      href: '/dashboard/reports',
      title: 'Open reports',
      description: 'Read trends, top questions, and sentiment summaries.',
      icon: BarChart3,
    },
    {
      href: '/dashboard/settings',
      title: 'Tune automation',
      description: 'Adjust tone, limits, delay, and schedule intervals.',
      icon: Settings2,
    },
  ]

  return (
    <div className="space-y-6">
      {(postgresUnavailable || firestoreUnavailable) && (
        <div className="rev-panel flex items-start gap-3 border-amber-200 bg-amber-50/85 px-5 py-4 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-none" />
          <div>
            <p className="font-semibold">Some services are unavailable right now.</p>
            <p className="mt-1 leading-6">
              {postgresUnavailable ? 'PostgreSQL could not be reached, so some dashboard metrics are showing fallback values. ' : ''}
              {firestoreUnavailable ? 'Firestore could not be reached, so recent comment activity is temporarily unavailable.' : ''}
            </p>
          </div>
        </div>
      )}

      <section className="rev-panel-strong overflow-hidden px-6 py-8 sm:px-8">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
          <div>
            <p className="rev-kicker">Operations Overview</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
              Welcome back, {session.user.name || session.user.email}.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-8 text-slate-600">
              Your workspace is live. This view keeps the whole RevAI flow visible, from platform connection and monitored content to queued replies and reporting rhythm.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <div className="rev-tag">
                <Bot className="h-3.5 w-3.5" />
                {user?.autoReplyEnabled ? 'Auto replies enabled' : 'Manual review mode'}
              </div>
              <div className="rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-sm text-slate-600">
                Tone: {replySettings?.tone || 'friendly'}
              </div>
              <div className="rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-sm text-slate-600">
                Confidence: {replySettings?.minConfidenceScore ? `${Math.round(replySettings.minConfidenceScore * 100)}%` : '70%'}
              </div>
            </div>
          </div>

          <div className="rounded-[1.75rem] bg-slate-950 p-5 text-white shadow-[0_26px_50px_rgba(15,23,42,0.24)]">
            <p className="rev-kicker !text-white/60">Automation Rhythm</p>
            <div className="mt-5 grid gap-3">
              {[
                { label: 'Fetch interval', value: `${user?.fetchIntervalMinutes ?? 30} min` },
                { label: 'Process interval', value: `${user?.processIntervalMinutes ?? 60} min` },
                { label: 'Post interval', value: `${user?.postIntervalMinutes ?? 15} min` },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <span className="text-sm text-slate-300">{item.label}</span>
                  <span className="text-sm font-semibold text-white">{item.value}</span>
                </div>
              ))}
            </div>
            <Link href="/dashboard/settings" className="rev-button-primary mt-5 w-full">
              Refine schedules
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <section className="rev-grid">
        {[
          {
            label: 'Connected platforms',
            value: connections.length,
            note: connections.length > 0 ? connections.map((connection) => connection.platform.toLowerCase()).join(', ') : 'No channels connected yet',
          },
          {
            label: 'Monitored content',
            value: monitoredContentCount,
            note: 'Assets currently watched for new comments.',
          },
          {
            label: 'Queued replies',
            value: queuedCount,
            note: 'Recent comments ready to be posted.',
          },
          {
            label: 'Recently posted',
            value: postedCount,
            note: 'Replies marked as posted in recent activity.',
          },
        ].map((item) => (
          <div key={item.label} className="rev-stat-card">
            <p className="text-sm text-slate-500">{item.label}</p>
            <p className="mt-3 text-4xl font-semibold text-slate-950">{item.value}</p>
            <p className="mt-3 text-sm leading-6 text-slate-500">{item.note}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="rev-panel p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="rev-kicker">Recent Pipeline Activity</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">Latest comment movement</h2>
            </div>
            <Link href="/dashboard/comments" className="rev-button-secondary">
              Open comments
            </Link>
          </div>

          <div className="mt-6 space-y-3">
            {recentComments.length > 0 ? recentComments.map((comment) => (
              <div key={comment.id} className="rounded-[1.5rem] border border-slate-200/70 bg-white/80 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{comment.authorName}</p>
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">{comment.text}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white">
                      {comment.platform}
                    </span>
                    <span className="rounded-full bg-[rgba(255,123,84,0.12)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--rev-primary-strong)]">
                      {comment.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>
              </div>
            )) : (
              <div className="rev-empty">
                No comments have reached this workspace yet. Connect a platform and monitor content to start the pipeline.
              </div>
            )}
          </div>
        </div>

        <div className="rev-panel p-6">
          <p className="rev-kicker">Quick Actions</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">Move the demo forward</h2>
          <div className="mt-6 grid gap-3">
            {quickActions.map((action) => {
              const Icon = action.icon
              return (
                <Link
                  key={action.href}
                  href={action.href}
                  className="group rounded-[1.5rem] border border-slate-200/70 bg-white/80 p-4 hover:border-orange-200 hover:bg-white"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-sm font-semibold text-slate-950">{action.title}</h3>
                        <ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-950" />
                      </div>
                      <p className="mt-1 text-sm leading-6 text-slate-600">{action.description}</p>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      </section>
    </div>
  )
}
