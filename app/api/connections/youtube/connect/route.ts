import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { youtubeAPI } from '@/lib/integrations/youtube'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Generate OAuth URL with user ID as state for callback identification
    const authUrl = youtubeAPI.getAuthUrl(session.user.id)

    return NextResponse.json({ authUrl })
  } catch (error) {
    console.error('YouTube connect error:', error)
    return NextResponse.json(
      { error: 'Failed to generate authorization URL' },
      { status: 500 }
    )
  }
}
