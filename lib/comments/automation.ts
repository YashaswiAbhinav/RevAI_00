import { prisma } from '@/lib/db/postgres'
import { classifyComment, geminiAPI, type CommentClassification } from '@/lib/integrations/gemini'

const ACTIVE_GEMINI_MODEL =
  process.env.GEMINI_MODEL || 'gemini-2.5-flash'

type FirestoreCommentData = {
  userId?: string
  text?: string
  platform?: string
  author?: {
    name?: string
  }
  classification?: {
    type?: 'question' | 'complaint' | 'praise' | 'spam' | 'general'
    confidence?: number
    hasSensitiveKeywords?: boolean
    keywords?: string[]
    sentiment?: 'positive' | 'negative' | 'neutral'
  }
  generatedReply?: {
    text?: string
    generatedAt?: Date
    model?: string
  }
  status?: string
}

type ReplyTone = 'professional' | 'friendly' | 'casual'

export type AutomationResult = {
  reply?: string
  classification?: CommentClassification
  status: 'classified' | 'ready_to_post' | 'rejected'
  reason?: string
  model?: string
}

function shouldAutoQueue(options: {
  autoReplyEnabled: boolean
  minConfidenceScore: number
  replyToTypes: string[]
  classification: CommentClassification
}) {
  const { autoReplyEnabled, minConfidenceScore, replyToTypes, classification } = options

  if (!autoReplyEnabled) {
    return {
      queue: false,
      status: 'classified' as const,
      reason: 'auto_reply_disabled',
    }
  }

  if (classification.type === 'spam') {
    return {
      queue: false,
      status: 'rejected' as const,
      reason: 'spam_detected',
    }
  }

  if (classification.hasSensitiveKeywords) {
    return {
      queue: false,
      status: 'rejected' as const,
      reason: 'sensitive_keywords_detected',
    }
  }

  if (!replyToTypes.includes(classification.type)) {
    return {
      queue: false,
      status: 'rejected' as const,
      reason: 'reply_type_not_allowed',
    }
  }

  if (classification.confidence < minConfidenceScore * 100) {
    return {
      queue: false,
      status: 'rejected' as const,
      reason: 'confidence_below_threshold',
    }
  }

  return {
    queue: true,
    status: 'ready_to_post' as const,
  }
}

function normalizeClassification(
  classification?: FirestoreCommentData['classification']
): CommentClassification | null {
  if (!classification?.type) {
    return null
  }

  return {
    type: classification.type,
    confidence: typeof classification.confidence === 'number' ? classification.confidence : 50,
    hasSensitiveKeywords: Boolean(classification.hasSensitiveKeywords),
    keywords: Array.isArray(classification.keywords) ? classification.keywords : [],
    sentiment: classification.sentiment || 'neutral',
  }
}

function normalizeTone(tone?: string | null): ReplyTone {
  if (tone === 'professional' || tone === 'friendly' || tone === 'casual') {
    return tone
  }

  return 'friendly'
}

export async function processCommentForAutomation(comment: FirestoreCommentData, userId: string): Promise<AutomationResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      autoReplyEnabled: true,
      aiTone: true,
      businessContext: true,
      replySettings: {
        select: {
          minConfidenceScore: true,
          replyToTypes: true,
          tone: true,
          businessContext: true,
          maxReplyLength: true,
        },
      },
    },
  })

  if (!user) {
    throw new Error('User not found')
  }

  const classification = normalizeClassification(comment.classification) ?? await classifyComment(comment.text || '')
  const tone = normalizeTone(user.replySettings?.tone || user.aiTone)
  const businessContext = user.replySettings?.businessContext || user.businessContext || undefined
  const maxReplyLength = user.replySettings?.maxReplyLength || 300
  const minConfidenceScore = user.replySettings?.minConfidenceScore ?? 0.7
  const replyToTypes = user.replySettings?.replyToTypes?.length
    ? user.replySettings.replyToTypes
    : ['question', 'complaint', 'praise', 'general']

  const automationDecision = shouldAutoQueue({
    autoReplyEnabled: user.autoReplyEnabled ?? false,
    minConfidenceScore,
    replyToTypes,
    classification,
  })

  if (!automationDecision.queue) {
    return {
      classification,
      status: automationDecision.status,
      reason: automationDecision.reason,
    }
  }

  const reply = comment.generatedReply?.text ?? await geminiAPI.generateReply({
    commentText: comment.text || '',
    commentType: classification.type,
    businessContext: businessContext || '',
    tone,
    maxLength: maxReplyLength,
  })

  return {
    reply,
    classification,
    status: 'ready_to_post',
    model: ACTIVE_GEMINI_MODEL,
    reason: `queued_with_${tone}_tone_and_max_${maxReplyLength}_chars`,
  }
}
