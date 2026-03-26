'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AlertTriangle, CheckCircle2, Link2, MessageCircle, Plug2, ShieldCheck, Youtube, Instagram, Facebook } from 'lucide-react'

interface Connection {
  id: string
  platform: string
  channelName: string
  status: string
  errors?: string[]
  permissions: {
    canReadComments: boolean
    canPostReplies: boolean
  }
}

const platformMeta = {
  YOUTUBE: {
    label: 'YouTube',
    description: 'Connect your channel to ingest comments and send AI-generated replies.',
    icon: Youtube,
    tone: 'from-red-500 to-orange-500',
    accent: 'bg-red-50 text-red-700 border-red-200',
  },
  REDDIT: {
    label: 'Reddit',
    description: 'Connect your Reddit account to monitor post discussions and automate replies.',
    icon: MessageCircle,
    tone: 'from-orange-500 to-amber-400',
    accent: 'bg-orange-50 text-orange-700 border-orange-200',
  },
  INSTAGRAM: {
    label: 'Instagram',
    description: 'Attach your business account to monitor posts and automate response flow.',
    icon: Instagram,
    tone: 'from-fuchsia-500 to-orange-400',
    accent: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200',
  },
  FACEBOOK: {
    label: 'Facebook',
    description: 'Reserved for the next integration pass once the current demo scope is settled.',
    icon: Facebook,
    tone: 'from-sky-600 to-blue-500',
    accent: 'bg-sky-50 text-sky-700 border-sky-200',
  },
} as const

