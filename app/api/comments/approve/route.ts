import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { firestore } from '@/lib/db/firestore'
import { isLegacyFallbackReply } from '@/lib/integrations/gemini'

export const dynamic = 'force-dynamic'

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

    const commentRef = firestore.collection('comments').doc(commentId)
    const commentSnapshot = await commentRef.get()
    if (!commentSnapshot.exists) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
    }

    const comment = commentSnapshot.data()
    if (!comment || comment.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (!comment.generatedReply?.text) {
      return NextResponse.json({ error: 'Generate a reply before queueing it' }, { status: 400 })
    }

    if (isLegacyFallbackReply(comment.generatedReply.text)) {
      return NextResponse.json(
        { error: 'This reply was generated from an outdated fallback. Retry generation before queueing it.' },
        { status: 409 }
      )
    }

    if (comment.status === 'replied') {
      return NextResponse.json({ error: 'Comment has already been posted' }, { status: 409 })
    }

    await commentRef.update({
      status: 'ready_to_post',
      updatedAt: new Date(),
    })

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error approving reply:', error)
    return NextResponse.json(
      { error: 'Failed to approve reply' },
      { status: 500 }
    )
  }
}
