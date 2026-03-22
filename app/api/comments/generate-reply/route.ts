import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { firestore } from '@/lib/db/firestore'
import { processCommentForAutomation } from '@/lib/comments/automation'

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

    const result = await processCommentForAutomation(comment, session.user.id)

    await commentRef.update({
      classification: result.classification,
      generatedReply: result.reply ? {
        text: result.reply,
        generatedAt: new Date(),
        model: result.model,
      } : null,
      automation: {
        processedAt: new Date(),
        decision: result.reason || null,
      },
      status: result.status,
      updatedAt: new Date(),
    })

    return NextResponse.json({
      reply: result.reply || null,
      classification: result.classification,
      status: result.status,
      model: result.model || null,
      reason: result.reason || null,
    })

  } catch (error) {
    console.error('Error generating AI reply:', error)
    return NextResponse.json(
      { error: 'Failed to generate AI reply' },
      { status: 500 }
    )
  }
}
