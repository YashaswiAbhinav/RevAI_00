import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { generateReply } from '@/lib/integrations/gemini'

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

    // For now, we'll generate a reply based on a mock comment
    // In a real implementation, you'd fetch the comment from your database
    const mockComment = {
      text: "Great video! Really helpful content.",
      author: "John Doe",
      platform: "youtube"
    }

    const reply = await generateReply(mockComment.text, mockComment.author, mockComment.platform)

    return NextResponse.json({ reply })

  } catch (error) {
    console.error('Error generating AI reply:', error)
    return NextResponse.json(
      { error: 'Failed to generate AI reply' },
      { status: 500 }
    )
  }
}