import { prisma } from '@/lib/db/postgres'
import { classifyComment, geminiAPI, isLegacyFallbackReply, type CommentClassification } from '@/lib/integrations/gemini'

const ACTIVE_GEMINI_MODEL =
  process.env.GEMINI_MODEL || 'gemini-2.5-flash'

type FirestoreCommentData = {
  userId?: string
  text?: string
  platform?: string
  publishedAt?: Date | string | { toDate?: () => Date }
  fetchedAt?: Date | string | { toDate?: () => Date }
  updatedAt?: Date | string | { toDate?: () => Date }
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

type ProcessCommentOptions = {
  allowDraftGeneration?: boolean
  queueReply?: boolean
  feedback?: string
  forceRegeneration?: boolean
  bypassDelay?: boolean
}

function shouldRejectAutomation(classification: CommentClassification) {
  if (classification.type === 'spam') {
    return {
      reject: true,
      reason: 'spam_detected',
    }
  }

  if (classification.hasSensitiveKeywords) {
    return {
      reject: true,
      reason: 'sensitive_keywords_detected',
    }
  }

  return {
    reject: false,
  }
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

function coerceDate(value: FirestoreCommentData['publishedAt']): Date | null {
  if (!value) {
    return null
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }

  if (typeof value === 'string') {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  if (typeof value === 'object' && typeof value.toDate === 'function') {
    const parsed = value.toDate()
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  return null
}

function isReplyDelaySatisfied(comment: FirestoreCommentData, replyDelayMinutes: number) {
  if (!replyDelayMinutes || replyDelayMinutes <= 0) {
    return true
  }

  const referenceTime =
    coerceDate(comment.publishedAt) ||
    coerceDate(comment.fetchedAt) ||
    coerceDate(comment.updatedAt)

  if (!referenceTime) {
    return true
  }

  return (Date.now() - referenceTime.getTime()) >= (replyDelayMinutes * 60 * 1000)
}

function getReusableReply(comment: FirestoreCommentData, forceRegeneration: boolean) {
  const candidate = comment.generatedReply?.text

  if (forceRegeneration || !candidate || isLegacyFallbackReply(candidate)) {
    return null
  }

  return candidate
}

export async function processCommentForAutomation(
  comment: FirestoreCommentData,
  userId: string,
  options: ProcessCommentOptions = {}
): Promise<AutomationResult> {
  const {
    allowDraftGeneration = false,
    queueReply = true,
    feedback = '',
    forceRegeneration = false,
    bypassDelay = false,
  } = options

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      autoReplyEnabled: true,
      replyDelay: true,
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
  const rejection = shouldRejectAutomation(classification)
  const replyDelay = user.replyDelay ?? 0

  if (rejection.reject) {
    return {
      classification,
      status: 'rejected',
      reason: rejection.reason,
    }
  }

  const automationDecision = shouldAutoQueue({
    autoReplyEnabled: queueReply && (user.autoReplyEnabled ?? false),
    minConfidenceScore,
    replyToTypes,
    classification,
  })

  if (!automationDecision.queue) {
    if (!allowDraftGeneration) {
      return {
        classification,
        status: automationDecision.status,
        reason: automationDecision.reason,
      }
    }

    const reusableReply = getReusableReply(comment, forceRegeneration)
    const reply = reusableReply ?? await geminiAPI.generateReply({
      commentText: comment.text || '',
      commentType: classification.type,
      commentSentiment: classification.sentiment,
      businessContext: businessContext || '',
      tone,
      maxLength: maxReplyLength,
      previousReplies: comment.generatedReply?.text ? [comment.generatedReply.text] : [],
      feedback,
    })

    return {
      reply,
      classification,
      status: 'classified',
      model: ACTIVE_GEMINI_MODEL,
      reason: automationDecision.reason || 'manual_review_required',
    }
  }

  const reusableReply = getReusableReply(comment, forceRegeneration)
  const reply = reusableReply ?? await geminiAPI.generateReply({
    commentText: comment.text || '',
    commentType: classification.type,
    commentSentiment: classification.sentiment,
    businessContext: businessContext || '',
    tone,
    maxLength: maxReplyLength,
    previousReplies: comment.generatedReply?.text ? [comment.generatedReply.text] : [],
    feedback,
  })

  if (!bypassDelay && !isReplyDelaySatisfied(comment, replyDelay)) {
    return {
      reply,
      classification,
      status: 'classified',
      model: ACTIVE_GEMINI_MODEL,
      reason: 'awaiting_reply_delay',
    }
  }

  return {
    reply,
    classification,
    status: 'ready_to_post',
    model: ACTIVE_GEMINI_MODEL,
    reason: `queued_with_${tone}_tone_and_max_${maxReplyLength}_chars`,
  }
}