export default function ConnectionsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [connections, setConnections] = useState<Connection[]>([])
  const [loading, setLoading] = useState(true)
  const [busyPlatform, setBusyPlatform] = useState<string | null>(null)

  const error = searchParams.get('error')
  const success = searchParams.get('success')

  const errorMessages: Record<string, string> = {
    oauth_failed: 'Google rejected the YouTube authorization request.',
    reddit_oauth_failed: 'Reddit rejected the authorization request.',
    missing_params: 'Google returned an incomplete callback. Please try again.',
    user_not_found: 'Your session could not be matched to a local user.',
    token_exchange_failed: 'Google authorization succeeded, but token exchange failed.',
    youtube_api_not_enabled: 'Google sign-in worked, but YouTube Data API v3 is not enabled for this Google Cloud project yet.',
    no_youtube_channel: 'This Google account does not appear to have a YouTube channel available for this app.',
    insufficient_permissions: 'The app received a token, but YouTube permissions were not sufficient.',
    connection_failed: 'YouTube connection failed after the callback. Check the server log for details.',
    reddit_connection_failed: 'Reddit connection failed after the callback. Check the server log for details.',
  }

  const successMessages: Record<string, string> = {
    youtube_connected: 'YouTube connected successfully.',
    reddit_connected: 'Reddit connected successfully.',
    instagram_connected: 'Instagram connected successfully.',
  }

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
    }
  }, [status, router])

  useEffect(() => {
    async function fetchConnections() {
      try {
        const response = await fetch('/api/connections', { cache: 'no-store' })
        if (response.ok) {
          const data = await response.json()
          setConnections(data.connections)
        }
      } catch (fetchError) {
        console.error('Failed to fetch connections:', fetchError)
      } finally {
        setLoading(false)
      }
    }

    if (session?.user) {
      fetchConnections()
    }
  }, [session])

  const connectedCount = useMemo(
    () => connections.filter((connection) => connection.status === 'connected').length,
    [connections]
  )

  const handleConnect = async (platform: 'youtube' | 'reddit' | 'instagram') => {
    setBusyPlatform(platform.toUpperCase())
    try {
      const response = await fetch(`/api/connections/${platform}/connect`)
      const data = await response.json()
      if (data.authUrl) {
        window.location.href = data.authUrl
      }
    } catch (connectError) {
      console.error(`Failed to connect ${platform}:`, connectError)
    } finally {
      setBusyPlatform(null)
    }
  }

  const handleDisconnect = async (platform: 'YOUTUBE' | 'REDDIT' | 'INSTAGRAM') => {
    setBusyPlatform(platform)
    try {
      const response = await fetch(`/api/connections/${platform.toLowerCase()}/disconnect`, {
        method: 'DELETE',
      })
      if (response.ok) {
        window.location.reload()
      }
    } catch (disconnectError) {
      console.error(`Failed to disconnect ${platform}:`, disconnectError)
      setBusyPlatform(null)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="rev-panel flex items-center gap-4 px-8 py-6">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-[color:var(--rev-primary)]" />
          <div>
            <p className="text-sm font-semibold text-slate-900">Loading connections</p>
            <p className="text-sm text-slate-500">Checking your connected platforms...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section className="rev-panel-strong px-6 py-8 sm:px-8">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="rev-kicker">Platform Setup</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">Connect the channels your workflow depends on.</h1>
            <p className="mt-4 max-w-2xl text-base leading-8 text-slate-600">
              This screen is the first mile of RevAI. Once a connection is live, the rest of the product can fetch content, monitor comments, generate replies, and feed the reporting pipeline.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rev-stat-card">
              <p className="text-sm text-slate-500">Connected platforms</p>
              <p className="mt-3 text-4xl font-semibold text-slate-950">{connectedCount}</p>
              <p className="mt-3 text-sm text-slate-500">Healthy integrations available to the rest of the workflow.</p>
            </div>
            <div className="rev-stat-card">
              <p className="text-sm text-slate-500">OAuth readiness</p>
              <p className="mt-3 text-4xl font-semibold text-slate-950">Live</p>
              <p className="mt-3 text-sm text-slate-500">Connection callbacks, permissions, and token storage are already wired.</p>
            </div>
          </div>
        </div>
      </section>

      {error && (
        <div className="rev-panel flex items-start gap-3 border-red-200 bg-red-50/80 px-5 py-4 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-none" />
          <div>{errorMessages[error] || `Connection error: ${error}`}</div>
        </div>
      )}

      {success && (
        <div className="rev-panel flex items-start gap-3 border-emerald-200 bg-emerald-50/80 px-5 py-4 text-sm text-emerald-700">
          <CheckCircle2 className="mt-0.5 h-5 w-5 flex-none" />
          <div>{successMessages[success] || success}</div>
        </div>
      )}

      <section className="grid gap-6 xl:grid-cols-3">
        {(['YOUTUBE', 'REDDIT', 'INSTAGRAM', 'FACEBOOK'] as const).map((platformKey) => {
          const meta = platformMeta[platformKey]
          const Icon = meta.icon
          const connection = connections.find((item) => item.platform === platformKey)
          const isBusy = busyPlatform === platformKey
          const isComingSoon = platformKey === 'FACEBOOK'

          return (
            <article
              key={platformKey}
              className={`rev-panel-strong flex flex-col overflow-hidden ${isComingSoon ? 'opacity-80' : ''}`}
            >
              <div className={`h-2 w-full bg-gradient-to-r ${meta.tone}`} />
              <div className="flex flex-1 flex-col p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className={`flex h-14 w-14 items-center justify-center rounded-3xl bg-gradient-to-r ${meta.tone} text-white shadow-lg`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${meta.accent}`}>
                    {connection?.status || (isComingSoon ? 'Coming soon' : 'Ready')}
                  </span>
                </div>

                <div className="mt-5">
                  <h2 className="text-2xl font-semibold text-slate-950">{meta.label}</h2>
                  <p className="mt-2 text-sm leading-7 text-slate-600">{meta.description}</p>
                </div>

                <div className="mt-6 flex-1 rounded-[1.5rem] border border-slate-200/70 bg-white/70 p-4">
                  {connection ? (
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{connection.channelName || 'Connected account'}</p>
                        <p className="mt-1 text-sm text-slate-500">Status: {connection.status}</p>
                      </div>

                      <div className="grid gap-3">
                        <div className="flex items-center justify-between rounded-2xl bg-slate-950/4 px-4 py-3">
                          <span className="text-sm text-slate-600">Read comments</span>
                          <span className="text-sm font-semibold text-slate-950">
                            {connection.permissions.canReadComments ? 'Enabled' : 'Missing'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between rounded-2xl bg-slate-950/4 px-4 py-3">
                          <span className="text-sm text-slate-600">Post replies</span>
                          <span className="text-sm font-semibold text-slate-950">
                            {connection.permissions.canPostReplies ? 'Enabled' : 'Missing'}
                          </span>
                        </div>
                      </div>

                      {connection.errors && connection.errors.length > 0 && (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                          {connection.errors[0]}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex h-full flex-col justify-between gap-4">
                      <div className="flex items-start gap-3 text-sm text-slate-600">
                        <ShieldCheck className="mt-0.5 h-5 w-5 flex-none text-[color:var(--rev-secondary)]" />
                        <p>Once connected, this account becomes available to the content, comments, and automation screens automatically.</p>
                      </div>
                      <div className="rounded-2xl bg-slate-950 px-4 py-4 text-sm text-slate-300">
                        OAuth callback, encrypted token storage, and permission checks are already handled in the app.
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-6">
                  {isComingSoon ? (
                    <button disabled className="rev-button-secondary w-full cursor-not-allowed opacity-60">
                      <Plug2 className="h-4 w-4" />
                      Facebook coming soon
                    </button>
                  ) : connection ? (
                    <button
                      onClick={() => handleDisconnect(platformKey)}
                      disabled={isBusy}
                      className="rev-button-danger w-full disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isBusy ? 'Disconnecting...' : `Disconnect ${meta.label}`}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleConnect(
                        platformKey === 'YOUTUBE'
                          ? 'youtube'
                          : platformKey === 'REDDIT'
                          ? 'reddit'
                          : 'instagram'
                      )}
                      disabled={isBusy}
                      className="rev-button-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Link2 className="h-4 w-4" />
                      {isBusy ? 'Redirecting...' : `Connect ${meta.label}`}
                    </button>
                  )}
                </div>
              </div>
            </article>
          )
        })}
      </section>
    </div>
  )
}
