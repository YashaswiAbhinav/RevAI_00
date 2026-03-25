import type { Metadata } from 'next'
import { SessionProvider } from '@/components/SessionProvider'
import './globals.css'

export const metadata: Metadata = {
  title: 'RevAI - Intelligent Social Media Auto-Response',
  description: 'Automate customer engagement on YouTube, Reddit, and Instagram with AI-powered responses',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <SessionProvider>
          {children}
        </SessionProvider>
      </body>
    </html>
  )
}
