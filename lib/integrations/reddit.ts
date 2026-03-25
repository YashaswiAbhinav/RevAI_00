import axios from 'axios'
import { decryptToken, encryptToken } from '@/lib/security/encryption'
import { prisma } from '@/lib/db/postgres'

type RedditTokenResponse = {
  access_token: string
  token_type: string
  expires_in: number
  scope: string
  refresh_token?: string
}

type RedditUser = {
  id: string
  name: string
  icon_img?: string
}

function toIsoFromUnix(value: number | undefined) {
  if (!value) {
    return new Date().toISOString()
  }

  return new Date(value * 1000).toISOString()
}

export class RedditAPI {
  private authBaseUrl = 'https://www.reddit.com'
  private apiBaseUrl = 'https://oauth.reddit.com'
  private clientId = process.env.REDDIT_CLIENT_ID
  private clientSecret = process.env.REDDIT_CLIENT_SECRET
  private redirectUri = `${process.env.NEXTAUTH_URL}/api/connections/reddit/callback`
  private userAgent = process.env.REDDIT_USER_AGENT || 'revai/1.0'

  private get basicAuthHeader() {
    const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')
    return `Basic ${credentials}`
  }

  private get defaultHeaders() {
    return {
      'User-Agent': this.userAgent,
    }
  }

  private get oauthHeaders() {
    return {
      ...this.defaultHeaders,
      Authorization: this.basicAuthHeader,
      'Content-Type': 'application/x-www-form-urlencoded',
    }
  }

  private async fetchWithAccessToken<T = any>(path: string, accessToken: string, params?: Record<string, unknown>) {
    const response = await axios.get<T>(`${this.apiBaseUrl}${path}`, {
      headers: {
        ...this.defaultHeaders,
        Authorization: `Bearer ${accessToken}`,
      },
      params,
    })

    return response.data
  }

