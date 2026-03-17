import axios from 'axios'
import { decryptToken } from '@/lib/security/encryption'
import { prisma } from '@/lib/db/postgres'
import type { InstagramComment } from '@/models'

export class InstagramAPI {
  private baseURL = 'https://graph.facebook.com/v18.0'
  private clientId = process.env.META_APP_ID
  private clientSecret = process.env.META_APP_SECRET

  /**
   * Generate OAuth authorization URL for Instagram
   */
  getAuthUrl(state?: string): string {
    const scopes = [
      'instagram_basic',
      'instagram_content_publish',
      'instagram_manage_comments',
      'pages_read_engagement',
      'pages_show_list'
    ].join(',')

    return `https://www.facebook.com/v18.0/dialog/oauth?` +
           `client_id=${this.clientId}&` +
           `redirect_uri=${encodeURIComponent(`${process.env.NEXTAUTH_URL}/api/connections/instagram/callback`)}&` +
           `scope=${encodeURIComponent(scopes)}&` +
           `response_type=code&` +
           `${state ? `state=${encodeURIComponent(state)}` : ''}`
  }

  /**
   * Exchange authorization code for access token
   */
  async getAccessToken(code: string): Promise<{
    accessToken: string
    userId: string
  }> {
    const response = await axios.get(`${this.baseURL}/oauth/access_token`, {
      params: {
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: `${process.env.NEXTAUTH_URL}/api/connections/instagram/callback`,
        code,
      },
    })

    return {
      accessToken: response.data.access_token,
      userId: response.data.user_id || '',
    }
  }

  /**
   * Get long-lived access token (valid for 60 days)
   */
  async getLongLivedToken(shortLivedToken: string): Promise<{
    accessToken: string
    expiresIn: number
  }> {
    const response = await axios.get(`${this.baseURL}/oauth/access_token`, {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        fb_exchange_token: shortLivedToken,
      },
    })

    return {
      accessToken: response.data.access_token,
      expiresIn: response.data.expires_in || 5184000, // 60 days in seconds
    }
  }

  /**
   * Get user's Instagram accounts
   */
  async getInstagramAccounts(accessToken: string): Promise<{
    id: string
    name: string
    username: string
  }[]> {
    // First get Facebook pages
    const pagesResponse = await axios.get(`${this.baseURL}/me/accounts`, {
      params: { access_token: accessToken },
    })

    const accounts: any[] = []

    for (const page of pagesResponse.data.data) {
      try {
        // Check if page has Instagram account
        const igResponse = await axios.get(`${this.baseURL}/${page.id}`, {
          params: {
            fields: 'instagram_business_account{id,name,username}',
            access_token: accessToken,
          },
        })

        if (igResponse.data.instagram_business_account) {
          accounts.push({
            id: igResponse.data.instagram_business_account.id,
            name: igResponse.data.instagram_business_account.name,
            username: igResponse.data.instagram_business_account.username,
          })
        }
      } catch (error) {
        // Page doesn't have Instagram account, skip
        continue
      }
    }

    return accounts
  }

  /**
   * Get Instagram account info
   */
  async getAccountInfo(accessToken: string, accountId: string): Promise<{
    id: string
    name: string
    username: string
    followersCount: number
    mediaCount: number
  }> {
    const response = await axios.get(`${this.baseURL}/${accountId}`, {
      params: {
        fields: 'id,name,username,followers_count,media_count',
        access_token: accessToken,
      },
    })

    const data = response.data
    return {
      id: data.id,
      name: data.name,
      username: data.username,
      followersCount: data.followers_count || 0,
      mediaCount: data.media_count || 0,
    }
  }

  /**
   * Get user's media/posts
   */
  async getMedia(accessToken: string, accountId: string, limit = 50): Promise<{
    id: string
    mediaType: string
    mediaUrl: string
    permalink: string
    caption?: string
    timestamp: string
  }[]> {
    const response = await axios.get(`${this.baseURL}/${accountId}/media`, {
      params: {
        fields: 'id,media_type,media_url,permalink,caption,timestamp',
        access_token: accessToken,
        limit,
      },
    })

    return response.data.data.map((item: any) => ({
      id: item.id,
      mediaType: item.media_type,
      mediaUrl: item.media_url,
      permalink: item.permalink,
      caption: item.caption,
      timestamp: item.timestamp,
    }))
  }

  /**
   * Get comments for a specific media
   */
  async getMediaComments(accessToken: string, mediaId: string): Promise<{
    comments: InstagramComment[]
    next?: string
  }> {
    try {
      const response = await axios.get(`${this.baseURL}/${mediaId}/comments`, {
        params: {
          fields: 'id,text,username,timestamp,replies{id,text,username,timestamp}',
          access_token: accessToken,
          limit: 100,
        },
      })

      const comments: InstagramComment[] = response.data.data.map((comment: any) => ({
        id: comment.id,
        text: comment.text,
        username: comment.username,
        timestamp: comment.timestamp,
      }))

      return {
        comments,
        next: response.data.paging?.next,
      }
    } catch (error: any) {
      if (error.response?.status === 403) {
        throw new Error('Comments are disabled for this post or insufficient permissions')
      }
      if (error.response?.status === 400) {
        throw new Error('Invalid media ID or access token')
      }
      throw error
    }
  }

  /**
   * Post a reply to a comment
   */
  async postCommentReply(accessToken: string, commentId: string, message: string): Promise<{
    id: string
    text: string
    timestamp: string
  }> {
    const response = await axios.post(`${this.baseURL}/${commentId}/replies`, {
      message,
      access_token: accessToken,
    })

    return {
      id: response.data.id,
      text: response.data.text || message,
      timestamp: response.data.timestamp || new Date().toISOString(),
    }
  }

  /**
   * Check if user has necessary permissions
   */
  async checkPermissions(accessToken: string, accountId: string): Promise<{
    canReadComments: boolean
    canPostReplies: boolean
    errors: string[]
  }> {
    const errors: string[] = []
    let canReadComments = false
    let canPostReplies = false

    try {
      // Try to get account info
      await this.getAccountInfo(accessToken, accountId)

      // Try to get media to check basic access
      const media = await this.getMedia(accessToken, accountId, 1)
      canReadComments = media.length >= 0

      // For posting permissions, we could try a test reply
      // but that's not practical, so assume if they can read, they can post
      canPostReplies = canReadComments

    } catch (error: any) {
      errors.push(error.message || 'Permission check failed')
    }

    return {
      canReadComments,
      canPostReplies,
      errors,
    }
  }

  /**
   * Refresh long-lived token
   */
  async refreshToken(currentToken: string): Promise<{
    accessToken: string
    expiresIn: number
  }> {
    return this.getLongLivedToken(currentToken)
  }
}

// Export singleton instance
export const instagramAPI = new InstagramAPI()

/**
 * Helper function to get decrypted Instagram token for a user
 */
export async function getInstagramToken(userId: string): Promise<{
  accessToken: string
  refreshToken?: string
  expiresAt?: Date
}> {
  const connection = await prisma.connection.findFirst({
    where: {
      userId,
      platform: 'INSTAGRAM',
    },
  })

  if (!connection) {
    throw new Error('Instagram connection not found')
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
 * Get Instagram content for monitoring selection
 */
export async function getInstagramContent(accessToken: string, accountId: string) {
  const api = new InstagramAPI()
  const media = await api.getMedia(accessToken, accountId, 50)

  return media.map(item => ({
    id: item.id,
    title: item.caption || 'Instagram Post',
    description: item.caption || '',
    publishedAt: item.timestamp,
    thumbnailUrl: item.mediaUrl,
    platform: 'instagram',
  }))
}