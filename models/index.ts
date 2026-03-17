// Database model types and utilities
// These types correspond to the Prisma schema

export type Platform = 'YOUTUBE' | 'INSTAGRAM' | 'FACEBOOK'

export interface User {
  id: string
  email: string
  passwordHash: string
  name?: string
  createdAt: Date
  updatedAt: Date
}

export interface Connection {
  id: string
  userId: string
  platform: Platform
  accessToken: string // Encrypted
  refreshToken?: string // Encrypted
  expiresAt?: Date
  channelId?: string
  channelName?: string
  createdAt: Date
  updatedAt: Date
}

export interface MonitoredContent {
  id: string
  userId: string
  platform: Platform
  platformContentId: string
  title?: string
  isMonitored: boolean
  createdAt: Date
  updatedAt: Date
}

export interface ReplySettings {
  id: string
  userId: string
  businessContext?: string
  minConfidenceScore: number
  replyToTypes: string[]
  tone: string
  maxReplyLength: number
  createdAt: Date
  updatedAt: Date
}

export interface RateLimit {
  id: string
  userId: string
  repliesToday: number
  repliesThisHour: number
  lastReset: Date
  createdAt: Date
  updatedAt: Date
}

// Firestore document types

export interface FirestoreComment {
  id: string
  userId: string
  connectionId: string
  contentId: string
  platform: string
  platformCommentId: string
  text: string
  author: {
    name: string
    profileUrl?: string
    avatarUrl?: string
  }
  publishedAt: Date
  status: 'pending' | 'classified' | 'ready_to_post' | 'replied' | 'failed'
  classification?: {
    type: string
    confidence: number
    hasSensitiveKeywords: boolean
    keywords: string[]
  }
  generatedReply?: {
    text: string
    generatedAt: Date
    model: string
  }
  posted?: {
    isPosted: boolean
    postedAt: Date
    platformReplyId: string
  }
  fetchedAt: Date
  processedAt?: Date
  createdAt: Date
  updatedAt: Date
}

export interface FirestoreReport {
  id: string
  userId: string
  period: {
    startDate: Date
    endDate: Date
  }
  metrics: {
    totalComments: number
    repliedCount: number
    filteredCount: number
    pendingCount: number
    sentiment: {
      positive: number
      neutral: number
      negative: number
    }
    byPlatform: Record<string, {
      comments: number
      replied: number
    }>
  }
  insights: {
    topConcerns: string[]
    topQuestions: string[]
    competitorMentions: string[]
    recommendations: string[]
  }
  generatedAt: Date
  generatedBy: string
  createdAt: Date
}

// API response types

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// Form types

export interface RegisterForm {
  email: string
  password: string
  name?: string
}

export interface LoginForm {
  email: string
  password: string
}

export interface ReplySettingsForm {
  businessContext?: string
  minConfidenceScore: number
  replyToTypes: string[]
  tone: string
  maxReplyLength: number
}

// Platform API types

export interface YouTubeComment {
  id: string
  snippet: {
    textDisplay: string
    authorDisplayName: string
    authorProfileImageUrl?: string
    authorChannelUrl?: string
    publishedAt: string
  }
}

export interface InstagramComment {
  id: string
  text: string
  username: string
  timestamp: string
}

// Utility types

export type CommentStatus = 'pending' | 'classified' | 'ready_to_post' | 'replied' | 'failed'

export type CommentType = 'question' | 'complaint' | 'praise' | 'spam' | 'general'