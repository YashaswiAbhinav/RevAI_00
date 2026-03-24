'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Bell, Bot, Clock3, Mail, Save, Sparkles, UserRound, Workflow } from 'lucide-react'

interface Settings {
  aiTone: 'professional' | 'friendly' | 'casual'
  autoReplyEnabled: boolean
  replyDelay: number
  maxRepliesPerHour: number
  businessContext: string
  notificationEmail: string
  fetchIntervalMinutes: number
  processIntervalMinutes: number
  postIntervalMinutes: number
}

interface SettingsStats {
  connectedPlatforms: number
  monitoredContent: number
  commentsAwaitingReview: number
}

export default function SettingsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [settings, setSettings] = useState<Settings>({
    aiTone: 'friendly',
    autoReplyEnabled: false,
    replyDelay: 30,
    maxRepliesPerHour: 10,
    businessContext: '',
    notificationEmail: '',
    fetchIntervalMinutes: 30,
    processIntervalMinutes: 60,
    postIntervalMinutes: 15,
  })
  const [saving, setSaving] = useState(false)
  const [loadingSettings, setLoadingSettings] = useState(true)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [stats, setStats] = useState<SettingsStats>({
    connectedPlatforms: 0,
    monitoredContent: 0,
    commentsAwaitingReview: 0,
  })

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
    }
  }, [status, router])

  useEffect(() => {
    if (session?.user) {
      loadSettings()
    }
  }, [session])

  const loadSettings = async () => {
    setLoadingSettings(true)
    setErrorMessage(null)
    try {
      const response = await fetch('/api/settings', { cache: 'no-store' })
      if (response.ok) {
        const data = await response.json()
        setSettings((previous) => ({ ...previous, ...data.settings }))
        setStats(data.stats)
      } else {
        const data = await response.json().catch(() => ({}))
        setErrorMessage(data.error || 'Failed to load settings.')
      }
    } catch (loadError) {
      console.error('Failed to load settings:', loadError)
      setErrorMessage('Failed to load settings.')
    } finally {
      setLoadingSettings(false)
    }
  }

  const saveSettings = async () => {
    setSaving(true)
    setSaveMessage(null)
    setErrorMessage(null)
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ settings }),
      })

      if (response.ok) {
        setSaveMessage('Settings saved successfully.')
      } else {
        const data = await response.json().catch(() => ({}))
        setErrorMessage(data.error || 'Failed to save settings.')
      }
    } catch (saveError) {
      console.error('Failed to save settings:', saveError)
      setErrorMessage('Failed to save settings. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleInputChange = (field: keyof Settings, value: string | number | boolean) => {
    setSettings((previous) => ({ ...previous, [field]: value }))
  }

  if (status === 'loading') {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="rev-panel flex items-center gap-4 px-8 py-6">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-[color:var(--rev-primary)]" />
          <div>
            <p className="text-sm font-semibold text-slate-900">Loading settings</p>
            <p className="text-sm text-slate-500">Preparing your automation preferences...</p>
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
            <p className="rev-kicker">Automation Controls</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">Tune how RevAI speaks, schedules, and behaves.</h1>
            <p className="mt-4 max-w-2xl text-base leading-8 text-slate-600">
              Settings turn the app from a working prototype into a controlled demo. This is where tone, delay, limits, notification routing, and schedule cadence become explicit and explainable.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rev-stat-card">
              <p className="text-sm text-slate-500">Connected platforms</p>
              <p className="mt-3 text-4xl font-semibold text-slate-950">{stats.connectedPlatforms}</p>
            </div>
            <div className="rev-stat-card">
              <p className="text-sm text-slate-500">Monitored content</p>
              <p className="mt-3 text-4xl font-semibold text-slate-950">{stats.monitoredContent}</p>
            </div>
            <div className="rev-stat-card">
              <p className="text-sm text-slate-500">Comments in pipeline</p>
              <p className="mt-3 text-4xl font-semibold text-slate-950">{stats.commentsAwaitingReview}</p>
            </div>
          </div>
        </div>
      </section>

      {errorMessage && (
        <div className="rev-panel border-red-200 bg-red-50/80 px-5 py-4 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      {saveMessage && (
        <div className="rev-panel border-emerald-200 bg-emerald-50/80 px-5 py-4 text-sm text-emerald-700">
          {saveMessage}
        </div>
      )}

      {loadingSettings ? (
        <div className="rev-panel flex items-center justify-center gap-4 px-6 py-14">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-[color:var(--rev-primary)]" />
          <span className="text-sm text-slate-600">Loading your saved preferences...</span>
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <section className="rev-panel p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <p className="rev-kicker">AI Profile</p>
                  <h2 className="mt-1 text-2xl font-semibold text-slate-950">Voice and response behavior</h2>
                </div>
              </div>

              <div className="mt-6 grid gap-5">
                <label className="space-y-2 text-sm font-medium text-slate-700">
                  AI reply tone
                  <select
                    value={settings.aiTone}
                    onChange={(event) => handleInputChange('aiTone', event.target.value)}
                    className="rev-input"
                  >
                    <option value="professional">Professional</option>
                    <option value="friendly">Friendly</option>
                    <option value="casual">Casual</option>
                  </select>
                </label>

                <label className="space-y-2 text-sm font-medium text-slate-700">
                  Business context
                  <textarea
                    value={settings.businessContext}
                    onChange={(event) => handleInputChange('businessContext', event.target.value)}
                    rows={5}
                    className="rev-input"
                    placeholder="Describe your brand, products, audience, and how you want replies to feel."
                  />
                </label>

                <div className="rounded-[1.5rem] border border-slate-200/70 bg-slate-950 px-5 py-4 text-white">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold">Automatic replies</p>
                      <p className="mt-1 text-sm text-slate-300">
                        When enabled, eligible comments are generated and queued without manual approval.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleInputChange('autoReplyEnabled', !settings.autoReplyEnabled)}
                      className={`relative h-8 w-14 rounded-full ${
                        settings.autoReplyEnabled ? 'bg-emerald-400' : 'bg-white/20'
                      }`}
                      aria-pressed={settings.autoReplyEnabled}
                    >
                      <span
                        className={`absolute top-1 h-6 w-6 rounded-full bg-white transition ${
                          settings.autoReplyEnabled ? 'left-7' : 'left-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-2 text-sm font-medium text-slate-700">
                    Reply delay (minutes)
                    <input
                      type="number"
                      value={settings.replyDelay}
                      onChange={(event) => handleInputChange('replyDelay', parseInt(event.target.value))}
                      min="0"
                      max="1440"
                      className="rev-input"
                    />
                  </label>

                  <label className="space-y-2 text-sm font-medium text-slate-700">
                    Max replies per hour
                    <input
                      type="number"
                      value={settings.maxRepliesPerHour}
                      onChange={(event) => handleInputChange('maxRepliesPerHour', parseInt(event.target.value))}
                      min="1"
                      max="100"
                      className="rev-input"
                    />
                  </label>
                </div>
              </div>
            </section>

            <section className="rev-panel p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[color:var(--rev-primary)] text-white">
                  <Workflow className="h-5 w-5" />
                </div>
                <div>
                  <p className="rev-kicker">Automation Schedule</p>
                  <h2 className="mt-1 text-2xl font-semibold text-slate-950">How often the pipeline runs</h2>
                </div>
              </div>

              <div className="mt-6 grid gap-4">
                <label className="space-y-2 text-sm font-medium text-slate-700">
                  Fetch comments interval (minutes)
                  <input
                    type="number"
                    value={settings.fetchIntervalMinutes}
                    onChange={(event) => handleInputChange('fetchIntervalMinutes', parseInt(event.target.value))}
                    min="5"
                    max="1440"
                    className="rev-input"
                  />
                </label>

                <label className="space-y-2 text-sm font-medium text-slate-700">
                  Process &amp; generate interval (minutes)
                  <input
                    type="number"
                    value={settings.processIntervalMinutes}
                    onChange={(event) => handleInputChange('processIntervalMinutes', parseInt(event.target.value))}
                    min="5"
                    max="1440"
                    className="rev-input"
                  />
                </label>

                <label className="space-y-2 text-sm font-medium text-slate-700">
                  Post replies interval (minutes)
                  <input
                    type="number"
                    value={settings.postIntervalMinutes}
                    onChange={(event) => handleInputChange('postIntervalMinutes', parseInt(event.target.value))}
                    min="5"
                    max="1440"
                    className="rev-input"
                  />
                </label>
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <section className="rev-panel p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[color:var(--rev-secondary)] text-white">
                  <Bell className="h-5 w-5" />
                </div>
                <div>
                  <p className="rev-kicker">Notifications</p>
                  <h2 className="mt-1 text-2xl font-semibold text-slate-950">Where operational updates go</h2>
                </div>
              </div>

              <label className="mt-6 block space-y-2 text-sm font-medium text-slate-700">
                <span className="inline-flex items-center gap-2">
                  <Mail className="h-4 w-4 text-slate-400" />
                  Notification email
                </span>
                <input
                  type="email"
                  value={settings.notificationEmail}
                  onChange={(event) => handleInputChange('notificationEmail', event.target.value)}
                  className="rev-input"
                  placeholder="your@email.com"
                />
              </label>
            </section>

            <section className="rev-panel p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white">
                  <Clock3 className="h-5 w-5" />
                </div>
                <div>
                  <p className="rev-kicker">Live Summary</p>
                  <h2 className="mt-1 text-2xl font-semibold text-slate-950">Current operating posture</h2>
                </div>
              </div>

              <div className="mt-6 grid gap-3">
                {[
                  { label: 'Mode', value: settings.autoReplyEnabled ? 'Automatic queueing' : 'Manual review' },
                  { label: 'Tone', value: settings.aiTone },
                  { label: 'Delay', value: `${settings.replyDelay} min` },
                  { label: 'Hourly cap', value: `${settings.maxRepliesPerHour} replies` },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between rounded-2xl bg-slate-950/4 px-4 py-3 text-sm">
                    <span className="text-slate-600">{item.label}</span>
                    <span className="font-semibold text-slate-950">{item.value}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rev-panel p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,var(--rev-primary),var(--rev-primary-strong))] text-white">
                  <UserRound className="h-5 w-5" />
                </div>
                <div>
                  <p className="rev-kicker">Account</p>
                  <h2 className="mt-1 text-2xl font-semibold text-slate-950">Identity and workspace ownership</h2>
                </div>
              </div>

              <div className="mt-6 space-y-4 text-sm">
                <div className="rounded-[1.5rem] border border-slate-200/70 bg-white/78 px-4 py-4">
                  <p className="text-slate-500">Email</p>
                  <p className="mt-1 font-semibold text-slate-950">{session?.user?.email}</p>
                </div>
                <div className="rounded-[1.5rem] border border-slate-200/70 bg-white/78 px-4 py-4">
                  <p className="text-slate-500">Name</p>
                  <p className="mt-1 font-semibold text-slate-950">{session?.user?.name || 'Not set'}</p>
                </div>
                <div className="rounded-[1.5rem] border border-dashed border-slate-200 px-4 py-4 text-slate-500">
                  Account deletion is intentionally disabled for the current demo phase.
                </div>
              </div>
            </section>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <button
          onClick={saveSettings}
          disabled={saving || loadingSettings}
          className="rev-button-primary disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Save className="h-4 w-4" />
          {saving ? 'Saving...' : 'Save settings'}
        </button>
      </div>

      <div className="rev-panel flex items-center gap-3 px-5 py-4 text-sm text-slate-600">
        <Sparkles className="h-4 w-4 text-[color:var(--rev-primary)]" />
        Keep this page presentation-ready. It explains the automation system clearly when someone asks how the app is controlled.
      </div>
    </div>
  )
}
