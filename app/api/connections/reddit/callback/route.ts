import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/postgres'
import { encryptToken } from '@/lib/security/encryption'
import { redditAPI } from '@/lib/integrations/reddit'

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
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    if (error) {
      console.error('Reddit OAuth error:', error)
      return redirectWithError(request, 'reddit_oauth_failed')
    }

    if (!code || !state) {
      return redirectWithError(request, 'missing_params')
    }

    const user = await prisma.user.findUnique({
      where: { id: state },
    })

    if (!user) {
      return redirectWithError(request, 'user_not_found')
    }

    const tokens = await redditAPI.getTokens(code)
    const account = await redditAPI.getCurrentUser(tokens.accessToken)

    const encryptedAccessToken = encryptToken(tokens.accessToken)
    const encryptedRefreshToken = tokens.refreshToken
      ? encryptToken(tokens.refreshToken)
      : null
    const expiresAt = new Date(Date.now() + (tokens.expiresIn * 1000))

    const existingConnection = await prisma.connection.findFirst({
      where: {
        userId: state,
        platform: 'REDDIT',
      },
    })

    const data = {
      accessToken: encryptedAccessToken,
      refreshToken: encryptedRefreshToken,
      expiresAt,
      channelId: account.name,
      channelName: `u/${account.name}`,
      updatedAt: new Date(),
    }

    if (existingConnection) {
      await prisma.connection.update({
        where: { id: existingConnection.id },
        data,
      })
    } else {
      await prisma.connection.create({
        data: {
          userId: state,
          platform: 'REDDIT',
          ...data,
        },
      })
    }

    return NextResponse.redirect(
      new URL('/dashboard/connections?success=reddit_connected', request.url)
    )
  } catch (error) {
    console.error('Reddit callback error:', error)
    return redirectWithError(request, 'reddit_connection_failed')
  }
}
