'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Eye, Layers3, PlayCircle, Sparkles } from 'lucide-react'

interface ContentItem {
  id: string
  title: string
  description?: string
  publishedAt: string
  thumbnailUrl?: string
  platform: string
  isMonitored: boolean
}

interface Connection {
  id: string
  platform: string
  channelName: string
  channelId: string
}

interface MonitoredItem {
  id: string
  platform: string
  platformContentId: string
  title?: string
  updatedAt: string
}

export default function ContentPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [connections, setConnections] = useState<Connection[]>([])
  const [selectedConnection, setSelectedConnection] = useState<string>('')
  const [content, setContent] = useState<ContentItem[]>([])
  const [monitoredContent, setMonitoredContent] = useState<MonitoredItem[]>([])
  const [loading, setLoading] = useState(false)
  const [savingId, setSavingId] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
    }
  }, [status, router])

  useEffect(() => {
    async function fetchMonitoredContent() {
      try {
        const response = await fetch('/api/content/monitored', { cache: 'no-store' })
        if (response.ok) {
          const data = await response.json()
          setMonitoredContent(data.content)
        }
      } catch (fetchError) {
        console.error('Failed to fetch monitored content:', fetchError)
      }
    }

    async function fetchConnections() {
      try {
        const response = await fetch('/api/connections', { cache: 'no-store' })
        if (response.ok) {
          const data = await response.json()
          const validConnections = data.connections.filter((connection: { status: string }) => connection.status === 'connected')
          setConnections(validConnections)
        }
      } catch (fetchError) {
        console.error('Failed to fetch connections:', fetchError)
      }
    }

    if (session?.user) {
      fetchConnections()
      fetchMonitoredContent()
    }
  }, [session])

  const fetchContent = async (connectionId: string) => {
    setLoading(true)
    try {
      const [contentResponse, monitoredResponse] = await Promise.all([
        fetch(`/api/content?connectionId=${connectionId}`, { cache: 'no-store' }),
        fetch('/api/content/monitored', { cache: 'no-store' }),
      ])

      if (contentResponse.ok) {
        const data = await contentResponse.json()
        let items: ContentItem[] = data.content

        if (monitoredResponse.ok) {
          const monitoredData = await monitoredResponse.json()
          const monitoredIds = new Set((monitoredData.content as MonitoredItem[]).map((item) => item.platformContentId))
          items = items.map((item) => ({ ...item, isMonitored: monitoredIds.has(item.id) }))
          setMonitoredContent(monitoredData.content)
        }

        setContent(items)
      }
    } catch (fetchError) {
      console.error('Failed to fetch content:', fetchError)
    } finally {
      setLoading(false)
    }
  }

  const handleConnectionChange = (connectionId: string) => {
    setSelectedConnection(connectionId)
    if (connectionId) {
      fetchContent(connectionId)
    } else {
      setContent([])
    }
  }

  const refreshMonitoredContent = async () => {
    try {
      const response = await fetch('/api/content/monitored', { cache: 'no-store' })
      if (response.ok) {
        const data = await response.json()
        const monitored: MonitoredItem[] = data.content
        setMonitoredContent(monitored)
        const monitoredIds = new Set(monitored.map((item) => item.platformContentId))
        setContent((previous) => previous.map((item) => ({ ...item, isMonitored: monitoredIds.has(item.id) })))
      }
    } catch (refreshError) {
      console.error('Failed to refresh monitored content:', refreshError)
    }
  }

  const toggleMonitoring = async (item: ContentItem) => {
    setSavingId(item.id)
    setContent((previous) => previous.map((current) =>
      current.id === item.id ? { ...current, isMonitored: !item.isMonitored } : current
    ))

    try {
      const response = await fetch('/api/content/monitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId: selectedConnection,
          contentId: item.id,
          title: item.title,
          isMonitored: !item.isMonitored,
        }),
      })

      if (response.ok) {
        await refreshMonitoredContent()
      } else {
        setContent((previous) => previous.map((current) =>
          current.id === item.id ? { ...current, isMonitored: item.isMonitored } : current
        ))
      }
    } catch (toggleError) {
      console.error('Failed to update monitoring:', toggleError)
      setContent((previous) => previous.map((current) =>
        current.id === item.id ? { ...current, isMonitored: item.isMonitored } : current
      ))
    } finally {
      setSavingId(null)
    }
  }

  const selectedConnectionName = useMemo(
    () => connections.find((connection) => connection.id === selectedConnection)?.channelName || '',
    [connections, selectedConnection]
  )

  if (status === 'loading') {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="rev-panel flex items-center gap-4 px-8 py-6">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-[color:var(--rev-primary)]" />
          <div>
            <p className="text-sm font-semibold text-slate-900">Loading content workspace</p>
            <p className="text-sm text-slate-500">Preparing your monitored content list...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section className="rev-panel-strong px-6 py-8 sm:px-8">
        <div className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
          <div>
            <p className="rev-kicker">Monitoring Scope</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">Choose the exact content RevAI should watch.</h1>
            <p className="mt-4 max-w-2xl text-base leading-8 text-slate-600">
              This screen defines the comment surface for the whole automation pipeline. The cleaner this list is, the easier it is to demo meaningful monitoring, reply generation, and reporting.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rev-stat-card">
              <p className="text-sm text-slate-500">Connected sources</p>
              <p className="mt-3 text-4xl font-semibold text-slate-950">{connections.length}</p>
              <p className="mt-3 text-sm text-slate-500">Platforms currently available for content fetch.</p>
            </div>
            <div className="rev-stat-card">
              <p className="text-sm text-slate-500">Monitored items</p>
              <p className="mt-3 text-4xl font-semibold text-slate-950">{monitoredContent.length}</p>
              <p className="mt-3 text-sm text-slate-500">Assets actively feeding the comment pipeline.</p>
            </div>
            <div className="rev-stat-card">
              <p className="text-sm text-slate-500">Active selection</p>
              <p className="mt-3 text-xl font-semibold text-slate-950">{selectedConnectionName || 'None'}</p>
              <p className="mt-3 text-sm text-slate-500">The source currently loaded in the browser.</p>
            </div>
          </div>
        </div>
      </section>

      {connections.length === 0 ? (
        <div className="rev-panel px-6 py-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="rev-kicker">No Connected Sources</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">You need at least one platform connection first.</h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
                Connect YouTube, Reddit, or Instagram before selecting content to monitor. Once connected, the selector below will populate automatically.
              </p>
            </div>
            <Link href="/dashboard/connections" className="rev-button-primary">
              Connect platforms
            </Link>
          </div>
        </div>
      ) : (
        <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
          <div className="space-y-6">
            <div className="rev-panel p-6">
              <p className="rev-kicker">Source Selector</p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">Pick a connected account</h2>
              <label htmlFor="connection" className="mt-5 block text-sm font-medium text-slate-700">
                Platform connection
              </label>
              <select
                id="connection"
                value={selectedConnection}
                onChange={(event) => handleConnectionChange(event.target.value)}
                className="rev-input mt-2"
              >
                <option value="">Choose a connection...</option>
                {connections.map((connection) => (
                  <option key={connection.id} value={connection.id}>
                    {connection.platform} - {connection.channelName}
                  </option>
                ))}
              </select>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                We fetch available videos, posts, or Reddit submissions from the selected source and let you toggle monitoring with one click.
              </p>
            </div>

            <div className="rev-panel p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="rev-kicker">Monitored Right Now</p>
                  <h2 className="mt-1 text-2xl font-semibold text-slate-950">Current watchlist</h2>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                {monitoredContent.length === 0 ? (
                  <div className="rounded-[1.5rem] border border-dashed border-slate-200 px-5 py-6 text-sm text-slate-500">
                    No content is currently monitored. Select a source and start watching a few strong demo assets.
                  </div>
                ) : monitoredContent.map((item) => (
                  <div key={item.id} className="rounded-[1.5rem] border border-slate-200/70 bg-white/80 px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{item.title || item.platformContentId}</p>
                        <p className="mt-1 text-sm text-slate-500">
                          {item.platform.charAt(0).toUpperCase() + item.platform.slice(1).toLowerCase()} • {new Date(item.updatedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                        Live
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rev-panel p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="rev-kicker">Available Assets</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                  {selectedConnectionName ? `${selectedConnectionName} content library` : 'Select a source to load content'}
                </h2>
              </div>
              {selectedConnection && (
                <div className="rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-sm text-slate-600">
                  {content.filter((item) => item.isMonitored).length} monitored in this source
                </div>
              )}
            </div>

            {!selectedConnection ? (
              <div className="mt-6 rounded-[1.5rem] border border-dashed border-slate-200 px-5 py-10 text-center text-sm text-slate-500">
                Pick a connected platform to browse videos, posts, or Reddit threads available for monitoring.
              </div>
            ) : loading ? (
              <div className="mt-6 flex items-center justify-center py-14">
                <div className="flex items-center gap-4 rounded-[1.5rem] border border-slate-200 bg-white/70 px-6 py-4">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-[color:var(--rev-primary)]" />
                  <span className="text-sm text-slate-600">Loading content from the selected source...</span>
                </div>
              </div>
            ) : content.length === 0 ? (
              <div className="mt-6 rounded-[1.5rem] border border-dashed border-slate-200 px-5 py-10 text-center text-sm text-slate-500">
                No content was returned for this connection yet.
              </div>
            ) : (
              <div className="mt-6 grid gap-4">
                {content.map((item) => (
                  <article key={item.id} className="rounded-[1.75rem] border border-slate-200/70 bg-white/78 p-4 shadow-sm rev-hover-lift">
                    <div className="flex min-w-0 items-start gap-4">
                      <div className="shrink-0">
                        {item.thumbnailUrl ? (
                          <img
                            src={item.thumbnailUrl}
                            alt={item.title}
                            className="h-24 w-32 rounded-2xl object-cover shadow-sm sm:h-28 sm:w-40"
                          />
                        ) : (
                          <div className="flex h-24 w-32 items-center justify-center rounded-2xl bg-slate-950 text-white sm:h-28 sm:w-40">
                            <PlayCircle className="h-8 w-8" />
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white">
                            {item.platform}
                          </span>
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${
                            item.isMonitored
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}>
                            {item.isMonitored ? 'Monitored' : 'Available'}
                          </span>
                        </div>

                        <h3 className="mt-3 text-lg font-semibold text-slate-950">{item.title}</h3>

                        {item.description && (
                          <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">{item.description}</p>
                        )}

                        <div className="mt-3 grid gap-2 text-sm text-slate-500 sm:grid-cols-2">
                          <span className="inline-flex items-center gap-2">
                            <Eye className="h-4 w-4" />
                            {new Date(item.publishedAt).toLocaleDateString()}
                          </span>
                          <span className="inline-flex items-center gap-2 break-all sm:justify-end">
                            <Layers3 className="h-4 w-4 shrink-0" />
                            <span className="truncate">ID: {item.id}</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-col gap-3 rounded-[1.35rem] bg-slate-950/4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="text-sm text-slate-600">
                        {item.isMonitored
                          ? 'Currently feeding the comment pipeline'
                          : 'Not part of the monitored set yet'}
                      </div>

                      <div className="flex w-full sm:w-auto">
                        <button
                          onClick={() => toggleMonitoring(item)}
                          disabled={savingId === item.id}
                          className={`w-full rounded-2xl px-5 py-3 text-sm font-semibold text-white sm:min-w-[190px] ${
                            item.isMonitored
                              ? 'bg-gradient-to-r from-rose-500 to-red-500'
                              : 'bg-gradient-to-r from-[color:var(--rev-primary)] to-[color:var(--rev-primary-strong)]'
                          } disabled:cursor-not-allowed disabled:opacity-60`}
                        >
                          {savingId === item.id
                            ? 'Saving...'
                            : item.isMonitored
                            ? 'Stop monitoring'
                            : 'Start monitoring'}
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      <div className="rev-panel flex items-center gap-3 px-5 py-4 text-sm text-slate-600">
        <Sparkles className="h-4 w-4 text-[color:var(--rev-primary)]" />
        Pick a few representative videos, posts, or Reddit threads for the demo rather than monitoring everything. It makes the comments and reports screens feel much sharper.
      </div>
    </div>
  )
}
