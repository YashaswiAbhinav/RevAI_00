'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

interface Connection {
  id: string
  platform: string
  channelName: string
  status: string
  permissions: {
    canReadComments: boolean
    canPostReplies: boolean
  }
}

export default function ConnectionsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [connections, setConnections] = useState<Connection[]>([])
  const [loading, setLoading] = useState(true)

  const error = searchParams.get('error')
  const success = searchParams.get('success')

  const errorMessages: Record<string, string> = {
    oauth_failed: 'Google rejected the YouTube authorization request.',
    missing_params: 'Google returned an incomplete callback. Please try again.',
    user_not_found: 'Your session could not be matched to a local user.',
    token_exchange_failed: 'Google authorization succeeded, but token exchange failed.',
    youtube_api_not_enabled: 'Google sign-in worked, but YouTube Data API v3 is not enabled for this Google Cloud project yet.',
    no_youtube_channel: 'This Google account does not appear to have a YouTube channel available for this app.',
    insufficient_permissions: 'The app received a token, but YouTube permissions were not sufficient.',
    connection_failed: 'YouTube connection failed after the callback. Check the server log for details.',
  }

  const successMessages: Record<string, string> = {
    youtube_connected: 'YouTube connected successfully.',
  }

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
    }
  }, [status, router])

  useEffect(() => {
    async function fetchConnections() {
      try {
        const response = await fetch('/api/connections')
        if (response.ok) {
          const data = await response.json()
          setConnections(data.connections)
        }
      } catch (error) {
        console.error('Failed to fetch connections:', error)
      } finally {
        setLoading(false)
      }
    }

    if (session?.user) {
      fetchConnections()
    }
  }, [session])

  const handleConnect = async (platform: string) => {
    try {
      const response = await fetch(`/api/connections/${platform.toLowerCase()}/connect`)
      const data = await response.json()
      if (data.authUrl) {
        window.location.href = data.authUrl
      }
    } catch (error) {
      console.error(`Failed to connect ${platform}:`, error)
    }
  }

  const handleDisconnect = async (platform: string) => {
    try {
      const response = await fetch(`/api/connections/${platform.toLowerCase()}/disconnect`, {
        method: 'DELETE',
      })
      if (response.ok) {
        // Refresh connections
        window.location.reload()
      }
    } catch (error) {
      console.error(`Failed to disconnect ${platform}:`, error)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Platform Connections</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect your social media accounts to start monitoring comments.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessages[error] || `Connection error: ${error}`}
        </div>
      )}

      {success && (
        <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {successMessages[success] || success}
        </div>
      )}

      {/* Connection Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {/* YouTube Card */}
        <div className="bg-card overflow-hidden shadow rounded-lg gradient-card">
          <div className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-medium text-foreground">YouTube</h3>
                <p className="text-sm text-muted-foreground">Connect your YouTube channel</p>
              </div>
            </div>

            <div className="mt-6">
              {(() => {
                const youtubeConnection = connections.find(c => c.platform === 'YOUTUBE')
                if (youtubeConnection) {
                  return (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">
                          {youtubeConnection.channelName}
                        </span>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          youtubeConnection.status === 'connected'
                            ? 'bg-green-100 text-green-800'
                            : youtubeConnection.status === 'expired'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {youtubeConnection.status}
                        </span>
                      </div>

                      <div className="text-xs text-muted-foreground space-y-1">
                        <div>Read Comments: {youtubeConnection.permissions.canReadComments ? '✅' : '❌'}</div>
                        <div>Post Replies: {youtubeConnection.permissions.canPostReplies ? '✅' : '❌'}</div>
                      </div>

                      <button
                        onClick={() => handleDisconnect('YOUTUBE')}
                        className="w-full bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-red-700"
                      >
                        Disconnect
                      </button>
                    </div>
                  )
                } else {
                  return (
                    <button
                      onClick={() => handleConnect('youtube')}
                      className="w-full bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-red-700"
                    >
                      Connect YouTube
                    </button>
                  )
                }
              })()}
            </div>
          </div>
        </div>

        {/* Instagram Card */}
        <div className="bg-card overflow-hidden shadow rounded-lg gradient-card">
          <div className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-medium text-foreground">Instagram</h3>
                <p className="text-sm text-muted-foreground">Connect your Instagram account</p>
              </div>
            </div>

            <div className="mt-6">
              {(() => {
                const instagramConnection = connections.find(c => c.platform === 'INSTAGRAM')
                if (instagramConnection) {
                  return (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">
                          @{instagramConnection.channelName}
                        </span>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          instagramConnection.status === 'connected'
                            ? 'bg-green-100 text-green-800'
                            : instagramConnection.status === 'expired'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {instagramConnection.status}
                        </span>
                      </div>

                      <div className="text-xs text-muted-foreground space-y-1">
                        <div>Read Comments: {instagramConnection.permissions.canReadComments ? '✅' : '❌'}</div>
                        <div>Post Replies: {instagramConnection.permissions.canPostReplies ? '✅' : '❌'}</div>
                      </div>

                      <button
                        onClick={() => handleDisconnect('INSTAGRAM')}
                        className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-2 rounded-md text-sm font-medium hover:from-purple-600 hover:to-pink-600"
                      >
                        Disconnect
                      </button>
                    </div>
                  )
                } else {
                  return (
                    <button
                      onClick={() => handleConnect('instagram')}
                      className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-2 rounded-md text-sm font-medium hover:from-purple-600 hover:to-pink-600"
                    >
                      Connect Instagram
                    </button>
                  )
                }
              })()}
            </div>
          </div>
        </div>

        {/* Facebook Card (Coming Soon) */}
        <div className="bg-card overflow-hidden shadow rounded-lg gradient-card opacity-50">
          <div className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-medium text-foreground">Facebook</h3>
                <p className="text-sm text-muted-foreground">Coming soon</p>
              </div>
            </div>

            <div className="mt-6">
              <button
                disabled
                className="w-full bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium opacity-50 cursor-not-allowed"
              >
                Connect Facebook
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
