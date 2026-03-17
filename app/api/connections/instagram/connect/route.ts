import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { instagramAPI } from '@/lib/integrations/instagram'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Generate OAuth URL with user ID as state
    const authUrl = instagramAPI.getAuthUrl(session.user.id)

    return NextResponse.json({ authUrl })
  } catch (error) {
    console.error('Instagram connect error:', error)
    return NextResponse.json(
      { error: 'Failed to generate authorization URL' },
      { status: 500 }
    )
  }
}
