'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

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
      // Load user settings
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
        setSettings(prev => ({ ...prev, ...data.settings }))
        setStats(data.stats)
      } else {
        const data = await response.json().catch(() => ({}))
        setErrorMessage(data.error || 'Failed to load settings.')
      }
    } catch (error) {
      console.error('Failed to load settings:', error)
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
    } catch (error) {
      console.error('Failed to save settings:', error)
      setErrorMessage('Failed to save settings. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleInputChange = (field: keyof Settings, value: string | number | boolean) => {
    setSettings(prev => ({ ...prev, [field]: value }))
  }

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-600">
          Configure your AI reply preferences and automation settings.
        </p>
      </div>

      {errorMessage && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      {saveMessage && (
        <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {saveMessage}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-lg bg-white p-5 shadow">
          <p className="text-sm text-gray-500">Connected Platforms</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">{stats.connectedPlatforms}</p>
        </div>
        <div className="rounded-lg bg-white p-5 shadow">
          <p className="text-sm text-gray-500">Monitored Content</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">{stats.monitoredContent}</p>
        </div>
        <div className="rounded-lg bg-white p-5 shadow">
          <p className="text-sm text-gray-500">Comments Awaiting Review</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">{stats.commentsAwaitingReview}</p>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          {loadingSettings ? (
            <div className="flex items-center justify-center py-10">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-sm text-gray-600">Loading settings...</span>
            </div>
          ) : (
            <div className="space-y-6">
              {/* AI Tone */}
              <div>
                <label htmlFor="aiTone" className="block text-sm font-medium text-gray-700">
                  AI Reply Tone
                </label>
                <select
                  id="aiTone"
                  value={settings.aiTone}
                  onChange={(e) => handleInputChange('aiTone', e.target.value)}
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                >
                  <option value="professional">Professional</option>
                  <option value="friendly">Friendly</option>
                  <option value="casual">Casual</option>
                </select>
                <p className="mt-1 text-sm text-gray-500">
                  Choose the tone for AI-generated replies.
                </p>
              </div>

              {/* Auto Reply */}
              <div className="flex items-center">
                <input
                  id="autoReplyEnabled"
                  type="checkbox"
                  checked={settings.autoReplyEnabled}
                  onChange={(e) => handleInputChange('autoReplyEnabled', e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="autoReplyEnabled" className="ml-2 block text-sm text-gray-900">
                  Enable automatic replies (Phase 6 feature)
                </label>
              </div>

              {/* Reply Delay */}
              <div>
                <label htmlFor="replyDelay" className="block text-sm font-medium text-gray-700">
                  Reply Delay (minutes)
                </label>
                <input
                  type="number"
                  id="replyDelay"
                  value={settings.replyDelay}
                  onChange={(e) => handleInputChange('replyDelay', parseInt(e.target.value))}
                  min="0"
                  max="1440"
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
                <p className="mt-1 text-sm text-gray-500">
                  Delay before posting AI-generated replies.
                </p>
              </div>

              {/* Max Replies Per Hour */}
              <div>
                <label htmlFor="maxRepliesPerHour" className="block text-sm font-medium text-gray-700">
                  Max Replies Per Hour
                </label>
                <input
                  type="number"
                  id="maxRepliesPerHour"
                  value={settings.maxRepliesPerHour}
                  onChange={(e) => handleInputChange('maxRepliesPerHour', parseInt(e.target.value))}
                  min="1"
                  max="100"
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
                <p className="mt-1 text-sm text-gray-500">
                  Maximum number of automated replies per hour to avoid spam detection.
                </p>
              </div>

              {/* Business Context */}
              <div>
                <label htmlFor="businessContext" className="block text-sm font-medium text-gray-700">
                  Business Context
                </label>
                <textarea
                  id="businessContext"
                  value={settings.businessContext}
                  onChange={(e) => handleInputChange('businessContext', e.target.value)}
                  rows={4}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="Describe your business, products, or services to help the AI generate more relevant replies..."
                />
                <p className="mt-1 text-sm text-gray-500">
                  This context helps the AI understand your business for better replies.
                </p>
              </div>

              {/* Notification Email */}
              <div>
                <label htmlFor="notificationEmail" className="block text-sm font-medium text-gray-700">
                  Notification Email
                </label>
                <input
                  type="email"
                  id="notificationEmail"
                  value={settings.notificationEmail}
                  onChange={(e) => handleInputChange('notificationEmail', e.target.value)}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="your@email.com"
                />
                <p className="mt-1 text-sm text-gray-500">
                  Email address for important notifications and reports.
                </p>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={saveSettings}
                  disabled={saving}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* DAG Schedule Settings */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-1">Automation Schedule</h3>
          <p className="text-sm text-gray-500 mb-6">
            Control how often each Airflow pipeline runs. Changes are saved to the database and synced to Airflow automatically. The new schedule takes effect on the next DAG parse (within ~30 seconds after saving).
          </p>

          {loadingSettings ? (
            <div className="flex items-center justify-center py-10">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <label htmlFor="fetchIntervalMinutes" className="block text-sm font-medium text-gray-700">
                  Fetch Comments Interval (minutes)
                </label>
                <input
                  type="number"
                  id="fetchIntervalMinutes"
                  value={settings.fetchIntervalMinutes}
                  onChange={(e) => handleInputChange('fetchIntervalMinutes', parseInt(e.target.value))}
                  min="5"
                  max="1440"
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
                <p className="mt-1 text-sm text-gray-500">
                  How often to pull new comments from YouTube/Instagram. Default: 30 min.
                </p>
              </div>

              <div>
                <label htmlFor="processIntervalMinutes" className="block text-sm font-medium text-gray-700">
                  Process &amp; Generate Replies Interval (minutes)
                </label>
                <input
                  type="number"
                  id="processIntervalMinutes"
                  value={settings.processIntervalMinutes}
                  onChange={(e) => handleInputChange('processIntervalMinutes', parseInt(e.target.value))}
                  min="5"
                  max="1440"
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
                <p className="mt-1 text-sm text-gray-500">
                  How often Gemini AI classifies comments and generates replies. Default: 60 min.
                </p>
              </div>

              <div>
                <label htmlFor="postIntervalMinutes" className="block text-sm font-medium text-gray-700">
                  Post Replies Interval (minutes)
                </label>
                <input
                  type="number"
                  id="postIntervalMinutes"
                  value={settings.postIntervalMinutes}
                  onChange={(e) => handleInputChange('postIntervalMinutes', parseInt(e.target.value))}
                  min="5"
                  max="1440"
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
                <p className="mt-1 text-sm text-gray-500">
                  How often approved replies are posted back to platforms. Default: 15 min.
                </p>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={saveSettings}
                  disabled={saving}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Account Settings */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Account Settings</h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <p className="mt-1 text-sm text-gray-900">{session?.user?.email}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <p className="mt-1 text-sm text-gray-900">{session?.user?.name}</p>
            </div>

            <div className="pt-4">
              <button
                disabled
                className="inline-flex items-center px-3 py-2 border border-red-200 shadow-sm text-sm leading-4 font-medium rounded-md text-red-400 bg-white cursor-not-allowed"
              >
                Delete Account Coming Soon
              </button>
              <p className="mt-1 text-xs text-gray-500">
                Account deletion has not been implemented yet, so this control is intentionally disabled.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
