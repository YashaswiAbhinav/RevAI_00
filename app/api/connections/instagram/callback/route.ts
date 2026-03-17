import { NextRequest, NextResponse } from 'next/server'
import { instagramAPI } from '@/lib/integrations/instagram'
import { prisma } from '@/lib/db/postgres'
import { encryptToken } from '@/lib/security/encryption'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get('code')
    const state = searchParams.get('state') // This should be the user ID
    const error = searchParams.get('error')
    const errorDescription = searchParams.get('error_description')

    if (error) {
      console.error('Instagram OAuth error:', error, errorDescription)
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

    // Exchange code for short-lived token
    const { accessToken: shortLivedToken } = await instagramAPI.getAccessToken(code)

    // Exchange for long-lived token
    const { accessToken: longLivedToken, expiresIn } = await instagramAPI.getLongLivedToken(shortLivedToken)

    // Get user's Instagram accounts
    const accounts = await instagramAPI.getInstagramAccounts(longLivedToken)

    if (accounts.length === 0) {
      return NextResponse.redirect(
        new URL('/dashboard/connections?error=no_instagram_accounts', request.url)
      )
    }

    // Use the first account (in a real app, you might want to let user choose)
    const selectedAccount = accounts[0]

    // Get account details
    const accountInfo = await instagramAPI.getAccountInfo(longLivedToken, selectedAccount.id)

    // Encrypt token before storing
    const encryptedAccessToken = encryptToken(longLivedToken)

    // Calculate expiration date
    const expiresAt = new Date(Date.now() + (expiresIn * 1000))

    // Check if connection already exists
    const existingConnection = await prisma.connection.findFirst({
      where: {
        userId: state,
        platform: 'INSTAGRAM',
      },
    })

    if (existingConnection) {
      // Update existing connection
      await prisma.connection.update({
        where: { id: existingConnection.id },
        data: {
          accessToken: encryptedAccessToken,
          refreshToken: null, // Instagram uses long-lived tokens
          expiresAt,
          channelId: accountInfo.id,
          channelName: accountInfo.username,
          updatedAt: new Date(),
        },
      })
    } else {
      // Create new connection
      await prisma.connection.create({
        data: {
          userId: state,
          platform: 'INSTAGRAM',
          accessToken: encryptedAccessToken,
          refreshToken: null,
          expiresAt,
          channelId: accountInfo.id,
          channelName: accountInfo.username,
        },
      })
    }

    // Redirect to dashboard with success
    return NextResponse.redirect(
      new URL('/dashboard/connections?success=instagram_connected', request.url)
    )

  } catch (error) {
    console.error('Instagram callback error:', error)
    return NextResponse.redirect(
      new URL('/dashboard/connections?error=connection_failed', request.url)
    )
  }
}