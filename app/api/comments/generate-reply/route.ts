import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db/postgres'
import { firestore } from '@/lib/db/firestore'
import { classifyComment } from '@/lib/integrations/gemini'
import { generateReply } from '@/lib/integrations/gemini'

const ACTIVE_GEMINI_MODEL =
  process.env.GEMINI_MODEL || 'gemini-2.5-flash'

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

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        businessContext: true,
      },
    })

    const classification = await classifyComment(comment.text || '')
    const reply = await generateReply(
      comment.text || '',
      comment.author?.name || 'Customer',
      comment.platform || 'youtube',
      user?.businessContext || undefined
    )

    await commentRef.update({
      classification,
      generatedReply: {
        text: reply,
        generatedAt: new Date(),
        model: ACTIVE_GEMINI_MODEL,
      },
      status: 'classified',
      updatedAt: new Date(),
    })

    return NextResponse.json({
      reply,
      classification,
      status: 'classified',
      model: ACTIVE_GEMINI_MODEL,
    })

  } catch (error) {
    console.error('Error generating AI reply:', error)
    return NextResponse.json(
      { error: 'Failed to generate AI reply' },
      { status: 500 }
    )
  }
}
