import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { commentId } = await request.json()

    if (!commentId) {
      return NextResponse.json({ error: 'Comment ID required' }, { status: 400 })
    }

    // In a real implementation, you would:
    // 1. Update the comment status in your database to 'rejected'
    // 2. Optionally log the rejection reason

    // For now, just return success
    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error rejecting reply:', error)
    return NextResponse.json(
      { error: 'Failed to reject reply' },
      { status: 500 }
    )
  }
}