  getAuthUrl(state?: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId || '',
      response_type: 'code',
      state: state || '',
      redirect_uri: this.redirectUri,
      duration: 'permanent',
      scope: 'identity read submit history',
    })

    return `${this.authBaseUrl}/api/v1/authorize?${params.toString()}`
  }

  async getTokens(code: string): Promise<{
    accessToken: string
    refreshToken?: string
    expiresIn: number
  }> {
    const response = await axios.post<RedditTokenResponse>(
      `${this.authBaseUrl}/api/v1/access_token`,
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.redirectUri,
      }),
      {
        headers: this.oauthHeaders,
      }
    )

    return {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      expiresIn: response.data.expires_in,
    }
  }

  async refreshAccessToken(refreshToken: string): Promise<{
    accessToken: string
    expiresIn: number
  }> {
    const response = await axios.post<RedditTokenResponse>(
      `${this.authBaseUrl}/api/v1/access_token`,
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
      {
        headers: this.oauthHeaders,
      }
    )

    return {
      accessToken: response.data.access_token,
      expiresIn: response.data.expires_in,
    }
  }

  async getCurrentUser(accessToken: string): Promise<RedditUser> {
    return this.fetchWithAccessToken<RedditUser>('/api/v1/me', accessToken, {
      raw_json: 1,
    })
  }

  async getUserPosts(accessToken: string, username: string, limit = 50): Promise<Array<{
    id: string
    title: string
    description: string
    publishedAt: string
    thumbnailUrl?: string
    permalink: string
    subreddit: string
    platform: 'reddit'
  }>> {
    const response = await this.fetchWithAccessToken<{
      data?: {
        children?: Array<{ data?: Record<string, any> }>
      }
    }>(`/user/${username}/submitted`, accessToken, {
      limit,
      raw_json: 1,
      sort: 'new',
    })

    return (response.data?.children || []).map((item) => {
      const data = item.data || {}
      const previewImage = data.preview?.images?.[0]?.source?.url
      const thumbnailUrl = typeof data.thumbnail === 'string' && data.thumbnail.startsWith('http')
        ? data.thumbnail
        : previewImage

      return {
        id: String(data.id || ''),
        title: String(data.title || 'Reddit post'),
        description: String(data.selftext || ''),
        publishedAt: toIsoFromUnix(Number(data.created_utc || 0)),
        thumbnailUrl,
        permalink: String(data.permalink || ''),
        subreddit: String(data.subreddit || ''),
        platform: 'reddit' as const,
      }
    }).filter((item) => Boolean(item.id))
  }

  async getPostComments(accessToken: string, postId: string): Promise<Array<{
    id: string
    text: string
    author: {
      name: string
      profileUrl?: string
      avatarUrl?: string
    }
    publishedAt: string
  }>> {
    const response = await this.fetchWithAccessToken<any[]>(`/comments/${postId}`, accessToken, {
      limit: 100,
      sort: 'new',
      raw_json: 1,
    })

    const commentListing = Array.isArray(response) ? response[1] : null
    const children = commentListing?.data?.children || []
    const comments: Array<{
      id: string
      text: string
      author: {
        name: string
        profileUrl?: string
        avatarUrl?: string
      }
      publishedAt: string
    }> = []

    const walk = (items: Array<{ kind?: string; data?: Record<string, any> }>) => {
      for (const item of items) {
        if (item.kind !== 't1') {
          continue
        }

        const data = item.data || {}
        if (typeof data.body !== 'string' || !data.name) {
          continue
        }

        comments.push({
          id: String(data.name),
          text: data.body,
          author: {
            name: String(data.author || 'Unknown'),
            profileUrl: data.author ? `https://www.reddit.com/user/${data.author}` : undefined,
          },
          publishedAt: toIsoFromUnix(Number(data.created_utc || 0)),
        })

        const replies = data.replies?.data?.children
        if (Array.isArray(replies)) {
          walk(replies)
        }
      }
    }

    walk(children)
    return comments
  }

  async postCommentReply(accessToken: string, parentThingId: string, text: string): Promise<{
    id: string
    text: string
  }> {
    const response = await axios.post(
      `${this.apiBaseUrl}/api/comment`,
      new URLSearchParams({
        api_type: 'json',
        thing_id: parentThingId,
        text,
      }),
      {
        headers: {
          ...this.defaultHeaders,
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    )

    const errors = response.data?.json?.errors || []
    if (Array.isArray(errors) && errors.length > 0) {
      throw new Error(`Reddit reply failed: ${errors.map((entry: any) => entry.join(' ')).join(', ')}`)
    }

    const createdThing = response.data?.json?.data?.things?.[0]?.data

    return {
      id: createdThing?.name || parentThingId,
      text: createdThing?.body || text,
    }
  }

  async checkPermissions(accessToken: string, username?: string): Promise<{
    canReadComments: boolean
    canPostReplies: boolean
    errors: string[]
  }> {
    const errors: string[] = []
    let canReadComments = false
    let canPostReplies = false

    try {
      const user = await this.getCurrentUser(accessToken)
      await this.getUserPosts(accessToken, username || user.name, 1)
      canReadComments = true
      canPostReplies = true
    } catch (error: any) {
      errors.push(error.message || 'Permission check failed')
    }

    return {
      canReadComments,
      canPostReplies,
      errors,
    }
  }
}

export const redditAPI = new RedditAPI()

export async function getRedditToken(userId: string): Promise<{
  accessToken: string
  refreshToken?: string
  expiresAt?: Date
}> {
  const connection = await prisma.connection.findFirst({
    where: {
      userId,
      platform: 'REDDIT',
    },
  })

  if (!connection) {
    throw new Error('Reddit connection not found')
  }

  let accessToken = decryptToken(connection.accessToken)
  const refreshToken = connection.refreshToken ? decryptToken(connection.refreshToken) : undefined
  const expiresAt = connection.expiresAt || undefined
  const shouldRefresh = Boolean(
    refreshToken &&
    expiresAt &&
    expiresAt.getTime() <= Date.now() + (5 * 60 * 1000)
  )

  if (shouldRefresh && refreshToken) {
    const refreshed = await redditAPI.refreshAccessToken(refreshToken)
    accessToken = refreshed.accessToken

    await prisma.connection.update({
      where: { id: connection.id },
      data: {
        accessToken: encryptToken(refreshed.accessToken),
        expiresAt: new Date(Date.now() + (refreshed.expiresIn * 1000)),
        updatedAt: new Date(),
      },
    })

    return {
      accessToken,
      refreshToken,
      expiresAt: new Date(Date.now() + (refreshed.expiresIn * 1000)),
    }
  }

  return {
    accessToken,
    refreshToken,
    expiresAt,
  }
}

export async function getRedditContent(accessToken: string, username: string) {
  return redditAPI.getUserPosts(accessToken, username, 50)
}
