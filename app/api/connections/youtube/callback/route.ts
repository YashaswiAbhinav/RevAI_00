import { NextRequest, NextResponse } from 'next/server'
import { youtubeAPI } from '@/lib/integrations/youtube'
import { prisma } from '@/lib/db/postgres'
import { encryptToken } from '@/lib/security/encryption'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const state = searchParams.get('state') // This should be the user ID
    const error = searchParams.get('error')

    if (error) {
      console.error('YouTube OAuth error:', error)
      return NextResponse.redirect(
        new URL('/dashboard/connections?error=oauth_failed', request.url)
      )
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL('/dashboard/connections?error=missing_params', request.url)
      )
    }

    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: state }
    })

    if (!user) {
      return NextResponse.redirect(
        new URL('/dashboard/connections?error=user_not_found', request.url)
      )
    }

    // Exchange code for tokens
    const tokens = await youtubeAPI.getTokens(code)

    if (!tokens.access_token) {
      return NextResponse.redirect(
        new URL('/dashboard/connections?error=token_exchange_failed', request.url)
      )
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
          refreshToken: encryptedRefreshToken,
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

  } catch (error) {
    console.error('YouTube callback error:', error)
    return NextResponse.redirect(
      new URL('/dashboard/connections?error=connection_failed', request.url)
    )
  }
}