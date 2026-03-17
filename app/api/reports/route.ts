import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const timeRange = searchParams.get('timeRange') || '7d'

    // Mock data for now - in a real implementation, this would aggregate
    // data from Firestore and PostgreSQL based on the time range
    const mockReportData = {
      totalComments: 156,
      sentimentBreakdown: {
        positive: 68,
        neutral: 22,
        negative: 10,
      },
      topQuestions: [
        'When will the next video be released?',
        'Do you offer tutorials for beginners?',
        'Can I use this for commercial projects?',
      ],
      topConcerns: [
        'Video loading issues',
        'Missing documentation',
        'Feature requests for mobile app',
      ],
      platformStats: {
        youtube: 124,
        instagram: 32,
      },
      recentActivity: [
        { date: '2024-01-15', comments: 23, replies: 18 },
        { date: '2024-01-14', comments: 31, replies: 25 },
        { date: '2024-01-13', comments: 28, replies: 22 },
        { date: '2024-01-12', comments: 19, replies: 15 },
        { date: '2024-01-11', comments: 35, replies: 28 },
      ],
    }

    return NextResponse.json(mockReportData)

  } catch (error) {
    console.error('Error fetching reports:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}