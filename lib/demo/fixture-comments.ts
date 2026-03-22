import { readFile } from 'fs/promises'
import path from 'path'

export type DemoCommentRecord = {
  id: string
  platform: 'instagram' | 'facebook'
  contentId: string
  contentTitle: string
  author: string
  text: string
  publishedAt: string
  sentiment: 'positive' | 'neutral' | 'negative'
  status: 'pending' | 'classified' | 'ready_to_post' | 'replied' | 'failed' | 'rejected'
}

type FixtureShape = {
  comments?: DemoCommentRecord[]
}

let cachedComments: DemoCommentRecord[] | null = null

export function isDemoFixtureEnabled() {
  return process.env.NEXT_PUBLIC_ENABLE_DEMO_FIXTURES === 'true' || process.env.ENABLE_DEMO_FIXTURES === 'true'
}

export async function loadDemoFixtureComments(): Promise<DemoCommentRecord[]> {
  if (cachedComments) {
    return cachedComments
  }

  try {
    const filePath = path.join(process.cwd(), 'data', 'fixtures', 'facebook-instagram-comments.json')
    const raw = await readFile(filePath, 'utf-8')
    const parsed = JSON.parse(raw) as FixtureShape
    const comments = Array.isArray(parsed.comments) ? parsed.comments : []

    cachedComments = comments.filter((comment) =>
      Boolean(comment.id && comment.platform && comment.contentId && comment.text && comment.publishedAt)
    )

    return cachedComments
  } catch (error) {
    console.error('Failed to load demo fixture comments:', error)
    cachedComments = []
    return cachedComments
  }
}
