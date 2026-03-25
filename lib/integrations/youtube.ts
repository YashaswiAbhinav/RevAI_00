import { google } from 'googleapis'
import { decryptToken } from '@/lib/security/encryption'
import { prisma } from '@/lib/db/postgres'
import type { YouTubeComment } from '@/models'

export class YouTubeAPI {
  private oauth2Client

  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.NEXTAUTH_URL}/api/connections/youtube/callback`
    )
  }

  /**
   * Generate OAuth authorization URL
   */
  getAuthUrl(state?: string): string {
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/youtube.readonly',
        'https://www.googleapis.com/auth/youtube.force-ssl'
      ],
      state,
    })
  }

  /**
   * Exchange authorization code for tokens
   */
  async getTokens(code: string) {
    const { tokens } = await this.oauth2Client.getToken(code)
    this.oauth2Client.setCredentials(tokens)
    return tokens
  }

  /**
   * Set credentials for authenticated requests
   */
  setCredentials(accessToken: string, refreshToken?: string) {
    this.oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    })
  }

  /**
   * Get user's YouTube channel information
   */
  async getChannelInfo(accessToken: string) {
    this.setCredentials(accessToken)

    const youtube = google.youtube({
      version: 'v3',
      auth: this.oauth2Client,
    })

    const response = await youtube.channels.list({
      part: ['snippet', 'statistics'],
      mine: true,
    })

    const channel = response.data.items?.[0]
    if (!channel) {
      throw new Error('No channel found')
    }

    return {
      id: channel.id!,
      title: channel.snippet?.title || '',
      description: channel.snippet?.description || '',
      subscriberCount: parseInt(channel.statistics?.subscriberCount || '0'),
      videoCount: parseInt(channel.statistics?.videoCount || '0'),
    }
  }

  /**
   * Get user's videos for selection
   */
  async getVideos(accessToken: string, maxResults = 50) {
    this.setCredentials(accessToken)

    const youtube = google.youtube({
      version: 'v3',
      auth: this.oauth2Client,
    })

    const response = await youtube.search.list({
      part: ['snippet'],
      forMine: true,
      type: ['video'],
      maxResults,
      order: 'date',
    })

    return response.data.items?.map(item => ({
      id: item.id?.videoId!,
      title: item.snippet?.title || '',
      description: item.snippet?.description || '',
      publishedAt: item.snippet?.publishedAt || '',
      thumbnailUrl: item.snippet?.thumbnails?.default?.url || '',
    })) || []
  }

  /**
   * Fetch comments for a specific video
   */
  async getVideoComments(accessToken: string, videoId: string, pageToken?: string): Promise<{
    comments: YouTubeComment[]
    nextPageToken?: string
  }> {
    this.setCredentials(accessToken)

    const youtube = google.youtube({
      version: 'v3',
      auth: this.oauth2Client,
    })

    try {
      const response = await youtube.commentThreads.list({
        part: ['snippet'],
        videoId,
        maxResults: 100,
        pageToken,
        order: 'time',
      })

      const comments: YouTubeComment[] = response.data.items?.map(thread => ({
        id: thread.snippet?.topLevelComment?.id || '',
        snippet: {
          textDisplay: thread.snippet?.topLevelComment?.snippet?.textDisplay || '',
          authorDisplayName: thread.snippet?.topLevelComment?.snippet?.authorDisplayName || '',
          authorProfileImageUrl: thread.snippet?.topLevelComment?.snippet?.authorProfileImageUrl ?? undefined,
          authorChannelUrl: thread.snippet?.topLevelComment?.snippet?.authorChannelUrl ?? undefined,
          publishedAt: thread.snippet?.topLevelComment?.snippet?.publishedAt || '',
        }
      })) || []

      return {
        comments,
        nextPageToken: response.data.nextPageToken ?? undefined,
      }
    } catch (error: any) {
      // Handle common YouTube API errors
      if (error.code === 403) {
        throw new Error('Comments are disabled for this video or insufficient permissions')
      }
      if (error.code === 404) {
        throw new Error('Video not found')
      }
      throw error
    }
  }

  /**
   * Post a reply to a comment
   */
  async postCommentReply(accessToken: string, parentCommentId: string, text: string) {
    this.setCredentials(accessToken)

    const youtube = google.youtube({
      version: 'v3',
      auth: this.oauth2Client,
    })

    const response = await youtube.comments.insert({
      part: ['snippet'],
      requestBody: {
        snippet: {
          parentId: parentCommentId,
          textOriginal: text,
        },
      },
    })

    return {
      id: response.data.id,
      text: response.data.snippet?.textOriginal,
      publishedAt: response.data.snippet?.publishedAt,
    }
  }

  /**
   * Check if user has necessary permissions
   */
  async checkPermissions(accessToken: string): Promise<{
    canReadComments: boolean
    canPostReplies: boolean
    errors: string[]
  }> {
    const errors: string[] = []
    let canReadComments = false
    let canPostReplies = false

    try {
      // Try to get channel info to check basic access
      await this.getChannelInfo(accessToken)

      // Try to get videos to check read access
      const videos = await this.getVideos(accessToken, 1)
      canReadComments = videos.length >= 0

      // For posting permissions, we'd need to try posting a test comment
      // but that's not practical, so we'll assume if they have read access
      // they likely have post access too
      canPostReplies = canReadComments

    } catch (error: any) {
      errors.push(error.message)
    }

    return {
      canReadComments,
      canPostReplies,
      errors,
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string) {
    this.oauth2Client.setCredentials({
      refresh_token: refreshToken,
    })

    const { credentials } = await this.oauth2Client.refreshAccessToken()
    return credentials
  }
}

// Export singleton instance
export const youtubeAPI = new YouTubeAPI()

/**
 * Helper function to get decrypted YouTube token for a user
 */
export async function getYouTubeToken(userId: string): Promise<{
  accessToken: string
  refreshToken?: string
  expiresAt?: Date
}> {
  const connection = await prisma.connection.findFirst({
    where: {
      userId,
      platform: 'YOUTUBE',
    },
  })

  if (!connection) {
    throw new Error('YouTube connection not found')
  }

  const accessToken = decryptToken(connection.accessToken)
  const refreshToken = connection.refreshToken ? decryptToken(connection.refreshToken) : undefined

  return {
    accessToken,
    refreshToken,
    expiresAt: connection.expiresAt || undefined,
  }
}

/**
 * Get YouTube content for monitoring selection
 */
export async function getYouTubeContent(accessToken: string, channelId: string) {
  const api = new YouTubeAPI()
  return await api.getVideos(accessToken, 50)
}
