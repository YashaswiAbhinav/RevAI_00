'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

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
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
    }
  }, [status, router])

  useEffect(() => {
    async function fetchMonitoredContent() {
      try {
        const response = await fetch('/api/content/monitored')
        if (response.ok) {
          const data = await response.json()
          setMonitoredContent(data.content)
        }
      } catch (error) {
        console.error('Failed to fetch monitored content:', error)
      }
    }

    async function fetchConnections() {
      try {
        const response = await fetch('/api/connections')
        if (response.ok) {
          const data = await response.json()
          const validConnections = data.connections.filter((c: any) => c.status === 'connected')
          setConnections(validConnections)
        }
      } catch (error) {
        console.error('Failed to fetch connections:', error)
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
        // Sync isMonitored from DB in case API didn't return it correctly
        if (monitoredResponse.ok) {
          const monitoredData = await monitoredResponse.json()
          const monitoredIds = new Set((monitoredData.content as MonitoredItem[]).map(m => m.platformContentId))
          items = items.map(c => ({ ...c, isMonitored: monitoredIds.has(c.id) }))
          setMonitoredContent(monitoredData.content)
        }
        setContent(items)
      }
    } catch (error) {
      console.error('Failed to fetch content:', error)
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
        // Sync isMonitored flag on the visible content list from DB truth
        const monitoredIds = new Set(monitored.map((m) => m.platformContentId))
        setContent(prev => prev.map(c => ({ ...c, isMonitored: monitoredIds.has(c.id) })))
      }
    } catch (error) {
      console.error('Failed to refresh monitored content:', error)
    }
  }

  const toggleMonitoring = async (item: ContentItem) => {
    setSaving(true)
    // Optimistic update
    setContent(prev => prev.map(c =>
      c.id === item.id ? { ...c, isMonitored: !item.isMonitored } : c
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
        // Revert optimistic update on failure
        setContent(prev => prev.map(c =>
          c.id === item.id ? { ...c, isMonitored: item.isMonitored } : c
        ))
      }
    } catch (error) {
      console.error('Failed to update monitoring:', error)
      // Revert optimistic update
      setContent(prev => prev.map(c =>
        c.id === item.id ? { ...c, isMonitored: item.isMonitored } : c
      ))
    } finally {
      setSaving(false)
    }
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
        <h1 className="text-2xl font-bold text-gray-900">Content Selection</h1>
        <p className="mt-1 text-sm text-gray-600">
          Choose which videos and posts you want to monitor for comments.
        </p>
      </div>

      {/* Connection Selector */}
      <div className="bg-white shadow rounded-lg p-6">
        <label htmlFor="connection" className="block text-sm font-medium text-gray-700 mb-2">
          Select Platform Connection
        </label>
        <select
          id="connection"
          value={selectedConnection}
          onChange={(e) => handleConnectionChange(e.target.value)}
          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
        >
          <option value="">Choose a connection...</option>
          {connections.map((connection) => (
            <option key={connection.id} value={connection.id}>
              {connection.platform} - {connection.channelName}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
          Currently Monitored Content
        </h3>

        {monitoredContent.length === 0 ? (
          <p className="text-sm text-gray-500">
            No content is currently being monitored.
          </p>
        ) : (
          <div className="space-y-3">
            {monitoredContent.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {item.title || item.platformContentId}
                  </p>
                  <p className="text-xs text-gray-500">
                    {item.platform.charAt(0).toUpperCase() + item.platform.slice(1).toLowerCase()} • {item.platformContentId}
                  </p>
                </div>
                <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                  Monitored
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Content List */}
      {selectedConnection && (
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
              Available Content
            </h3>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-2 text-sm text-gray-600">Loading content...</span>
              </div>
            ) : content.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                No content found for this connection.
              </p>
            ) : (
              <div className="space-y-4">
                {content.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-center space-x-4">
                      {item.thumbnailUrl && (
                        <img
                          src={item.thumbnailUrl}
                          alt={item.title}
                          className="w-16 h-16 object-cover rounded"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-gray-900 truncate">
                          {item.title}
                        </h4>
                        <p className="text-sm text-gray-500 truncate">
                          {item.description}
                        </p>
                        <p className="text-xs text-gray-400">
                          {new Date(item.publishedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        item.isMonitored
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {item.isMonitored ? 'Monitored' : 'Not Monitored'}
                      </span>

                      <button
                        onClick={() => toggleMonitoring(item)}
                        disabled={saving}
                        className={`px-4 py-2 text-sm font-medium rounded-md ${
                          item.isMonitored
                            ? 'bg-red-600 text-white hover:bg-red-700'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {saving ? 'Saving...' : item.isMonitored ? 'Stop Monitoring' : 'Start Monitoring'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {connections.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">
                No connections available
              </h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>
                  You need to connect at least one social media account before you can select content to monitor.
                  <a href="/dashboard/connections" className="font-medium underline text-yellow-700 hover:text-yellow-600">
                    Go to connections →
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
