import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
const GEMINI_MODEL_CANDIDATES = [
  process.env.GEMINI_MODEL,
  'gemini-2.5-flash',
  'gemini-2.0-flash',
].filter(Boolean) as string[]

export class GeminiAPI {
  private modelName: string

  constructor(modelName = GEMINI_MODEL_CANDIDATES[0]) {
    this.modelName = modelName
  }

  private async generateText(prompt: string): Promise<string> {
    let lastError: unknown

    for (const modelName of GEMINI_MODEL_CANDIDATES) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName })
        const result = await model.generateContent(prompt)
        const response = await result.response
        this.modelName = modelName
        return response.text()
      } catch (error) {
        lastError = error
        const message = String((error as Error)?.message || '')
        const isMissingModel = message.includes('404') || message.includes('not found')

        if (!isMissingModel) {
          throw error
        }
      }
    }

    throw lastError ?? new Error('No supported Gemini model succeeded')
  }

  /**
   * Classify a comment to determine its type and intent
   */
  async classifyComment(commentText: string): Promise<{
    type: 'question' | 'complaint' | 'praise' | 'spam' | 'general'
    confidence: number
    hasSensitiveKeywords: boolean
    keywords: string[]
    sentiment: 'positive' | 'negative' | 'neutral'
  }> {
    const prompt = `
Analyze this social media comment and classify it. Return a JSON object with the following structure:
{
  "type": "question|complaint|praise|spam|general",
  "confidence": 0-100,
  "hasSensitiveKeywords": true|false,
  "keywords": ["keyword1", "keyword2"],
  "sentiment": "positive|negative|neutral"
}

Comment: "${commentText}"

Classification rules:
- question: Asks for information, help, or clarification
- complaint: Expresses dissatisfaction, criticism, or problem
- praise: Expresses satisfaction, appreciation, or positive feedback
- spam: Promotional content, irrelevant, or suspicious
- general: Casual conversation or neutral statements

Confidence should be 0-100 based on how clearly it fits the category.
Look for sensitive keywords like profanity, personal information, or controversial topics.
`

    try {
      const text = await this.generateText(prompt)

      // Parse JSON response
      const classification = JSON.parse(text.trim())

      // Validate and provide defaults
      return {
        type: ['question', 'complaint', 'praise', 'spam', 'general'].includes(classification.type)
          ? classification.type
          : 'general',
        confidence: Math.min(100, Math.max(0, classification.confidence || 50)),
        hasSensitiveKeywords: Boolean(classification.hasSensitiveKeywords),
        keywords: Array.isArray(classification.keywords) ? classification.keywords : [],
        sentiment: ['positive', 'negative', 'neutral'].includes(classification.sentiment)
          ? classification.sentiment
          : 'neutral',
      }
    } catch (error) {
      console.error('Gemini classification error:', error)
      // Return safe defaults on error
      return {
        type: 'general',
        confidence: 50,
        hasSensitiveKeywords: false,
        keywords: [],
        sentiment: 'neutral',
      }
    }
  }

  /**
   * Generate an AI reply based on comment classification and business context
   */
  async generateReply(options: {
    commentText: string
    commentType: string
    businessContext?: string
    tone: 'professional' | 'friendly' | 'casual'
    maxLength?: number
    previousReplies?: string[]
  }): Promise<string> {
    const {
      commentText,
      commentType,
      businessContext = '',
      tone = 'professional',
      maxLength = 500,
      previousReplies = []
    } = options

    const toneDescriptions = {
      professional: 'formal, polite, and business-appropriate',
      friendly: 'warm, approachable, and conversational',
      casual: 'relaxed, informal, and friendly'
    }

    const prompt = `
Generate a helpful response to this social media comment. The response should be ${toneDescriptions[tone]} in tone.

Comment: "${commentText}"
Comment Type: ${commentType}
${businessContext ? `Business Context: ${businessContext}` : ''}
${previousReplies.length > 0 ? `Previous Replies: ${previousReplies.join('; ')}` : ''}

Guidelines:
- Keep the response under ${maxLength} characters
- Be helpful and engaging
- Address the specific concern or question
- Maintain brand voice appropriate for ${tone} communication
- If it's a question, provide useful information
- If it's a complaint, show empathy and offer solutions
- If it's praise, express gratitude
- Avoid generic responses - be specific to the comment
- Do not include hashtags or promotional content unless directly relevant

Response:`

    try {
      let reply = (await this.generateText(prompt)).trim()

      // Ensure reply is within length limit
      if (reply.length > maxLength) {
        reply = reply.substring(0, maxLength - 3) + '...'
      }

      return reply
    } catch (error) {
      console.error('Gemini reply generation error:', error)
      // Return a safe fallback response
      return this.getFallbackReply(commentType, tone)
    }
  }

  /**
   * Generate insights from comment data for reports
   */
  async generateInsights(options: {
    comments: Array<{
      text: string
      type: string
      sentiment: string
      timestamp: Date
    }>
    businessContext?: string
    timeRange: {
      start: Date
      end: Date
    }
  }): Promise<{
    topConcerns: string[]
    topQuestions: string[]
    competitorMentions: string[]
    recommendations: string[]
    summary: string
  }> {
    const { comments, businessContext = '', timeRange } = options

    const commentsText = comments.map(c => c.text).join('\n')
    const types = comments.map(c => c.type)
    const sentiments = comments.map(c => c.sentiment)

    const prompt = `
Analyze these social media comments and provide business insights. Return a JSON object with this structure:
{
  "topConcerns": ["concern1", "concern2", "concern3"],
  "topQuestions": ["question1", "question2", "question3"],
  "competitorMentions": ["competitor1", "competitor2"],
  "recommendations": ["recommendation1", "recommendation2", "recommendation3"],
  "summary": "brief summary of overall sentiment and trends"
}

Comments (${comments.length} total):
${commentsText}

${businessContext ? `Business Context: ${businessContext}` : ''}

Analysis Period: ${timeRange.start.toISOString()} to ${timeRange.end.toISOString()}

Focus on:
- Common customer concerns or pain points
- Frequently asked questions
- Competitor mentions or comparisons
- Actionable recommendations for improvement
- Overall sentiment trends
`

    try {
      const text = await this.generateText(prompt)

      const insights = JSON.parse(text.trim())

      return {
        topConcerns: Array.isArray(insights.topConcerns) ? insights.topConcerns : [],
        topQuestions: Array.isArray(insights.topQuestions) ? insights.topQuestions : [],
        competitorMentions: Array.isArray(insights.competitorMentions) ? insights.competitorMentions : [],
        recommendations: Array.isArray(insights.recommendations) ? insights.recommendations : [],
        summary: insights.summary || 'Analysis completed for the specified time period.',
      }
    } catch (error) {
      console.error('Gemini insights generation error:', error)
      return {
        topConcerns: [],
        topQuestions: [],
        competitorMentions: [],
        recommendations: ['Monitor comments regularly', 'Respond promptly to customer inquiries'],
        summary: 'Unable to generate detailed insights at this time.',
      }
    }
  }

  /**
   * Fallback reply when AI generation fails
   */
  private getFallbackReply(commentType: string, tone: string): string {
    const fallbacks = {
      question: {
        professional: "Thank you for your question. We'll get back to you with more information soon.",
        friendly: "Thanks for asking! We're looking into this and will update you shortly.",
        casual: "Good question! We'll check that out and get back to you."
      },
      complaint: {
        professional: "We apologize for any inconvenience. We're working to resolve this issue.",
        friendly: "Sorry to hear that! We're on it and will make this right.",
        casual: "Oops, sorry about that! We're fixing it right away."
      },
      praise: {
        professional: "Thank you for your kind words. We're glad you're enjoying our content.",
        friendly: "Thanks so much! We're thrilled you like it!",
        casual: "Awesome, thanks! Glad you're enjoying it!"
      },
      general: {
        professional: "Thank you for your comment. We appreciate your engagement.",
        friendly: "Thanks for reaching out! We love hearing from you.",
        casual: "Thanks for the comment! Appreciate it!"
      }
    }

    return fallbacks[commentType as keyof typeof fallbacks]?.[tone as keyof typeof fallbacks.question] ||
           fallbacks.general.professional
  }

  /**
   * Check if the API key is valid and service is available
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.generateText('Hello')
      return true
    } catch (error) {
      console.error('Gemini API health check failed:', error)
      return false
    }
  }
}

// Export singleton instance
export const geminiAPI = new GeminiAPI()

// Export types
export interface CommentClassification {
  type: 'question' | 'complaint' | 'praise' | 'spam' | 'general'
  confidence: number
  hasSensitiveKeywords: boolean
  keywords: string[]
  sentiment: 'positive' | 'negative' | 'neutral'
}

export interface GeneratedReply {
  text: string
  model: string
  generatedAt: Date
}

export interface ReportInsights {
  topConcerns: string[]
  topQuestions: string[]
  competitorMentions: string[]
  recommendations: string[]
  summary: string
}

/**
 * Helper function to classify a comment
 */
export async function classifyComment(commentText: string): Promise<CommentClassification> {
  return await geminiAPI.classifyComment(commentText)
}

/**
 * Helper function to generate a reply
 */
export async function generateReply(
  commentText: string,
  authorName: string,
  platform: string,
  businessContext?: string
): Promise<string> {
  // First classify the comment
  const classification = await classifyComment(commentText)

  // Generate reply based on classification
  return await geminiAPI.generateReply({
    commentText,
    commentType: classification.type,
    businessContext,
    tone: 'friendly', // Default to friendly tone
    maxLength: 300,
  })
}
