import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { firestore } from '@/lib/db/firestore'
import { prisma } from '@/lib/db/postgres'
import { processCommentForAutomation } from '@/lib/comments/automation'

const AUTO_PROCESSABLE_STATUSES = new Set(['pending', 'classified', 'failed'])

export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { autoReplyEnabled: true },
    })

    if (!user?.autoReplyEnabled) {
      return NextResponse.json({
        success: true,
        processed: 0,
        queued: 0,
        skipped: 0,
        autoReplyEnabled: false,
      })
    }

    const snapshot = await firestore
      .collection('comments')
      .where('userId', '==', session.user.id)
      .limit(100)
      .get()

    const candidates = snapshot.docs.filter((doc) => {
      const status = String(doc.data().status || 'pending')
      return AUTO_PROCESSABLE_STATUSES.has(status)
    })

    let processed = 0
    let queued = 0
    let skipped = 0

    for (const doc of candidates) {
      const comment = doc.data()

      try {
        const result = await processCommentForAutomation(comment, session.user.id)

        await doc.ref.update({
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

        processed += 1
        if (result.status === 'ready_to_post') {
          queued += 1
        } else {
          skipped += 1
        }
      } catch (error) {
        console.error(`Failed to auto-process comment ${doc.id}:`, error)
        await doc.ref.update({
          status: 'failed',
          updatedAt: new Date(),
          automation: {
            processedAt: new Date(),
            decision: 'automation_failed',
          },
        })
        processed += 1
        skipped += 1
      }
    }

    return NextResponse.json({
      success: true,
      processed,
      queued,
      skipped,
      autoReplyEnabled: true,
    })
  } catch (error) {
    console.error('Error auto-processing comments:', error)
    return NextResponse.json(
      { error: 'Failed to auto-process comments' },
      { status: 500 }
    )
  }
}
