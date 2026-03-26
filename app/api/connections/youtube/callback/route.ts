import { NextRequest, NextResponse } from 'next/server'
import { youtubeAPI } from '@/lib/integrations/youtube'
import { prisma } from '@/lib/db/postgres'
import { encryptToken } from '@/lib/security/encryption'

export const dynamic = 'force-dynamic'

function redirectWithError(request: NextRequest, errorCode: string) {
  return NextResponse.redirect(
    new URL(`/dashboard/connections?error=${errorCode}`, request.url)
  )
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const state = searchParams.get('state') // This should be the user ID
    const error = searchParams.get('error')

    if (error) {
      console.error('YouTube OAuth error:', error)
      return redirectWithError(request, 'oauth_failed')
    }

    if (!code || !state) {
      return redirectWithError(request, 'missing_params')
    }

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: state }
    })

    if (!user) {
      return redirectWithError(request, 'user_not_found')
    }

    // Exchange code for tokens
    const tokens = await youtubeAPI.getTokens(code)

    if (!tokens.access_token) {
      return redirectWithError(request, 'token_exchange_failed')
    }

    // Get channel information
    const channelInfo = await youtubeAPI.getChannelInfo(tokens.access_token)

    // Encrypt tokens before storing
    const encryptedAccessToken = encryptToken(tokens.access_token)
    const encryptedRefreshToken = tokens.refresh_token
      ? encryptToken(tokens.refresh_token)
      : null

    // Calculate expiration date (tokens are typically valid for 1 hour)
    const expiresAt = tokens.expiry_date
      ? new Date(tokens.expiry_date)
      : new Date(Date.now() + 3600000) // 1 hour from now

    // Check if connection already exists
    const existingConnection = await prisma.connection.findFirst({
      where: {
        userId: state,
        platform: 'YOUTUBE',
      },
    })

    if (existingConnection) {
      // Update existing connection
      await prisma.connection.update({
        where: { id: existingConnection.id },
        data: {
          accessToken: encryptedAccessToken,
          refreshToken: encryptedRefreshToken ?? existingConnection.refreshToken,
          expiresAt,
          channelId: channelInfo.id,
          channelName: channelInfo.title,
          updatedAt: new Date(),
        },
      })
    } else {
      // Create new connection
      await prisma.connection.create({
        data: {
          userId: state,
          platform: 'YOUTUBE',
          accessToken: encryptedAccessToken,
          refreshToken: encryptedRefreshToken,
          expiresAt,
          channelId: channelInfo.id,
          channelName: channelInfo.title,
        },
      })
    }

    // Redirect to dashboard with success
    return NextResponse.redirect(
      new URL('/dashboard/connections?success=youtube_connected', request.url)
    )

  } catch (error: any) {
    console.error('YouTube callback error:', error)

    const message = String(error?.message || '')
    const errors = Array.isArray(error?.errors) ? error.errors : []
    const hasAccessNotConfigured = errors.some(
      (item: any) => item?.reason === 'accessNotConfigured'
    )

    if (hasAccessNotConfigured || message.includes('YouTube Data API v3 has not been used')) {
      return redirectWithError(request, 'youtube_api_not_enabled')
    }

    if (message.includes('No channel found')) {
      return redirectWithError(request, 'no_youtube_channel')
    }

    if (message.includes('insufficient permissions')) {
      return redirectWithError(request, 'insufficient_permissions')
    }

    if (message.includes('invalid_grant')) {
      return redirectWithError(request, 'token_exchange_failed')
    }

    return redirectWithError(request, 'connection_failed')
  }
}
